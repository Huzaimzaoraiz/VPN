import grpc
import json
import logging
from typing import AsyncGenerator
from vpn_node.src.config import node_settings
from vpn_node.src.identity import GatewayIdentity
from vpn_node.src.metrics import SystemMetrics
from vpn_node.src import vpn_node_pb2, vpn_node_pb2_grpc

logger = logging.getLogger("ControllerClient")

class ControllerClient:
    def __init__(self, identity: GatewayIdentity):
        self.identity = identity
        self.channel = None
        self.stub = None
        self.gateway_id = ""

    async def connect(self):
        url = node_settings.CONTROLLER_GRPC_URL
        logger.info(f"Connecting to Controller gRPC service at {url}")
        self.channel = grpc.aio.insecure_channel(url)
        self.stub = vpn_node_pb2_grpc.VpnNodeControlServiceStub(self.channel)

    async def register(self) -> int:
        req = vpn_node_pb2.RegisterVpnNodeRequest(
            node_id=self.identity.node_id,
            hostname=self.identity.hostname,
            public_key=self.identity.public_key,
            public_ip=self.identity.public_ip,
            listen_port=self.identity.listen_port,
            software_version=node_settings.SOFTWARE_VERSION,
            region=self.identity.region,
            capacity=1000
        )
        resp = await self.stub.RegisterVpnNode(req)
        self.gateway_id = resp.gateway_id
        logger.info(f"Registered successfully with Controller. Assigned Gateway ID: {self.gateway_id}, initial version: {resp.initial_version}")
        return resp.initial_version

    async def watch_desired_state(self, current_version: int) -> AsyncGenerator[dict, None]:
        req = vpn_node_pb2.WatchDesiredStateRequest(
            gateway_id=self.gateway_id,
            current_version=current_version
        )
        async for envelope in self.stub.WatchDesiredState(req):
            logger.info(f"Received new desired state version {envelope.version} (checksum: {envelope.checksum[:8]}...)")
            try:
                state_dict = json.loads(envelope.state_json)
                yield state_dict
            except Exception as e:
                logger.error(f"Failed to parse received desired state JSON: {e}")

    async def report_actual_state(self, version: int, state_json: str, success: bool, error_msg: str = ""):
        req = vpn_node_pb2.ReportActualStateRequest(
            gateway_id=self.gateway_id,
            version=version,
            state_json=state_json,
            success=success,
            error_message=error_msg
        )
        await self.stub.ReportActualState(req)

    async def report_heartbeat(self, metrics: SystemMetrics, last_version: int):
        req = vpn_node_pb2.HeartbeatRequest(
            gateway_id=self.gateway_id,
            cpu_usage=metrics.cpu_usage,
            memory_usage=metrics.memory_usage,
            active_peers=metrics.active_peers,
            bytes_rx=metrics.bytes_rx,
            bytes_tx=metrics.bytes_tx,
            last_reconciled_version=last_version
        )
        await self.stub.ReportHeartbeat(req)

    async def close(self):
        if self.channel:
            await self.channel.close()
