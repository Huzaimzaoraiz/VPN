import { Gateway } from "@prisma/client";
import { gatewayTelemetryMap } from "../grpc/service";

export class GatewayScheduler {
  /**
   * Evaluates the health score of a gateway based on telemetry metrics.
   * Lower score is better.
   */
  static calculateScore(gateway: Gateway, metrics?: any): number {
    const telemetry = metrics || gatewayTelemetryMap.get(gateway.id) || { cpu: 0, bw: 0, sessions: 0, latency: 0 };
    const W_CPU = 0.40;
    const W_BW = 0.30;
    const W_SESSIONS = 0.20;
    const W_LATENCY = 0.10;

    const cpu = telemetry.cpu ?? telemetry.cpu_usage ?? 0;
    const bw = telemetry.bw ?? 0;
    const sessions = telemetry.sessions ?? telemetry.active_peers ?? 0;
    const latency = telemetry.latency ?? 0;

    return (W_CPU * cpu) + (W_BW * bw) + (W_SESSIONS * sessions) + (W_LATENCY * latency);
  }

  static selectBestGateway(gateways: Gateway[]): Gateway | null {
    const readyGateways = gateways.filter(gw => gw.status === "READY");
    if (readyGateways.length === 0) return null;

    // Sort by capacity and some deterministic logic if telemetry isn't available
    readyGateways.sort((a, b) => this.calculateScore(a) - this.calculateScore(b));
    return readyGateways[0];
  }
}
