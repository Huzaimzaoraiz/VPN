import { Router } from 'express';
import { prisma } from '../core/database';
import { requireAuth, AuthRequest } from './middlewares/auth';
import { DesiredStateEngine } from '../orchestration/desired_state';

const router = Router();
router.use(requireAuth);

router.delete('/:id', async (req: AuthRequest, res) => {
  const device = await prisma.device.findUnique({
    where: { id: req.params.id },
    include: { network: { include: { assignments: true } } }
  });

  if (!device) {
    res.status(404).json({ detail: 'Device not found' });
    return;
  }

  await prisma.device.delete({ where: { id: req.params.id } });

  // Trigger Desired State rebuild for all assigned gateways
  if (device.network) {
    for (const assignment of device.network.assignments) {
      await DesiredStateEngine.generateGatewayDesiredState(assignment.gatewayId);
    }
  }

  res.status(204).send();
});

export default router;
