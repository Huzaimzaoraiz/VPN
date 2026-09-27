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
    <nav className="w-full md:w-64 bg-black border-r border-white min-h-screen sticky top-0 flex flex-col p-4 z-40">
      <div className="flex flex-col h-full">
        <div className="flex items-center space-x-3 mb-10 px-2 pt-4">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 border border-white/10 rounded-lg flex items-center justify-center text-white bg-white/5 group-hover:bg-white/10 transition-colors">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-xl tracking-tight text-white block leading-tight">
                OVERLAY
              </span>
              <span className="text-xs uppercase font-mono tracking-wider text-gray-400">
                Network
              </span>
            </div>
          </Link>
        </div>

        {token && (
          <div className="flex flex-col space-y-2 flex-1">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2 pb-2">Menu</div>
            <Link
              to="/"
              className="flex items-center space-x-3 px-4 py-3 border-transparent hover:bg-white/5 text-sm font-semibold text-gray-300 hover:text-white rounded-lg transition-all group"
            >
              <Network className="w-5 h-5 text-white" />
              <span>Networks</span>
            </Link>
            {isAdmin && (
              <Link
                to="/gateways"
                className="flex items-center space-x-3 px-4 py-3 border-transparent hover:bg-white/5 text-sm font-semibold text-gray-300 hover:text-white rounded-lg transition-all group"
              >
                <Server className="w-5 h-5 text-white" />
                <span>Gateways</span>
              </Link>
            )}
          </div>
        )}

        <div className="mt-auto pt-6 border-t border-white/10">
          <div className="flex flex-col space-y-4 px-2">
            <div className="flex flex-col space-y-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</span>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-emerald-400 text-xs font-mono font-medium">Dataplane Online</span>
              </div>
            </div>

            {token && (
              <button
                onClick={handleLogout}
                className="flex items-center justify-center space-x-2 px-3 py-2 border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-gray-300 rounded-lg transition-all text-sm font-medium mt-4"
              >
                <LogOut className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
