import { Gateway } from "@prisma/client";

export class GatewayScheduler {
  /**
   * Evaluates the health score of a gateway based on telemetry metrics.
   * Lower score is better.
   * Note: Since Prisma Gateway model doesn't explicitly store metrics right now,
   * we simulate or pass metrics via telemetry structures if we tracked them.
   * For parity with Python backend, we assign new networks to the best gateway.
   */
  static calculateScore(gateway: Gateway, metrics: any = { cpu: 0, bw: 0, sessions: 0, latency: 0 }): number {
    const W_CPU = 0.40;
    const W_BW = 0.30;
    const W_SESSIONS = 0.20;
    const W_LATENCY = 0.10;

    return (W_CPU * metrics.cpu) + (W_BW * metrics.bw) + (W_SESSIONS * metrics.sessions) + (W_LATENCY * metrics.latency);
  }

  static selectBestGateway(gateways: Gateway[]): Gateway | null {
    const readyGateways = gateways.filter(gw => gw.status === "READY");
    if (readyGateways.length === 0) return null;

    // Sort by capacity and some deterministic logic if telemetry isn't available
    readyGateways.sort((a, b) => this.calculateScore(a) - this.calculateScore(b));
    return readyGateways[0];
  }
}
