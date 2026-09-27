import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Lock, Mail, ArrowRight, RefreshCw } from 'lucide-react'
import { api } from '../api/client'

export const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.login(email, password)
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex text-gray-400 bg-black">
      
      {/* Left side: Branding / Graphic */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#0a0a0a] overflow-hidden border-r border-white/10">
        <div className="absolute inset-0 bg-[#0a0a0a]"></div>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
        
        <div className="relative z-10 flex flex-col justify-center px-20">
          <div className="w-16 h-16 bg-[#111] border border-white/10 rounded-xl flex items-center justify-center text-white mb-8 shadow-2xl">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-5xl font-bold text-white tracking-tight leading-tight mb-4">
            Total Network <br />
            Isolation.
          </h1>
          <p className="text-lg text-gray-400 font-medium max-w-md">
            The next-generation multi-tenant control plane for WireGuard and Open vSwitch.
          </p>
        </div>
      </div>

      {/* Right side: Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-12 lg:px-24">
        <div className="w-full max-w-sm mx-auto">
          <div className="mb-10 lg:hidden">
            <div className="w-12 h-12 bg-[#111] border border-white/10 rounded-xl flex items-center justify-center text-white mb-4 shadow-xl">
              <Shield className="w-6 h-6" />
            </div>
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Welcome back</h2>
          <p className="text-gray-400 font-medium mb-8 text-sm">Sign in to orchestrate your virtual networks.</p>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Password
                </label>
                <Link to="/forgot-password" className="text-sm text-gray-400 hover:text-white font-medium transition-colors">
                  Recover password
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-6 flex items-center justify-center space-x-2 rounded-lg"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 text-center text-sm text-gray-400 font-medium">
            Don't have an account?{' '}
            <Link to="/register" className="text-white hover:text-gray-200 transition-colors">
              Create a tenant
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
