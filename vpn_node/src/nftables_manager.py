import subprocess
import logging
from vpn_node.src.config import node_settings
from vpn_node.src.state import FirewallState

logger = logging.getLogger("NftablesManager")

class NftablesManager:
    def __init__(self, wan_interface: str = node_settings.WAN_INTERFACE):
        self.wan_interface = wan_interface
        self._mock_ruleset = ""

    def generate_ruleset(self, firewall: FirewallState) -> str:
        """
        Compiles an atomic, declarative nftables ruleset string.
        """
        lines = [
            "#!/usr/sbin/nft -f",
            "flush table inet vpn_filter",
            "flush table inet vpn_nat",
            "",
            "table inet vpn_filter {",
            "    chain forward {",
            "        type filter hook forward priority 0; policy drop;",
            "",
            "        # Allow established and related connections",
            "        ct state established,related accept",
            ""
        ]

        # 1. Allow intra-network traffic for each tenant network
        for cidr in firewall.isolated_networks:
            lines.append(f"        ip saddr {cidr} ip daddr {cidr} accept")

        # 2. Allow egress to WAN for internet access
        for cidr in firewall.isolated_networks:
            lines.append(f"        ip saddr {cidr} oifname \"{self.wan_interface}\" accept")

        # 3. Explicitly drop cross-tenant traffic between all pairs of isolated networks
        for i, src_cidr in enumerate(firewall.isolated_networks):
            for j, dst_cidr in enumerate(firewall.isolated_networks):
                if i != j:
                    lines.append(f"        ip saddr {src_cidr} ip daddr {dst_cidr} drop")

        # 4. Custom user firewall rules
        for rule in firewall.rules:
            action = rule.action.lower()
            proto = rule.protocol.lower() if rule.protocol else "all"
            if proto in ("tcp", "udp"):
                proto_clause = f" {proto}"
                port_clause = f" dport {rule.port}" if rule.port else ""
            elif rule.port:
                proto_clause = " meta l4proto {tcp, udp}"
                port_clause = f" th dport {rule.port}"
            elif proto != "all":
                proto_clause = f" ip protocol {proto}"
                port_clause = ""
            else:
                proto_clause = ""
                port_clause = ""

            lines.append(f"        ip saddr {rule.source_cidr} ip daddr {rule.destination_cidr}{proto_clause}{port_clause} {action}")

        lines.extend([
            "    }",
            "}",
            "",
            "table inet vpn_nat {",
            "    chain postrouting {",
            "        type nat hook postrouting priority srcnat; policy accept;",
        ])

        # Masquerade outbound traffic on WAN interface
        for cidr in firewall.isolated_networks:
            lines.append(f"        oifname \"{self.wan_interface}\" ip saddr {cidr} masquerade")

        lines.extend([
            "    }",
            "}",
            ""
        ])

        return "\n".join(lines)

    def apply_ruleset(self, firewall: FirewallState):
        """
        Atomically loads the compiled nftables configuration.
        """
        ruleset = self.generate_ruleset(firewall)
        if node_settings.MOCK_NETWORKING:
            self._mock_ruleset = ruleset
            logger.info(f"[MOCK] Atomic nftables ruleset compiled ({len(ruleset.splitlines())} lines).")
            return

        try:
            cmd = ["nft", "-f", "-"]
            subprocess.run(cmd, input=ruleset.encode("utf-8"), check=True)
            logger.info("Successfully loaded atomic nftables ruleset.")
        except Exception as e:
            logger.error(f"Failed to apply nftables ruleset: {e}")
            raise
