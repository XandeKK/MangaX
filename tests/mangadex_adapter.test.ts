import assert from 'node:assert/strict';
import { MangaDexSource } from '../src/server/sources/mangadex';

const mangaId = '32d76d19-8a05-4db0-9fc2-e0b0648fe9d0';
const chapterOne = '6f1d5bf8-ef95-4ed0-a3ad-24f2e8c2055b';
const chapterTwo = 'd23bb435-2e94-4cf6-bcc1-45b8d7aaef22';

class FixtureMangaDexSource extends MangaDexSource {
  protected async fetchJson(url: string): Promise<any> {
    if (url.includes(`/manga/${mangaId}?`)) return {
      data: {
        id: mangaId,
        attributes: { title: { en: 'Fixture Manga' }, description: { en: 'Fixture description' }, status: 'ongoing', originalLanguage: 'ja', tags: [] },
        relationships: [
          { type: 'cover_art', attributes: { fileName: 'cover.jpg' } },
          { type: 'author', attributes: { name: 'Fixture Author' } }
        ]
      }
    };
    if (url.includes(`/manga/${mangaId}/feed?`)) return { data: [
      { id: chapterOne, attributes: { chapter: '1.5', title: 'Interlude', translatedLanguage: 'en', pages: 2, publishAt: '2026-01-01T00:00:00Z' } },
      { id: chapterTwo, attributes: { chapter: '2', title: 'Next', translatedLanguage: 'pt-br', pages: 3, publishAt: '2026-01-08T00:00:00Z' } },
      { id: 'ff3c82bb-6135-4c9b-a837-98923bff5f93', attributes: { chapter: '1.5', title: 'Interlude (Português)', translatedLanguage: 'pt-br', pages: 2 } }
    ] };
    if (url.includes(`/at-home/server/${chapterOne}`)) return {
      baseUrl: 'https://uploads.mangadex.org',
      chapter: { hash: 'fixture-hash', data: ['001.jpg', '002.jpg'] }
    };
    throw new Error(`Unexpected fixture MangaDex API URL: ${url}`);
  }
}

const source = new FixtureMangaDexSource();
const metadata = await source.extractManga(`https://mangadex.org/title/${mangaId}`);
assert.equal(metadata.title, 'Fixture Manga');
assert.equal(metadata.author, 'Fixture Author');
assert.equal(metadata.mainUrl, `https://mangadex.org/title/${mangaId}`);

const chapters = await source.extractChapters(mangaId);
assert.equal(chapters.length, 3, 'same-number chapters with different source IDs remain separate');
assert.deepEqual(chapters.map(chapter => chapter.chapterNumber), [2, 1.5, 1.5]);
assert.equal(chapters[0].url, `https://mangadex.org/chapter/${chapterTwo}`);

const pages = await source.extractPages(`https://mangadex.org/chapter/${chapterOne}`);
assert.deepEqual(pages.pages.map(page => page.url), [
  'https://uploads.mangadex.org/data/fixture-hash/001.jpg',
  'https://uploads.mangadex.org/data/fixture-hash/002.jpg'
]);
assert.deepEqual(pages.pages.map(page => page.index), [1, 2]);

console.log('[PASS] MangaDex adapter metadata, decimal chapter ordering, chapter links, and reader image URLs');
