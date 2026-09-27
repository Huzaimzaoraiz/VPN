import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Network, Server, LogOut } from 'lucide-react'
import { api } from '../api/client'

export const Navbar: React.FC = () => {
  const navigate = useNavigate()
  const token = localStorage.getItem('access_token')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (token) {
      api.getMe()
        .then(user => setIsAdmin(user.role === 'SUPERADMIN'))
        .catch(err => console.error('Failed to fetch user role:', err))
    }
  }, [token])

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    navigate('/login')
  }

  return (
    <nav className="border-b border-slate-800 bg-slate-900 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center">
                <Shield className="w-4 h-4 text-slate-300" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight text-white">
                  OVERLAY<span className="text-slate-400">VPN</span>
                </span>
                <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider bg-slate-800 text-slate-400 border border-slate-700 rounded-sm">
                  Control Plane
                </span>
              </div>
            </Link>

            {token && (
              <div className="hidden md:flex items-center space-x-1">
                <Link
                  to="/"
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <Network className="w-4 h-4 text-slate-500" />
                  <span>Networks</span>
                </Link>
                {isAdmin && (
                  <Link
                    to="/gateways"
                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <Server className="w-4 h-4 text-slate-500" />
                    <span>Gateways</span>
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-3 py-1 rounded-sm bg-emerald-900/30 border border-emerald-900/50 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="hidden sm:inline">Dataplane:</span>
              <span className="font-bold">Operational</span>
            </div>

            {token && (
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 p-2 sm:px-3 sm:py-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950 border border-transparent hover:border-rose-900 transition-all text-xs font-medium"
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
