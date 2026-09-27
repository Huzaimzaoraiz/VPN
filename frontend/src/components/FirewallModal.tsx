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
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-colors bg-transparent border-none"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-4 mb-5">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Add Firewall Policy</h3>
            <p className="text-sm text-gray-400 mt-0.5">Enforce atomic nftables packet filter rules</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Priority
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Action
              </label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as any)}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg text-slate-100 text-sm px-3.5 py-2.5 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/10 font-semibold"
              >
                <option value="allow" className="text-emerald-400">ALLOW</option>
                <option value="drop" className="text-red-400">DROP</option>
                <option value="reject" className="text-amber-400">REJECT</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Source CIDR
            </label>
            <input
              type="text"
              required
              value={sourceCidr}
              onChange={(e) => setSourceCidr(e.target.value)}
              className="w-full font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Destination CIDR
            </label>
            <input
              type="text"
              required
              value={destinationCidr}
              onChange={(e) => setDestinationCidr(e.target.value)}
              className="w-full font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Protocol
              </label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as any)}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg text-slate-100 text-sm px-3.5 py-2.5 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/10 uppercase"
              >
                <option value="all">ALL</option>
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
                <option value="icmp">ICMP</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Port (Optional)
              </label>
              <input
                type="number"
                min="1"
                max="65535"
                placeholder="e.g. 443"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full font-mono"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white bg-transparent hover:bg-white/5 rounded-lg border-none transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>Install Policy</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
