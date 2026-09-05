import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Network as NetworkIcon, Plus, Laptop, Trash2, ArrowRight, ShieldCheck, RefreshCw, X } from 'lucide-react'
import { api } from '../api/client'
import { Network } from '../types'

export const Dashboard: React.FC = () => {
  const [networks, setNetworks] = useState<Network[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newNetworkName, setNewNetworkName] = useState('')
  const [newNetworkCidr, setNewNetworkCidr] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  const loadNetworks = async () => {
    try {
      setLoading(true)
      const data = await api.getNetworks()
      setNetworks(data)
    } catch (err: any) {
      if (err.message?.includes('validate credentials') || err.message?.includes('Not authenticated')) {
        navigate('/login')
      } else {
        setError(err.message || 'Failed to load networks')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNetworks()
  }, [])

  const handleCreateNetwork = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNetworkName.trim()) return

    setCreating(true)
    try {
      await api.createNetwork({
        name: newNetworkName.trim(),
        cidr: newNetworkCidr.trim() || undefined,
      })
      setNewNetworkName('')
      setNewNetworkCidr('')
      setIsModalOpen(false)
      loadNetworks()
    } catch (err: any) {
      alert(err.message || 'Failed to create network')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteNetwork = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete network "${name}"? All devices and routes will be deleted.`)) {
      return
    }
    try {
      await api.deleteNetwork(id)
      loadNetworks()
    } catch (err: any) {
      alert(err.message || 'Failed to delete network')
    }
  }

  const totalDevices = networks.reduce((acc, n) => acc + (n.device_count || 0), 0)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Virtual Networks</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Isolated layer-3 overlay segments with dedicated WireGuard endpoints and OVS VLANs
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 hover:from-brand-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-brand-500/20 flex items-center space-x-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Network</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl glass-panel flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <NetworkIcon className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Networks</span>
            <p className="text-2xl font-black text-white">{networks.length}</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Laptop className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Connected Peers</span>
            <p className="text-2xl font-black text-white">{totalDevices}</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tenant Isolation</span>
            <p className="text-2xl font-black text-emerald-400">Enforced</p>
          </div>
        </div>
      </div>

      {/* Networks Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          {error}
        </div>
      ) : networks.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-panel space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
            <NetworkIcon className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-white">No virtual networks created</h3>
            <p className="text-xs text-slate-400 mt-1">
              Create your first private network to allocate an isolated /24 CIDR, assign a Linux WireGuard gateway, and add client devices.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs inline-flex items-center space-x-2 transition-all shadow-lg shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create Network</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {networks.map((network) => (
            <div
              key={network.id}
              className="rounded-2xl glass-panel glass-panel-hover p-6 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                      <NetworkIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white group-hover:text-brand-400 transition-colors">
                        {network.name}
                      </h3>
                      <span className="text-xs font-mono text-emerald-400 font-semibold">{network.cidr}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteNetwork(network.id, network.name)}
                    className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                    title="Delete Network"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-6 space-y-2 text-xs border-t border-slate-800/80 pt-4">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Devices / Peers:</span>
                    <span className="font-semibold text-white font-mono">{network.device_count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>OVS Isolation Tag:</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      VLAN {network.vlan_id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Serving Gateway:</span>
                    <span className="font-mono text-[11px] text-slate-300">
                      {network.assigned_gateway_hostname || 'Ready'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/60">
                <Link
                  to={`/networks/${network.id}`}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-brand-600 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-sm"
                >
                  <span>Manage Network</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Network Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Create Virtual Network</h3>
            <p className="text-xs text-slate-400 mb-5">
              IPAM will assign a dedicated /24 CIDR and isolate it on the gateway switch.
            </p>

            <form onSubmit={handleCreateNetwork} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Network Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Personal Network, Production Cluster"
                  value={newNetworkName}
                  onChange={(e) => setNewNetworkName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Custom CIDR (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Auto-allocated if left empty (e.g. 10.100.0.0/24)"
                  value={newNetworkCidr}
                  onChange={(e) => setNewNetworkCidr(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500 font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Leave blank to allow IPAM to choose next available non-overlapping /24.
                </span>
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newNetworkName.trim()}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50 flex items-center space-x-2"
                >
                  {creating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Network</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
