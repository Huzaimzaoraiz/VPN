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
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
            <Shield className="w-8 h-8 text-brand-500" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">
          Reset Password
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          {step === 1 ? "We'll send a code to your email." : "Enter your code and new password."}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-900 py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border border-slate-800">
          
          {error && (
            <div className="mb-6 rounded-lg bg-rose-500/10 border border-rose-500/20 p-4">
              <p className="text-sm text-rose-400 text-center font-medium">{error}</p>
            </div>
          )}

          {step === 1 ? (
            <form className="space-y-6" onSubmit={handleRequestOtp}>
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-xl bg-slate-950/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all sm:text-sm"
                    placeholder="admin@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-brand-600 hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Send Reset Code
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleResetPassword}>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  6-Digit Reset Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="appearance-none block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-xl bg-slate-950/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all sm:text-sm text-center tracking-[0.5em] font-mono text-lg"
                    placeholder="123456"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-xl bg-slate-950/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6 || newPassword.length < 8}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-brand-600 hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Set New Password'}
              </button>
            </form>
          )}

          <div className="mt-8 text-center border-t border-slate-800 pt-6">
            <p className="text-sm text-slate-400">
              Remembered your password?{' '}
              <Link to="/login" className="font-medium text-brand-400 hover:text-brand-300 transition-colors">
                Back to login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
