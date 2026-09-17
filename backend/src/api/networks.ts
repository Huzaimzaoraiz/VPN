import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../core/database';
import { requireAuth, AuthRequest } from './middlewares/auth';
import { GatewayScheduler } from '../orchestration/scheduler';
import { DesiredStateEngine } from '../orchestration/desired_state';
import { IPAMService } from '../services/ipam_service';

const router = Router();
router.use(requireAuth);

const createNetworkSchema = z.object({
  name: z.string(),
  cidr: z.string().optional(),
});

router.get('/', async (req: AuthRequest, res) => {
  const user = req.user;
  const tenants = await prisma.tenant.findMany({ where: { ownerId: user.id } });
  const tenantIds = tenants.map(t => t.id);

  const networks = await prisma.network.findMany({
    where: { tenantId: { in: tenantIds } },
    include: { devices: true, assignments: { include: { gateway: true } } }
  });
  res.json(networks.map(n => ({
    ...n,
    vlan_id: n.vlanId,
    device_count: n.devices.length,
    assigned_gateway_id: n.assignments.length > 0 ? n.assignments[0].gatewayId : null,
    assigned_gateway_hostname: n.assignments.length > 0 ? n.assignments[0].gateway.hostname : null,
  })));
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

  if (data.cidr) {
    const existing = await prisma.network.findUnique({ where: { cidr: data.cidr } });
    if (existing) {
      res.status(400).json({ detail: 'Network CIDR overlaps or already exists.' });
      return;
    }
  }

  // Find next available VLAN ID
  const maxVlan = await prisma.network.aggregate({
    _max: { vlanId: true }
  });
  const vlanId = (maxVlan._max.vlanId || 99) + 1;
  
  const finalCidr = data.cidr || `10.${vlanId % 255}.0.0/24`;

  const network = await prisma.network.create({
    data: {
      name: data.name,
      cidr: finalCidr,
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

  res.status(201).json({
    ...network,
    vlan_id: network.vlanId,
    device_count: 0,
    assigned_gateway_id: bestGateway ? bestGateway.id : null,
    assigned_gateway_hostname: bestGateway ? bestGateway.hostname : null,
  });
});

router.get('/:id', async (req: AuthRequest, res) => {
  const network = await prisma.network.findUnique({
    where: { id: req.params.id },
    include: { devices: true, assignments: { include: { gateway: true } } }
  });
  if (!network) {
    res.status(404).json({ detail: 'Network not found' });
    return;
  }
  res.json({
    ...network,
    vlan_id: network.vlanId,
    device_count: network.devices.length,
    assigned_gateway_id: network.assignments.length > 0 ? network.assignments[0].gatewayId : null,
    assigned_gateway_hostname: network.assignments.length > 0 ? network.assignments[0].gateway.hostname : null,
  });
});

// --- NESTED ROUTES FOR NETWORK SUB-RESOURCES ---

const createDeviceSchema = z.object({
  name: z.string(),
  public_key: z.string(),
  is_exit_node: z.boolean().optional().default(false),
});

router.get('/:id/devices', async (req: AuthRequest, res) => {
  const devices = await prisma.device.findMany({ where: { networkId: req.params.id } });
  // Map Prisma snake_case response back for frontend expectation if necessary
  res.json(devices.map(d => ({
    ...d,
    public_key: d.publicKey,
    vpn_ip: d.vpnIp,
    is_exit_node: d.isExitNode
  })));
});

router.post('/:id/devices', async (req: AuthRequest, res) => {
  const data = createDeviceSchema.parse(req.body);
  const network = await prisma.network.findUnique({
    where: { id: req.params.id },
    include: { devices: true, assignments: true }
  });
  if (!network) {
    res.status(404).json({ detail: 'Network not found' });
    return;
  }

  const usedIps = network.devices.map(d => d.vpnIp);
  const vpnIp = IPAMService.allocateNextIp(network.cidr, usedIps);
  if (!vpnIp) {
    res.status(400).json({ detail: 'Network CIDR exhausted' });
    return;
  }

  const device = await prisma.device.create({
    data: {
      name: data.name,
      publicKey: data.public_key,
      vpnIp,
      isExitNode: data.is_exit_node,
      networkId: network.id
    }
  });

  for (const assignment of network.assignments) {
    await DesiredStateEngine.generateGatewayDesiredState(assignment.gatewayId);
  }

  const gateway = network.assignments.length > 0 ? await prisma.gateway.findUnique({ where: { id: network.assignments[0].gatewayId } }) : null;

  res.status(201).json({
    device_id: device.id,
    name: device.name,
    vpn_ip: device.vpnIp,
    subnet_cidr: network.cidr,
    gateway_endpoint: gateway ? `${gateway.publicIp}:${gateway.listenPort}` : 'WAITING_FOR_GATEWAY',
    gateway_public_key: gateway ? gateway.publicKey : 'WAITING_FOR_GATEWAY',
    dns_servers: ['1.1.1.1', '8.8.8.8'],
    allowed_ips: data.is_exit_node ? ['0.0.0.0/0'] : [network.cidr],
    keepalive: 25,
    wireguard_conf_text: '' // Frontend builds it
  });
});

const createRouteSchema = z.object({
  destination_cidr: z.string(),
  next_hop_vpn_ip: z.string(),
  description: z.string().optional(),
});

router.get('/:id/routes', async (req: AuthRequest, res) => {
  const routes = await prisma.route.findMany({ where: { networkId: req.params.id } });
  res.json(routes.map(r => ({
    ...r,
    destination_cidr: r.destinationCidr,
    next_hop_vpn_ip: r.nextHopVpnIp
  })));
});

router.post('/:id/routes', async (req: AuthRequest, res) => {
  const data = createRouteSchema.parse(req.body);
  const route = await prisma.route.create({
    data: {
      destinationCidr: data.destination_cidr,
      nextHopVpnIp: data.next_hop_vpn_ip,
      networkId: req.params.id
    }
  });

  const network = await prisma.network.findUnique({
    where: { id: req.params.id },
    include: { assignments: true }
  });
  if (network) {
    for (const assignment of network.assignments) {
      await DesiredStateEngine.generateGatewayDesiredState(assignment.gatewayId);
    }
  }

  res.status(201).json({
    ...route,
    destination_cidr: route.destinationCidr,
    next_hop_vpn_ip: route.nextHopVpnIp
  });
});

const createFirewallRuleSchema = z.object({
  action: z.enum(['allow', 'drop']),
  protocol: z.string(),
  source_cidr: z.string(),
  destination_cidr: z.string(),
  port: z.number().nullable().optional(),
  priority: z.number().default(100),
});

router.get('/:id/firewall/rules', async (req: AuthRequest, res) => {
  const rules = await prisma.firewallRule.findMany({
    where: { networkId: req.params.id }
  });
  res.json(rules.map(r => ({
    ...r,
    source_cidr: r.sourceCidr,
    destination_cidr: r.destinationCidr
  })));
});

router.post('/:id/firewall/rules', async (req: AuthRequest, res) => {
  const data = createFirewallRuleSchema.parse(req.body);
  const rule = await prisma.firewallRule.create({
    data: {
      action: data.action,
      protocol: data.protocol,
      sourceCidr: data.source_cidr,
      destinationCidr: data.destination_cidr,
      port: data.port,
      networkId: req.params.id
    }
  });

  const network = await prisma.network.findUnique({
    where: { id: req.params.id },
    include: { assignments: true }
  });
  if (network) {
    for (const assignment of network.assignments) {
      await DesiredStateEngine.generateGatewayDesiredState(assignment.gatewayId);
    }
  }

  res.status(201).json({
    ...rule,
    source_cidr: rule.sourceCidr,
    destination_cidr: rule.destinationCidr
  });
});

export default router;
