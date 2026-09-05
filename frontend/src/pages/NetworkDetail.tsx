import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Laptop,
  Route as RouteIcon,
  ShieldAlert,
  Share2,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Server,
} from 'lucide-react'
import { api } from '../api/client'
import { Network, Device, Route, FirewallRule } from '../types'
import { DeviceModal } from '../components/DeviceModal'
import { RouteModal } from '../components/RouteModal'
import { FirewallModal } from '../components/FirewallModal'
import { TopologyGraph } from '../components/TopologyGraph'

export const NetworkDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [network, setNetwork] = useState<Network | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [firewallRules, setFirewallRules] = useState<FirewallRule[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'devices' | 'routes' | 'firewall' | 'topology'>('devices')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Modals
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false)
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false)
  const [isFirewallModalOpen, setIsFirewallModalOpen] = useState(false)

  const loadData = async () => {
    if (!id) return
    try {
      setLoading(true)
      const [net, devs, rts, fws] = await Promise.all([
        api.getNetwork(id),
        api.getNetworkDevices(id),
        api.getNetworkRoutes(id),
        api.getNetworkFirewallRules(id),
      ])
      setNetwork(net)
      setDevices(devs)
      setRoutes(rts)
      setFirewallRules(fws)
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleDeleteDevice = async (devId: string) => {
    if (!confirm('Are you sure you want to remove this peer?')) return
    try {
      await api.deleteDevice(devId)
      loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to remove device')
    }
  }

  const handleDeleteRoute = async (rtId: string) => {
    try {
      await api.deleteRoute(rtId)
      loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to delete route')
    }
  }

  const handleDeleteFirewallRule = async (fwId: string) => {
    try {
      await api.deleteFirewallRule(fwId)
      loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to delete firewall rule')
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(text)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  if (loading && !network) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    )
  }

  if (!network) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-400">Network not found.</p>
        <Link to="/" className="text-brand-400 hover:underline mt-2 inline-block text-sm">
          Return to Networks
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Breadcrumb & Metadata */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Networks</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-black text-white">{network.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                {network.cidr}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400">
              <span className="font-mono">OVS Segment: VLAN {network.vlan_id}</span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                <span>Gateway: <strong className="text-slate-200">{network.assigned_gateway_hostname || 'Ready'}</strong></span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {activeTab === 'devices' && (
              <button
                onClick={() => setIsDeviceModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/20 flex items-center space-x-2 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Device</span>
              </button>
            )}
            {activeTab === 'routes' && (
              <button
                onClick={() => setIsRouteModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/20 flex items-center space-x-2 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Route</span>
              </button>
            )}
            {activeTab === 'firewall' && (
              <button
                onClick={() => setIsFirewallModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/20 flex items-center space-x-2 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Rule</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab('devices')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all ${
            activeTab === 'devices'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Laptop className="w-4 h-4" />
          <span>Devices ({devices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('routes')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all ${
            activeTab === 'routes'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <RouteIcon className="w-4 h-4" />
          <span>Custom Routes ({routes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('firewall')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all ${
            activeTab === 'firewall'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Firewall Policies ({firewallRules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('topology')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all ${
            activeTab === 'topology'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>Datapath Topology</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'devices' && (
        <div className="rounded-2xl glass-panel overflow-hidden">
          {devices.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No devices registered. Click "Add Device" to generate keys and onboard your first peer.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 border-b border-slate-800 uppercase font-mono text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Device Name</th>
                    <th className="py-3 px-4">Static VPN IP</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Public Key</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {devices.map((device) => (
                    <tr key={device.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white flex items-center space-x-2">
                        <Laptop className="w-4 h-4 text-slate-400" />
                        <span>{device.name}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-brand-400 font-bold">{device.vpn_ip}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
                          {device.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        <div className="flex items-center space-x-1.5">
                          <span>{device.public_key.substring(0, 14)}...</span>
                          <button
                            onClick={() => handleCopy(device.public_key)}
                            className="p-1 hover:text-white"
                            title="Copy Public Key"
                          >
                            {copiedKey === device.public_key ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-500" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {device.is_exit_node ? (
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Exit Node
                          </span>
                        ) : (
                          <span className="text-slate-500">Peer</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteDevice(device.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors"
                          title="Remove Device"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'routes' && (
        <div className="rounded-2xl glass-panel overflow-hidden">
          {routes.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No custom subnet routes configured. Click "Add Route" to forward remote CIDRs via peer devices.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 border-b border-slate-800 uppercase font-mono text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Destination Subnet</th>
                    <th className="py-3 px-4">Next-Hop VPN IP</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {routes.map((rt) => (
                    <tr key={rt.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-white">{rt.destination_cidr}</td>
                      <td className="py-3.5 px-4 font-mono text-blue-400">{rt.next_hop_vpn_ip}</td>
                      <td className="py-3.5 px-4 text-slate-400">{rt.description || '—'}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteRoute(rt.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'firewall' && (
        <div className="rounded-2xl glass-panel overflow-hidden">
          {firewallRules.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Using default tenant isolation policy (Cross-Tenant Drop + WAN NAT Masquerade). Click "Add Rule" to configure custom filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 border-b border-slate-800 uppercase font-mono text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Source CIDR</th>
                    <th className="py-3 px-4">Destination CIDR</th>
                    <th className="py-3 px-4">Protocol</th>
                    <th className="py-3 px-4">Port</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {firewallRules.map((fw) => (
                    <tr key={fw.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-400">{fw.priority}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                            fw.action === 'allow'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {fw.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">{fw.source_cidr}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">{fw.destination_cidr}</td>
                      <td className="py-3.5 px-4 uppercase font-mono text-slate-400">{fw.protocol}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">{fw.port || 'ANY'}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteFirewallRule(fw.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'topology' && (
        <TopologyGraph network={network} devices={devices} />
      )}

      {/* Modals */}
      <DeviceModal
        networkId={network.id}
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
        onSuccess={loadData}
      />
      <RouteModal
        networkId={network.id}
        devices={devices}
        isOpen={isRouteModalOpen}
        onClose={() => setIsRouteModalOpen(false)}
        onSuccess={loadData}
      />
      <FirewallModal
        networkId={network.id}
        isOpen={isFirewallModalOpen}
        onClose={() => setIsFirewallModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  )
}
