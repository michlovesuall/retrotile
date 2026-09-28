import os from 'os';

export interface LanAddressInfo {
  name: string;
  address: string;
  isPrivate: boolean;
  priority: number;
}

export interface ServerLanInfo {
  primaryIp: string;
  primaryUrl: string;
  port: number;
  allIps: LanAddressInfo[];
  instructions: string;
}

/**
 * Discovers and prioritizes usable IPv4 LAN addresses for offline Wi-Fi / hotspot gameplay.
 * Prioritizes standard Wi-Fi / hotspot subnets (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
 * and ignores loopback, link-local, and virtual adapters.
 */
export function detectLanInfo(port: number = 3000): ServerLanInfo {
  const interfaces = os.networkInterfaces();
  const candidates: LanAddressInfo[] = [];

  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    const isVirtual =
      lowerName.includes('vbox') ||
      lowerName.includes('vmnet') ||
      lowerName.includes('docker') ||
      lowerName.includes('veth') ||
      lowerName.includes('br-') ||
      lowerName.includes('wsl');

    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        let priority = 10;
        let isPrivate = false;

        // 192.168.x.x - Most common for Wi-Fi routers and mobile hotspots
        if (net.address.startsWith('192.168.')) {
          priority = isVirtual ? 4 : 1;
          isPrivate = true;
        }
        // 10.x.x.x - Common enterprise & mobile phone hotspot subnets
        else if (net.address.startsWith('10.')) {
          priority = isVirtual ? 5 : 2;
          isPrivate = true;
        }
        // 172.16.0.0 – 172.31.255.255
        else if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(net.address)) {
          priority = isVirtual ? 6 : 3;
          isPrivate = true;
        }

        candidates.push({
          name,
          address: net.address,
          isPrivate,
          priority,
        });
      }
    }
  }

  // Sort by priority (lowest number = highest priority)
  candidates.sort((a, b) => a.priority - b.priority);

  const primaryIp = candidates[0]?.address || '127.0.0.1';
  const primaryUrl = `http://${primaryIp}:${port}`;

  return {
    primaryIp,
    primaryUrl,
    port,
    allIps: candidates,
    instructions: `Connect all devices to the same Wi-Fi router or hotspot, then open ${primaryUrl} on player phones.`,
  };
}
