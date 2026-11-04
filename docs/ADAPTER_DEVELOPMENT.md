# MangaX Adapter Development Guide

MangaX integrates websites with explicit TypeScript modules. A `MangaSource` is a trusted adapter that implements the metadata, chapter, and reader operations used by Add Manga, monitoring, and the reader.

Adapters are executable server code. Review an adapter before registration. MangaX never imports user-uploaded TypeScript or dynamically loads a module based on a request.

## Where adapters live

- The contract is `src/server/sources/types.ts`.
- Existing adapters are `src/server/sources/mangadex.ts` and `src/server/sources/sample.ts`.
- Put reviewed site-specific implementations in `src/server/sources/custom/`.
- Import the adapter and add it to `trustedSourceAdapters` in `src/server/sources/custom/index.ts`.
- The central registry in `src/server/sources/index.ts` checks domains and rejects overlapping registrations.

## The actual `MangaSource` contract

```ts
export interface MangaSource {
  id: string;
  name: string;
  baseUrl: string;
  domains: string[];
  allowSubdomains?: boolean;
  canHandle(url: string): boolean;
  extractManga(url: string): Promise<MangaMetadata>;
  extractChapters(urlOrExternalId: string): Promise<ChapterMetadata[]>;
  extractPages(chapterUrlOrId: string): Promise<ChapterPagesResult>;
  search?(query: string): Promise<MangaMetadata[]>;
}
```

`MangaMetadata` requires `title` and `mainUrl`; description, cover, type, status, author, artist, genres, alternate titles, and external ID can be absent. `ChapterMetadata` requires an adapter-local `id`, title, chapter number (or `null` for a special chapter), display text, and URL. Volume, release date, language, and page count are optional. `ChapterPagesResult` returns an ordered `pages` array with one-based `index` values and image URLs; page dimensions and chapter navigation metadata are optional. Refer to `types.ts` for the complete current definitions.

An operation should return the typed data on success and throw an informative `Error` on failure. The metadata, chapter, and page result types each allow an optional `warnings` array for recoverable source issues. The API identifies the adapter in preview and reader responses and presents operation errors to the user.

## Minimal adapter example

This example follows the repository's exact interface. The URLs and values are illustrative; replace the extraction methods with the website's documented API or site-specific HTML logic.

```ts
import type { MangaSource, MangaMetadata, ChapterMetadata, ChapterPagesResult } from '../types';
import { safeFetch } from '../../services/safe-http';

export class ExampleSource implements MangaSource {
  id = 'example-source';
  name = 'Example Source';
  baseUrl = 'https://manga.example';
  domains = ['manga.example'];
  allowSubdomains = false;

  canHandle(url: string): boolean {
    try { return new URL(url).hostname.toLowerCase() === 'manga.example'; }
    catch { return false; }
  }

  async extractManga(url: string): Promise<MangaMetadata> {
    // Replace with site-specific extraction. Keep the request on the registered host.
    const response = await safeFetch(url, {
      allowedDomains: this.domains,
      timeoutMs: 10000,
      maxBytes: 1024 * 1024,
      headers: { Accept: 'application/json' }
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Example Source returned HTTP ${response.status} for manga details.`);
    }
    let data: { title?: unknown; description?: unknown; cover?: unknown };
    try { data = JSON.parse(Buffer.from(response.body).toString('utf8')); }
    catch { throw new Error('Example Source returned malformed manga data.'); }
    if (typeof data.title !== 'string' || !data.title.trim()) {
      throw new Error('The manga title was missing from the example response.');
    }

    return {
      title: data.title.trim(),
      mainUrl: response.url,
      ...(typeof data.description === 'string' ? { description: data.description } : {}),
      ...(typeof data.cover === 'string' ? { coverUrl: new URL(data.cover, response.url).href } : {})
    };
  }

  async extractChapters(_urlOrExternalId: string): Promise<ChapterMetadata[]> {
    return [
      {
        id: 'example-chapter-1',
        title: 'Chapter 1: Arrival',
        chapterNumber: 1,
        chapterNumberText: 'Chapter 1',
        url: 'https://manga.example/title/example/chapter/1',
        releaseDate: '2026-01-10'
      },
      {
        id: 'example-chapter-2',
        title: 'Chapter 2: The Road',
        chapterNumber: 2,
        chapterNumberText: 'Chapter 2',
        url: 'https://manga.example/title/example/chapter/2'
      }
    ];
  }

  async extractPages(chapterUrlOrId: string): Promise<ChapterPagesResult> {
    const chapterId = new URL(chapterUrlOrId).pathname.split('/').filter(Boolean).at(-1) || chapterUrlOrId;
    return {
      chapterId,
      pages: [
        { index: 1, url: `https://images.example/${chapterId}/001.jpg` },
        { index: 2, url: `https://images.example/${chapterId}/002.jpg` },
        { index: 3, url: `https://images.example/${chapterId}/003.jpg` }
      ]
    };
  }
}
```

This example assumes the website exposes a JSON endpoint on the registered domain. For HTML sites, use an HTML parsing library as appropriate, and validate all values returned from the site.

## Domain matching and registration

The registry matches the URL hostname against the adapter's `domains`. Matching is exact by default. Set `allowSubdomains = true` only when the adapter intentionally supports hosts below each registered domain. Registry overlap (including an exact host that falls under another adapter's approved subdomain rule) fails at startup.

Register only an explicit, reviewed import:

```ts
import { ExampleSource } from './example-source';

export const trustedSourceAdapters: MangaSource[] = [new ExampleSource()];
```

Do not add a selector configuration, uploaded module, dynamic import, or generic fallback. One adapter owns one website's extraction behavior.

## Implementing extraction

### Manga metadata

`extractManga(url)` should return the page's title and canonical manga URL. Include description, cover, author, artist, genres, status, type, alternative titles, and an external ID when the site provides them. Omit data the website does not provide.

### Chapters

`extractChapters(urlOrExternalId)` should return the site's chapter records. Preserve original display titles and special entries. Use decimal numbers where available and `null` for chapters with no numeric number. Keep URL identity stable; chapter numbers may repeat across language releases or editions. Follow site pagination inside this adapter and return chapters in a consistent source order.

### Reader images

`extractPages(chapterUrlOrId)` returns the reader's image URLs in display order. Resolve relative URLs against the correct page or API base with `new URL(relative, base)`. Check lazy-loaded image fields and site APIs when required. Return a clear error if the source has no usable pages.

### Errors and safe requests

Use `safeFetch` from `src/server/services/safe-http.ts` for external requests. Provide an explicit allowed domain list for the origin and any documented CDN/API domains the adapter needs. The helper restricts protocols, blocks private and local addresses, revalidates redirect destinations, and enforces timeout, redirect, and response-size limits. Keep errors useful to the user without including credentials, secrets, or large response bodies.

Do not read environment secrets from adapters. If a source requires authentication, first design a narrowly scoped credential flow; never hard-code credentials or expose them to the browser.

## Testing and running MangaX

1. Add local HTML or JSON fixtures for the website responses.
2. Test metadata fields, chapter ordering and numbering, relative links, reader page ordering, pagination, and failure messages.
3. Add the adapter to the explicit registry and test exact domain matching, intended subdomains, and conflicts.
4. Run `npm test`, `npm run lint`, and `npm run build`.
5. Start the app with `npm run dev`, add a test manga through its URL, inspect discovered chapters, open a chapter, and run a monitoring refresh.

MangaDex is a dedicated API adapter and should remain independent from HTML-specific logic.

## Built-in Demonicscans adapter

`src/server/sources/custom/demonic-scans.ts` is the reviewed adapter for the exact `demonicscans.org` host. It reads the site's manga details from `#manga-info-rightColumn`, chapter links from `#chapters-list a.chplinks`, and reader pages from `.imgholder` images. The list page currently includes its full chapter list in the HTML; the adapter checks the displayed chapter count and reports an error when fewer valid links are present instead of treating a partial list as complete.

The reader currently serves page images from the exact `cdn2.demoniclibs.com` host and manga covers from `readermc.org`. The adapter filters out the site's ad image and other chapters' pages, resolves relative links, normalizes chapter URLs, and preserves page numbering. It does not enable the alternative CDN mentioned by the site's error-handling script because its TLS certificate could not be verified during review. Update the allowlist only after verifying the host and its redirects.

Local fixture coverage is in `tests/demonic_scans_adapter.test.ts`; run it with `npm test` as part of the complete suite.

## Built-in Asura Scans adapter

`src/server/sources/custom/asura-scans.ts` handles the exact `asurascans.com` host. Manga metadata comes from the page's `ComicSeries` JSON-LD and visible status/type values. The adapter reads chapter rows from the manga page's `.group` chapter links and verifies them against the displayed chapter count; the supplied page returned all 178 chapter links in its HTML.

Reader pages use `img[data-page-index]` and are hosted at `cdn.asurascans.com/asura-images/chapters/`. The zero-based page index establishes reading order; image filenames are hashes. The adapter only accepts page paths for the current chapter and exact verified CDN host. Fixture coverage is in `tests/asura_scans_adapter.test.ts` and runs with `npm test`.
