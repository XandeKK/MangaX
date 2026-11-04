import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { load } from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { getSourceForUrl } from '../src/server/sources';
import { DemonicScansSource } from '../src/server/sources/custom/demonic-scans';

const mangaFixture = readFileSync(path.join(process.cwd(), 'tests/fixtures/demonic-manga.html'), 'utf8');
const readerFixture = readFileSync(path.join(process.cwd(), 'tests/fixtures/demonic-reader-77.html'), 'utf8');

class FixtureDemonicScansSource extends DemonicScansSource {
  constructor(
    private readonly readerHtml = readerFixture,
    private readonly mangaHtml = mangaFixture
  ) { super(); }

  async fetchHtml(url: string): Promise<{ url: string; $: CheerioAPI }> {
    if ((url.includes('chaptered.php') && url.includes('chapter=77')) || url.includes('/chapter/77/')) {
      return { url: 'https://demonicscans.org/title/The-Genius-Wants-to-be-Ordinary%2521/chapter/77/1', $: load(this.readerHtml) };
    }
    return { url: 'https://demonicscans.org/title/A-Test-Manga', $: load(this.mangaHtml) };
  }
}

const source = new FixtureDemonicScansSource();
assert.equal(getSourceForUrl('https://demonicscans.org/title/A-Test-Manga').id, 'demonic-scans');
assert.equal(source.canHandle('https://demonicscans.org/title/A-Test-Manga'), true);
assert.equal(source.canHandle('https://www.demonicscans.org/title/A-Test-Manga'), false, 'only the exact reviewed source host is supported');
assert.throws(() => getSourceForUrl('https://sub.demonicscans.org/title/A-Test-Manga'), /No TypeScript source adapter supports/);

const metadata = await source.extractManga('https://demonicscans.org/title/A-Test-Manga');
assert.equal(metadata.title, 'A Test Manga');
assert.equal(metadata.mainUrl, 'https://demonicscans.org/title/A-Test-Manga');
assert.equal(metadata.coverUrl, 'https://readermc.org/images/cover.jpg');
assert.equal(metadata.description, 'A short synopsis.');
assert.deepEqual(metadata.genres, ['Drama', 'Fantasy']);
assert.equal(metadata.author, undefined, 'placeholder author values are omitted');
assert.equal(metadata.artist, 'A. Artist');
assert.equal(metadata.status, 'ongoing');
assert.deepEqual(metadata.altTitles, ['Test Alternative']);
assert.equal(metadata.externalId, '12914');
const populatedMetadata = await new FixtureDemonicScansSource(readerFixture, mangaFixture
  .replace('<li>updating</li>', '<li>A. Writer</li>')
  .replace('<img src="https://readermc.org/images/cover.jpg"', '<img src="/covers/local-cover.jpg"')).extractManga('https://demonicscans.org/title/A-Test-Manga');
assert.equal(populatedMetadata.author, 'A. Writer');
assert.equal(populatedMetadata.coverUrl, 'https://demonicscans.org/covers/local-cover.jpg', 'relative metadata URLs use the final manga page URL');

const chapters = await source.extractChapters('https://demonicscans.org/title/A-Test-Manga');
assert.equal(chapters.length, 6, 'duplicate URLs are removed while separate editions with the same number remain');
assert.equal(chapters[0].chapterNumber, 77);
assert.equal(chapters[0].title, 'Chapter 77');
assert.equal(chapters[0].chapterNumberText, 'Chapter 77');
assert.equal(chapters[0].url, 'https://demonicscans.org/chaptered.php?chapter=77&manga=12914');
assert.equal(chapters[0].releaseDate, '2026-10-21');
assert.equal(chapters[1].title, 'Chapter 76', 'relative publication text is not included in the chapter title');
assert.equal(chapters[2].chapterNumber, 75, 'nested title markup is read without its date span');
assert.equal(chapters[3].chapterNumber, 74);
assert.equal(chapters[4].chapterNumber, 74);
assert.notEqual(chapters[3].url, chapters[4].url, 'same-number editions remain distinct by URL identity');
assert.equal(chapters[5].chapterNumber, null, 'special chapters keep a null chapter number');
await assert.rejects(
  new FixtureDemonicScansSource(readerFixture, mangaFixture.replace('6 Chapters Available', '7 Chapters Available'))
    .extractChapters('https://demonicscans.org/title/A-Test-Manga'),
  /reported 7 chapters but only 6 valid chapter links/
);

const pages = await source.extractPages(chapters[0].url);
assert.equal(pages.title, 'Chapter 77');
assert.equal(pages.chapterId, chapters[0].id, 'page extraction uses the same stable chapter identity');
assert.equal(pages.prevChapterId, 'https://demonicscans.org/chaptered.php?chapter=76&manga=12914');
assert.equal(pages.nextChapterId, 'https://demonicscans.org/chaptered.php?chapter=78&manga=12914');
assert.equal(pages.pages.length, 28, 'ads, another chapter, and an unverified fallback CDN are excluded');
assert.deepEqual(pages.pages.map(page => page.index), Array.from({ length: 28 }, (_, index) => index + 1));
assert.deepEqual(pages.pages.map(page => new URL(page.url).pathname.split('/').at(-1)), [
  ...Array.from({ length: 27 }, (_, index) => `${index + 1}.jpg`), '28.png'
]);
assert(pages.pages.every(page => new URL(page.url).hostname === 'cdn2.demoniclibs.com'));
const pagesFromCanonicalReader = await source.extractPages('https://demonicscans.org/title/The-Genius-Wants-to-be-Ordinary%2521/chapter/77/1');
assert.equal(pagesFromCanonicalReader.chapterId, chapters[0].id, 'redirected reader URLs map to the source chapter URL through its navigation links');
const nonNumericFilenamePages = await new FixtureDemonicScansSource(readerFixture.replace('/28.png', '/final-page.png')).extractPages(chapters[0].url);
assert.equal(nonNumericFilenamePages.pages.length, 28, 'page extraction does not require filenames to contain numeric indexes');
assert.equal(new URL(nonNumericFilenamePages.pages[27].url).pathname.split('/').at(-1), 'final-page.png');
const relativeImagePages = await new FixtureDemonicScansSource(readerFixture.replace(
  'https://cdn2.demoniclibs.com/The Genius Wants to be Ordinary!/77./1.jpg',
  '/chapter-images/77./1.jpg'
)).extractPages(chapters[0].url);
assert.equal(relativeImagePages.pages.length, 28, 'relative images on the reviewed source host are resolved against the reader page');
assert.equal(new URL(relativeImagePages.pages[0].url).href, 'https://demonicscans.org/chapter-images/77./1.jpg');
await assert.rejects(new FixtureDemonicScansSource('<html><body><div class="chapter-info"><h2>Chapter 77</h2></div></body></html>')
  .extractPages(chapters[0].url), /found no valid reader images/);
await assert.rejects(source.extractPages('https://sub.demonicscans.org/chaptered.php?manga=12914&chapter=77'), /requires a chapter URL on demonicscans.org/);

console.log('[PASS] Demonic Scans exact-host routing, metadata, chapter extraction, and reader page filtering');
