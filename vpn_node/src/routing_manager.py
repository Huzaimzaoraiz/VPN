import subprocess
import logging
from typing import List
from vpn_node.src.config import node_settings
from vpn_node.src.state import RouteState

logger = logging.getLogger("RoutingManager")

class RoutingManager:
    def __init__(self):
        self._mock_routes: dict[str, RouteState] = {}

    def add_route(self, route: RouteState):
        """
        Adds or replaces a route in Linux kernel routing table.
        """
        if node_settings.MOCK_NETWORKING:
            self._mock_routes[route.destination] = route
            logger.info(f"[MOCK] Added Route: {route.destination} via {route.next_hop} dev {route.interface}")
            return

        try:
            # WireGuard interfaces are point-to-point (NOARP). Specifying next-hop gateway can cause EINVAL.
            if route.interface.startswith("wg") or not route.next_hop:
                cmd = ["ip", "route", "replace", route.destination, "dev", route.interface]
            else:
                cmd = ["ip", "route", "replace", route.destination, "via", route.next_hop, "dev", route.interface]
            subprocess.run(cmd, check=True)
            logger.info(f"Installed route: {route.destination} on {route.interface}")
        except Exception as e:
            try:
                cmd = ["ip", "route", "replace", route.destination, "dev", route.interface]
                subprocess.run(cmd, check=True)
                logger.info(f"Installed route (dev fallback): {route.destination} dev {route.interface}")
            except Exception as e2:
                logger.error(f"Failed to add route {route.destination}: {e2}")
                raise

    def delete_route(self, destination: str, interface: str = "wg0"):
        """
        Deletes a route from the Linux routing table.
        """
        if node_settings.MOCK_NETWORKING:
            self._mock_routes.pop(destination, None)
            logger.info(f"[MOCK] Deleted Route: {destination}")
            return

        try:
            cmd = ["ip", "route", "del", destination, "dev", interface]
            subprocess.run(cmd, check=False)
            logger.info(f"Deleted route: {destination}")
        except Exception as e:
            logger.warning(f"Could not delete route {destination}: {e}")

    def inspect_actual_routes(self, interface: str = "wg0") -> List[RouteState]:
        """
        Inspects actual routes bound to the interface using standard ip route CLI.
        """
        if node_settings.MOCK_NETWORKING:
            return list(self._mock_routes.values())

        routes = []
        try:
            res = subprocess.run(["ip", "-4", "route", "show", "dev", interface], capture_output=True, text=True, check=True)
            for line in res.stdout.strip().splitlines():
                parts = line.strip().split()
                if not parts:
                    continue
                dst = parts[0]
                if "/" not in dst:
                    dst = f"{dst}/32"
                next_hop = ""
                if "via" in parts:
                    via_idx = parts.index("via")
                    if via_idx + 1 < len(parts):
                        next_hop = parts[via_idx + 1]
                routes.append(RouteState(
                    destination=dst,
                    next_hop=next_hop,
                    interface=interface
                ))
        except Exception as e:
            logger.warning(f"Could not inspect actual routes via ip route: {e}")

        return routes
