import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

let db: SqlJsDatabase | null = null;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'manga_x.sqlite');

export async function getDatabase(): Promise<SqlJsDatabase> {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } catch (err) {
      console.error('Error loading existing SQLite DB, initializing fresh:', err);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  // Enforce foreign keys
  db.run('PRAGMA foreign_keys = ON;');

  applyMigrations(db);
  seedInitialData(db);
  saveDatabase();

  return db;
}

export function saveDatabase(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Failed to save SQLite database to disk:', err);
  }
}

function applyMigrations(database: SqlJsDatabase): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const res = database.exec('SELECT MAX(version) FROM schema_migrations');
  const currentVersion = res.length > 0 && res[0].values[0][0] ? Number(res[0].values[0][0]) : 0;

  if (currentVersion < 1) {
    database.run(`
      -- Obras
      CREATE TABLE IF NOT EXISTS mangas (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        cover_url TEXT,
        type TEXT NOT NULL DEFAULT 'manga',
        status TEXT NOT NULL DEFAULT 'ongoing',
        main_url TEXT NOT NULL,
        author TEXT,
        artist TEXT,
        last_read_chapter_id TEXT,
        last_read_chapter_number REAL,
        last_known_chapter_number REAL,
        unread_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Fontes
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        manga_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        check_interval_minutes INTEGER DEFAULT 30,
        last_checked_at INTEGER,
        last_status TEXT DEFAULT 'ok',
        error_message TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (manga_id) REFERENCES mangas(id) ON DELETE CASCADE
      );

      -- Capítulos
      CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        manga_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        title TEXT,
        chapter_number REAL NOT NULL,
        chapter_number_text TEXT NOT NULL,
        volume TEXT,
        url TEXT NOT NULL,
        release_date TEXT,
        detected_at INTEGER NOT NULL,
        is_read INTEGER DEFAULT 0,
        read_at INTEGER,
        last_page_read INTEGER DEFAULT 1,
        total_pages INTEGER DEFAULT 0,
        FOREIGN KEY (manga_id) REFERENCES mangas(id) ON DELETE CASCADE,
        FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
      );

      -- Preferências do Reader por Obra
      CREATE TABLE IF NOT EXISTS reader_preferences (
        manga_id TEXT PRIMARY KEY,
        reading_mode TEXT DEFAULT 'single',
        direction TEXT DEFAULT 'rtl',
        night_filter TEXT DEFAULT 'none',
        scroll_snap INTEGER DEFAULT 0,
        fit_mode TEXT DEFAULT 'fit_width',
        auto_mark_read INTEGER DEFAULT 1,
        last_page INTEGER DEFAULT 1,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (manga_id) REFERENCES mangas(id) ON DELETE CASCADE
      );

      -- Configuração do Monitoramento
      CREATE TABLE IF NOT EXISTS monitor_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Histórico de verificações
      CREATE TABLE IF NOT EXISTS check_logs (
        id TEXT PRIMARY KEY,
        manga_id TEXT,
        source_id TEXT,
        timestamp INTEGER NOT NULL,
        status TEXT NOT NULL,
        chapters_found INTEGER DEFAULT 0,
        new_chapters_count INTEGER DEFAULT 0,
        message TEXT,
        duration_ms INTEGER DEFAULT 0
      );

      -- Notificações de novos capítulos
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        manga_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        title TEXT NOT NULL,
        chapter_number_text TEXT NOT NULL,
        source_name TEXT NOT NULL,
        detected_at INTEGER NOT NULL,
        is_read INTEGER DEFAULT 0
      );

      -- Índices para performance
      CREATE INDEX IF NOT EXISTS idx_chapters_manga_num ON chapters(manga_id, chapter_number);
      CREATE INDEX IF NOT EXISTS idx_chapters_unread ON chapters(manga_id, is_read);
      CREATE INDEX IF NOT EXISTS idx_sources_manga ON sources(manga_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
      CREATE INDEX IF NOT EXISTS idx_check_logs_time ON check_logs(timestamp);

      INSERT INTO schema_migrations (version, applied_at) VALUES (1, ${Date.now()});
    `);
  }
}

function seedInitialData(database: SqlJsDatabase): void {
  const check = database.exec('SELECT COUNT(*) FROM mangas');
  const count = check.length > 0 ? Number(check[0].values[0][0]) : 0;
  if (count > 0) return;

  const now = Date.now();

  // Initial Seed: 3 iconic representative titles (Solo Leveling / Manhwa, Frieren / Manga, Tower of God / Webtoon)
  const seedMangas = [
    {
      id: 'solo-leveling-seed',
      title: 'Solo Leveling (Only I Level Up)',
      description: 'Em um mundo onde caçadores despertam com poderes mágicos, Sung Jin-woo é conhecido como o caçador mais fraco da humanidade. Após uma expedição quase fatal, ele acorda em um hospital com uma interface misteriosa que só ele pode ver.',
      cover_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
      type: 'manhwa',
      status: 'completed',
      main_url: 'https://mangadex.org/title/32d76d19-8a05-4db0-9fc2-e0b0648fe9d0/solo-leveling',
      author: 'Chugong',
      artist: 'DUBU (REDICE Studio)',
      last_read_chapter_id: 'sl-ch-01',
      last_read_chapter_number: 1,
      last_known_chapter_number: 179,
      unread_count: 3,
    },
    {
      id: 'frieren-seed',
      title: 'Sousou no Frieren (Frieren: Beyond Journey\'s End)',
      description: 'A maga elfa Frieren e seus corajosos companheiros derrotaram o Rei Demônio e trouxeram paz à terra. Para os elfos imortais, uma década é um piscar de olhos; Frieren embarca em uma nova jornada para compreender a efemeridade humana.',
      cover_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
      type: 'manga',
      status: 'ongoing',
      main_url: 'https://mangadex.org/title/b0b721ff-c388-4486-aa0f-c8b0e95152b0/sousou-no-frieren',
      author: 'Yamada Kanehito',
      artist: 'Abe Tsukasa',
      last_read_chapter_id: null,
      last_read_chapter_number: null,
      last_known_chapter_number: 132,
      unread_count: 5,
    },
    {
      id: 'tower-of-god-seed',
      title: 'Tower of God (Kami no Tou)',
      description: 'O que você mais deseja? Dinheiro e riquezas? Glória e honra? Poder e autoridade? Vingança? Ou algo que transcende tudo isso? Seja o que for, você pode conseguir no topo da Torre.',
      cover_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80',
      type: 'webtoon',
      status: 'ongoing',
      main_url: 'https://mangadex.org/title/077054a8-f5bc-4521-87a4-44b1c2be120e/tower-of-god',
      author: 'SIU',
      artist: 'SIU',
      last_read_chapter_id: null,
      last_read_chapter_number: null,
      last_known_chapter_number: 615,
      unread_count: 4,
    }
  ];

  for (const m of seedMangas) {
    database.run(
      `INSERT INTO mangas (id, title, description, cover_url, type, status, main_url, author, artist, last_read_chapter_id, last_read_chapter_number, last_known_chapter_number, unread_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [m.id, m.title, m.description, m.cover_url, m.type, m.status, m.main_url, m.author, m.artist, m.last_read_chapter_id, m.last_read_chapter_number, m.last_known_chapter_number, m.unread_count, now, now]
    );

    // Add source
    const sourceId = `src-${m.id}`;
    database.run(
      `INSERT INTO sources (id, manga_id, source_type, name, url, is_active, check_interval_minutes, last_checked_at, last_status, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 30, ?, 'ok', ?)`,
      [sourceId, m.id, 'mangadex', 'MangaDex (Oficial)', m.main_url, now, now]
    );

    // Add reader preferences
    database.run(
      `INSERT INTO reader_preferences (manga_id, reading_mode, direction, night_filter, scroll_snap, fit_mode, auto_mark_read, last_page, updated_at)
       VALUES (?, ?, ?, 'none', 0, 'fit_width', 1, 1, ?)`,
      [m.id, m.type === 'webtoon' ? 'webtoon' : 'single', m.type === 'webtoon' ? 'vertical' : 'rtl', now]
    );
  }

  // Seed sample chapters for Solo Leveling
  const slChapters = [
    { id: 'sl-ch-01', mangaId: 'solo-leveling-seed', num: 1, text: 'Capítulo 1: O Caçador Mais Fraco', url: 'https://mangadex.org/chapter/sample-1', isRead: 1 },
    { id: 'sl-ch-02', mangaId: 'solo-leveling-seed', num: 2, text: 'Capítulo 2: O Covil Duplo', url: 'https://mangadex.org/chapter/sample-2', isRead: 0 },
    { id: 'sl-ch-03', mangaId: 'solo-leveling-seed', num: 3, text: 'Capítulo 3: Os Mandamentos da Estátua', url: 'https://mangadex.org/chapter/sample-3', isRead: 0 },
    { id: 'sl-ch-04', mangaId: 'solo-leveling-seed', num: 4, text: 'Capítulo 4: Despertar Secreto', url: 'https://mangadex.org/chapter/sample-4', isRead: 0 },
  ];

  for (const c of slChapters) {
    database.run(
      `INSERT INTO chapters (id, manga_id, source_id, title, chapter_number, chapter_number_text, url, release_date, detected_at, is_read, read_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.mangaId, `src-${c.mangaId}`, c.text, c.num, `Capítulo ${c.num}`, c.url, '2024-01-10', now - 86400000 * (5 - c.num), c.isRead, c.isRead ? now - 3600000 : null]
    );
  }

  // Seed sample chapters for Frieren
  const frierenChapters = [
    { id: 'fr-ch-01', mangaId: 'frieren-seed', num: 1, text: 'Capítulo 1: O Fim da Aventura', url: 'https://mangadex.org/chapter/sample-fr-1', isRead: 0 },
    { id: 'fr-ch-02', mangaId: 'frieren-seed', num: 2, text: 'Capítulo 2: A Mentira do Mago', url: 'https://mangadex.org/chapter/sample-fr-2', isRead: 0 },
    { id: 'fr-ch-03', mangaId: 'frieren-seed', num: 3, text: 'Capítulo 3: Flores Lunares Azuis', url: 'https://mangadex.org/chapter/sample-fr-3', isRead: 0 },
  ];

  for (const c of frierenChapters) {
    database.run(
      `INSERT INTO chapters (id, manga_id, source_id, title, chapter_number, chapter_number_text, url, release_date, detected_at, is_read, read_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.mangaId, `src-${c.mangaId}`, c.text, c.num, `Capítulo ${c.num}`, c.url, '2024-02-15', now - 86400000 * (4 - c.num), c.isRead, null]
    );
  }

  // Seed default monitor config
  database.run(`INSERT OR REPLACE INTO monitor_config (key, value) VALUES ('check_interval_minutes', '30')`);
  database.run(`INSERT OR REPLACE INTO monitor_config (key, value) VALUES ('concurrency_limit', '3')`);
  database.run(`INSERT OR REPLACE INTO monitor_config (key, value) VALUES ('auto_mark_on_open', '0')`);
  database.run(`INSERT OR REPLACE INTO monitor_config (key, value) VALUES ('auto_mark_threshold_percent', '85')`);
  database.run(`INSERT OR REPLACE INTO monitor_config (key, value) VALUES ('notifications_enabled', '1')`);

  // Seed initial check log
  database.run(
    `INSERT INTO check_logs (id, manga_id, source_id, timestamp, status, chapters_found, new_chapters_count, message, duration_ms)
     VALUES (?, ?, ?, ?, 'success', 4, 1, 'Verificação automática inicial concluída com êxito.', 420)`,
    ['init-log-1', 'solo-leveling-seed', 'src-solo-leveling-seed', now - 1800000]
  );

  // Seed initial notification
  database.run(
    `INSERT INTO notifications (id, manga_id, chapter_id, title, chapter_number_text, source_name, detected_at, is_read)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    ['notif-init-1', 'solo-leveling-seed', 'sl-ch-04', 'Solo Leveling (Only I Level Up)', 'Capítulo 4', 'MangaDex (Oficial)', now - 1800000]
  );
}

// Database helper functions
function sanitizeParams(params: any[]): any[] {
  return params.map(p => (p === undefined ? null : p));
}

export function dbAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!db) throw new Error('Database not initialized');
  const sanitized = sanitizeParams(params);
  const stmt = db.prepare(sql);
  stmt.bind(sanitized);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function dbGet<T = any>(sql: string, params: any[] = []): T | null {
  if (!db) throw new Error('Database not initialized');
  const rows = dbAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function dbRun(sql: string, params: any[] = []): void {
  if (!db) throw new Error('Database not initialized');
  const sanitized = sanitizeParams(params);
  db.run(sql, sanitized);
  saveDatabase();
}

