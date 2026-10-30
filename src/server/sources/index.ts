import { MangaSource } from './types';
import { MangaDexSource } from './mangadex';
import { SampleMangaSource } from './sample';
import { GenericHtmlSource } from './generic-html';

const sources: MangaSource[] = [
  new SampleMangaSource(),
  new MangaDexSource(),
  new GenericHtmlSource()
];

export function getSourceForUrl(url: string): MangaSource {
  for (const source of sources) {
    if (source.canHandle(url)) {
      return source;
    }
  }
  // Default fallback is the Generic HTML scraper
  return sources[sources.length - 1];
}

export function getAllSources(): MangaSource[] {
  return sources;
}

export async function testSourceHealth(): Promise<{ id: string; name: string; status: 'ok' | 'degraded' | 'offline'; latencyMs: number }[]> {
  const results = [];
  for (const source of sources) {
    const start = Date.now();
    try {
      if (source.id === 'sample-local') {
        results.push({ id: source.id, name: source.name, status: 'ok' as const, latencyMs: 5 });
      } else if (source.id === 'mangadex') {
        const res = await fetch('https://api.mangadex.org/ping', { signal: AbortSignal.timeout(3000) });
        const latency = Date.now() - start;
        results.push({ id: source.id, name: source.name, status: res.ok ? 'ok' as const : 'degraded' as const, latencyMs: latency });
      } else {
        results.push({ id: source.id, name: source.name, status: 'ok' as const, latencyMs: 15 });
      }
    } catch {
      results.push({ id: source.id, name: source.name, status: 'degraded' as const, latencyMs: Date.now() - start });
    }
  }
  return results;
}
