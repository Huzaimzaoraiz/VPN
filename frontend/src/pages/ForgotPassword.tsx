import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Mail, KeyRound, Lock, ArrowRight, Loader2 } from 'lucide-react'
import { api } from '../api/client'

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.forgotPassword(email)
      setStep(2)
    } catch (err: any) {
      setError(err.message || 'Failed to send reset code.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.resetPassword({ email, otp, new_password: newPassword })
      // Navigate to login after success
      navigate('/login', { state: { message: 'Password reset successfully. You can now log in.' } })
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.')
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
            Regain <br />
            Access.
          </h1>
          <p className="text-lg text-gray-400 font-medium max-w-md">
            Securely verify your identity and restore access to your isolated virtual networks.
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

          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Reset Password</h2>
          <p className="text-gray-400 font-medium mb-8 text-sm">
            {step === 1 ? "We'll send a code to your email." : "Enter your code and new password."}
          </p>
          
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          {step === 1 ? (
            <form className="space-y-5" onSubmit={handleRequestOtp}>
              <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3"
                    placeholder="admin@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 flex items-center justify-center space-x-2 mt-6 rounded-lg"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Send Reset Code</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={handleResetPassword}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  6-Digit Reset Code
                </label>
                <div className="relative">
                  <KeyRound className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-12 pr-4 py-3 text-center tracking-widest font-mono text-xl rounded-lg"
                    placeholder="123456"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6 || newPassword.length < 8}
                className="w-full py-3 flex items-center justify-center space-x-2 mt-6 rounded-lg"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    <span>Set New Password</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-10 text-center text-sm text-gray-400 font-medium">
            Remembered your password?{' '}
            <Link to="/login" className="text-white hover:text-gray-200 transition-colors">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
