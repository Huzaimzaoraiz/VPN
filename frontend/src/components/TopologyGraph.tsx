import React from 'react'
import { Server, Laptop, Wifi, WifiOff } from 'lucide-react'
import { Network, Device } from '../types'

interface TopologyGraphProps {
  network: Network
  devices: Device[]
}

export const TopologyGraph: React.FC<TopologyGraphProps> = ({ network, devices }) => {
  return (
    <div className="p-6 bg-[#09090b] border border-white/10 rounded relative overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Network Topology & Datapath</h3>
          <p className="text-xs text-gray-400">
            Logical Overlay Map: OVS Segment VLAN {network.vlan_id} ({network.cidr})
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono text-gray-400">
          <span className="w-2 h-2  bg-emerald-400"></span>
          <span>{devices.length} Peer Nodes</span>
        </div>
      </div>

      <div className="flex flex-col items-center">
        {/* Gateway Node */}
        <div className="relative group">
          <div className="w-48 p-4 bg-black border border-white/10 flex flex-col items-center text-center z-10 relative rounded">
            <div className="w-10 h-10 border border-white/10 flex items-center justify-center text-white mb-2 rounded">
              <Server className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white truncate max-w-full">
              {network.assigned_gateway_hostname || 'VPN Gateway Node'}
            </span>
            <span className="text-[10px] font-mono text-emerald-400 mt-0.5">
              {network.assigned_gateway_ip || 'WAN IP'} : 51820
            </span>
            <div className="mt-2 flex gap-1">
              <span className="px-1.5 py-0.5 text-[9px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                OVS: br-vpn
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded">
                VLAN {network.vlan_id}
              </span>
            </div>
          </div>
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-slate-700"></div>
        </div>

        {/* Bus connecting gateway to devices */}
        {devices.length > 0 && (
          <div className="w-full max-w-2xl h-0.5 bg-slate-700 mt-6 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
          </div>
        )}

        {/* Peer Device Nodes */}
        <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
          {devices.map((device) => {
            const isOnline = device.status === 'CONFIGURED' || device.status === 'ONLINE'
            return (
              <div
                key={device.id}
                className="p-3.5 bg-[#09090b] border border-white/10 hover:border-white/20 transition-all flex flex-col items-center text-center relative group rounded"
              >
                <div
                  className={`w-8 h-8 flex items-center justify-center mb-2 rounded ${
                    isOnline
                      ? 'border border-white/20 text-white'
                      : 'border border-white/5 text-gray-500'
                  }`}
                >
                  <Laptop className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white truncate max-w-full">
                  {device.name}
                </span>
                <span className="text-[11px] font-mono text-blue-400 mt-0.5">
                  {device.vpn_ip}
                </span>

                <div className="mt-2 flex items-center space-x-1 text-[10px]">
                  {isOnline ? (
                    <span className="flex items-center space-x-1 text-emerald-400 font-medium">
                      <Wifi className="w-3 h-3" />
                      <span>Ready</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 text-gray-500">
                      <WifiOff className="w-3 h-3" />
                      <span>{device.status}</span>
                    </span>
                  )}
                  {device.is_exit_node && (
                    <span className="px-1.5 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] uppercase rounded">
                      Exit Node
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {devices.length === 0 && (
          <div className="mt-8 text-center text-gray-400 text-xs py-6">
            No devices connected yet. Click "Add Device" to generate keys and onboard your first peer.
          </div>
        )}
      </div>
    </div>
  )
}
