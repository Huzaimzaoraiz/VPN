import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { prisma } from '../core/database';
import { DesiredStateEngine } from '../orchestration/desired_state';

const PROTO_PATH = path.resolve(__dirname, '../../../proto/vpn_node.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const vpnNodeProto = protoDescriptor.vpn.vpn_node;

// Map of gatewayId to ServerWritableStream
const connectedNodes = new Map<string, grpc.ServerWritableStream<any, any>>();

export interface GatewayTelemetry {
  cpu_usage: number;
  memory_usage: number;
  active_peers: number;
  bytes_rx: number;
  bytes_tx: number;
  last_heartbeat: Date;
}

export const gatewayTelemetryMap = new Map<string, GatewayTelemetry>();

export const VpnNodeControlServiceImpl = {
  RegisterVpnNode: async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    try {
      const metadata = call.metadata.get('authorization');
      const incomingToken = metadata.length > 0 ? (metadata[0] as string).replace('Bearer ', '') : null;

      if (!incomingToken) {
        return callback({ code: grpc.status.UNAUTHENTICATED, details: 'Missing NODE_TOKEN' }, null);
      }

      const req = call.request;

      // Look up the token in the database
      const validToken = await prisma.gatewayToken.findUnique({
        where: { token: incomingToken }
      });

      if (!validToken) {
        return callback({ code: grpc.status.UNAUTHENTICATED, details: 'Invalid Token' }, null);
      }

      if (validToken.isUsed) {
        if (validToken.nodeId !== req.node_id) {
          return callback({ code: grpc.status.UNAUTHENTICATED, details: 'Token already used by another Node' }, null);
        }
        // Token is used but belongs to this specific node ID - it's a restart, allow it
      }

      let gateway = await prisma.gateway.findUnique({ where: { nodeId: req.node_id } });
      
      if (!gateway) {
        gateway = await prisma.gateway.create({
          data: {
            nodeId: req.node_id,
            hostname: req.hostname,
            publicKey: req.public_key,
            publicIp: req.public_ip,
            listenPort: req.listen_port,
            capacity: req.capacity,
            region: req.region,
            status: "READY",
          }
        });
      } else {
        gateway = await prisma.gateway.update({
          where: { id: gateway.id },
          data: {
            hostname: req.hostname,
            publicKey: req.public_key,
            publicIp: req.public_ip,
            listenPort: req.listen_port,
            capacity: req.capacity,
            status: "READY"
          }
        });
      }

      // Burn the token (mark as used and bind to this nodeId)
      if (!validToken.isUsed) {
        await prisma.gatewayToken.update({
          where: { id: validToken.id },
          data: {
            isUsed: true,
            nodeId: req.node_id
          }
        });
      }

      // --- AUTOMATED NETWORK RECOVERY ---
      // Sweep for any unassigned networks and assign them to this gateway
      const strandedNetworks = await prisma.network.findMany({
        where: {
          assignments: { none: {} }
        }
      });

      if (strandedNetworks.length > 0) {
        console.log(`[Recovery] Found ${strandedNetworks.length} stranded networks. Assigning to gateway ${gateway.hostname}...`);
        for (const network of strandedNetworks) {
          await prisma.gatewayAssignment.create({
            data: {
              networkId: network.id,
              gatewayId: gateway.id
            }
          });
        }
        // Generate desired state so the gateway instantly configures the rescued networks
        await DesiredStateEngine.generateGatewayDesiredState(gateway.id);
      }
      // ----------------------------------

      callback(null, {
        gateway_id: gateway.id,
        registered: true,
        initial_version: 1
      });
    } catch (error: any) {
      callback({ code: grpc.status.INTERNAL, details: error.message }, null);
    }
  },

  WatchDesiredState: (call: grpc.ServerWritableStream<any, any>) => {
    const gatewayId = call.request.gateway_id;
    console.log(`VPN Node ${gatewayId} connected to WatchDesiredState`);
    
    connectedNodes.set(gatewayId, call);

    const cleanup = () => {
      console.log(`VPN Node ${gatewayId} stream closed/error`);
      connectedNodes.delete(gatewayId);
    };

    call.on('cancelled', cleanup);
    call.on('error', cleanup);
    call.on('end', cleanup);

    // Send current desired state immediately if exists
    prisma.gatewayDesiredState.findUnique({ where: { gatewayId } })
      .then(state => {
        if (state) {
          call.write({
            gateway_id: gatewayId,
            version: state.version,
            checksum: state.checksum,
            state_json: JSON.stringify(state.stateJson)
          });
        }
      });
  },

  ReportActualState: async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    try {
      const req = call.request;
      await prisma.gatewayActualState.upsert({
        where: { gatewayId: req.gateway_id },
        update: {
          version: req.version,
          stateJson: JSON.parse(req.state_json),
          status: req.success ? "SYNCED" : "ERROR",
          errorMessage: req.error_message
        },
        create: {
          gatewayId: req.gateway_id,
          version: req.version,
          stateJson: JSON.parse(req.state_json),
          status: req.success ? "SYNCED" : "ERROR",
          errorMessage: req.error_message
        }
      });
      callback(null, { acknowledged: true });
    } catch (error: any) {
      callback({ code: grpc.status.INTERNAL, details: error.message }, null);
    }
  },

  ReportHeartbeat: async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    try {
      const req = call.request;
      const now = new Date();

      gatewayTelemetryMap.set(req.gateway_id, {
        cpu_usage: req.cpu_usage || 0,
        memory_usage: req.memory_usage || 0,
        active_peers: req.active_peers || 0,
        bytes_rx: Number(req.bytes_rx) || 0,
        bytes_tx: Number(req.bytes_tx) || 0,
        last_heartbeat: now
      });

      await prisma.gateway.update({
        where: { id: req.gateway_id },
        data: { lastHeartbeat: now }
      });
      callback(null, { healthy: true, force_reconcile: false });
    } catch (error: any) {
      callback({ code: grpc.status.INTERNAL, details: error.message }, null);
    }
  }
};

/**
 * Utility to push a new desired state to an active stream
 */
export function pushDesiredStateToVpnNode(gatewayId: string, desiredState: any) {
  const stream = connectedNodes.get(gatewayId);
  if (stream) {
    console.log(`Pushing new desired state v${desiredState.version} to active VPN node ${gatewayId}`);
    stream.write({
      gateway_id: gatewayId,
      version: desiredState.version,
      checksum: desiredState.checksum,
      state_json: typeof desiredState.stateJson === 'string' ? desiredState.stateJson : JSON.stringify(desiredState.stateJson)
    });
  }
}
