import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { applyMigrations } from '../src/server/db/database';

const SQL = await initSqlJs();
const db = new SQL.Database();
db.run('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)');
db.run('INSERT INTO schema_migrations (version, applied_at) VALUES (1, 1), (2, 2), (3, 3), (4, 4), (5, 5)');
db.run('CREATE TABLE source_parsers (id TEXT PRIMARY KEY, config_json TEXT NOT NULL)');
db.run("INSERT INTO source_parsers (id, config_json) VALUES ('old-parser', '{}')");
db.run('CREATE TABLE sources (id TEXT PRIMARY KEY, source_type TEXT NOT NULL, last_status TEXT, error_message TEXT)');
db.run("INSERT INTO sources (id, source_type) VALUES ('tracked-source', 'parser:old-parser'), ('manual-source', 'custom')");
db.run('CREATE TABLE mangas (id TEXT PRIMARY KEY, title TEXT)');
db.run("INSERT INTO mangas (id, title) VALUES ('manga-1', 'Preserved manga')");
db.run('CREATE TABLE chapters (id TEXT PRIMARY KEY, manga_id TEXT, is_read INTEGER, last_page_read INTEGER)');
db.run("INSERT INTO chapters (id, manga_id, is_read, last_page_read) VALUES ('chapter-1', 'manga-1', 1, 14)");
db.run('CREATE TABLE reader_preferences (manga_id TEXT PRIMARY KEY, reading_mode TEXT)');
db.run("INSERT INTO reader_preferences (manga_id, reading_mode) VALUES ('manga-1', 'webtoon')");

applyMigrations(db);

const parserTable = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'source_parsers'");
assert.equal(parserTable.length, 0, 'migration retires parser storage');
assert.equal(db.exec("SELECT source_type FROM sources WHERE id = 'tracked-source'")[0].values[0][0], 'unsupported');
assert.equal(db.exec("SELECT last_status FROM sources WHERE id = 'tracked-source'")[0].values[0][0], 'error');
assert.match(String(db.exec("SELECT error_message FROM sources WHERE id = 'tracked-source'")[0].values[0][0]), /No registered TypeScript adapter/);
assert.equal(db.exec("SELECT source_type FROM sources WHERE id = 'manual-source'")[0].values[0][0], 'custom');
assert.equal(db.exec("SELECT title FROM mangas WHERE id = 'manga-1'")[0].values[0][0], 'Preserved manga');
assert.deepEqual(db.exec("SELECT is_read, last_page_read FROM chapters WHERE id = 'chapter-1'")[0].values[0], [1, 14]);
assert.equal(db.exec("SELECT reading_mode FROM reader_preferences WHERE manga_id = 'manga-1'")[0].values[0][0], 'webtoon');
assert.equal(db.exec('SELECT MAX(version) FROM schema_migrations')[0].values[0][0], 6);

console.log('[PASS] migration 6 retires parser configs and preserves manga, sources, chapters, and reading progress');
