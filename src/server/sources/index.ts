import { MangaDexSource } from './mangadex';
import { SampleMangaSource } from './sample';
import { trustedSourceAdapters } from './custom';
import { MangaSource } from './types';
import { safeFetch } from '../services/safe-http';

export interface SourceRegistration {
  source: MangaSource;
  domains: string[];
  allowSubdomains?: boolean;
}

function normalizeDomain(domain: string): string {
  const normalized = domain.trim().toLowerCase().replace(/\.$/, '');
  if (!normalized || normalized.includes('://') || normalized.includes('/') || normalized.includes(':') ||
      normalized.startsWith('.') || normalized.endsWith('.') || normalized.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) {
    throw new Error(`Invalid registered source domain "${domain}".`);
  }
  return normalized;
}

function registrationMatchesDomain(registration: SourceRegistration, hostname: string): boolean {
  return registration.domains.some(domain => hostname === domain ||
    (registration.allowSubdomains === true && hostname.endsWith(`.${domain}`)));
}

function registrationsOverlap(left: SourceRegistration, right: SourceRegistration): boolean {
  return left.domains.some(leftDomain => right.domains.some(rightDomain =>
    leftDomain === rightDomain ||
    (left.allowSubdomains === true && rightDomain.endsWith(`.${leftDomain}`)) ||
    (right.allowSubdomains === true && leftDomain.endsWith(`.${rightDomain}`))));
}

/** Build and validate an explicit registry; exported for deterministic registry tests. */
export function createSourceRegistry(registrations: SourceRegistration[]): SourceRegistration[] {
  const normalized = registrations.map(registration => {
    if (!registration.source.id || !registration.source.name || !registration.source.canHandle) {
      throw new Error('Every registered source must provide an id, name, and canHandle method.');
    }
    if (!registration.domains.length) throw new Error(`Source "${registration.source.id}" must register at least one domain.`);
    return { ...registration, domains: registration.domains.map(normalizeDomain) };
  });

  for (let index = 0; index < normalized.length; index++) {
    for (let other = index + 1; other < normalized.length; other++) {
      if (normalized[index].source.id === normalized[other].source.id) {
        throw new Error(`Duplicate source adapter id "${normalized[index].source.id}".`);
      }
      if (registrationsOverlap(normalized[index], normalized[other])) {
        throw new Error(`Source domain registration conflict between "${normalized[index].source.id}" and "${normalized[other].source.id}".`);
      }
    }
  }
  return normalized;
}

const builtInSources: MangaSource[] = [new SampleMangaSource(), new MangaDexSource()];
const registrations = createSourceRegistry([
  ...builtInSources.map(source => ({ source, domains: source.domains, allowSubdomains: source.allowSubdomains })),
  ...trustedSourceAdapters.map(source => ({ source, domains: source.domains, allowSubdomains: source.allowSubdomains }))
]);

const MANGADEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getSourceForUrl(rawUrl: string): MangaSource {
  const value = rawUrl.trim();
  if (MANGADEX_UUID.test(value)) {
    const mangaDex = registrations.find(registration => registration.source.id === 'mangadex');
    if (mangaDex) return mangaDex.source;
  }

  let parsed: URL;
  try { parsed = new URL(value); }
  catch { throw new Error('Enter a valid HTTP or HTTPS URL for a supported manga source.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Only credential-free HTTP and HTTPS source URLs are supported.');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const matches = registrations.filter(registration => registrationMatchesDomain(registration, hostname) && registration.source.canHandle(parsed.href));
  if (matches.length > 1) throw new Error(`More than one source adapter matches "${hostname}". Fix the source registry domain conflict.`);
  if (!matches.length) throw new Error(`No TypeScript source adapter supports "${hostname}" yet.`);
  return matches[0].source;
}

export function getAllSources(): MangaSource[] {
  return registrations.map(registration => registration.source);
}

export function getRegisteredSources() {
  return registrations.map(({ source, domains, allowSubdomains }) => ({
    id: source.id,
    name: source.name,
    domains: [...domains],
    allowSubdomains: allowSubdomains === true
  }));
}

export async function testSourceHealth(): Promise<{
  id: string;
  name: string;
  status: 'ok' | 'degraded' | 'offline' | 'registered';
  latencyMs: number;
  error?: string;
}[]> {
  const results = [];
  for (const source of getAllSources()) {
    const start = Date.now();
    try {
      if (source.id === 'sample-local') {
        results.push({ id: source.id, name: source.name, status: 'ok' as const, latencyMs: 0 });
      } else if (source.id === 'mangadex') {
        const response = await safeFetch('https://api.mangadex.org/ping', {
          allowedDomains: ['api.mangadex.org'], timeoutMs: 3000, maxBytes: 32 * 1024
        });
        const ok = response.status < 400;
        results.push({ id: source.id, name: source.name, status: ok ? 'ok' as const : 'degraded' as const, latencyMs: Date.now() - start, ...(ok ? {} : { error: `MangaDex API returned HTTP ${response.status}.` }) });
      } else {
        results.push({ id: source.id, name: source.name, status: 'registered' as const, latencyMs: 0 });
      }
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message.slice(0, 240) : 'Source health check failed.';
      results.push({ id: source.id, name: source.name, status: 'degraded' as const, latencyMs: Date.now() - start, error: message });
    }
  }
  return results;
}
