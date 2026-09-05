import {
  AuthResponse,
  Network,
  Device,
  DeviceConfigResponse,
  Route,
  FirewallRule,
  Gateway,
  GatewayHealth,
} from '../types'

const BASE_URL = '/api/v1'

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    let errorDetail = 'API Request Failed'
    try {
      const err = await response.json()
      errorDetail = err.detail || errorDetail
    } catch {
      // ignore json parse error
    }
    throw new Error(errorDetail)
  }

  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

export const api = {
  // Auth
  register: (data: { email: string; password: string; tenant_name: string }) =>
    request<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const formData = new URLSearchParams()
    formData.append('username', email)
    formData.append('password', password)

    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail || 'Login failed')
    }
    const data: AuthResponse = await response.json()
    localStorage.setItem('access_token', data.access_token)
    return data
  },

  getMe: () => request<any>('/auth/me'),

  // Networks
  getNetworks: () => request<Network[]>('/networks'),
  getNetwork: (id: string) => request<Network>(`/networks/${id}`),
  createNetwork: (data: { name: string; cidr?: string }) =>
    request<Network>('/networks', { method: 'POST', body: JSON.stringify(data) }),
  deleteNetwork: (id: string) => request<void>(`/networks/${id}`, { method: 'DELETE' }),

  // Devices
  getNetworkDevices: (networkId: string) =>
    request<Device[]>(`/networks/${networkId}/devices`),
  createDevice: (networkId: string, data: { name: string; public_key: string; is_exit_node?: boolean }) =>
    request<DeviceConfigResponse>(`/networks/${networkId}/devices`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteDevice: (deviceId: string) =>
    request<void>(`/devices/${deviceId}`, { method: 'DELETE' }),

  // Routes
  getNetworkRoutes: (networkId: string) =>
    request<Route[]>(`/networks/${networkId}/routes`),
  createRoute: (networkId: string, data: { destination_cidr: string; next_hop_vpn_ip: string; description?: string }) =>
    request<Route>(`/networks/${networkId}/routes`, { method: 'POST', body: JSON.stringify(data) }),
  deleteRoute: (routeId: string) =>
    request<void>(`/routes/${routeId}`, { method: 'DELETE' }),

  // Firewall
  getNetworkFirewallRules: (networkId: string) =>
    request<FirewallRule[]>(`/networks/${networkId}/firewall/rules`),
  createFirewallRule: (networkId: string, data: Partial<FirewallRule>) =>
    request<FirewallRule>(`/networks/${networkId}/firewall/rules`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteFirewallRule: (ruleId: string) =>
    request<void>(`/firewall/rules/${ruleId}`, { method: 'DELETE' }),

  // Gateways
  getGateways: () => request<Gateway[]>('/gateways'),
  getGatewayHealth: (id: string) => request<GatewayHealth>(`/gateways/${id}/health`),
  triggerFailover: (id: string) =>
    request<any>(`/gateways/${id}/failover`, { method: 'POST' }),
}
