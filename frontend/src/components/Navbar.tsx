import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Network, Server, LogOut } from 'lucide-react'

export const Navbar: React.FC = () => {
  const navigate = useNavigate()
  const token = localStorage.getItem('access_token')

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    navigate('/login')
  }

  return (
    <nav className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 p-0.5 shadow-lg shadow-brand-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Shield className="w-5 h-5 text-brand-500 group-hover:scale-110 transition-transform" />
                </div>
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                  OVERLAY<span className="text-brand-500">VPN</span>
                </span>
                <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-md">
                  Control Plane
                </span>
              </div>
            </Link>

            {token && (
              <div className="hidden md:flex items-center space-x-1">
                <Link
                  to="/"
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                >
                  <Network className="w-4 h-4 text-slate-400" />
                  <span>Networks</span>
                </Link>
                <Link
                  to="/gateways"
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                >
                  <Server className="w-4 h-4 text-slate-400" />
                  <span>Gateways</span>
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="hidden sm:inline">Dataplane:</span>
              <span className="font-bold">Operational</span>
            </div>

            {token && (
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 p-2 sm:px-3 sm:py-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all text-xs font-medium"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
