import React, { useState } from 'react'
import { Route as RouteIcon, X, RefreshCw } from 'lucide-react'
import { api } from '../api/client'
import { Device } from '../types'

interface RouteModalProps {
  networkId: string
  devices: Device[]
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const RouteModal: React.FC<RouteModalProps> = ({
  networkId,
  devices,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [destinationCidr, setDestinationCidr] = useState('')
  const [nextHopVpnIp, setNextHopVpnIp] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!destinationCidr || !nextHopVpnIp) return

    setLoading(true)
    setError(null)
    try {
      await api.createRoute(networkId, {
        destination_cidr: destinationCidr.trim(),
        next_hop_vpn_ip: nextHopVpnIp.trim(),
        description: description.trim() || undefined,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create route')
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
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <RouteIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Add Custom Route</h3>
            <p className="text-xs text-slate-400">Route remote subnets via a device inside your network</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Destination Subnet CIDR
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 192.168.50.0/24"
              value={destinationCidr}
              onChange={(e) => setDestinationCidr(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Next-Hop Device VPN IP
            </label>
            <select
              value={nextHopVpnIp}
              onChange={(e) => setNextHopVpnIp(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
            >
              <option value="">Select a device...</option>
              {devices.map((d) => (
                <option key={d.id} value={d.vpn_ip}>
                  {d.name} ({d.vpn_ip})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Office Internal Subnet"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
            />
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
              disabled={loading || !destinationCidr || !nextHopVpnIp}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50 flex items-center space-x-2"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Route</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
