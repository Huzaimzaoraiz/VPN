export interface User {
  id: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

export interface Tenant {
  id: string
  name: string
  created_at: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface Network {
  id: string
  tenant_id: string
  name: string
  cidr: string
  vlan_id: number
  created_at: string
  device_count: number
  assigned_gateway_id: string | null
  assigned_gateway_hostname: string | null
  assigned_gateway_ip: string | null
}

export interface Device {
  id: string
  network_id: string
  gateway_id: string
  name: string
  public_key: string
  vpn_ip: string
  status: 'CREATED' | 'PENDING' | 'CONFIGURED' | 'ONLINE' | 'OFFLINE' | 'REVOKED'
  is_exit_node: boolean
  last_seen: string | null
  created_at: string
}

export interface DeviceConfigResponse {
  device_id: string
  name: string
  vpn_ip: string
  subnet_cidr: string
  gateway_endpoint: string
  gateway_public_key: string
  dns_servers: string[]
  allowed_ips: string[]
  keepalive: number
  wireguard_conf_text: string
}

export interface Route {
  id: string
  network_id: string
  destination_cidr: string
  next_hop_vpn_ip: string
  device_id: string | null
  gateway_id: string | null
  description: string | null
  created_at: string
}

export interface FirewallRule {
  id: string
  network_id: string
  priority: number
  source_cidr: string
  destination_cidr: string
  protocol: 'all' | 'tcp' | 'udp' | 'icmp'
  port: number | null
  action: 'allow' | 'drop' | 'reject'
  created_at: string
}

export interface Gateway {
  id: string
  node_id: string
  hostname: string
  provider: string
  public_ip: string
  listen_port: number
  public_key: string
  region: string
  status: 'PROVISIONING' | 'JOINING' | 'READY' | 'DEGRADED' | 'DRAINING' | 'UNHEALTHY' | 'TERMINATED'
  capacity: number
  current_sessions: number
  cpu_usage: number
  memory_usage: number
  last_heartbeat: string | null
  created_at: string
  updated_at: string
}

export interface GatewayHealth {
  gateway_id: string
  hostname: string
  status: string
  is_healthy: boolean
  score: number
  last_heartbeat_seconds_ago: number | null
  cpu_usage: number
  memory_usage: number
  active_sessions: number
}
