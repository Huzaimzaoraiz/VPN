import * as crypto from 'crypto';
import { prisma } from '../core/database';
import { IPAMService } from '../services/ipam_service';

export class DesiredStateEngine {
  /**
   * Constructs the versioned desired state manifest.
   */
  static async generateGatewayDesiredState(gatewayId: string): Promise<any> {
    const gateway = await prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gateway) throw new Error(`Gateway ${gatewayId} not found.`);

    const assignments = await prisma.gatewayAssignment.findMany({
      where: { gatewayId },
      include: {
        network: {
          include: { devices: true, routes: true, firewalls: true }
        }
      }
    });

    const assignedNetworks = assignments.map(a => a.network).filter(n => n !== null);

    const wgPeers: any[] = [];
    const ovsTenants: any[] = [];
    const ovsFlows: any[] = [];
    const customRoutes: any[] = [];
    const firewallRules: any[] = [];
    const isolatedCidrs: string[] = [];

    // Default OVS flow: drop
    ovsFlows.push({ table: 0, priority: 0, match: "", actions: "drop" });

    for (const net of assignedNetworks) {
      isolatedCidrs.push(net.cidr);
      const gatewayVirtualIp = IPAMService.getGatewayIp(net.cidr);

      ovsTenants.push({
        network_id: net.id,
        vlan_id: net.vlanId,
        cidr: net.cidr,
        gateway_ip: gatewayVirtualIp
      });

      ovsFlows.push({
        table: 0, priority: 100,
        match: `ip,nw_src=${net.cidr},nw_dst=${net.cidr}`,
        actions: `mod_vlan_vid:${net.vlanId},resubmit(,1)`
      });

      ovsFlows.push({
        table: 1, priority: 100,
        match: `dl_vlan=${net.vlanId},ip,nw_dst=${net.cidr}`,
        actions: "strip_vlan,NORMAL"
      });

      for (const dev of net.devices) {
        const allowed = [`${dev.vpnIp}/32`];
        for (const r of net.routes) {
          if (r.deviceId === dev.id) allowed.push(r.destinationCidr);
        }

        wgPeers.push({
          device_id: dev.id,
          name: dev.name,
          public_key: dev.publicKey,
          allowed_ips: allowed,
          keepalive: 25
        });
      }

      for (const r of net.routes) {
        customRoutes.push({
          destination: r.destinationCidr,
          next_hop: r.nextHopVpnIp,
          interface: "wg0"
        });
      }

      for (const fw of net.firewalls) {
        firewallRules.push({
          source_cidr: fw.sourceCidr,
          destination_cidr: fw.destinationCidr,
          protocol: fw.protocol,
          port: fw.port,
          action: fw.action
        });
      }
    }

    const currentRecord = await prisma.gatewayDesiredState.findUnique({
      where: { gatewayId }
    });

    const nextVersion = currentRecord ? Number(currentRecord.version) + 1 : 1;

    const stateDict = {
      version: nextVersion,
      gateway_id: gatewayId,
      wireguard: {
        interface: "wg0",
        listen_port: gateway.listenPort,
        peers: wgPeers
      },
      ovs: {
        bridge: "br-vpn",
        tenants: ovsTenants,
        flows: ovsFlows
      },
      routes: customRoutes,
      firewall: {
        default_policy: "drop",
        isolated_networks: isolatedCidrs,
        rules: firewallRules
      }
    };

    const serialized = JSON.stringify(stateDict, Object.keys(stateDict).sort());
    const checksum = crypto.createHash('sha256').update(serialized).digest('hex');

    if (currentRecord) {
      await prisma.gatewayDesiredState.update({
        where: { id: currentRecord.id },
        data: {
          version: nextVersion,
          stateJson: stateDict,
          checksum
        }
      });
    } else {
      await prisma.gatewayDesiredState.create({
        data: {
          gatewayId,
          version: nextVersion,
          stateJson: stateDict,
          checksum
        }
      });
    }

    return stateDict;
  }
}
