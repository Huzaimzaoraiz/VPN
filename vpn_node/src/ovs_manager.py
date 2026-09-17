import subprocess
import logging
import re
from typing import List
from vpn_node.src.config import node_settings
from vpn_node.src.state import OvsFlowState

logger = logging.getLogger("OVSManager")

class OVSManager:
    def __init__(self, bridge: str = node_settings.OVS_BRIDGE):
        self.bridge = bridge
        self._mock_flows: dict[str, OvsFlowState] = {}
        self._mock_bridge_created = False
        self._ovs_warned = False

    def is_available(self) -> bool:
        if node_settings.MOCK_NETWORKING:
            return True
        try:
            check = subprocess.run(["ovs-vsctl", "--timeout=2", "show"], capture_output=True, text=True)
            return check.returncode == 0
        except Exception:
            return False

    def ensure_bridge(self):
        """
        Idempotently creates the integration OVS bridge.
        """
        if node_settings.MOCK_NETWORKING:
            self._mock_bridge_created = True
            logger.info(f"[MOCK] OVS bridge {self.bridge} ensured.")
            return

        if not self.is_available():
            if not self._ovs_warned:
                logger.warning(f"Open vSwitch daemons (ovsdb-server/ovs-vswitchd) not running. Skipping OVS bridge {self.bridge}; kernel nftables provides tenant isolation.")
                self._ovs_warned = True
            return

        try:
            # Check if bridge exists
            check = subprocess.run(["ovs-vsctl", "br-exists", self.bridge], capture_output=True)
            if check.returncode != 0:
                subprocess.run(["ovs-vsctl", "add-br", self.bridge], check=True)
                logger.info(f"Created OVS bridge {self.bridge}")
            
            # Bring up bridge interface in Linux
            subprocess.run(["ip", "link", "set", "up", "dev", self.bridge], check=True)
        except Exception as e:
            logger.error(f"Error ensuring OVS bridge {self.bridge}: {e}")

    def install_flow(self, flow: OvsFlowState):
        """
        Installs an OpenFlow rule into the OVS bridge.
        """
        flow_key = f"table={flow.table},{flow.match}"
        if node_settings.MOCK_NETWORKING:
            self._mock_flows[flow_key] = flow
            logger.info(f"[MOCK] Installed OVS Flow: table={flow.table}, priority={flow.priority}, match='{flow.match}', actions='{flow.actions}'")
            return

        if not self.is_available():
            return

        try:
            match_part = f"{flow.match}," if flow.match else ""
            flow_str = f"table={flow.table},priority={flow.priority},{match_part}actions={flow.actions}"
            cmd = ["ovs-ofctl", "add-flow", self.bridge, flow_str]
            subprocess.run(cmd, check=True)
            logger.info(f"Installed flow on {self.bridge}: {flow_str}")
        except Exception as e:
            logger.warning(f"Could not install OVS flow on {self.bridge}: {e}")

    def remove_flow(self, match: str, table: int = 0):
        """
        Deletes matching flow from OVS table.
        """
        flow_key = f"table={table},{match}"
        if node_settings.MOCK_NETWORKING:
            self._mock_flows.pop(flow_key, None)
            logger.info(f"[MOCK] Removed OVS Flow matching '{match}' on table {table}")
            return

        if not self.is_available():
            return

        try:
            filter_str = f"table={table}"
            if match:
                filter_str += f",{match}"
            cmd = ["ovs-ofctl", "del-flows", self.bridge, filter_str]
            subprocess.run(cmd, check=True)
            logger.info(f"Removed flows from {self.bridge}: {filter_str}")
        except Exception as e:
            logger.warning(f"Could not delete flow from {self.bridge}: {e}")

    def inspect_actual_flows(self) -> List[OvsFlowState]:
        """
        Inspects live OpenFlow rules on the bridge via `ovs-ofctl dump-flows`.
        """
        if node_settings.MOCK_NETWORKING:
            return list(self._mock_flows.values())

        if not self.is_available():
            return []

        flows = []
        try:
            res = subprocess.run(["ovs-ofctl", "dump-flows", self.bridge], capture_output=True, text=True, check=True)
            lines = res.stdout.strip().split("\n")
            for line in lines:
                if "actions=" in line:
                    # Example line:
                    # cookie=0x0, duration=10.5s, table=0, n_packets=0, n_bytes=0, priority=100,ip,nw_src=10.100.0.0/24 actions=mod_vlan_vid:100
                    table_match = re.search(r'table=(\d+)', line)
                    priority_match = re.search(r'priority=(\d+)', line)
                    actions_match = re.search(r'actions=(.*)$', line)

                    table = int(table_match.group(1)) if table_match else 0
                    priority = int(priority_match.group(1)) if priority_match else 100
                    actions = actions_match.group(1).strip() if actions_match else ""

                    # Extract match conditions
                    # Split on 'actions=' then take the part before it after priority
                    parts = line.split("actions=")[0]
                    if priority_match:
                        match_str = parts[priority_match.end():].strip().rstrip(",")
                    else:
                        match_str = ""

                    flows.append(OvsFlowState(
                        table=table,
                        priority=priority,
                        match=match_str,
                        actions=actions
                    ))
        except Exception as e:
            logger.warning(f"Could not inspect live OVS flows on {self.bridge}: {e}")

        return flows
