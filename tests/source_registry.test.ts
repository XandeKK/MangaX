import assert from 'node:assert/strict';
import { createSourceRegistry, getSourceForUrl } from '../src/server/sources';
import { assertSafeExternalUrl, resolveUrl } from '../src/server/services/safe-http';
import { MangaSource } from '../src/server/sources/types';

function fixtureSource(id: string, domains: string[], allowSubdomains = false): MangaSource {
  return {
    id, name: id, baseUrl: `https://${domains[0]}`, domains, allowSubdomains,
    canHandle(url: string) {
      try { return this.domains.includes(new URL(url).hostname); } catch { return false; }
    },
    async extractManga(url) { return { title: id, mainUrl: url }; },
    async extractChapters() { return []; },
    async extractPages(chapterId) { return { chapterId, pages: [] }; }
  };
}

assert.equal(getSourceForUrl('https://mangadex.org/title/abc').id, 'mangadex');
assert.equal(getSourceForUrl('https://www.mangadex.org/title/abc').id, 'mangadex', 'MangaDex subdomains are approved by its registration');
assert.equal(getSourceForUrl('https://frank.local/sample-frieren').id, 'sample-local');
assert.equal(getSourceForUrl('32d76d19-8a05-4db0-9fc2-e0b0648fe9d0').id, 'mangadex', 'MangaDex UUID support remains available');
assert.equal(resolveUrl('../chapter/2', 'https://reader.example/title/series'), 'https://reader.example/chapter/2');
await assert.rejects(assertSafeExternalUrl('http://127.0.0.1/secret'), /Private network addresses/);
await assert.rejects(assertSafeExternalUrl('file:///etc/passwd'), /Invalid URL|Only HTTP and HTTPS/);
await assert.rejects(assertSafeExternalUrl('https://sub.example.com/path', ['example.com'], false), /outside the allowed request domains/);

assert.throws(() => getSourceForUrl('https://notmangadex.org/title/abc'), /No TypeScript source adapter supports/);
assert.throws(() => getSourceForUrl('file:///etc/passwd'), /Only credential-free HTTP and HTTPS/);
assert.throws(() => getSourceForUrl('https://user:pass@mangadex.org/title/abc'), /credential-free HTTP and HTTPS/);

const registry = createSourceRegistry([
  { source: fixtureSource('host-source', ['reader.example']), domains: ['reader.example'], allowSubdomains: true },
  { source: fixtureSource('other-source', ['other.example']), domains: ['other.example'] }
]);
assert.equal(registry.length, 2);
assert.throws(() => createSourceRegistry([
  { source: fixtureSource('parent', ['example.org']), domains: ['example.org'], allowSubdomains: true },
  { source: fixtureSource('child', ['reader.example.org']), domains: ['reader.example.org'] }
]), /domain registration conflict/);
assert.throws(() => createSourceRegistry([
  { source: fixtureSource('first', ['same.example']), domains: ['same.example'] },
  { source: fixtureSource('second', ['same.example']), domains: ['same.example'] }
]), /domain registration conflict/);
assert.throws(() => createSourceRegistry([
  { source: fixtureSource('bad', ['https://bad.example']), domains: ['https://bad.example'] }
]), /Invalid registered source domain/);

console.log('[PASS] source registry exact/subdomain matching, unsupported URLs, MangaDex selection, and conflict validation');
