import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Network as NetworkIcon, Plus, Trash2, ArrowRight, RefreshCw, X } from 'lucide-react'
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
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Create and manage secure, private WireGuard networks for your devices.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 flex items-center space-x-2 rounded bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create Network</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 dark-panel flex flex-col justify-center border border-white/10 rounded-sm">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Networks</span>
            <p className="text-2xl font-semibold text-white">{networks.length}</p>
          </div>
        </div>

        <div className="p-5 dark-panel flex flex-col justify-center border border-white/10 rounded-sm">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Connected Peers</span>
            <p className="text-2xl font-semibold text-white">{totalDevices}</p>
          </div>
        </div>

        <div className="p-5 dark-panel flex flex-col justify-center border border-white/10 rounded-sm">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Network Isolation</span>
            <p className="text-2xl font-semibold text-white">Enforced</p>
          </div>
        </div>
      </div>

      {/* Networks Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
        </div>
      ) : error ? (
        <div className="p-4  bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium">
          {error}
        </div>
      ) : networks.length === 0 ? (
        <div className="p-12 text-center dark-panel space-y-4 border border-white/10 rounded-sm">
          <div className="w-16 h-16 border border-white/10 rounded-sm flex items-center justify-center text-gray-400 mx-auto bg-white/5">
            <NetworkIcon className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-white">No virtual networks created</h3>
            <p className="text-sm text-gray-400 mt-1">
              Create your first private network to allocate an isolated /24 CIDR, assign a Linux WireGuard gateway, and add client devices.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2 inline-flex items-center space-x-2 rounded bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
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
              className="dark-panel dark-panel-hover p-6 flex flex-col justify-between group border border-white/10 rounded-sm"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 border border-white/10 rounded flex items-center justify-center text-white bg-white/5 group-hover:bg-white/10 transition-colors">
                      <NetworkIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-white group-hover:text-gray-300 transition-colors">
                        {network.name}
                      </h3>
                      <span className="text-xs font-mono text-gray-400 font-medium">{network.cidr}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteNetwork(network.id, network.name)}
                    className="text-gray-400 hover:text-red-400 p-2 hover:bg-white/5 rounded transition-colors"
                    title="Delete Network"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-8 space-y-3 text-sm border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Devices / Peers:</span>
                    <span className="font-semibold text-white font-mono">{network.device_count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-400">
                    <span>OVS Isolation Tag:</span>
                    <span className="px-2 py-0.5 text-xs font-mono bg-white/5 text-gray-300 border border-white/10 rounded">
                      VLAN {network.vlan_id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Serving Gateway:</span>
                    <span className="font-mono text-xs text-gray-400">
                      {network.assigned_gateway_hostname || 'Ready'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-white">
                <Link
                  to={`/networks/${network.id}`}
                  className="w-full py-3  bg-black hover:bg-black border border-white text-white text-sm font-bold transition-all flex items-center justify-center space-x-2"
                >
                  <span>Manage Network</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Network Modal */}
      {isModalOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-sm max-w-md w-full p-8 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors bg-transparent border-none p-1 hover:bg-white/5 rounded"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-semibold text-white mb-2">Create Virtual Network</h3>
            <p className="text-sm text-gray-400 mb-8">
              IPAM will assign a dedicated /24 CIDR and isolate it on the gateway switch.
            </p>

            <form onSubmit={handleCreateNetwork} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Network Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Personal Network, Production Cluster"
                  value={newNetworkName}
                  onChange={(e) => setNewNetworkName(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Custom CIDR (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Auto-allocated if left empty (e.g. 10.100.0.0/24)"
                  value={newNetworkCidr}
                  onChange={(e) => setNewNetworkCidr(e.target.value)}
                  className="w-full font-mono"
                />
                <span className="text-xs text-gray-400 mt-2 block">
                  Leave blank to allow IPAM to choose next available non-overlapping /24.
                </span>
              </div>

              <div className="pt-6 flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors bg-transparent hover:bg-white/5 rounded border-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newNetworkName.trim()}
                  className="btn-primary"
                >
                  {creating && <RefreshCw className="w-4 h-4 animate-spin" />}
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
