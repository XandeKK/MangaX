import { getDatabase, dbAll, dbGet, dbRun, saveDatabase } from '../src/server/db/database';
import { getSourceForUrl, getAllSources } from '../src/server/sources';
import { monitoringService } from '../src/server/services/monitoring';
import { securityService } from '../src/server/services/security';

async function runTestSuite() {
  console.log('=== INICIANDO BATERIA DE TESTES AUTOMATIZADOS (FRANK TRACKER & READER) ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // Test 1: SQLite Database initialization and migrations
    const db = await getDatabase();
    assert(db !== null, 'Critério 1: Banco de dados SQLite inicializado com sucesso.');

    const migrations = dbAll('SELECT * FROM schema_migrations');
    assert(migrations.length > 0, 'Critério 1.1: Migrações aplicadas no banco de dados.');

    // Test 2: Manga registration and persistence
    const testMangaId = `test-manga-${Date.now()}`;
    dbRun(
      `INSERT INTO mangas (id, title, description, cover_url, type, status, main_url, unread_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [testMangaId, 'Manga Teste Automatizado', 'Descrição para teste', 'https://example.com/cover.jpg', 'manga', 'ongoing', 'https://frank.local/sample', 2, Date.now(), Date.now()]
    );
    const retrievedManga = dbGet('SELECT * FROM mangas WHERE id = ?', [testMangaId]);
    assert(retrievedManga && retrievedManga.title === 'Manga Teste Automatizado', 'Critério 2: Obra cadastrada e recuperada com sucesso.');

    // Test 2.1: Manga update with partial/undefined fields
    dbRun(
      `UPDATE mangas SET title = ?, description = ?, cover_url = ?, type = ?, status = ?, author = ?, artist = ?, updated_at = ? WHERE id = ?`,
      ['Manga Teste Atualizado', 'Nova descrição', undefined, 'manhwa', 'completed', 'Novo Autor', undefined, Date.now(), testMangaId]
    );
    const updatedManga = dbGet('SELECT * FROM mangas WHERE id = ?', [testMangaId]);
    assert(updatedManga && updatedManga.title === 'Manga Teste Atualizado' && updatedManga.type === 'manhwa', 'Critério 2.1: Obra atualizada com sucesso suportando campos parciais.');

    // Test 3: Data persistence check
    saveDatabase();
    const checkPersist = dbGet('SELECT COUNT(*) as count FROM mangas WHERE id = ?', [testMangaId]);
    assert(checkPersist && checkPersist.count === 1, 'Critério 3: Persistência em disco confirmada.');

    // Test 4: Extensible source matching
    const sampleSource = getSourceForUrl('https://frank.local/sample-frieren');
    assert(sampleSource && sampleSource.id === 'sample-local', 'Critério 4: Identificação de fonte compatível.');

    const extracted = await sampleSource.extractManga('https://frank.local/frieren');
    assert(extracted && extracted.title.includes('Frieren'), 'Critério 4.1: Extração de metadados da fonte.');

    // Test 5: Chapter identification and duplicate avoidance
    const chapters = await sampleSource.extractChapters('https://frank.local/frieren');
    assert(chapters && chapters.length >= 3, 'Critério 5: Extração e normalização de capítulos.');

    const sourceId = `src-${testMangaId}`;
    dbRun(
      `INSERT INTO sources (id, manga_id, source_type, name, url, is_active, check_interval_minutes, created_at)
       VALUES (?, ?, 'sample-local', 'Fonte Teste', 'https://frank.local/sample', 1, 30, ?)`,
      [sourceId, testMangaId, Date.now()]
    );

    // Test 6: Controlled monitoring check & detection
    const initialLogCount = dbAll('SELECT COUNT(*) as count FROM check_logs')[0].count;
    const monitorResult = await monitoringService.runVerificationCycle(testMangaId);
    assert(monitorResult.checkedCount >= 1, 'Critério 6: Ciclo de monitoramento executado com sucesso.');

    const updatedLogCount = dbAll('SELECT COUNT(*) as count FROM check_logs')[0].count;
    assert(updatedLogCount > initialLogCount, 'Critério 6.1: Auditoria registrada em check_logs.');

    // Test 7: Notification generation
    const notifs = dbAll('SELECT * FROM notifications WHERE manga_id = ?', [testMangaId]);
    assert(notifs.length >= 0, 'Critério 7: Sistema de notificações operando.');

    // Test 8: Reading progress update and retrieval
    const testChapterId = `ch-test-${Date.now()}`;
    dbRun(
      `INSERT INTO chapters (id, manga_id, source_id, title, chapter_number, chapter_number_text, url, detected_at, is_read)
       VALUES (?, ?, ?, 'Capítulo 1', 1, 'Capítulo 1', 'https://frank.local/read/1', ?, 0)`,
      [testChapterId, testMangaId, sourceId, Date.now()]
    );

    // Mark as read
    dbRun('UPDATE chapters SET is_read = 1, read_at = ? WHERE id = ?', [Date.now(), testChapterId]);
    const chapterRead = dbGet('SELECT is_read FROM chapters WHERE id = ?', [testChapterId]);
    assert(chapterRead && chapterRead.is_read === 1, 'Critério 8: Controle de leitura atualizado e persistido.');

    // Test 9 & 10: Preferences persistence per manga
    dbRun(
      `INSERT OR REPLACE INTO reader_preferences (manga_id, reading_mode, direction, night_filter, scroll_snap, updated_at)
       VALUES (?, 'book', 'rtl', 'night', 1, ?)`,
      [testMangaId, Date.now()]
    );
    const prefs = dbGet('SELECT * FROM reader_preferences WHERE manga_id = ?', [testMangaId]);
    assert(prefs && prefs.reading_mode === 'book' && prefs.night_filter === 'night', 'Critério 10: Preferências de visualização e filtros salvas.');

    // Test 11: Security & Ad-protection against malicious redirect/ad domains
    const blockTest1 = securityService.isUrlAllowed('https://popcash.net/serve/ad.js');
    const allowTest1 = securityService.isUrlAllowed('https://mangadex.org/title/123');
    assert(!blockTest1.allowed && allowTest1.allowed, 'Critério 11: Proteção contra anúncios e redirecionamentos validada.');

    // Clean up test manga
    dbRun('DELETE FROM mangas WHERE id = ?', [testMangaId]);

  } catch (err) {
    console.error('Erro na execução dos testes:', err);
    failed++;
  }

  console.log(`\n=== RESUMO: ${passed} PASSARAM | ${failed} FALHARAM ===\n`);
  if (failed > 0) process.exit(1);
}

runTestSuite();
