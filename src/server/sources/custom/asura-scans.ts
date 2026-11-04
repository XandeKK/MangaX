import { load } from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { ChapterMetadata, ChapterPagesResult, MangaMetadata, MangaSource, MangaStatus, MangaType } from '../types';
import { safeFetch } from '../../services/safe-http';

const SOURCE_HOST = 'asurascans.com';
const IMAGE_HOST = 'cdn.asurascans.com';
const PAGE_IMAGE_HOSTS = new Set([SOURCE_HOST, IMAGE_HOST]);
const USER_AGENT = 'MangaX/1.0 (+self-hosted manga library)';

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function exactUrl(rawValue: string, baseUrl: string, allowedHosts: Set<string>): string | undefined {
  try {
    const url = new URL(rawValue, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !allowedHosts.has(url.hostname.toLowerCase())) return undefined;
    url.hash = '';
    return url.href;
  } catch { return undefined; }
}

function mangaSlug(url: URL): string | undefined {
  return url.pathname.match(/^\/comics\/([a-z\d-]+)\/?$/i)?.[1];
}

function chapterUrl(rawValue: string, baseUrl: string, expectedSlug?: string): string | undefined {
  const resolved = exactUrl(rawValue, baseUrl, new Set([SOURCE_HOST]));
  if (!resolved) return undefined;
  try {
    const url = new URL(resolved);
    const match = url.pathname.match(/^\/comics\/([a-z\d-]+)\/chapter\/([a-z\d.-]+)\/?$/i);
    if (!match || (expectedSlug && match[1].toLowerCase() !== expectedSlug.toLowerCase())) return undefined;
    return url.href;
  } catch { return undefined; }
}

function parseChapterNumber(text: string): number | null {
  const match = text.match(/\bchapter\s*#?\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isFinite(number) ? number : null;
}

function isDateText(text: string): boolean {
  return /^(?:today|yesterday|last\s+(?:week|month|year)|\d+\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})$/i.test(text);
}

function getChapterText($: CheerioAPI, entry: any): { title: string; date?: string } {
  const $entry = $(entry);
  const dateValues = $entry.find('*').map((_, element) => cleanText($(element).text())).get().filter(isDateText);
  const titleCopy = $entry.clone();
  titleCopy.find('*').filter((_, element) => $(element).children().length === 0 && isDateText(cleanText($(element).text()))).remove();
  const titleParts = titleCopy.find('span').filter((_, element) => !$(element).find('span').length)
    .map((_, element) => cleanText($(element).text())).get().filter(Boolean);
  const title = cleanText(titleParts.length ? titleParts.join(' ') : titleCopy.text());
  return { title, ...(dateValues.length ? { date: dateValues[0] } : {}) };
}

function structuredComic($: CheerioAPI): Record<string, any> | undefined {
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    try {
      const parsed = JSON.parse($(script).text());
      const candidates = Array.isArray(parsed) ? parsed : Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed];
      const comic = candidates.find((item: any) => item && item['@type'] === 'ComicSeries');
      if (comic) return comic;
    } catch { /* Ignore malformed or non-comic structured data blocks. */ }
  }
  return undefined;
}

function personName(value: unknown): string | undefined {
  if (typeof value === 'string') return cleanText(value) || undefined;
  if (value && typeof value === 'object' && 'name' in value && typeof value.name === 'string') return cleanText(value.name) || undefined;
  return undefined;
}

function coverValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'url' in value && typeof value.url === 'string') return value.url;
  return undefined;
}

function typeValue(value: string): MangaType | undefined {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === 'manga' || normalized === 'manhwa' || normalized === 'manhua' || normalized === 'webtoon') return normalized;
  return undefined;
}

function statusValue(value: string): MangaStatus | undefined {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === 'ongoing') return 'ongoing';
  if (normalized === 'completed' || normalized === 'complete') return 'completed';
  if (normalized === 'hiatus') return 'hiatus';
  return undefined;
}

function labeledStat($: CheerioAPI, label: string): string | undefined {
  const labelNode = $('div').filter((_, element) => $(element).children().length === 0 && cleanText($(element).text()) === label).first();
  if (!labelNode.length) return undefined;
  const siblings = labelNode.parent().children().filter((_, element) => element !== labelNode.get(0));
  return cleanText(siblings.text()) || undefined;
}

function chapterCount($: CheerioAPI): number | undefined {
  const match = $('h2').map((_, element) => cleanText($(element).text())).get().map(text => text.match(/^(\d+)\s+chapters?$/i)).find(Boolean);
  return match ? Number(match[1]) : undefined;
}

function chapterPath(url: string): { slug: string; chapter: string } | undefined {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/comics\/([a-z\d-]+)\/chapter\/([a-z\d.-]+)\/?$/i);
    return match ? { slug: match[1], chapter: match[2] } : undefined;
  } catch { return undefined; }
}

function pageIndex(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  const index = Number(value);
  return Number.isSafeInteger(index) ? index : undefined;
}

function firstSrcsetUrl(srcset: string | undefined): string | undefined {
  if (!srcset) return undefined;
  return srcset.split(',').map(candidate => candidate.trim().split(/\s+/)[0]).find(Boolean);
}

export class AsuraScansSource implements MangaSource {
  id = 'asura-scans';
  name = 'Asura Scans';
  baseUrl = `https://${SOURCE_HOST}`;
  domains = [SOURCE_HOST];
  allowSubdomains = false;

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password && parsed.hostname.toLowerCase() === SOURCE_HOST;
    } catch { return false; }
  }

  protected async fetchHtml(url: string): Promise<{ url: string; $: CheerioAPI }> {
    if (!this.canHandle(url)) throw new Error('Asura Scans URLs must use the exact asurascans.com host.');
    let response;
    try {
      response = await safeFetch(url, {
        allowedDomains: this.domains,
        allowSubdomains: false,
        timeoutMs: 15000,
        maxBytes: 8 * 1024 * 1024,
        headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': USER_AGENT }
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown request failure.';
      throw new Error(`Asura Scans could not load the requested page: ${reason}`);
    }
    if (response.status < 200 || response.status >= 300) throw new Error(`Asura Scans returned HTTP ${response.status} for ${response.url}.`);
    const contentType = response.headers.get('content-type') || '';
    if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      throw new Error(`Asura Scans returned an unexpected content type for ${response.url}.`);
    }
    return { url: response.url, $: load(Buffer.from(response.body).toString('utf8')) };
  }

  async extractManga(url: string): Promise<MangaMetadata> {
    const { url: finalUrl, $ } = await this.fetchHtml(url);
    const parsedUrl = new URL(finalUrl);
    const slug = mangaSlug(parsedUrl);
    if (!slug) throw new Error(`Asura Scans manga URLs must use /comics/{slug}: ${finalUrl}`);
    const comic = structuredComic($);
    const title = cleanText($('h1').first().text()) || cleanText(typeof comic?.name === 'string' ? comic.name : '');
    if (!title) throw new Error(`Asura Scans could not find the manga title in ${finalUrl} (h1 or ComicSeries JSON-LD).`);

    const canonical = $('link[rel="canonical"]').first().attr('href');
    const mainUrl = canonical ? exactUrl(canonical, finalUrl, new Set([SOURCE_HOST])) || finalUrl : finalUrl;
    const coverUrlValue = coverValue(comic?.image) || $('img#mobile-cover-img').first().attr('src') || $('meta[property="og:image"]').first().attr('content');
    const coverUrl = coverUrlValue && exactUrl(coverUrlValue, finalUrl, new Set([IMAGE_HOST, SOURCE_HOST]));
    const description = cleanText($('.line-clamp-3').first().text()) || cleanText(typeof comic?.description === 'string' ? comic.description : '');
    const alternateName = comic?.alternateName;
    const altTitles = (typeof alternateName === 'string' ? alternateName.split(/\s*•\s*/) : Array.isArray(alternateName) ? alternateName : [])
      .filter((value: unknown): value is string => typeof value === 'string')
      .map(cleanText)
      .filter(value => value && value.toLowerCase() !== title.toLowerCase());
    const genres = (Array.isArray(comic?.genre) ? comic.genre : typeof comic?.genre === 'string' ? [comic.genre] : [])
      .filter((value: unknown): value is string => typeof value === 'string').map(cleanText).filter(Boolean);
    const author = personName(comic?.author);
    const artist = personName(comic?.illustrator || comic?.artist);
    const status = statusValue(labeledStat($, 'Status') || '');
    const type = typeValue(labeledStat($, 'Type') || '');

    return {
      title,
      mainUrl,
      externalId: slug,
      ...(coverUrl ? { coverUrl } : {}),
      ...(description ? { description } : {}),
      ...(author ? { author } : {}),
      ...(artist ? { artist } : {}),
      ...(genres.length ? { genres: [...new Set(genres)] } : {}),
      ...(altTitles.length ? { altTitles: [...new Set(altTitles)] } : {}),
      ...(status ? { status } : {}),
      ...(type ? { type } : {})
    };
  }

  async extractChapters(urlOrExternalId: string): Promise<ChapterMetadata[]> {
    let mangaUrl = urlOrExternalId.trim();
    if (!/^https?:\/\//i.test(mangaUrl)) {
      if (!/^[a-z\d-]+$/i.test(mangaUrl)) throw new Error('Asura Scans chapter extraction requires a manga URL or its comic slug.');
      mangaUrl = `${this.baseUrl}/comics/${mangaUrl}`;
    }
    if (!this.canHandle(mangaUrl)) throw new Error('Asura Scans chapter extraction requires a URL on asurascans.com.');
    const { url: finalUrl, $ } = await this.fetchHtml(mangaUrl);
    const slug = mangaSlug(new URL(finalUrl));
    if (!slug) throw new Error(`Asura Scans did not return a /comics/{slug} page: ${finalUrl}`);

    const prefix = `/comics/${slug.toLowerCase()}/chapter/`;
    const links = $('a.group[href]').toArray().filter(element => {
      const href = $(element).attr('href') || '';
      return href.toLowerCase().startsWith(prefix) && /^chapter\b/i.test(cleanText($(element).text()));
    });
    if (!links.length) throw new Error(`Asura Scans chapter list was not found in ${finalUrl} (a.group[href*="/chapter/"]).`);

    const chapters = new Map<string, ChapterMetadata>();
    links.forEach((link, sourcePosition) => {
      const resolved = chapterUrl($(link).attr('href') || '', finalUrl, slug);
      if (!resolved) return;
      const visible = getChapterText($, link);
      const chapterNumber = parseChapterNumber(visible.title);
      const title = visible.title || cleanText($(link).attr('aria-label') || '') || 'Chapter';
      if (!chapters.has(resolved)) {
        chapters.set(resolved, {
          id: resolved,
          title,
          chapterNumber,
          chapterNumberText: title,
          url: resolved,
          ...(visible.date ? { releaseDate: visible.date } : {}),
          sourcePosition
        });
      }
    });
    if (!chapters.size) throw new Error(`Asura Scans chapter rows had no valid URLs in ${finalUrl}.`);

    const reportedCount = chapterCount($);
    if (reportedCount !== undefined && reportedCount > chapters.size) {
      throw new Error(`Asura Scans reports ${reportedCount} chapters but only ${chapters.size} chapter links were extracted from ${finalUrl}; the list may be incomplete or its markup may have changed.`);
    }
    return [...chapters.values()];
  }

  async extractPages(chapterUrlOrId: string): Promise<ChapterPagesResult> {
    const input = chapterUrlOrId.trim();
    if (!this.canHandle(input)) throw new Error('Asura Scans reader extraction requires a chapter URL on asurascans.com.');
    const identity = chapterPath(input);
    if (!identity) throw new Error(`Asura Scans reader URL must use /comics/{slug}/chapter/{number}: ${input}`);
    const { url: readerUrl, $ } = await this.fetchHtml(input);

    const candidatePages: { url: string; dataIndex?: number; sourcePosition: number }[] = [];
    const seen = new Set<string>();
    $('img').each((sourcePosition, image) => {
      const rawUrl = $(image).attr('data-src') || $(image).attr('data-lazy-src') || $(image).attr('data-original') || $(image).attr('src') || firstSrcsetUrl($(image).attr('srcset'));
      if (!rawUrl) return;
      const imageUrl = exactUrl(rawUrl, readerUrl, PAGE_IMAGE_HOSTS);
      if (!imageUrl || seen.has(imageUrl)) return;
      const segments = new URL(imageUrl).pathname.split('/').filter(Boolean).map(segment => {
        try { return decodeURIComponent(segment); } catch { return segment; }
      });
      if (segments[0] !== 'asura-images' || segments[1] !== 'chapters' || segments[3] !== identity.chapter) return;
      const alt = cleanText($(image).attr('alt') || '');
      const altChapter = alt.match(/\bchapter\s*#?\s*([\d.]+)/i)?.[1];
      if (altChapter && altChapter !== identity.chapter) return;
      seen.add(imageUrl);
      candidatePages.push({ url: imageUrl, dataIndex: pageIndex($(image).attr('data-page-index')), sourcePosition });
    });

    if (!candidatePages.length) {
      throw new Error(`Asura Scans found no reader pages for chapter ${identity.chapter} at ${readerUrl} (img[data-page-index] on ${IMAGE_HOST}).`);
    }
    if (candidatePages.every(page => page.dataIndex !== undefined)) {
      candidatePages.sort((left, right) => left.dataIndex! - right.dataIndex! || left.sourcePosition - right.sourcePosition);
    }

    const canonicalReaderUrl = chapterUrl(readerUrl, readerUrl, identity.slug) || chapterUrl(input, input, identity.slug) || readerUrl;
    const chapterText = `Chapter ${identity.chapter}`;
    const navLinks = $('a[href*="/chapter/"]').toArray();
    const findNavigationUrl = (label: string): string | undefined => {
      const link = navLinks.find(element => cleanText($(element).text()).toLowerCase() === label.toLowerCase());
      return link ? chapterUrl($(link).attr('href') || '', readerUrl, identity.slug) : undefined;
    };
    const prevChapterId = findNavigationUrl('Prev');
    const nextChapterId = findNavigationUrl('Next');
    return {
      chapterId: canonicalReaderUrl,
      pages: candidatePages.map((page, index) => ({ index: index + 1, url: page.url })),
      title: chapterText,
      chapterNumberText: chapterText,
      ...(prevChapterId ? { prevChapterId } : {}),
      ...(nextChapterId ? { nextChapterId } : {})
    };
  }
}
