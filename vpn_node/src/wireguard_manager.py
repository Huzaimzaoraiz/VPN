import subprocess
import logging
from typing import List
from vpn_node.src.config import node_settings
from vpn_node.src.state import WireguardPeerState

logger = logging.getLogger("WireGuardManager")

class WireGuardManager:
    def __init__(self, interface: str = node_settings.WG_INTERFACE):
        self.interface = interface
        self._mock_peers: dict[str, WireguardPeerState] = {}

    def ensure_interface(self, listen_port: int, private_key: str):
        """
        Creates and brings up the WireGuard interface using kernel netlink / ip link.
        """
        if node_settings.MOCK_NETWORKING:
            logger.info(f"[MOCK] WireGuard interface {self.interface} created on port {listen_port}")
            return

        try:
            # Check if interface exists
            check = subprocess.run(["ip", "link", "show", self.interface], capture_output=True)
            if check.returncode != 0:
                subprocess.run(["ip", "link", "add", "dev", self.interface, "type", "wireguard"], check=True)

            # Write private key temporarily to stdin of wg set
            set_cmd = ["wg", "set", self.interface, "listen-port", str(listen_port), "private-key", "/dev/stdin"]
            subprocess.run(set_cmd, input=private_key.encode("utf-8"), check=True)

            # Bring interface UP
            subprocess.run(["ip", "link", "set", "up", "dev", self.interface], check=True)
            logger.info(f"WireGuard interface {self.interface} is UP on port {listen_port}")
        except Exception as e:
            logger.error(f"Error ensuring WireGuard interface: {e}")
            if not node_settings.MOCK_NETWORKING:
                raise

    def add_or_update_peer(self, peer: WireguardPeerState):
        """
        Idempotently adds or updates a WireGuard peer.
        """
        if node_settings.MOCK_NETWORKING:
            self._mock_peers[peer.public_key] = peer
            logger.info(f"[MOCK] Added/updated WireGuard peer: {peer.public_key} with AllowedIPs: {peer.allowed_ips}")
            return

        try:
            allowed_ips_str = ",".join(peer.allowed_ips)
            cmd = [
                "wg", "set", self.interface,
                "peer", peer.public_key,
                "allowed-ips", allowed_ips_str,
                "persistent-keepalive", str(peer.keepalive)
            ]
            subprocess.run(cmd, check=True)
            logger.info(f"Configured peer {peer.public_key} on {self.interface} (AllowedIPs: {allowed_ips_str})")
        except Exception as e:
            logger.error(f"Failed to configure WireGuard peer {peer.public_key}: {e}")
            raise

    def remove_peer(self, public_key: str):
        """
        Removes a peer from the WireGuard interface.
        """
        if node_settings.MOCK_NETWORKING:
            self._mock_peers.pop(public_key, None)
            logger.info(f"[MOCK] Removed WireGuard peer: {public_key}")
            return

        try:
            cmd = ["wg", "set", self.interface, "peer", public_key, "remove"]
            subprocess.run(cmd, check=True)
            logger.info(f"Removed peer {public_key} from {self.interface}")
        except Exception as e:
            logger.error(f"Failed to remove WireGuard peer {public_key}: {e}")

    def inspect_actual_peers(self) -> List[WireguardPeerState]:
        """
        Inspects actual WireGuard peers running in the Linux kernel using `wg show <ifname> dump`.
        """
        if node_settings.MOCK_NETWORKING:
            return list(self._mock_peers.values())

        peers = []
        try:
            res = subprocess.run(["wg", "show", self.interface, "dump"], capture_output=True, text=True, check=True)
            lines = res.stdout.strip().split("\n")
            # First line is interface details: private-key public-key listen-port fwmark
            # Subsequent lines are peer details: public-key preshared-key endpoint allowed-ips latest-handshake rx-bytes tx-bytes persistent-keepalive
            for line in lines[1:]:
                parts = line.split("\t")
                if len(parts) >= 8:
                    pub_key = parts[0]
                    endpoint = parts[2] if parts[2] != "(none)" else None
                    allowed = [ip.strip() for ip in parts[3].split(",") if ip.strip()]
                    handshake = int(parts[4])
                    rx = int(parts[5])
                    tx = int(parts[6])
                    keepalive = int(parts[7]) if parts[7] != "off" else 0

                    peers.append(WireguardPeerState(
                        device_id="",
                        public_key=pub_key,
                        allowed_ips=allowed,
                        keepalive=keepalive,
                        endpoint=endpoint,
                        last_handshake=handshake,
                        rx_bytes=rx,
                        tx_bytes=tx
                    ))
        except Exception as e:
            logger.warning(f"Could not inspect live WireGuard interface {self.interface}: {e}")

        return peers
