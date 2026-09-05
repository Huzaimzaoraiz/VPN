import logging
from typing import Tuple
from vpn_node.src.state import (
    AgentFullState,
    WireguardPeerState,
    OvsFlowState,
    RouteState
)
from vpn_node.src.wireguard_manager import WireGuardManager
from vpn_node.src.ovs_manager import OVSManager
from vpn_node.src.routing_manager import RoutingManager
from vpn_node.src.nftables_manager import NftablesManager

logger = logging.getLogger("Reconciler")

class Reconciler:
    def __init__(
        self,
        wg_manager: WireGuardManager,
        ovs_manager: OVSManager,
        routing_manager: RoutingManager,
        nft_manager: NftablesManager
    ):
        self.wg = wg_manager
        self.ovs = ovs_manager
        self.routing = routing_manager
        self.nft = nft_manager
        self.last_reconciled_version = 0

    def inspect_actual_state(self) -> AgentFullState:
        """
        Gathers live actual state from the Linux kernel, WireGuard, OVS, and routing tables.
        """
        actual_peers = self.wg.inspect_actual_peers()
        actual_flows = self.ovs.inspect_actual_flows()
        actual_routes = self.routing.inspect_actual_routes()

        from vpn_node.src.state import WireguardInterfaceState, OvsState, FirewallState
        return AgentFullState(
            version=self.last_reconciled_version,
            gateway_id="",
            wireguard=WireguardInterfaceState(
                interface=self.wg.interface,
                listen_port=51820,
                public_key="",
                peers=actual_peers
            ),
            ovs=OvsState(
                bridge=self.ovs.bridge,
                tenants=[],
                flows=actual_flows
            ),
            routes=actual_routes,
            firewall=FirewallState()
        )

    def calculate_diff(
        self,
        desired: AgentFullState,
        actual: AgentFullState
    ) -> dict:
        """
        Calculates diff between desired and actual state.
        Returns dictionary of additions, updates, and deletions needed.
        """
        # WireGuard diff
        actual_peers_map = {p.public_key: p for p in actual.wireguard.peers}
        desired_peers_map = {p.public_key: p for p in desired.wireguard.peers}

        wg_to_add: list[WireguardPeerState] = []
        wg_to_remove: list[str] = []

        for pub_key, desired_peer in desired_peers_map.items():
            if pub_key not in actual_peers_map:
                wg_to_add.append(desired_peer)
            else:
                # Check if allowed IPs changed
                act_peer = actual_peers_map[pub_key]
                if set(desired_peer.allowed_ips) != set(act_peer.allowed_ips):
                    wg_to_add.append(desired_peer)

        for pub_key in actual_peers_map:
            if pub_key not in desired_peers_map:
                wg_to_remove.append(pub_key)

        # OVS Flow diff
        actual_flows_set = {
            (f.table, f.priority, f.match.strip(), f.actions.strip())
            for f in actual.ovs.flows
        }
        ovs_to_add: list[OvsFlowState] = []
        for flow in desired.ovs.flows:
            flow_key = (flow.table, flow.priority, flow.match.strip(), flow.actions.strip())
            if flow_key not in actual_flows_set:
                ovs_to_add.append(flow)

        # Route diff
        actual_routes_map = {r.destination: r.next_hop for r in actual.routes}
        desired_routes_map = {r.destination: r.next_hop for r in desired.routes}

        routes_to_add: list[RouteState] = []
        routes_to_remove: list[str] = []

        for dest, next_hop in desired_routes_map.items():
            if dest not in actual_routes_map or actual_routes_map[dest] != next_hop:
                routes_to_add.append(RouteState(destination=dest, next_hop=next_hop, interface=self.wg.interface))

        for dest in actual_routes_map:
            if dest not in desired_routes_map:
                routes_to_remove.append(dest)

        return {
            "wg_to_add": wg_to_add,
            "wg_to_remove": wg_to_remove,
            "ovs_to_add": ovs_to_add,
            "routes_to_add": routes_to_add,
            "routes_to_remove": routes_to_remove,
            "has_changes": (
                bool(wg_to_add) or bool(wg_to_remove) or
                bool(ovs_to_add) or bool(routes_to_add) or
                bool(routes_to_remove)
            )
        }

    def reconcile(self, desired: AgentFullState, private_key: str) -> Tuple[bool, str]:
        """
        Core reconciliation algorithm:
        1. Ensure base interface & bridge
        2. Calculate diff between desired and actual
        3. Apply diff idempotently
        4. Reapply atomic firewall ruleset
        5. Verify state
        """
        try:
            logger.info(f"Reconciling state version {desired.version} (current: {self.last_reconciled_version})")

            # 1. Base infrastructure
            self.wg.ensure_interface(desired.wireguard.listen_port, private_key)
            self.ovs.ensure_bridge()

            # 2. Inspect actual state and calculate diff
            actual = self.inspect_actual_state()
            diff = self.calculate_diff(desired, actual)

            # 3. Apply WireGuard changes
            for peer in diff["wg_to_add"]:
                self.wg.add_or_update_peer(peer)

            for pub_key in diff["wg_to_remove"]:
                self.wg.remove_peer(pub_key)

            # 4. Apply OVS changes (flows)
            for flow in diff["ovs_to_add"]:
                self.ovs.install_flow(flow)

            # 5. Apply Route changes
            for r in diff["routes_to_add"]:
                self.routing.add_route(r)

            for dest in diff["routes_to_remove"]:
                self.routing.delete_route(dest, interface=self.wg.interface)

            # 6. Apply Firewall & NAT ruleset atomically
            self.nft.apply_ruleset(desired.firewall)

            self.last_reconciled_version = desired.version
            logger.info(f"Successfully reconciled state to version {desired.version}")
            return True, ""
        except Exception as e:
            logger.error(f"Reconciliation error at version {desired.version}: {e}", exc_info=True)
            return False, str(e)
