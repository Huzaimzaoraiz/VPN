import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { env } from '../config/env';
import { VpnNodeControlServiceImpl } from './service';

const PROTO_PATH = path.resolve(__dirname, '../../../../proto/vpn_node.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const vpnNodeProto = protoDescriptor.vpn.vpn_node;

export function startGrpcServer() {
  const server = new grpc.Server();
  
  server.addService(vpnNodeProto.VpnNodeControlService.service, VpnNodeControlServiceImpl);
  
  const listenAddr = `${env.GRPC_HOST}:${env.GRPC_PORT}`;
  
  server.bindAsync(listenAddr, grpc.ServerCredentials.createInsecure(), (error, port) => {
    if (error) {
      console.error("❌ Failed to start gRPC server:", error);
      return;
    }
    console.log(`✅ gRPC VpnNodeControlService listening on ${listenAddr}`);
    server.start();
  });
}
