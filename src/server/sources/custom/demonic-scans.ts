import { load } from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { ChapterMetadata, ChapterPagesResult, MangaMetadata, MangaSource } from '../types';
import { safeFetch } from '../../services/safe-http';

const SOURCE_HOST = 'demonicscans.org';
const IMAGE_HOST = 'cdn2.demoniclibs.com';
const PAGE_IMAGE_HOSTS = new Set([SOURCE_HOST, IMAGE_HOST]);
const COVER_HOSTS = new Set([SOURCE_HOST, 'readermc.org']);
const USER_AGENT = 'MangaX/1.0 (+self-hosted manga library)';

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function allowedAbsoluteUrl(rawValue: string, baseUrl: string, allowedHosts: Set<string>): string | undefined {
  try {
    const url = new URL(rawValue, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !allowedHosts.has(url.hostname.toLowerCase())) return undefined;
    url.hash = '';
    return url.href;
  } catch { return undefined; }
}

function normalizeChapterUrl(rawValue: string, baseUrl: string): string | undefined {
  const value = allowedAbsoluteUrl(rawValue, baseUrl, new Set([SOURCE_HOST]));
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!url.pathname.endsWith('/chaptered.php') || !url.searchParams.get('chapter') || !url.searchParams.get('manga')) return undefined;
    url.searchParams.sort();
    return url.href;
  } catch { return undefined; }
}

function chapterIdentity(url: string): { mangaRef: string; chapterRef: string } | undefined {
  try {
    const parsed = new URL(url);
    const queryManga = parsed.searchParams.get('manga');
    const queryChapter = parsed.searchParams.get('chapter');
    if (queryManga && queryChapter) return { mangaRef: queryManga, chapterRef: queryChapter };
    const slug = parsed.pathname.match(/\/title\/([^/]+)\/chapter\/([^/]+)/i);
    if (slug) return { mangaRef: slug[1], chapterRef: slug[2] };
  } catch { /* The caller reports an actionable URL error. */ }
  return undefined;
}

function parseNumber(text: string): number | null {
  const match = text.match(/\b(?:chapter|ch\.?)[\s#-]*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isFinite(number) ? number : null;
}

function isDateOrRelativeDate(text: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(text) || /^(?:today|yesterday|last\s+(?:week|month|year)|\d+\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago)$/i.test(text);
}

function chapterTitle($: CheerioAPI, entry: any): { title: string; date?: string } {
  const $entry = $(entry);
  const dates = $entry.find('*').map((_, node) => cleanText($(node).text())).get().filter(isDateOrRelativeDate);
  const clone = $entry.clone();
  clone.find('*').filter((_, node) => $(node).children().length === 0 && isDateOrRelativeDate(cleanText($(node).text()))).remove();
  const title = cleanText(clone.text());
  const date = dates.find(value => /^\d{4}-\d{2}-\d{2}$/.test(value));
  return { title, ...(date ? { date } : {}) };
}

function statusFromText(text: string): MangaMetadata['status'] | undefined {
  const normalized = text.toLowerCase();
  if (normalized.includes('ongoing')) return 'ongoing';
  if (normalized.includes('completed') || normalized.includes('complete')) return 'completed';
  if (normalized.includes('hiatus')) return 'hiatus';
  return undefined;
}

function usefulMetadata(text: string | undefined): string | undefined {
  const value = cleanText(text || '');
  return !value || /^(?:updating|unknown|n\/?a|none)$/i.test(value) ? undefined : value;
}

function externalMangaId($: CheerioAPI): string | undefined {
  const links = $('#read-first, a[href*="manga="]');
  for (const element of links.toArray()) {
    try {
      const value = new URL($(element).attr('href') || '', `https://${SOURCE_HOST}`).searchParams.get('manga');
      if (value && /^[a-z\d_-]+$/i.test(value)) return value;
    } catch { /* Ignore links without a usable manga id. */ }
  }
  return undefined;
}

function chapterCount($: CheerioAPI): number | undefined {
  const match = $('#chapters-container h2').first().text().match(/(\d+)\s+chapters?\b/i);
  return match ? Number(match[1]) : undefined;
}

function chapterTokenFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('chapter') || parsed.pathname.match(/\/chapter\/([^/]+)/i)?.[1];
  } catch { return undefined; }
}

function chapterUrlFromReader($: CheerioAPI, readerUrl: string, inputUrl: string): string | undefined {
  const inputChapterUrl = normalizeChapterUrl(inputUrl, inputUrl);
  if (inputChapterUrl) return inputChapterUrl;
  const chapterRef = chapterTokenFromUrl(readerUrl) || chapterTokenFromUrl(inputUrl);
  if (!chapterRef) return undefined;
  const navigation = $('a').toArray()
    .map(link => normalizeChapterUrl($(link).attr('href') || '', readerUrl))
    .filter((url): url is string => Boolean(url));
  const mangaRef = navigation.map(url => chapterIdentity(url)?.mangaRef).find(Boolean);
  if (!mangaRef) return undefined;
  const queryUrl = new URL('/chaptered.php', readerUrl);
  queryUrl.searchParams.set('manga', mangaRef);
  queryUrl.searchParams.set('chapter', chapterRef);
  return normalizeChapterUrl(queryUrl.href, readerUrl);
}

function firstSrcsetUrl(srcset: string | undefined): string | undefined {
  if (!srcset) return undefined;
  return srcset.split(',').map(candidate => candidate.trim().split(/\s+/)[0]).find(Boolean);
}

export class DemonicScansSource implements MangaSource {
  id = 'demonic-scans';
  name = 'Demonic Scans';
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
    if (!this.canHandle(url)) throw new Error('Demonic Scans URLs must use the exact demonicscans.org host.');
    let response;
    try {
      response = await safeFetch(url, {
        allowedDomains: this.domains,
        allowSubdomains: false,
        timeoutMs: 15000,
        maxBytes: 4 * 1024 * 1024,
        headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': USER_AGENT }
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown request failure.';
      throw new Error(`Demonic Scans could not load the requested page: ${reason}`);
    }
    if (response.status < 200 || response.status >= 300) throw new Error(`Demonic Scans returned HTTP ${response.status} for ${response.url}.`);
    const contentType = response.headers.get('content-type') || '';
    if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      throw new Error(`Demonic Scans returned an unexpected content type for ${response.url}.`);
    }
    return { url: response.url, $: load(Buffer.from(response.body).toString('utf8')) };
  }

  async extractManga(url: string): Promise<MangaMetadata> {
    const { url: finalUrl, $ } = await this.fetchHtml(url);
    const title = cleanText($('#manga-info-rightColumn h1.big-fat-titles').first().text());
    if (!title) throw new Error(`Demonic Scans could not find the manga title in ${finalUrl} (#manga-info-rightColumn h1.big-fat-titles).`);

    const cover = $('#manga-page img[src]').first().attr('src');
    const coverUrl = cover && allowedAbsoluteUrl(cover, finalUrl, COVER_HOSTS);
    const description = usefulMetadata($('#manga-info-rightColumn .white-font').first().text());
    const genres = $('#manga-info-rightColumn .genres-list li, #manga-info-rightColumn .genres-list a')
      .toArray().map(element => cleanText($(element).text())).filter(Boolean);
    const stats = new Map<string, string>();
    $('#manga-info-stats .flex.flex-row').each((_, row) => {
      const cells = $(row).find('li');
      if (cells.length >= 2) stats.set(cleanText(cells.first().text()).toLowerCase(), cleanText(cells.eq(1).text()));
    });
    const author = usefulMetadata(stats.get('author'));
    const artist = usefulMetadata(stats.get('artist'));
    const alternateTitles = usefulMetadata(stats.get('alternatives'));
    const status = statusFromText(stats.get('status') || '');
    const externalId = externalMangaId($);
    const metaImage = $('meta[property="og:image"]').first().attr('content');
    const resolvedCover = coverUrl || (metaImage ? allowedAbsoluteUrl(metaImage, finalUrl, COVER_HOSTS) : undefined);

    return {
      title,
      mainUrl: finalUrl,
      ...(resolvedCover ? { coverUrl: resolvedCover } : {}),
      ...(description ? { description } : {}),
      ...(author ? { author } : {}),
      ...(artist ? { artist } : {}),
      ...(genres.length ? { genres: [...new Set(genres)] } : {}),
      ...(status ? { status } : {}),
      ...(alternateTitles ? { altTitles: alternateTitles.split(/[,;|]/).map(cleanText).filter(Boolean) } : {}),
      ...(externalId ? { externalId } : {})
    };
  }

  async extractChapters(urlOrExternalId: string): Promise<ChapterMetadata[]> {
    if (!/^https?:\/\//i.test(urlOrExternalId.trim())) {
      throw new Error('Demonic Scans chapter extraction requires the manga page URL; a numeric external ID is not enough to identify its page.');
    }
    const { url: finalUrl, $ } = await this.fetchHtml(urlOrExternalId);
    const links = $('#chapters-list a.chplinks').toArray();
    if (!$('#chapters-list').length) throw new Error(`Demonic Scans chapter list container was not found in ${finalUrl} (#chapters-list).`);
    if (!links.length) throw new Error(`Demonic Scans found no chapter entries in ${finalUrl} (#chapters-list a.chplinks).`);

    const chapters = new Map<string, ChapterMetadata>();
    links.forEach((link, sourcePosition) => {
      const rawUrl = $(link).attr('href');
      const chapterUrl = rawUrl && normalizeChapterUrl(rawUrl, finalUrl);
      if (!chapterUrl || !chapterIdentity(chapterUrl)) return;
      const visible = chapterTitle($, link);
      const number = parseNumber(visible.title);
      const label = visible.title || cleanText($(link).attr('title') || '') || (number === null ? 'Special Chapter' : `Chapter ${number}`);
      if (!chapters.has(chapterUrl)) {
        chapters.set(chapterUrl, {
          id: chapterUrl,
          title: label,
          chapterNumber: number,
          chapterNumberText: label,
          url: chapterUrl,
          ...(visible.date ? { releaseDate: visible.date } : {}),
          sourcePosition
        });
      }
    });

    if (!chapters.size) throw new Error(`Demonic Scans chapter entries had no valid chapter URLs in ${finalUrl} (#chapters-list a.chplinks[href]).`);
    const reportedCount = chapterCount($);
    if (reportedCount !== undefined && reportedCount > chapters.size) {
      throw new Error(`Demonic Scans reported ${reportedCount} chapters but only ${chapters.size} valid chapter links were extracted from ${finalUrl}; the list may be incomplete or its markup may have changed.`);
    }
    return [...chapters.values()];
  }

  async extractPages(chapterUrlOrId: string): Promise<ChapterPagesResult> {
    const input = chapterUrlOrId.trim();
    if (!this.canHandle(input)) throw new Error('Demonic Scans reader extraction requires a chapter URL on demonicscans.org.');
    const { url: readerUrl, $ } = await this.fetchHtml(input);
    const heading = $('.chapter-info h2').first().text() || $('h2').filter((_, node) => /^chapter\b/i.test(cleanText($(node).text()))).first().text();
    const chapterText = cleanText(heading);
    const chapterNumber = parseNumber(chapterText);
    const routeToken = chapterTokenFromUrl(readerUrl) || chapterTokenFromUrl(input);
    const chapterToken = chapterNumber === null ? routeToken : String(chapterNumber);
    if (!chapterToken) throw new Error(`Demonic Scans could not identify the chapter number from ${readerUrl}.`);

    const candidatePages: { url: string; sourcePosition: number }[] = [];
    const seen = new Set<string>();
    $('.imgholder').each((sourcePosition, image) => {
      const rawUrl = $(image).attr('data-src') || $(image).attr('data-lazy-src') || $(image).attr('data-original') || $(image).attr('src') || firstSrcsetUrl($(image).attr('srcset'));
      if (!rawUrl) return;
      const pageUrl = allowedAbsoluteUrl(rawUrl, readerUrl, PAGE_IMAGE_HOSTS);
      if (!pageUrl || seen.has(pageUrl)) return;
      const alt = cleanText($(image).attr('alt') || '');
      const chapterLabelMatches = chapterNumber !== null && parseNumber(alt) === chapterNumber;
      const pathSegments = new URL(pageUrl).pathname.split('/').map(segment => {
        try { return decodeURIComponent(segment); } catch { return segment; }
      });
      const urlBelongsToChapter = pathSegments.some(segment => segment.toLowerCase() === `${chapterToken}.`.toLowerCase());
      if (!chapterLabelMatches && !urlBelongsToChapter) return;
      seen.add(pageUrl);
      candidatePages.push({ url: pageUrl, sourcePosition });
    });

    if (!candidatePages.length) {
      throw new Error(`Demonic Scans found no valid reader images for ${chapterText || `chapter ${chapterToken}`} in ${readerUrl}; expected .imgholder images on ${IMAGE_HOST}.`);
    }
    candidatePages.sort((left, right) => left.sourcePosition - right.sourcePosition);
    const chapterId = chapterUrlFromReader($, readerUrl, input) || readerUrl;
    const prevChapterId = normalizeChapterUrl($('.prevchap').first().attr('href') || '', readerUrl);
    const nextChapterId = normalizeChapterUrl($('.nextchap').first().attr('href') || '', readerUrl);
    return {
      chapterId,
      pages: candidatePages.map((page, index) => ({ index: index + 1, url: page.url })),
      ...(chapterText ? { title: chapterText } : {}),
      ...(chapterText ? { chapterNumberText: chapterText } : {}),
      ...(prevChapterId ? { prevChapterId } : {}),
      ...(nextChapterId ? { nextChapterId } : {})
    };
  }
}
