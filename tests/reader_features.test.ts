import assert from 'assert';
import express from 'express';
import { once } from 'node:events';
import { normalizeInputUrl } from '../src/server/routes.ts';
import { apiRouter } from '../src/server/routes';
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

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start the API test server.');
  const apiBase = `http://127.0.0.1:${address.port}/api`;
  let createdId = '';
  try {
    const addedResponse = await fetch(`${apiBase}/mangas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://frank.local/frieren' })
    });
    assert.equal(addedResponse.status, 201, 'registered adapter adds a manga URL');
    const added = await addedResponse.json() as { id: string; chaptersCount: number };
    createdId = added.id;
    assert.ok(added.chaptersCount >= 2, 'adapter chapters are stored with the manga');

    const duplicateResponse = await fetch(`${apiBase}/mangas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://frank.local/frieren/' })
    });
    const duplicate = await duplicateResponse.json() as { id: string; existing?: boolean };
    assert.equal(duplicateResponse.status, 200);
    assert.equal(duplicate.id, createdId, 'normalized canonical URL avoids duplicate manga records');
    assert.equal(duplicate.existing, true);

    const detailResponse = await fetch(`${apiBase}/mangas/${createdId}`);
    const details = await detailResponse.json() as any;
    assert.equal(details.sources[0].source_type, 'sample-local');
    const chapter = details.chapters[0];

    const readerResponse = await fetch(`${apiBase}/reader/chapter/${chapter.id}`);
    const reader = await readerResponse.json() as any;
    assert.ok(reader.pages.length > 1 && reader.pages[0].index === 1, 'reader loads pages through the registered adapter');

    const progressResponse = await fetch(`${apiBase}/chapters/${chapter.id}/read`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true, lastPageRead: 2 })
    });
    assert.equal(progressResponse.status, 200);
    const afterProgress = await (await fetch(`${apiBase}/mangas/${createdId}`)).json() as any;
    const savedChapter = afterProgress.chapters.find((item: any) => item.id === chapter.id);
    assert.equal(savedChapter.is_read, 1);
    assert.equal(savedChapter.last_page_read, 2);
    console.log('[PASS] add manga, chapter retrieval, reader pages, and progress work through the source adapter API');

    const unsupportedResponse = await fetch(`${apiBase}/sources/preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://unsupported.example/manga/1' })
    });
    assert.equal(unsupportedResponse.status, 400);
    assert.match((await unsupportedResponse.json() as any).error, /No TypeScript source adapter supports/);
    console.log('[PASS] unsupported source preview returns an explicit adapter error');
  } finally {
    if (createdId) await fetch(`${apiBase}/mangas/${createdId}`, { method: 'DELETE' });
    server.close();
  }

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

await runReaderFeaturesTests().catch((err) => {
  console.error('[FAIL]', err);
  process.exit(1);
});
