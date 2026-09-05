import asyncio
import json
import logging
import signal
from typing import Optional
from vpn_node.src.config import node_settings
from vpn_node.src.identity import IdentityManager
from vpn_node.src.state import (
    AgentFullState,
    WireguardInterfaceState,
    WireguardPeerState,
    OvsState,
    OvsTenantState,
    OvsFlowState,
    RouteState,
    FirewallState,
    FirewallRuleState
)
from vpn_node.src.wireguard_manager import WireGuardManager
from vpn_node.src.ovs_manager import OVSManager
from vpn_node.src.routing_manager import RoutingManager
from vpn_node.src.nftables_manager import NftablesManager
from vpn_node.src.reconciler import Reconciler
from vpn_node.src.health import HealthMonitor
from vpn_node.src.controller_client import ControllerClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (%(name)s) %(message)s"
)
logger = logging.getLogger("VPNAgentMain")

class VPNAgentDaemon:
    def __init__(self):
        self.identity = IdentityManager.load_or_create_identity()
        self.controller = ControllerClient(self.identity)
        self.wg_mgr = WireGuardManager()
        self.ovs_mgr = OVSManager()
        self.route_mgr = RoutingManager()
        self.nft_mgr = NftablesManager()
        self.reconciler = Reconciler(self.wg_mgr, self.ovs_mgr, self.route_mgr, self.nft_mgr)
        self.health_mon = HealthMonitor()
        
        self.latest_desired: Optional[AgentFullState] = None
        self.running = True

    def parse_desired_state(self, data: dict) -> AgentFullState:
        wg_data = data.get("wireguard", {})
        peers = [
            WireguardPeerState(
                device_id=p.get("device_id", ""),
                public_key=p["public_key"],
                allowed_ips=p.get("allowed_ips", []),
                keepalive=p.get("keepalive", 25)
            ) for p in wg_data.get("peers", [])
        ]
        wg_state = WireguardInterfaceState(
            interface=wg_data.get("interface", "wg0"),
            listen_port=wg_data.get("listen_port", 51820),
            public_key=self.identity.public_key,
            peers=peers
        )

        ovs_data = data.get("ovs", {})
        tenants = [
            OvsTenantState(
                network_id=t["network_id"],
                vlan_id=t["vlan_id"],
                cidr=t["cidr"],
                gateway_ip=t.get("gateway_ip", "")
            ) for t in ovs_data.get("tenants", [])
        ]
        flows = [
            OvsFlowState(
                table=f.get("table", 0),
                priority=f.get("priority", 100),
                match=f.get("match", ""),
                actions=f.get("actions", "drop")
            ) for f in ovs_data.get("flows", [])
        ]
        ovs_state = OvsState(
            bridge=ovs_data.get("bridge", "br-vpn"),
            tenants=tenants,
            flows=flows
        )

        routes = [
            RouteState(
                destination=r["destination"],
                next_hop=r["next_hop"],
                interface=r.get("interface", "wg0")
            ) for r in data.get("routes", [])
        ]

        fw_data = data.get("firewall", {})
        fw_rules = [
            FirewallRuleState(
                source_cidr=r["source_cidr"],
                destination_cidr=r["destination_cidr"],
                protocol=r.get("protocol", "all"),
                port=r.get("port"),
                action=r.get("action", "drop")
            ) for r in fw_data.get("rules", [])
        ]
        fw_state = FirewallState(
            default_policy=fw_data.get("default_policy", "drop"),
            isolated_networks=fw_data.get("isolated_networks", []),
            rules=fw_rules
        )

        return AgentFullState(
            version=data.get("version", 1),
            gateway_id=data.get("gateway_id", self.controller.gateway_id),
            wireguard=wg_state,
            ovs=ovs_state,
            routes=routes,
            firewall=fw_state
        )

    async def heartbeat_loop(self):
        logger.info("Starting heartbeat reporting loop...")
        while self.running:
            try:
                active_peers = len(self.wg_mgr.inspect_actual_peers())
                _, metrics = self.health_mon.check_health(active_peers)
                await self.controller.report_heartbeat(metrics, self.reconciler.last_reconciled_version)
            except Exception as e:
                logger.warning(f"Error sending heartbeat: {e}")
            await asyncio.sleep(node_settings.HEARTBEAT_INTERVAL)

    async def desired_state_listener(self, initial_version: int):
        logger.info("Listening for desired state updates from Controller...")
        while self.running:
            try:
                async for state_dict in self.controller.watch_desired_state(self.reconciler.last_reconciled_version):
                    desired = self.parse_desired_state(state_dict)
                    self.latest_desired = desired
                    success, err = self.reconciler.reconcile(desired, self.identity.private_key)
                    
                    actual_state = self.reconciler.inspect_actual_state()
                    actual_dict = {
                        "peers_count": len(actual_state.wireguard.peers),
                        "flows_count": len(actual_state.ovs.flows),
                        "routes_count": len(actual_state.routes)
                    }
                    await self.controller.report_actual_state(
                        desired.version,
                        json.dumps(actual_dict),
                        success,
                        err
                    )
            except Exception as e:
                logger.warning(f"Desired state connection lost ({e}), reconnecting in 5s...")
                await asyncio.sleep(5.0)

    async def drift_check_loop(self):
        """
        Anti-drift loop: Periodically re-inspects actual state.
        If an OVS flow, WireGuard peer, or route disappeared, reconciles immediately.
        """
        logger.info("Starting anti-drift self-healing monitor...")
        while self.running:
            await asyncio.sleep(node_settings.RECONCILE_INTERVAL)
            if not self.latest_desired:
                continue

            try:
                actual = self.reconciler.inspect_actual_state()
                diff = self.reconciler.calculate_diff(self.latest_desired, actual)
                if diff["has_changes"]:
                    logger.warning("Configuration drift detected! Self-healing missing rules/peers...")
                    self.reconciler.reconcile(self.latest_desired, self.identity.private_key)
            except Exception as e:
                logger.error(f"Error during anti-drift check: {e}")

    async def run(self):
        logger.info("==================================================")
        logger.info(f"Starting Multi-Tenant Overlay VPN Gateway Agent")
        logger.info(f"Node ID: {self.identity.node_id}")
        logger.info(f"Public IP: {self.identity.public_ip}")
        logger.info(f"WireGuard Public Key: {self.identity.public_key}")
        logger.info("==================================================")

        await self.controller.connect()
        init_version = await self.controller.register()

        tasks = [
            asyncio.create_task(self.heartbeat_loop()),
            asyncio.create_task(self.desired_state_listener(init_version)),
            asyncio.create_task(self.drift_check_loop())
        ]
        
        await asyncio.gather(*tasks)

    def stop(self):
        self.running = False

async def main():
    agent = VPNAgentDaemon()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, agent.stop)
        except NotImplementedError:
            pass

    try:
        await agent.run()
    finally:
        await agent.controller.close()

if __name__ == "__main__":
    asyncio.run(main())
