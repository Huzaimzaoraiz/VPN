import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../core/database';
import { requireAuth, requireSuperAdmin, AuthRequest } from './middlewares/auth';
import { DesiredStateEngine } from '../orchestration/desired_state';
import { GatewayScheduler } from '../orchestration/scheduler';
import { gatewayTelemetryMap } from '../grpc/service';

import * as crypto from 'crypto';

const router = Router();
router.use(requireAuth);
router.use(requireSuperAdmin);

const activeFailovers = new Set<string>();
router.post('/generate-token', async (req: AuthRequest, res) => {
  const rawToken = crypto.randomBytes(24).toString('hex');
  const tokenString = `vpn_tok_${rawToken}`;
  
  await prisma.gatewayToken.create({
    data: {
      token: tokenString,
      isUsed: false
    }
  });
  
  res.status(201).json({ token: tokenString });
});

function formatGateway(gw: any) {
  const telemetry = gatewayTelemetryMap.get(gw.id) || {
    cpu_usage: 0,
    memory_usage: 0,
    active_peers: 0,
    bytes_rx: 0,
    bytes_tx: 0,
    last_heartbeat: gw.lastHeartbeat
  };

  return {
    ...gw,
    node_id: gw.nodeId,
    public_ip: gw.publicIp,
    listen_port: gw.listenPort,
    public_key: gw.publicKey,
    cpu_usage: telemetry.cpu_usage,
    memory_usage: telemetry.memory_usage,
    current_sessions: telemetry.active_peers,
    bytes_rx: telemetry.bytes_rx,
    bytes_tx: telemetry.bytes_tx,
  };
}

const createGatewaySchema = z.object({
  node_id: z.string(),
  hostname: z.string(),
  public_ip: z.string(),
  listen_port: z.number().default(51820),
  public_key: z.string(),
  region: z.string().default("us-east-1"),
  provider: z.string().default("aws"),
  capacity: z.number().default(1000)
});

router.get('/', async (req: AuthRequest, res) => {
  const gateways = await prisma.gateway.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(gateways.map(formatGateway));
});

router.post('/', async (req: AuthRequest, res) => {
  const data = createGatewaySchema.parse(req.body);

  const existing = await prisma.gateway.findUnique({ where: { nodeId: data.node_id } });
  if (existing) {
    res.status(400).json({ detail: 'Gateway with this node_id already exists.' });
    return;
  }

  const gateway = await prisma.gateway.create({
    data: {
      nodeId: data.node_id,
      hostname: data.hostname,
      publicIp: data.public_ip,
      listenPort: data.listen_port,
      publicKey: data.public_key,
      region: data.region,
      provider: data.provider,
      status: "READY",
      capacity: data.capacity
    }
  });

  await DesiredStateEngine.generateGatewayDesiredState(gateway.id);
  res.status(201).json(formatGateway(gateway));
});

router.get('/:id', async (req: AuthRequest, res) => {
  const gateway = await prisma.gateway.findUnique({ where: { id: req.params.id } });
  if (!gateway) {
    res.status(404).json({ detail: 'Gateway not found' });
    return;
  }
  res.json(formatGateway(gateway));
});

router.delete('/:id', async (req: AuthRequest, res) => {
  const gatewayId = req.params.id;
  const gateway = await prisma.gateway.findUnique({ where: { id: gatewayId } });
  if (!gateway) {
    res.status(404).json({ detail: 'Gateway not found' });
    return;
  }

  const assignments = await prisma.gatewayAssignment.findMany({ where: { gatewayId } });
  if (assignments.length > 0) {
    res.status(400).json({ detail: 'Cannot delete gateway. It has active network assignments. Trigger a failover first.' });
    return;
  }

  await prisma.gatewayDesiredState.deleteMany({ where: { gatewayId } });
  await prisma.gatewayToken.deleteMany({ where: { nodeId: gateway.nodeId } });
  await prisma.gateway.delete({ where: { id: gatewayId } });

  res.status(204).send();
});

router.post('/:id/failover', async (req: AuthRequest, res) => {
  const gatewayId = req.params.id;

  if (activeFailovers.has(gatewayId)) {
    res.status(429).json({ detail: 'A failover is already in progress for this gateway.' });
    return;
  }

  activeFailovers.add(gatewayId);
  try {
    const gateway = await prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gateway) {
      res.status(404).json({ detail: 'Gateway not found' });
      return;
    }

    // Mark this gateway degraded / failed
  await prisma.gateway.update({
    where: { id: gatewayId },
    data: { status: 'DEGRADED' }
  });

  // Find all current assignments
  const assignments = await prisma.gatewayAssignment.findMany({
    where: { gatewayId }
  });

  // Find alternative healthy gateways
  const otherGateways = await prisma.gateway.findMany({
    where: {
      id: { not: gatewayId },
      status: 'READY'
    }
  });

  const bestOtherGateway = GatewayScheduler.selectBestGateway(otherGateways);
  let migratedCount = 0;

  if (bestOtherGateway && assignments.length > 0) {
    for (const a of assignments) {
      await prisma.gatewayAssignment.update({
        where: { id: a.id },
        data: { gatewayId: bestOtherGateway.id }
      });
      migratedCount++;
    }

    // Rebuild desired states for both old and new gateways
    await DesiredStateEngine.generateGatewayDesiredState(gatewayId);
    await DesiredStateEngine.generateGatewayDesiredState(bestOtherGateway.id);
  }

  res.json({
    status: 'Failover completed',
    migrated_networks_count: migratedCount,
    failed_gateway_id: gatewayId,
    target_gateway_id: bestOtherGateway ? bestOtherGateway.id : null
  });
  } finally {
    activeFailovers.delete(gatewayId);
  }
});

router.get('/:id/health', async (req: AuthRequest, res) => {
  const gateway = await prisma.gateway.findUnique({ where: { id: req.params.id } });
  if (!gateway) {
    res.status(404).json({ detail: 'Gateway not found' });
    return;
  }

  const score = GatewayScheduler.calculateScore(gateway);
  let secondsAgo = null;
  let isHealthy = gateway.status === 'READY';

  if (gateway.lastHeartbeat) {
    const diff = (new Date().getTime() - gateway.lastHeartbeat.getTime()) / 1000;
    secondsAgo = Math.round(diff * 10) / 10;
    if (diff > 30) {
      isHealthy = false;
    }
  }

  res.json({
    gateway_id: gateway.id,
    hostname: gateway.hostname,
    status: gateway.status,
    healthy: isHealthy,
    last_heartbeat_seconds_ago: secondsAgo,
    load_score: Math.round(score * 10) / 10
  });
});

export default router;
