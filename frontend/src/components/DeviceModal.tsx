import React, { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Key, Download, Check, Copy, X, Laptop, RefreshCw } from 'lucide-react'
import { generateWireguardKeypair, buildClientWireguardConfig, WireguardKeypair } from '../utils/wireguard'
import { api } from '../api/client'
import { DeviceConfigResponse } from '../types'

interface DeviceModalProps {
  networkId: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const DeviceModal: React.FC<DeviceModalProps> = ({
  networkId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('')
  const [isExitNode, setIsExitNode] = useState(false)
  const [keypair, setKeypair] = useState<WireguardKeypair | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdConfig, setCreatedConfig] = useState<DeviceConfigResponse | null>(null)
  const [clientConfText, setClientConfText] = useState<string>('')
  const [copied, setCopied] = useState(false)

  // Generate keypair in browser when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('')
      setIsExitNode(false)
      setError(null)
      setCreatedConfig(null)
      setClientConfText('')
      try {
        const kp = generateWireguardKeypair()
        setKeypair(kp)
      } catch (err: any) {
        setError('Failed to generate Curve25519 keypair in browser.')
      }
    }
  }, [isOpen])

  const handleRegenerateKeys = () => {
    const kp = generateWireguardKeypair()
    setKeypair(kp)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !keypair) return

    setLoading(true)
    setError(null)

    try {
      // Send ONLY device name and public key to backend! Private key stays in memory.
      const resp = await api.createDevice(networkId, {
        name: name.trim(),
        public_key: keypair.publicKeyBase64,
        is_exit_node: isExitNode,
      })

      // Assemble full client configuration text with client's private key
      const completeConf = buildClientWireguardConfig(
        keypair.privateKeyBase64,
        resp.vpn_ip,
        resp.gateway_public_key,
        resp.gateway_endpoint,
        resp.allowed_ips,
        resp.dns_servers
      )

      setCreatedConfig(resp)
      setClientConfText(completeConf)
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to register device')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadConfig = () => {
    if (!clientConfText) return
    const blob = new Blob([clientConfText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${name.toLowerCase().replace(/\s+/g, '-')}-wg0.conf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(clientConfText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-sm max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded transition-colors bg-transparent border-none"
        >
          <X className="w-5 h-5" />
        </button>

        {!createdConfig ? (
          <div>
            <div className="flex items-center space-x-4 mb-5">
              <div className="w-12 h-12 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center text-gray-300">
                <Laptop className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Add New Device</h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  Zero-Knowledge Onboarding: Private keys are generated locally in your browser.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Device Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MacBook Pro, Production Node"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="p-4 bg-[#111] border border-white/10 rounded space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm font-semibold text-gray-300">
                    <Key className="w-4 h-4 text-brand-400" />
                    <span>Client-Generated Cryptographic Keys</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRegenerateKeys}
                    className="text-xs text-gray-400 hover:text-white flex items-center space-x-1 bg-transparent border-none"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Regenerate</span>
                  </button>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-gray-500 block mb-1">
                    Public Key (Transmitted to Gateway):
                  </span>
                  <p className="text-xs font-mono text-emerald-400 truncate bg-black px-3 py-2 rounded border border-emerald-500/20">
                    {keypair?.publicKeyBase64}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-gray-500 block mb-1">
                    Private Key (Stays In Browser Memory):
                  </span>
                  <p className="text-xs font-mono text-gray-400 truncate bg-black px-3 py-2 rounded border border-white/10">
                    {keypair?.privateKeyBase64.substring(0, 16)}•••••••••••••••••••••••••••••
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#111] border border-white/10 rounded">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-300">Act as Exit Node</span>
                  <span className="text-xs text-gray-500 mt-0.5">Route WAN internet traffic through this device</span>
                </div>
                <input
                  type="checkbox"
                  checked={isExitNode}
                  onChange={(e) => setIsExitNode(e.target.checked)}
                  className="w-5 h-5 rounded border-white/20 bg-black text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white bg-transparent hover:bg-white/5 rounded border-none transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="btn-primary"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Allocating Static IP...</span>
                    </>
                  ) : (
                    <span>Register Device</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-sm bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Device Connected!</h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  Assigned Static VPN IP: <span className="text-white font-mono font-semibold px-2 py-0.5 bg-white/5 rounded ml-1">{createdConfig.vpn_ip}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-[#111] border border-white/10 rounded-sm">
              <div className="p-4 bg-white rounded-sm shadow-sm flex-shrink-0">
                <QRCodeSVG value={clientConfText} size={150} level="M" />
              </div>
              <div className="space-y-3 text-sm text-gray-400">
                <p className="font-semibold text-white">Mobile Quick Setup</p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Scan this QR code with the official WireGuard app on iOS or Android to immediately connect this device to your virtual network.
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleDownloadConfig}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-gray-300 text-sm font-semibold flex items-center space-x-2 transition-colors"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Download .conf</span>
                  </button>
                  <button
                    onClick={handleCopyConfig}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-gray-300 text-sm font-semibold flex items-center space-x-2 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                    <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-2">
                WireGuard Configuration File Preview:
              </span>
              <pre className="p-4 bg-black border border-white/10 rounded-sm text-xs font-mono text-gray-400 overflow-x-auto max-h-40">
                {clientConfText}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
