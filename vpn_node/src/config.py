import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class VpnNodeSettings(BaseSettings):
    NODE_ID: str = os.getenv("NODE_ID", "gateway-us-east-01")
    HOSTNAME: str = os.getenv("HOSTNAME", "gw-01.vpn.internal")
    CONTROLLER_GRPC_URL: str = os.getenv("CONTROLLER_GRPC_URL", "localhost:50051")
    PUBLIC_IP: str = os.getenv("PUBLIC_IP", "127.0.0.1")
    LISTEN_PORT: int = int(os.getenv("LISTEN_PORT", "51820"))
    REGION: str = os.getenv("REGION", "us-east-1")
    SOFTWARE_VERSION: str = "1.0.0"
    
    # WireGuard configuration
    WG_INTERFACE: str = "wg0"
    WG_KEY_PATH: str = os.getenv("WG_KEY_PATH", "/tmp/wg_gateway.key")
    
    # Open vSwitch configuration
    OVS_BRIDGE: str = "br-vpn"
    
    # WAN Interface for egress NAT
    WAN_INTERFACE: str = os.getenv("WAN_INTERFACE", "eth0")
    
    # Operating mode: mock if running on non-Linux kernel for local testing
    MOCK_NETWORKING: bool = os.getenv("MOCK_NETWORKING", "false").lower() in ("true", "1", "yes")

    # Reconciliation loop frequency (seconds)
    RECONCILE_INTERVAL: float = 15.0
    HEARTBEAT_INTERVAL: float = 5.0

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")

node_settings = VpnNodeSettings()
