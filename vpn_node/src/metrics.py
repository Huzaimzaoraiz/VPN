import psutil
from dataclasses import dataclass

@dataclass
class SystemMetrics:
    cpu_usage: float
    memory_usage: float
    active_peers: int
    bytes_rx: int
    bytes_tx: int

class MetricsCollector:
    @staticmethod
    def collect(active_peers_count: int = 0) -> SystemMetrics:
        cpu = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory().percent
        net_io = psutil.net_io_counters()

        return SystemMetrics(
            cpu_usage=round(cpu, 1),
            memory_usage=round(mem, 1),
            active_peers=active_peers_count,
            bytes_rx=net_io.bytes_recv if net_io else 0,
            bytes_tx=net_io.bytes_sent if net_io else 0
        )
