import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Dashboard } from './pages/Dashboard'
import { NetworkDetail } from './pages/NetworkDetail'
import { Gateways } from './pages/Gateways'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { ForgotPassword } from './pages/ForgotPassword'

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('access_token')
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

export function App() {
  return (
    <div className="min-h-screen font-sans selection:bg-brand-500/30 selection:text-white flex flex-col md:flex-row">
      <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Navbar />
                <main className="flex-1 overflow-x-hidden overflow-y-auto">
                  <Dashboard />
                </main>
              </ProtectedRoute>
            }
          />
          <Route
            path="/networks/:id"
            element={
              <ProtectedRoute>
                <Navbar />
                <main className="flex-1 overflow-x-hidden overflow-y-auto">
                  <NetworkDetail />
                </main>
              </ProtectedRoute>
            }
          />
          <Route
            path="/gateways"
            element={
              <ProtectedRoute>
                <Navbar />
                <main className="flex-1 overflow-x-hidden overflow-y-auto">
                  <Gateways />
                </main>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    </div>
  )
}
export default App
