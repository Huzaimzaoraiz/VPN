import React, { useState, useEffect } from 'react'
import { Server, Activity, AlertTriangle, RefreshCw, Cpu, Database } from 'lucide-react'
import { api } from '../api/client'
import { Gateway } from '../types'

export const Gateways: React.FC = () => {
  const [gateways, setGateways] = useState<Gateway[]>([])
  const [loading, setLoading] = useState(true)
  const [failingOver, setFailingOver] = useState<string | null>(null)

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Linux Gateway Nodes</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Data-plane compute instances executing autonomous desired-state reconciliation for WireGuard, OVS, and nftables
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Live Telemetry Polling (5s)</span>
        </div>
      </div>

      {loading && gateways.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : gateways.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-panel text-slate-400 text-xs">
          No gateways registered in cluster. Launch a Linux VM agent to register automatically.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {gateways.map((gw) => {
            const isReady = gw.status === 'READY'
            return (
              <div key={gw.id} className="rounded-2xl glass-panel p-6 space-y-6 relative overflow-hidden">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        isReady
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                      }`}
                    >
                      <Server className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-base text-white">{gw.hostname}</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isReady
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {gw.status}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">
                        {gw.node_id} • {gw.region} ({gw.provider.toUpperCase()})
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleFailover(gw.id)}
                    disabled={failingOver === gw.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all flex items-center space-x-1.5"
                    title="Simulate node failure and trigger network migration"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{failingOver === gw.id ? 'Failing over...' : 'Trigger Failover'}</span>
                  </button>
                </div>

                {/* Gateway Details */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Public Endpoint:</span>
                    <span className="text-slate-200 font-bold">{gw.public_ip}:{gw.listen_port}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Active Sessions:</span>
                    <span className="text-brand-400 font-bold">{gw.current_sessions} / {gw.capacity}</span>
                  </div>
                </div>

                {/* Telemetry Metrics */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400 flex items-center space-x-1">
                        <Cpu className="w-3.5 h-3.5" />
                        <span>CPU Utilization</span>
                      </span>
                      <span className="font-mono font-bold text-white">{gw.cpu_usage}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(gw.cpu_usage, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400 flex items-center space-x-1">
                        <Database className="w-3.5 h-3.5" />
                        <span>Memory Utilization</span>
                      </span>
                      <span className="font-mono font-bold text-white">{gw.memory_usage}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(gw.memory_usage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Public Key */}
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">
                    Gateway WireGuard Public Key:
                  </span>
                  <p className="text-[11px] font-mono text-slate-400 truncate bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
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
