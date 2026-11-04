import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const privateNetworks = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4]
] as const) privateNetworks.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['2001:db8::', 32]] as const) {
  privateNetworks.addSubnet(network, prefix, 'ipv6');
}

export function resolveUrl(value: string, baseUrl: string): string {
  try { return new URL(value, baseUrl).href; }
  catch { throw new Error(`Could not resolve URL "${value}" relative to ${baseUrl}.`); }
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

export function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  const host = normalizeHostname(hostname);
  const allowed = normalizeHostname(domain);
  return host === allowed || host.endsWith(`.${allowed}`);
}

export function urlMatchesDomains(url: string, domains: string[]): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) && domains.some(domain => hostnameMatchesDomain(parsed.hostname, domain));
  } catch { return false; }
}

function assertPublicAddress(address: string, family: number): void {
  if (family === 6 && address.toLowerCase().startsWith('::ffff:')) {
    const mapped = address.slice(address.lastIndexOf(':') + 1);
    if (isIP(mapped) === 4 && privateNetworks.check(mapped, 'ipv4')) throw new Error('Private network addresses are not allowed.');
  }
  if (privateNetworks.check(address, family === 6 ? 'ipv6' : 'ipv4')) throw new Error('Private network addresses are not allowed.');
}

export async function assertSafeExternalUrl(rawUrl: string, allowedDomains?: string[], allowSubdomains = true): Promise<URL> {
  let parsed: URL;
  try { parsed = new URL(rawUrl); }
  catch { throw new Error('Invalid URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS URLs are allowed.');
  if (parsed.username || parsed.password) throw new Error('URLs containing credentials are not allowed.');
  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Local and internal hostnames are not allowed.');
  }
  if (allowedDomains && !allowedDomains.some(domain => allowSubdomains
    ? hostnameMatchesDomain(hostname, domain)
    : hostname === normalizeHostname(domain))) {
    throw new Error(`Redirect or URL host "${hostname}" is outside the allowed request domains.`);
  }

  const family = isIP(hostname);
  if (family) assertPublicAddress(hostname, family);
  else {
    let records: { address: string; family: number }[];
    try { records = await lookup(hostname, { all: true, verbatim: true }); }
    catch { throw new Error(`Could not resolve external host "${hostname}".`); }
    if (!records.length) throw new Error(`Could not resolve external host "${hostname}".`);
    for (const record of records) assertPublicAddress(record.address, record.family);
  }
  return parsed;
}

export interface SafeFetchOptions {
  allowedDomains?: string[];
  /** Defaults to true for existing callers; set false for exact host allowlists. */
  allowSubdomains?: boolean;
  blockedDomains?: string[];
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
}

export interface SafeFetchResult {
  url: string;
  status: number;
  headers: Headers;
  body: Uint8Array;
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? 10000;
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
  let currentUrl = rawUrl;

  for (let redirects = 0; redirects <= 5; redirects++) {
    const checkedUrl = await assertSafeExternalUrl(currentUrl, options.allowedDomains, options.allowSubdomains !== false);
    if (options.blockedDomains?.some(domain => hostnameMatchesDomain(checkedUrl.hostname, domain))) {
      throw new Error(`External host "${checkedUrl.hostname}" is blocked.`);
    }
    const response = await fetch(checkedUrl, {
      redirect: 'manual',
      headers: options.headers,
      signal: AbortSignal.timeout(timeoutMs)
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Redirect from ${checkedUrl.href} has no Location header.`);
      if (redirects === 5) throw new Error('The external request exceeded the redirect limit.');
      currentUrl = resolveUrl(location, checkedUrl.href);
      continue;
    }

    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > maxBytes) throw new Error(`The response exceeds the ${maxBytes} byte size limit.`);
    if (!response.body) return { url: checkedUrl.href, status: response.status, headers: response.headers, body: new Uint8Array() };

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new Error(`The response exceeds the ${maxBytes} byte size limit.`);
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return { url: checkedUrl.href, status: response.status, headers: response.headers, body };
  }
  throw new Error('The external request could not be completed.');
}
