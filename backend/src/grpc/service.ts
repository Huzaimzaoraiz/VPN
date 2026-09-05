import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { prisma } from '../core/database';

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

export const VpnNodeControlServiceImpl = {
  RegisterVpnNode: async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    try {
      const req = call.request;
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

    // If stream ends, remove from map
    call.on('cancelled', () => {
      console.log(`VPN Node ${gatewayId} cancelled stream`);
      connectedNodes.delete(gatewayId);
    });

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
      await prisma.gateway.update({
        where: { id: req.gateway_id },
        data: { lastHeartbeat: new Date() }
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
    stream.write({
      gateway_id: gatewayId,
      version: desiredState.version,
      checksum: desiredState.checksum,
      state_json: JSON.stringify(desiredState.stateJson)
    });
  }
}
