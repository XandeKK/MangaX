# MangaX — Manga Tracker & Reader

MangaX is a self-hosted manga, manhwa, manhua, and webtoon library with chapter tracking and an integrated reader. Add titles from supported sources or enter them manually, keep track of unread chapters, and save reading progress locally.

The application runs as a web app: a React and TypeScript frontend is served by an Express backend, which stores its data in a local SQLite database.

## Features

- Organize a personal library with search, filters, and reading status.
- Track chapters and receive in-app notifications when the monitor finds new releases.
- Read chapters in single-page, double-page, book, or vertical scroll modes.
- Use vertical scrolling by default for manhwa, manhua, and webtoon titles; manga titles retain a configurable reading mode.
- Save chapter progress and reader preferences per title.
- Fetch metadata and chapters from MangaDex, use a generic HTML source, or add titles manually.
- Review source health and monitoring activity in the app.

## Requirements

- Node.js 20 or newer
- npm

## Getting Started

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd mangax
npm install
```

Start the app in development mode:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The server creates `data/manga_x.sqlite` automatically the first time it starts and seeds a sample library when the database is empty.

No Gemini API key is required. Online sources such as MangaDex require an internet connection. The generic HTML source may not work with sites that require JavaScript execution or block automated requests.

## Production Build

Build the frontend assets and start the Express server in production mode:

```bash
npm run build
NODE_ENV=production npm start
```

The server listens on port `3000` by default. Set the `PORT` environment variable to use a different port. Keep the `data/` directory available and writable so SQLite data persists across restarts.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Express with the Vite development server. |
| `npm run build` | Build the frontend into `dist/`. |
| `npm start` | Start the server. Set `NODE_ENV=production` to serve the production build. |
| `npm run preview` | Preview the Vite build. |
| `npm run lint` | Run the TypeScript compiler without emitting files. |

## Project Structure

```text
src/
  components/       React views and reader
  services/         Frontend API client
  server/
    db/             SQLite initialization and migrations
    services/       Monitoring and security services
    sources/        MangaDex, generic HTML, and sample sources
    routes.ts       Express API routes
  types.ts          Shared frontend types
server.ts           Express and Vite application entry point
data/               Local SQLite database (created at runtime)
docs/               Additional architecture notes
```

## Adding a Manga Source

Sources implement the `MangaSource` interface in `src/server/sources/types.ts`. Add the implementation under `src/server/sources/` and register it in `src/server/sources/index.ts` to make it available to the application and chapter monitor.

## Data and Privacy

The library, reader preferences, and monitoring history are stored in the local SQLite file at `data/frank_manga.sqlite`. The app requests manga metadata, chapters, and page images from the configured source websites when needed.

## Additional Documentation

See [`docs/ARCHITECTURE_AND_USAGE.md`](docs/ARCHITECTURE_AND_USAGE.md) for more details about the architecture, reader controls, and source integration.
