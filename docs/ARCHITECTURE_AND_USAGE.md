# MangaX Architecture and Usage

## Overview

MangaX is a self-hosted React and TypeScript application. Express serves the frontend and `/api`; source adapters provide website-specific metadata, chapter, and page extraction. SQLite stores the library and reading data.

```text
React components → frontend API client → Express routes → registered MangaSource adapters → SQLite
                                                              ↑
                                                    chapter monitoring
```

The server entry point is `server.ts`. Vite runs as Express middleware during development; production serves the `dist/` build.

## Source adapter architecture

Every website integration implements `MangaSource` from `src/server/sources/types.ts`. The adapter registry in `src/server/sources/index.ts` maps registered domains to explicit TypeScript modules and rejects overlapping registrations. Requests never select or load code dynamically.

- `MangaDexSource` in `src/server/sources/mangadex.ts` uses the structured MangaDex API.
- `SampleMangaSource` in `src/server/sources/sample.ts` provides local demo data.
- Reviewed additional adapters are imported in `src/server/sources/custom/index.ts`.
- `src/server/services/safe-http.ts` applies HTTP/HTTPS, address, redirect, timeout, and response-size checks to adapter requests.

There is no generic HTML scraper. If no registered adapter supports a URL, Add Manga and source APIs return an unsupported-domain error. The **Supported Sources** page lists adapter names, domains, and current health state.

See [MangaX Adapter Development Guide](ADAPTER_DEVELOPMENT.md) for the contract and workflow.

## Database and migrations

The default file is `data/manga_x.sqlite`; `MANGAX_DATA_DIR` selects another directory. `sql.js` loads the database into memory and writes the exported SQLite file after updates.

The migrations in `src/server/db/database.ts` create the library, sources, chapters, preferences, monitoring data, and later metadata fields. Migration 5 allows special chapters without numeric chapter values. Migration 6 retires the historical `source_parsers` table and changes tracked parser source types to `unsupported`. It does not delete manga, chapter rows, reader preferences, or progress. Earlier migration records remain unchanged for installed databases.

## Main workflows

### Adding a manga

`AddMangaModal` sends the entered URL to `/api/sources/preview`. `getSourceForUrl` selects the registered adapter by domain. MangaX previews metadata, chapter count, and a sample reader page. On save, `/api/mangas` stores the title and chapters. A supplied URL that has no registered adapter is rejected; users can still add a manual title without supplying a website URL.

### Reading

`Reader` requests `/api/reader/chapter/:id`. The route selects the source adapter using the stored chapter URL, gets ordered image URLs, and returns the stored reading progress and preferences. Images continue to load through `/api/proxy/image`.

### Monitoring

`MonitoringService` checks active source URLs through the same adapter registry. It deduplicates chapters by normalized URL so repeated chapter numbers across translations or editions remain distinct. Failures are recorded in `check_logs` and on the source row.

## Security and limits

- Only HTTP and HTTPS URLs without credentials are accepted for external sources.
- The shared safe HTTP utility blocks local/private network addresses, rechecks redirect destinations, and limits time, redirects, and response size.
- Reader images use the protected proxy and existing advertisement block list.
- Adapter modules are trusted executable code. Review them before explicit registration; do not load user uploads or pass application secrets to an adapter.
- MangaDex uses a dedicated API adapter. JavaScript-rendered websites require a reviewed TypeScript adapter or a documented API; MangaX does not fall back to selector rules or heuristic scraping.
