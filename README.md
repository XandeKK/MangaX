# MangaX — Manga Tracker & Reader

MangaX is a self-hosted manga, manhwa, manhua, and webtoon library with chapter tracking and an integrated reader. Add titles from a supported website or enter details manually, track unread chapters, and save reading progress locally.

The application uses a React and TypeScript frontend, an Express backend, and a local SQLite database.

## Features

- Organize a personal library with search, filters, and reading status.
- Track chapters and receive in-app notifications when monitoring finds new releases.
- Read chapters in single-page, double-page, book, or vertical scroll modes.
- Save chapter progress and reader preferences per title.
- Add a manga from a supported URL; MangaX selects its reviewed TypeScript adapter by domain.
- Browse adapter availability and diagnose source and reader health.

Only explicitly registered TypeScript adapters can fetch website content. MangaDex uses its structured API adapter. Unsupported websites receive a clear unsupported-source error; there is no generic scraping fallback.

## Requirements and setup

- Node.js 20 or newer
- npm

```bash
git clone <repository-url>
cd mangax
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The server creates `data/manga_x.sqlite` on first startup and seeds a sample library if the database is empty.

For production:

```bash
npm run build
NODE_ENV=production npm start
```

The server listens on port `3000` by default. Set `PORT` to choose a different port. Keep `data/` writable so SQLite data persists. `MANGAX_DATA_DIR` selects a different data directory.

## Development commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start Express with the Vite development server. |
| `npm run build` | Build frontend assets into `dist/`. |
| `npm start` | Start the Express server. Set `NODE_ENV=production` to serve the build. |
| `npm run lint` | Run TypeScript checks without emitting files. |
| `npm test` | Run source registry, migration, reader, and application tests with a temporary SQLite database. |

## Project structure

```text
src/
  components/       React views, dialogs, and reader
  services/         Frontend API client
  server/
    db/             SQLite initialization and migrations
    services/       Monitoring, security, and safe HTTP requests
    sources/        MangaDex, sample, and reviewed TypeScript adapters
      custom/       Explicit registration point for trusted adapters
    routes.ts       Express API routes
  types.ts          Shared frontend types
server.ts           Express and Vite application entry point
data/               Local SQLite database (created at runtime)
docs/               Architecture notes and adapter development guide
```

## Website adapters

The supported sources screen lists registered adapters and their domains. Adding a website integration requires implementing `MangaSource` in TypeScript and registering the reviewed module in `src/server/sources/custom/index.ts`. MangaX does not load uploaded or dynamically selected code.

See the [MangaX Adapter Development Guide](docs/ADAPTER_DEVELOPMENT.md) for the actual contract, domain matching, safe HTTP requests, and test workflow.

## Data and security

Manga, chapters, source records, reading preferences, progress, notifications, and monitoring history are stored in SQLite. Historical migration entries are retained; migration 6 removes retired parser configuration data and marks its tracked source rows unsupported without deleting library or reading data.

Adapters use the shared safe HTTP utility for HTTP/HTTPS validation, public-address checks, redirect validation, request timeouts, and response-size limits. Reader images continue through the protected image proxy.

See [Architecture and Usage](docs/ARCHITECTURE_AND_USAGE.md) and the [Adapter Development Guide](docs/ADAPTER_DEVELOPMENT.md).
