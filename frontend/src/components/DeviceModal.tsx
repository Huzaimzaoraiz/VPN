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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {!createdConfig ? (
          <div>
            <div className="flex items-center space-x-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                <Laptop className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Add New Device</h3>
                <p className="text-xs text-slate-400">
                  Zero-Knowledge Onboarding: Private keys are generated locally in your browser.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Device Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MacBook Pro, Production Node"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
                    <Key className="w-4 h-4 text-brand-400" />
                    <span>Client-Generated Cryptographic Keys</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRegenerateKeys}
                    className="text-xs text-slate-400 hover:text-brand-400 flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Regenerate</span>
                  </button>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">
                    Public Key (Transmitted to Gateway):
                  </span>
                  <p className="text-xs font-mono text-emerald-400 truncate bg-slate-900 px-2 py-1 rounded border border-slate-800/60 mt-1">
                    {keypair?.publicKeyBase64}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">
                    Private Key (Stays In Browser Memory):
                  </span>
                  <p className="text-xs font-mono text-slate-400 truncate bg-slate-900 px-2 py-1 rounded border border-slate-800/60 mt-1">
                    {keypair?.privateKeyBase64.substring(0, 16)}•••••••••••••••••••••••••••••
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-200">Act as Exit Node</span>
                  <span className="text-[11px] text-slate-500">Route WAN internet traffic through this device</span>
                </div>
                <input
                  type="checkbox"
                  checked={isExitNode}
                  onChange={(e) => setIsExitNode(e.target.checked)}
                  className="w-4 h-4 text-brand-500 rounded bg-slate-900 border-slate-700 focus:ring-0 focus:ring-offset-0"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors disabled:opacity-50 flex items-center space-x-2"
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
          <div className="space-y-5">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Device Connected!</h3>
                <p className="text-xs text-slate-400">
                  Assigned Static VPN IP: <span className="text-brand-400 font-mono font-bold">{createdConfig.vpn_ip}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="p-3 bg-white rounded-xl shadow-lg flex-shrink-0">
                <QRCodeSVG value={clientConfText} size={150} level="M" />
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <p className="font-semibold text-white">Mobile Quick Setup</p>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Scan this QR code with the official WireGuard app on iOS or Android to immediately connect this device to your virtual network.
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={handleDownloadConfig}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center space-x-1.5 transition-colors border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5 text-brand-400" />
                    <span>Download .conf</span>
                  </button>
                  <button
                    onClick={handleCopyConfig}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center space-x-1.5 transition-colors border border-slate-700"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[11px] uppercase font-mono text-slate-400 block mb-1.5">
                WireGuard Configuration File Preview:
              </span>
              <pre className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto max-h-40">
                {clientConfText}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors"
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
