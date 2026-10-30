import * as cheerio from 'cheerio';
import { MangaSource, MangaMetadata, ChapterMetadata, ChapterPagesResult, MangaType } from './types';

export class GenericHtmlSource implements MangaSource {
  id = 'generic-html';
  name = 'Web Scraper Universal (HTML)';
  baseUrl = '';

  canHandle(url: string): boolean {
    return /^https?:\/\//i.test(url.trim());
  }

  async extractManga(url: string): Promise<MangaMetadata> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!res.ok) {
      throw new Error(`Não foi possível acessar a página (${res.status}): ${res.statusText}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract title
    let title = $('meta[property="og:title"]').attr('content')
      || $('meta[name="twitter:title"]').attr('content')
      || $('h1.entry-title').text().trim()
      || $('h1').first().text().trim()
      || $('title').text().replace(/[-–|].*$/, '').trim();

    if (!title) {
      title = 'Obra sem título';
    }

    // Extract description
    const description = $('meta[property="og:description"]').attr('content')
      || $('meta[name="description"]').attr('content')
      || $('.manga-excerpt, .description, .synopsis, .summary__content').first().text().trim()
      || '';

    // Extract cover image
    let coverUrl = $('meta[property="og:image"]').attr('content')
      || $('meta[name="twitter:image"]').attr('content')
      || $('.summary_image img, .manga-thumb img, .thumb img').attr('src')
      || $('.summary_image img, .manga-thumb img, .thumb img').attr('data-src')
      || '';

    if (coverUrl && !coverUrl.startsWith('http')) {
      try {
        coverUrl = new URL(coverUrl, url).href;
      } catch {
        // keep as is
      }
    }

    if (!coverUrl) {
      coverUrl = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';
    }

    // Detect type
    let type: MangaType = 'manga';
    const bodyText = (html + ' ' + title).toLowerCase();
    if (bodyText.includes('manhwa') || bodyText.includes('coreano')) {
      type = 'manhwa';
    } else if (bodyText.includes('manhua') || bodyText.includes('chinês')) {
      type = 'manhua';
    } else if (bodyText.includes('webtoon')) {
      type = 'webtoon';
    }

    // Author
    const author = $('.author-content a, .manga-authors a, .author').first().text().trim() || undefined;

    return {
      title,
      description,
      coverUrl,
      type,
      status: 'ongoing',
      author,
      mainUrl: url
    };
  }

  async extractChapters(url: string): Promise<ChapterMetadata[]> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`Falha ao ler página de capítulos (${res.status})`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const chapters: ChapterMetadata[] = [];
    const seenUrls = new Set<string>();

    // Search for chapter links: common patterns
    $('a').each((_, el) => {
      const link = $(el);
      const href = link.attr('href');
      const text = link.text().trim();

      if (!href || href === '#' || href.startsWith('javascript:')) return;

      // Match chapter patterns like: "Capítulo 14", "Cap. 14.5", "Chapter 120", "Ch. 5"
      const match = text.match(/(?:cap[ií]tulo|chapter|cap\.?|ch\.?)\s*(\d+(?:\.\d+)?)/i)
        || href.match(/(?:capitulo|chapter|ch)[-_/]?(\d+(?:\.\d+)?)/i);

      if (match) {
        let fullUrl = href;
        if (!fullUrl.startsWith('http')) {
          try {
            fullUrl = new URL(href, url).href;
          } catch {
            return;
          }
        }

        if (seenUrls.has(fullUrl)) return;
        seenUrls.add(fullUrl);

        const chNum = parseFloat(match[1]);
        const cleanTitle = text.length > 3 ? text.replace(/\s+/g, ' ') : `Capítulo ${match[1]}`;

        chapters.push({
          id: `gen-${Math.abs(hashString(fullUrl))}`,
          title: cleanTitle,
          chapterNumber: isNaN(chNum) ? 0 : chNum,
          chapterNumberText: `Capítulo ${match[1]}`,
          url: fullUrl
        });
      }
    });

    // Sort descending by chapter number
    return chapters.sort((a, b) => b.chapterNumber - a.chapterNumber);
  }

  async extractPages(chapterUrl: string): Promise<ChapterPagesResult> {
    const res = await fetch(chapterUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    if (!res.ok) {
      throw new Error(`Erro ao acessar página de leitura (${res.status}): ${res.statusText}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const pages: { index: number; url: string }[] = [];
    const seenUrls = new Set<string>();

    const cleanAndAddUrl = (rawUrl: string | undefined): boolean => {
      if (!rawUrl || typeof rawUrl !== 'string') return false;
      let clean = rawUrl.trim().replace(/^['"\\]+|['"\\]+$/g, '');
      if (!clean || clean.startsWith('data:image/svg') || clean.includes('avatar') || clean.includes('logo') || clean.includes('banner') || clean.includes('ads') || clean.includes('icon') || clean.includes('button')) {
        return false;
      }

      if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        try {
          clean = new URL(clean, chapterUrl).href;
        } catch {
          return false;
        }
      }

      if (!seenUrls.has(clean)) {
        seenUrls.add(clean);
        pages.push({
          index: pages.length + 1,
          url: clean
        });
        return true;
      }
      return false;
    };

    // Heurística Passo 1: Seletores específicos de leitores de mangá
    const readerSelectors = [
      '.reading-content img',
      '#readerarea img',
      '.entry-content img',
      '.chapter-image img',
      '.vung-doc img',
      '.page-break img',
      'div[id*="reader"] img',
      'div[class*="chapter-video"] img',
      '.chapter-content img',
      'img.wp-manga-chapter-img',
      '.reader-pages img',
      '#chapter-images img'
    ];

    for (const selector of readerSelectors) {
      $(selector).each((_, el) => {
        const img = $(el);
        const candidate = img.attr('data-src') 
          || img.attr('data-lazy-src') 
          || img.attr('data-original') 
          || img.attr('data-url')
          || img.attr('nitro-lazy-src')
          || img.attr('data-full-url')
          || img.attr('src');
        cleanAndAddUrl(candidate);
      });
      if (pages.length >= 2) break;
    }

    // Heurística Passo 2: Se nenhum seletor específico encontrou, varrer todas as tags <img>
    if (pages.length === 0) {
      $('img').each((_, el) => {
        const img = $(el);
        const candidate = img.attr('data-src') 
          || img.attr('data-lazy-src') 
          || img.attr('data-original') 
          || img.attr('data-url')
          || img.attr('src');
        cleanAndAddUrl(candidate);
      });
    }

    // Heurística Passo 3: Inspeção profunda de scripts embutidos (JSON / Arrays de páginas)
    if (pages.length < 2) {
      $('script').each((_, el) => {
        const scriptContent = $(el).html() || '';
        if (!scriptContent || (!scriptContent.includes('http') && !scriptContent.includes('/'))) return;

        // Procura por listas de imagens em scripts (ex: ts_reader, chapter_images, pages array)
        const matches = scriptContent.matchAll(/https?:\/\/[^"'\s\\]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^"'\s\\]*)?/gi);
        for (const match of matches) {
          cleanAndAddUrl(match[0]);
        }

        // Procura caminhos relativos em arrays JSON
        const relativeMatches = scriptContent.matchAll(/["'](\/(?:uploads|storage|data|chapters|manga)[^"']+\.(?:jpg|jpeg|png|webp|avif))["']/gi);
        for (const rel of relativeMatches) {
          cleanAndAddUrl(rel[1]);
        }
      });
    }

    return {
      chapterId: chapterUrl,
      pages
    };
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}
