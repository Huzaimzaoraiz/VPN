import { Router } from 'express';
import { prisma } from '../core/database';
import { requireAuth, AuthRequest } from './middlewares/auth';
import { DesiredStateEngine } from '../orchestration/desired_state';

const router = Router();
router.use(requireAuth);

router.delete('/:id', async (req: AuthRequest, res) => {
  const tenants = await prisma.tenant.findMany({ where: { ownerId: req.user.id } });
  const tenantIds = tenants.map(t => t.id);

  const route = await prisma.route.findFirst({
    where: { 
      id: req.params.id,
      network: { tenantId: { in: tenantIds } }
    },
    include: { network: { include: { assignments: true } } }
  });

  if (!route) {
    res.status(404).json({ detail: 'Route not found' });
    return;
  }

  await prisma.route.delete({ where: { id: req.params.id } });

  if (route.network) {
    for (const assignment of route.network.assignments) {
      await DesiredStateEngine.generateGatewayDesiredState(assignment.gatewayId);
    }
  }

  res.status(204).send();
});

export default router;
