import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { load } from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { getSourceForUrl } from '../src/server/sources';
import { AsuraScansSource } from '../src/server/sources/custom/asura-scans';

const mangaFixture = readFileSync(path.join(process.cwd(), 'tests/fixtures/asura-manga.html'), 'utf8');
const readerFixture = readFileSync(path.join(process.cwd(), 'tests/fixtures/asura-reader-177.html'), 'utf8');
const mangaUrl = 'https://asurascans.com/comics/the-novels-extra-remake-ab39de10';
const chapter177Url = `${mangaUrl}/chapter/177`;

class FixtureAsuraScansSource extends AsuraScansSource {
  constructor(private readonly readerHtml = readerFixture, private readonly mangaHtml = mangaFixture) { super(); }

  async fetchHtml(url: string): Promise<{ url: string; $: CheerioAPI }> {
    if (url.includes('/chapter/')) return { url, $: load(this.readerHtml) };
    return { url: mangaUrl, $: load(this.mangaHtml) };
  }
}

const source = new FixtureAsuraScansSource();
assert.equal(getSourceForUrl(mangaUrl).id, 'asura-scans');
assert.equal(source.canHandle(mangaUrl), true);
assert.equal(source.canHandle('https://www.asurascans.com/comics/the-novels-extra-remake-ab39de10'), false);
assert.throws(() => getSourceForUrl('https://cdn.asurascans.com/asura-images/chapters/test'), /No TypeScript source adapter supports/);
assert.throws(() => getSourceForUrl('https://sub.asurascans.com/comics/example'), /No TypeScript source adapter supports/);

const metadata = await source.extractManga(mangaUrl);
assert.equal(metadata.title, 'The Novel’s Extra');
assert.equal(metadata.mainUrl, mangaUrl);
assert.equal(metadata.externalId, 'the-novels-extra-remake-ab39de10');
assert.equal(metadata.description, 'A writer wakes inside the world of his own novel.');
assert.equal(metadata.coverUrl, 'https://cdn.asurascans.com/asura-images/covers/the-novels-extra-remake.8d8ec7.webp');
assert.equal(metadata.author, 'Jee Gab Song');
assert.equal(metadata.artist, 'CARROTOON');
assert.deepEqual(metadata.genres, ['Action', 'Adventure', 'Fantasy', 'School Life']);
assert.deepEqual(metadata.altTitles, ['소설 속 엑스트라', "The Novel's Extra", 'TNE']);
assert.equal(metadata.status, 'ongoing');
assert.equal(metadata.type, 'manhwa');

const chapters = await source.extractChapters(mangaUrl);
assert.equal(chapters.length, 4);
assert.deepEqual(chapters.map(chapter => chapter.chapterNumber), [178, 177, 144, 143]);
assert.equal(chapters[1].url, chapter177Url);
assert.equal(chapters[1].title, 'Chapter 177', 'HTML comments are ignored and last week remains a separate date');
assert.equal(chapters[1].releaseDate, 'last week');
assert.equal(chapters[2].title, 'Chapter 144 S4 Start');
assert.equal(chapters[2].releaseDate, 'Feb 9, 2026');
assert.equal(chapters[3].title, 'Chapter 143 {S3 END}');
assert.equal(chapters[3].releaseDate, 'Sep 15, 2025');
await assert.rejects(
  new FixtureAsuraScansSource(readerFixture, mangaFixture.replace('4 Chapters', '5 Chapters'))
    .extractChapters(mangaUrl),
  /reports 5 chapters but only 4 chapter links/
);

const reader = await source.extractPages(chapter177Url);
assert.equal(reader.chapterId, chapter177Url);
assert.equal(reader.title, 'Chapter 177');
assert.equal(reader.chapterNumberText, 'Chapter 177');
assert.equal(reader.prevChapterId, `${mangaUrl}/chapter/176`);
assert.equal(reader.nextChapterId, `${mangaUrl}/chapter/178`);
assert.equal(reader.pages.length, 17, 'covers, other chapters, and non-CDN images are excluded');
assert.deepEqual(reader.pages.map(page => page.index), Array.from({ length: 17 }, (_, index) => index + 1));
assert.equal(reader.pages[0].url, 'https://cdn.asurascans.com/asura-images/chapters/the-novels-extra-remake/177/caee10.webp?v=1793027734');
assert.equal(reader.pages[16].url, 'https://cdn.asurascans.com/asura-images/chapters/the-novels-extra-remake/177/fb0365.webp?v=1793027734');

const reordered = load(readerFixture);
const firstPage = reordered('img[data-page-index="0"]');
const secondPage = reordered('img[data-page-index="1"]');
firstPage.before(secondPage.clone());
secondPage.remove();
const orderedAfterIndexSort = await new FixtureAsuraScansSource(reordered.html()).extractPages(chapter177Url);
assert.equal(orderedAfterIndexSort.pages[0].url, reader.pages[0].url, 'data-page-index controls order even when DOM nodes are reordered');

const relativeImage = readerFixture.replace(
  'https://cdn.asurascans.com/asura-images/chapters/the-novels-extra-remake/177/caee10.webp?v=1793027734',
  '/asura-images/chapters/the-novels-extra-remake/177/caee10.webp?v=1793027734'
);
const relativeReader = await new FixtureAsuraScansSource(relativeImage).extractPages(chapter177Url);
assert.equal(relativeReader.pages[0].url, 'https://asurascans.com/asura-images/chapters/the-novels-extra-remake/177/caee10.webp?v=1793027734');

await assert.rejects(
  new FixtureAsuraScansSource('<html><body><img src="https://cdn.asurascans.com/asura-images/covers/cover.webp"></body></html>')
    .extractPages(chapter177Url),
  /found no reader pages/
);

console.log('[PASS] Asura Scans routing, JSON-LD metadata, complete chapter rows, and ordered reader images');
