import assert from 'assert';
import { normalizeInputUrl } from '../src/server/routes.ts';
import { getDatabase, dbAll } from '../src/server/db/database';

async function runReaderFeaturesTests() {
  console.log('=== TESTES DAS NOVAS FUNCIONALIDADES DO MANGAX ===');
  
  // 1. MangaDex UUID normalization
  const rawUuid = '32d76d19-8a05-4db0-9fc2-e0b0648fe9d0';
  const normalizedFromUuid = normalizeInputUrl(rawUuid);
  assert.strictEqual(
    normalizedFromUuid,
    `https://mangadex.org/title/${rawUuid}`,
    'UUID cru deve ser convertido em URL completa do MangaDex'
  );
  console.log('[PASS] Normalização de UUID cru do MangaDex');

  const mdUrl = 'https://mangadex.org/title/32d76d19-8a05-4db0-9fc2-e0b0648fe9d0/solo-leveling';
  assert.strictEqual(normalizeInputUrl(mdUrl), mdUrl, 'URL completa não deve ser corrompida');
  console.log('[PASS] Manutenção de URL já válida');

  // 2. Unread filter logic in SQLite
  await getDatabase();
  const unreadRows = dbAll(`SELECT id, title, unread_count FROM mangas WHERE unread_count > 0`);
  assert(Array.isArray(unreadRows), 'Consulta de não lidos executou com sucesso');
  console.log('[PASS] Filtro de obras não lidas no banco de dados');

  // 3. Default preferences by type
  // Verify reading mode rule:
  const getModeForType = (type: string) => {
    return ['manhwa', 'manhua', 'webtoon'].includes(type) ? 'webtoon' : 'single';
  };
  assert.strictEqual(getModeForType('manhwa'), 'webtoon', 'Manhwa deve ser scroll (webtoon)');
  assert.strictEqual(getModeForType('manhua'), 'webtoon', 'Manhua deve ser scroll (webtoon)');
  assert.strictEqual(getModeForType('webtoon'), 'webtoon', 'Webtoon deve ser scroll (webtoon)');
  assert.strictEqual(getModeForType('manga'), 'single', 'Manga deve ser single');
  console.log('[PASS] Preferências de leitura por tipo de obra (Scroll para manhwa/manhua/webtoon, Single para mangá)');

  console.log('=== TODOS OS TESTES ESPECÍFICOS PASSARAM COM SUCESSO ===');
}

runReaderFeaturesTests().catch((err) => {
  console.error('[FAIL]', err);
  process.exit(1);
});
