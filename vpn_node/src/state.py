from dataclasses import dataclass, field
from typing import List, Optional

@dataclass
class WireguardPeerState:
    device_id: str
    public_key: str
    allowed_ips: List[str]
    keepalive: int = 25
    endpoint: Optional[str] = None
    last_handshake: int = 0
    rx_bytes: int = 0
    tx_bytes: int = 0

@dataclass
class WireguardInterfaceState:
    interface: str
    listen_port: int
    public_key: str
    peers: List[WireguardPeerState] = field(default_factory=list)
    addresses: List[str] = field(default_factory=list)

@dataclass
class OvsTenantState:
    network_id: str
    vlan_id: int
    cidr: str
    gateway_ip: str

@dataclass
class OvsFlowState:
    table: int
    priority: int
    match: str
    actions: str

@dataclass
class OvsState:
    bridge: str
    tenants: List[OvsTenantState] = field(default_factory=list)
    flows: List[OvsFlowState] = field(default_factory=list)

@dataclass
class RouteState:
    destination: str
    next_hop: str
    interface: str = "wg0"

@dataclass
class FirewallRuleState:
    source_cidr: str
    destination_cidr: str
    protocol: str = "all"
    port: Optional[int] = None
    action: str = "drop"

@dataclass
class FirewallState:
    default_policy: str = "drop"
    isolated_networks: List[str] = field(default_factory=list)
    rules: List[FirewallRuleState] = field(default_factory=list)

@dataclass
class AgentFullState:
    version: int
    gateway_id: str
    wireguard: WireguardInterfaceState
    ovs: OvsState
    routes: List[RouteState] = field(default_factory=list)
    firewall: FirewallState = field(default_factory=FirewallState)
