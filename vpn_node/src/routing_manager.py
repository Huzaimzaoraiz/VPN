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
        Adds a route using pyroute2 Netlink socket.
        """
        if node_settings.MOCK_NETWORKING:
            self._mock_routes[route.destination] = route
            logger.info(f"[MOCK] Added Route: {route.destination} via {route.next_hop} dev {route.interface}")
            return

        try:
            from pyroute2 import IPRoute
            with IPRoute() as ipr:
                idx = ipr.link_lookup(ifname=route.interface)
                if not idx:
                    logger.warning(f"Interface {route.interface} not found when adding route.")
                    return
                oif = idx[0]
                # WireGuard interfaces are point-to-point (NOARP). Specifying next-hop gateway causes EINVAL.
                if route.interface.startswith("wg") or not route.next_hop:
                    ipr.route("replace", dst=route.destination, oif=oif)
                    logger.info(f"Installed WireGuard interface route: {route.destination} dev {route.interface}")
                else:
                    try:
                        ipr.route("replace", dst=route.destination, gateway=route.next_hop, oif=oif)
                        logger.info(f"Installed route: {route.destination} via {route.next_hop} on {route.interface}")
                    except Exception:
                        ipr.route("replace", dst=route.destination, oif=oif)
                        logger.info(f"Installed route: {route.destination} dev {route.interface}")
        except Exception as e:
            logger.error(f"Failed to add route {route.destination}: {e}")
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
            from pyroute2 import IPRoute
            with IPRoute() as ipr:
                idx = ipr.link_lookup(ifname=interface)
                if idx:
                    ipr.route("del", dst=destination, oif=idx[0])
                    logger.info(f"Deleted route: {destination}")
        except Exception as e:
            logger.warning(f"Could not delete route {destination}: {e}")

    def inspect_actual_routes(self, interface: str = "wg0") -> List[RouteState]:
        """
        Inspects actual routes bound to the interface using pyroute2 Netlink.
        """
        if node_settings.MOCK_NETWORKING:
            return list(self._mock_routes.values())

        routes = []
        try:
            from pyroute2 import IPRoute
            with IPRoute() as ipr:
                idx = ipr.link_lookup(ifname=interface)
                if not idx:
                    return []
                dev_idx = idx[0]
                for r in ipr.get_routes(family=2): # AF_INET
                    oif = r.get_attr("RTA_OIF")
                    if oif == dev_idx:
                        dst = r.get_attr("RTA_DST")
                        dst_len = r.get("dst_len", 32)
                        gateway = r.get_attr("RTA_GATEWAY") or ""
                        if dst:
                            routes.append(RouteState(
                                destination=f"{dst}/{dst_len}",
                                next_hop=gateway,
                                interface=interface
                            ))
        except Exception as e:
            logger.warning(f"Could not inspect actual routes via pyroute2: {e}")

        return routes
