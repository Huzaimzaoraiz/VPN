import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../core/database';
import { requireAuth, AuthRequest } from './middlewares/auth';
import { GatewayScheduler } from '../orchestration/scheduler';
import { DesiredStateEngine } from '../orchestration/desired_state';

const router = Router();
router.use(requireAuth);

const createNetworkSchema = z.object({
  name: z.string(),
  cidr: z.string(),
});

router.get('/', async (req: AuthRequest, res) => {
  const user = req.user;
  const tenants = await prisma.tenant.findMany({ where: { ownerId: user.id } });
  const tenantIds = tenants.map(t => t.id);

  const networks = await prisma.network.findMany({
    where: { tenantId: { in: tenantIds } },
    include: { devices: true, assignments: true }
  });
  res.json(networks);
});

router.post('/', async (req: AuthRequest, res) => {
  const data = createNetworkSchema.parse(req.body);
  const user = req.user;

  const tenants = await prisma.tenant.findMany({ where: { ownerId: user.id } });
  if (tenants.length === 0) {
    res.status(403).json({ detail: 'No tenants found for this user.' });
    return;
  }
  const tenant = tenants[0]; // For simplicity, pick the first tenant

  const existing = await prisma.network.findUnique({ where: { cidr: data.cidr } });
  if (existing) {
    res.status(400).json({ detail: 'Network CIDR overlaps or already exists.' });
    return;
  }

  // Find next available VLAN ID
  const maxVlan = await prisma.network.aggregate({
    _max: { vlanId: true }
  });
  const vlanId = (maxVlan._max.vlanId || 99) + 1;

  const network = await prisma.network.create({
    data: {
      name: data.name,
      cidr: data.cidr,
      vlanId,
      tenantId: tenant.id
    }
  });

  // Assign to best gateway
  const gateways = await prisma.gateway.findMany();
  const bestGateway = GatewayScheduler.selectBestGateway(gateways);

  if (bestGateway) {
    await prisma.gatewayAssignment.create({
      data: {
        networkId: network.id,
        gatewayId: bestGateway.id
      }
    });
    // Trigger Desired State rebuild
    await DesiredStateEngine.generateGatewayDesiredState(bestGateway.id);
  }

  res.status(201).json(network);
});

export default router;
