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
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-colors bg-transparent border-none"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-4 mb-5">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300">
            <RouteIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Add Custom Route</h3>
            <p className="text-sm text-gray-400 mt-0.5">Route remote subnets via a device inside your network</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Destination Subnet CIDR
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 192.168.50.0/24"
              value={destinationCidr}
              onChange={(e) => setDestinationCidr(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Next-Hop Device VPN IP
            </label>
            <select
              value={nextHopVpnIp}
              onChange={(e) => setNextHopVpnIp(e.target.value)}
              required
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg text-slate-100 text-sm px-3.5 py-2.5 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/10"
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Description (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Office Internal Subnet"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full"
            />
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
              disabled={loading || !destinationCidr || !nextHopVpnIp}
              className="btn-primary"
            >
              {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>Save Route</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
