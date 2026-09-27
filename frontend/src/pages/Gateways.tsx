import React, { useState, useEffect } from 'react'
import { Server, Activity, AlertTriangle, RefreshCw, Cpu, Database, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { Gateway } from '../types'

export const Gateways: React.FC = () => {
  const [gateways, setGateways] = useState<Gateway[]>([])
  const [loading, setLoading] = useState(true)
  const [failingOver, setFailingOver] = useState<string | null>(null)
  const [generatedToken, setGeneratedToken] = useState<string | null>(null)
  const loadGateways = async () => {
    try {
      setLoading(true)
      const data = await api.getGateways()
      setGateways(data)
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGateways()
    // Poll telemetry every 5s
    const interval = setInterval(loadGateways, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleFailover = async (gatewayId: string) => {
    if (!confirm('Simulate Gateway Failure & Automated Failover? All assigned networks will migrate to healthy nodes.')) {
      return
    }
    setFailingOver(gatewayId)
    try {
      const res = await api.triggerFailover(gatewayId)
      alert(`Failover executed! Migrated ${res.migrated_networks_count} virtual networks.`)
      loadGateways()
    } catch (err: any) {
      alert(err.message || 'Failover failed')
    } finally {
      setFailingOver(null)
    }
  }

  const handleGenerateToken = async () => {
    try {
      const res = await api.generateToken()
      setGeneratedToken(res.token)
    } catch (err: any) {
      alert(err.message || 'Failed to generate token')
    }
  }

  const handleDeleteGateway = async (gatewayId: string) => {
    if (!confirm('Are you sure you want to permanently delete this Gateway? This will delete its token and cannot be undone.')) {
      return
    }
    try {
      await api.deleteGateway(gatewayId)
      loadGateways()
    } catch (err: any) {
      alert(err.message || 'Failed to delete gateway')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2">Gateway Nodes</h1>
          <p className="text-sm text-gray-400">
            Data-plane compute instances executing autonomous desired-state reconciliation.
          </p>
        </div>
        <div className="flex flex-col items-end space-y-3">
          <div className="flex items-center space-x-2 text-xs font-mono text-gray-400">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Live Telemetry Polling (5s)</span>
          </div>
          <button
            onClick={handleGenerateToken}
            className="px-5 py-2 flex items-center space-x-2 rounded-lg bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
          >
            Deploy New Node
          </button>
        </div>
      </div>

      {generatedToken && (
        <div className="p-6 bg-[#0a0a0a] border border-emerald-500/30 rounded-xl text-white">
          <p className="text-sm mb-3 font-semibold text-emerald-400">New Node Token Generated! Copy this and set it as <code className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">NODE_TOKEN</code> in your server's .env file before starting the agent.</p>
          <code className="px-4 py-3 bg-black border border-white/10 rounded-lg text-white font-mono text-sm block select-all overflow-x-auto">{generatedToken}</code>
        </div>
      )}

      {loading && gateways.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : gateways.length === 0 ? (
        <div className="p-12 text-center dark-panel text-gray-400 text-sm border border-white/10 rounded-xl">
          No gateways registered in cluster. Launch a Linux VM agent to register automatically.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {gateways.map((gw) => {
            const isReady = gw.status === 'READY'
            return (
              <div key={gw.id} className="dark-panel dark-panel-hover p-6 space-y-6 relative overflow-hidden border border-white/10 rounded-xl">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-14 h-14 rounded-lg flex items-center justify-center border border-white/10 ${
                        isReady
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      <Server className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-base text-white">{gw.hostname}</h3>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border border-white/10 ${
                            isReady
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {gw.status}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-gray-400 mt-0.5">
                        {gw.node_id} • {gw.region} ({gw.provider.toUpperCase()})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleFailover(gw.id)}
                      disabled={failingOver === gw.id}
                      className="px-3 py-1.5  text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all flex items-center space-x-1.5"
                      title="Simulate node failure and trigger network migration"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{failingOver === gw.id ? 'Failing over...' : 'Trigger Failover'}</span>
                    </button>
                    {!isReady && (
                      <button
                        onClick={() => handleDeleteGateway(gw.id)}
                        className="p-1.5  text-gray-400 hover:bg-rose-500/20 hover:text-rose-400 transition-all"
                        title="Delete Gateway permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Gateway Details */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-[#111] border border-white/10 rounded-lg text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase block mb-1">Public Endpoint:</span>
                    <span className="text-white font-semibold text-sm">{gw.public_ip}:{gw.listen_port}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase block mb-1">Active Sessions:</span>
                    <span className="text-white font-semibold text-sm">{gw.current_sessions} / {gw.capacity}</span>
                  </div>
                </div>

                {/* Telemetry Metrics */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-400 flex items-center space-x-1">
                        <Cpu className="w-3.5 h-3.5" />
                        <span>CPU Utilization</span>
                      </span>
                      <span className="font-mono font-bold text-white">{gw.cpu_usage}%</span>
                    </div>
                    <div className="w-full h-2  bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-brand-500  transition-all duration-500"
                        style={{ width: `${Math.min(gw.cpu_usage, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-400 flex items-center space-x-1">
                        <Database className="w-3.5 h-3.5" />
                        <span>Memory Utilization</span>
                      </span>
                      <span className="font-mono font-bold text-white">{gw.memory_usage}%</span>
                    </div>
                    <div className="w-full h-2  bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-blue-500  transition-all duration-500"
                        style={{ width: `${Math.min(gw.memory_usage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Public Key */}
                <div>
                  <span className="text-[10px] uppercase font-mono text-gray-400 block mb-2">
                    Gateway WireGuard Public Key:
                  </span>
                  <p className="text-xs font-mono text-gray-400 truncate bg-black px-3 py-2.5  border border-white">
                    {gw.public_key}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
