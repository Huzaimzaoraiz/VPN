import { x25519 } from '@noble/curves/ed25519'

export interface WireguardKeypair {
  privateKeyBase64: string
  publicKeyBase64: string
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Generates an RFC 7748 Curve25519 keypair in the browser.
 * The private key stays strictly in client-side memory.
 */
export function generateWireguardKeypair(): WireguardKeypair {
  const privateBytes = x25519.utils.randomPrivateKey()
  const publicBytes = x25519.getPublicKey(privateBytes)

  return {
    privateKeyBase64: bytesToBase64(privateBytes),
    publicKeyBase64: bytesToBase64(publicBytes),
  }
}

/**
 * Compiles a client WireGuard configuration file with client private key injected.
 */
export function buildClientWireguardConfig(
  clientPrivateKey: string,
  clientVpnIp: string,
  gatewayPublicKey: string,
  gatewayEndpoint: string,
  allowedIps: string[] = ['0.0.0.0/0'],
  dns: string[] = ['1.1.1.1', '1.0.0.1']
): string {
  return `[Interface]
# Generated client configuration - Keep PrivateKey secure!
PrivateKey = ${clientPrivateKey}
Address = ${clientVpnIp}/24
DNS = ${dns.join(', ')}

[Peer]
PublicKey = ${gatewayPublicKey}
Endpoint = ${gatewayEndpoint}
AllowedIPs = ${allowedIps.join(', ')}
PersistentKeepalive = 25
`
}
