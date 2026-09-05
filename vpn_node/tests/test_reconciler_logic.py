import pytest
from vpn_node.src.state import (
    AgentFullState,
    WireguardInterfaceState,
    WireguardPeerState,
    OvsState,
    OvsFlowState,
    RouteState,
    FirewallState
)
from vpn_node.src.wireguard_manager import WireGuardManager
from vpn_node.src.ovs_manager import OVSManager
from vpn_node.src.routing_manager import RoutingManager
from vpn_node.src.nftables_manager import NftablesManager
from vpn_node.src.reconciler import Reconciler
from vpn_node.src.config import node_settings

# Force mock mode for test execution
node_settings.MOCK_NETWORKING = True

@pytest.fixture
def reconciler():
    wg = WireGuardManager()
    ovs = OVSManager()
    routing = RoutingManager()
    nft = NftablesManager()
    return Reconciler(wg, ovs, routing, nft)

def test_reconciler_initial_diff_and_apply(reconciler):
    peer1 = WireguardPeerState(
        device_id="d1",
        public_key="pubkey_device_1_1111111111111111111111111111111=",
        allowed_ips=["10.100.0.10/32"]
    )
    flow1 = OvsFlowState(
        table=0,
        priority=100,
        match="ip,nw_src=10.100.0.0/24,nw_dst=10.100.0.0/24",
        actions="mod_vlan_vid:100,resubmit(,1)"
    )
    desired = AgentFullState(
        version=1,
        gateway_id="gw-1",
        wireguard=WireguardInterfaceState("wg0", 51820, "pubkey_gw", [peer1]),
        ovs=OvsState("br-vpn", [], [flow1]),
        routes=[RouteState("192.168.50.0/24", "10.100.0.10", "wg0")],
        firewall=FirewallState()
    )

    # 1. Initial reconciliation
    success, err = reconciler.reconcile(desired, "mock_priv_key")
    assert success is True
    assert err == ""

    # 2. Inspect actual state - must match desired
    actual = reconciler.inspect_actual_state()
    assert len(actual.wireguard.peers) == 1
    assert actual.wireguard.peers[0].public_key == peer1.public_key
    assert len(actual.ovs.flows) == 1
    assert len(actual.routes) == 1

    # 3. Idempotency test: diff against actual must have no changes
    diff = reconciler.calculate_diff(desired, actual)
    assert diff["has_changes"] is False
    assert len(diff["wg_to_add"]) == 0
    assert len(diff["ovs_to_add"]) == 0

def test_reconciler_anti_drift_restores_deleted_resources(reconciler):
    peer1 = WireguardPeerState(
        device_id="d1",
        public_key="pubkey_drift_test_111111111111111111111111111=",
        allowed_ips=["10.100.0.10/32"]
    )
    flow1 = OvsFlowState(
        table=0,
        priority=100,
        match="ip,nw_src=10.100.0.0/24",
        actions="resubmit(,1)"
    )
    desired = AgentFullState(
        version=1,
        gateway_id="gw-1",
        wireguard=WireguardInterfaceState("wg0", 51820, "pubkey_gw", [peer1]),
        ovs=OvsState("br-vpn", [], [flow1]),
        routes=[],
        firewall=FirewallState()
    )

    # Apply desired
    reconciler.reconcile(desired, "mock_priv_key")

    # SIMULATE CONFIGURATION DRIFT:
    # Admin manually deletes the OVS flow and the WireGuard peer!
    reconciler.ovs.remove_flow("ip,nw_src=10.100.0.0/24")
    reconciler.wg.remove_peer(peer1.public_key)

    # Inspect drifted state
    drifted_actual = reconciler.inspect_actual_state()
    assert len(drifted_actual.wireguard.peers) == 0
    assert len(drifted_actual.ovs.flows) == 0

    # Calculate diff - Reconciler must detect that the peer and flow are missing
    diff = reconciler.calculate_diff(desired, drifted_actual)
    assert diff["has_changes"] is True
    assert len(diff["wg_to_add"]) == 1
    assert len(diff["ovs_to_add"]) == 1

    # Reconcile self-heals the drift!
    success, _ = reconciler.reconcile(desired, "mock_priv_key")
    assert success is True

    # Check restored state
    healed_actual = reconciler.inspect_actual_state()
    assert len(healed_actual.wireguard.peers) == 1
    assert len(healed_actual.ovs.flows) == 1
