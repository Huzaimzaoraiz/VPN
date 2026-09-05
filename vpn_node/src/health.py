import logging
from vpn_node.src.metrics import MetricsCollector, SystemMetrics

logger = logging.getLogger("HealthMonitor")

class HealthMonitor:
    def __init__(self):
        self.metrics_collector = MetricsCollector()

    def check_health(self, active_peers: int = 0) -> tuple[bool, SystemMetrics]:
        metrics = self.metrics_collector.collect(active_peers)
        
        # Consider healthy if CPU < 95% and Memory < 95%
        is_healthy = metrics.cpu_usage < 95.0 and metrics.memory_usage < 95.0
        if not is_healthy:
            logger.warning(f"Gateway health degraded: CPU={metrics.cpu_usage}%, Mem={metrics.memory_usage}%")
            
        return is_healthy, metrics
