import React, { useState } from 'react'
import { ShieldAlert, X, RefreshCw } from 'lucide-react'
import { api } from '../api/client'

interface FirewallModalProps {
  networkId: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const FirewallModal: React.FC<FirewallModalProps> = ({
  networkId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [priority, setPriority] = useState(100)
  const [sourceCidr, setSourceCidr] = useState('0.0.0.0/0')
  const [destinationCidr, setDestinationCidr] = useState('0.0.0.0/0')
  const [protocol, setProtocol] = useState<'all' | 'tcp' | 'udp' | 'icmp'>('all')
  const [port, setPort] = useState<string>('')
  const [action, setAction] = useState<'allow' | 'drop' | 'reject'>('drop')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.createFirewallRule(networkId, {
        priority: Number(priority),
        source_cidr: sourceCidr.trim(),
        destination_cidr: destinationCidr.trim(),
        protocol,
        port: port ? Number(port) : null,
        action,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create firewall rule')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Add Firewall Policy</h3>
            <p className="text-xs text-slate-400">Enforce atomic nftables packet filter rules</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Priority
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Action
              </label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500 font-semibold"
              >
                <option value="allow" className="text-emerald-400">ALLOW</option>
                <option value="drop" className="text-rose-400">DROP</option>
                <option value="reject" className="text-amber-400">REJECT</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Source CIDR
            </label>
            <input
              type="text"
              required
              value={sourceCidr}
              onChange={(e) => setSourceCidr(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Destination CIDR
            </label>
            <input
              type="text"
              required
              value={destinationCidr}
              onChange={(e) => setDestinationCidr(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Protocol
              </label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500 uppercase"
              >
                <option value="all">ALL</option>
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
                <option value="icmp">ICMP</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Port (Optional)
              </label>
              <input
                type="number"
                min="1"
                max="65535"
                placeholder="e.g. 443"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50 flex items-center space-x-2"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Install Policy</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
