// Security, Ad Protection and Safe Proxy module inspired by FRANK Scanlation

// Blocklist of aggressive advertising, redirectors, and tracking domains
export const BLOCKED_AD_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'popcash.net',
  'popads.net',
  'adsterra.com',
  'exoclick.com',
  'propellerads.com',
  'monetag.com',
  'outbrain.com',
  'taboola.com',
  'trafficstars.com',
  'clickadu.com',
  'zeroredirect.com',
  'adtrue.com',
  'yllix.com',
  'juicyads.com',
  'onclickperf.com',
  'onclickmega.com',
  'adnxs.com'
];

export interface NavigationCheckResult {
  allowed: boolean;
  reason?: string;
}

export class SecurityService {
  private blockedEventsCount = 0;
  private blockedLogs: { timestamp: number; url: string; reason: string }[] = [];

  isUrlAllowed(url: string, sourceHost?: string): NavigationCheckResult {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();

      // Check against ad domain blacklist
      for (const adDomain of BLOCKED_AD_DOMAINS) {
        if (host === adDomain || host.endsWith('.' + adDomain)) {
          this.recordBlock(url, `Domínio de anúncio/redirecionamento bloqueado: ${adDomain}`);
          return { allowed: false, reason: `Ad blocker: ${adDomain}` };
        }
      }

      // Check scheme
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        this.recordBlock(url, `Protocolo não seguro ou bloqueado: ${parsed.protocol}`);
        return { allowed: false, reason: 'Invalid protocol' };
      }

      return { allowed: true };
    } catch {
      return { allowed: false, reason: 'Invalid URL format' };
    }
  }

  private recordBlock(url: string, reason: string): void {
    this.blockedEventsCount++;
    this.blockedLogs.unshift({
      timestamp: Date.now(),
      url,
      reason
    });
    if (this.blockedLogs.length > 50) {
      this.blockedLogs.pop();
    }
  }

  getBlockedStats() {
    return {
      totalBlocked: this.blockedEventsCount,
      recentLogs: this.blockedLogs
    };
  }
}

export const securityService = new SecurityService();
