import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Lock, Mail, ArrowRight, RefreshCw } from 'lucide-react'
import { api } from '../api/client'

export const Register: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<1 | 2>(1)
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (step === 1) {
        await api.register({
          email,
          password,
        })
        setStep(2)
      } else {
        await api.verifyOtp(email, otp)
        navigate('/')
      }
    } catch (err: any) {
      setError(err.message || (step === 1 ? 'Registration failed' : 'OTP verification failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setResending(true)
    setError(null)
    try {
      await api.resendOtp(email)
      alert('A new 6-digit code has been sent.')
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP')
    } finally {
      setResending(false)
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
            Create Your <br />
            Secure Workspace.
          </h1>
          <p className="text-lg text-gray-400 font-medium max-w-md">
            Get an isolated layer-3 overlay network with full control over your endpoints.
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

          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Register</h2>
          <p className="text-gray-400 font-medium mb-8 text-sm">Create an account to get started.</p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Min 8 characters"
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
                  <span>Create Account</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-left mb-8">
              <p className="text-sm text-gray-400 font-medium">We've sent a 6-digit verification code to <strong className="text-white">{email}</strong>. Please check your terminal.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Enter Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-4 py-3 text-center text-xl tracking-widest font-mono rounded-lg"
                />
              </div>
            </div>
            <div className="flex flex-col space-y-4 mt-6">
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full py-3 flex items-center justify-center space-x-2 rounded-lg"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : (
                  <>
                    <span>Verify</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resending}
                className="w-full py-3 border border-white/10 hover:bg-white/5 rounded-lg transition-colors"
              >
                {resending ? 'Sending...' : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-10 text-center text-sm text-gray-400 font-medium">
          Already registered?{' '}
          <Link to="/login" className="text-white hover:text-gray-200 transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </div>
    </div>
  )
}
