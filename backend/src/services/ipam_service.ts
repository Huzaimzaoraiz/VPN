export class IPAMService {
  /**
   * Converts an IPv4 address string to an integer.
   */
  static ipToInt(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  /**
   * Converts an integer back to an IPv4 address string.
   */
  static intToIp(int: number): string {
    return [
      (int >>> 24) & 255,
      (int >>> 16) & 255,
      (int >>> 8) & 255,
      int & 255
    ].join('.');
  }

  /**
   * Returns the network address and broadcast address of a given CIDR.
   */
  static getCidrRange(cidr: string): { networkInt: number; broadcastInt: number; maskLength: number } {
    const [ipStr, maskStr] = cidr.split('/');
    const maskLength = parseInt(maskStr, 10);
    const ipInt = this.ipToInt(ipStr);
    
    const wildcardMask = (1 << (32 - maskLength)) - 1;
    const subnetMask = ~wildcardMask;

    const networkInt = (ipInt & subnetMask) >>> 0;
    const broadcastInt = (networkInt | wildcardMask) >>> 0;

    return { networkInt, broadcastInt, maskLength };
  }

  /**
   * The gateway is always assigned the first usable IP after the network address.
   */
  static getGatewayIp(cidr: string): string {
    const { networkInt } = this.getCidrRange(cidr);
    return this.intToIp(networkInt + 1);
  }

  /**
   * Allocates the next available IP address in the CIDR.
   * Devices are allocated starting from .10 to leave room for infrastructure.
   */
  static allocateNextIp(cidr: string, usedIps: string[]): string | null {
    const { networkInt, broadcastInt } = this.getCidrRange(cidr);
    const usedInts = new Set(usedIps.map(ip => this.ipToInt(ip)));
    
    // Start allocating from .10
    const startInt = networkInt + 10;
    const endInt = broadcastInt - 1; // Don't assign broadcast

    for (let current = startInt; current <= endInt; current++) {
      if (!usedInts.has(current)) {
        return this.intToIp(current);
      }
    }

    return null; // Network is full
  }
}
