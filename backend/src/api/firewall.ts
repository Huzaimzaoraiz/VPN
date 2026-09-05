import { Router } from 'express';
import { prisma } from '../core/database';
import { requireAuth, AuthRequest } from './middlewares/auth';
import { DesiredStateEngine } from '../orchestration/desired_state';

const router = Router();
router.use(requireAuth);

router.delete('/rules/:id', async (req: AuthRequest, res) => {
  const rule = await prisma.firewallRule.findUnique({
    where: { id: req.params.id },
    include: { network: { include: { assignments: true } } }
  });

  if (!rule) {
    res.status(404).json({ detail: 'Firewall rule not found' });
    return;
  }

  await prisma.firewallRule.delete({ where: { id: req.params.id } });

  if (rule.network) {
    for (const assignment of rule.network.assignments) {
      await DesiredStateEngine.generateGatewayDesiredState(assignment.gatewayId);
    }
  }

  res.status(204).send();
});

export default router;
