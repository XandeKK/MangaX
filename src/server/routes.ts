import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from './db/database';
import { getRegisteredSources, getSourceForUrl, testSourceHealth } from './sources';
import { monitoringService } from './services/monitoring';
import { BLOCKED_AD_DOMAINS, securityService } from './services/security';
import { safeFetch } from './services/safe-http';

export const apiRouter = Router();

export function normalizeInputUrl(input: string): string {
  const value = input.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return `https://mangadex.org/title/${value}`;
  if (value.startsWith('mangadex.org/')) return `https://${value}`;
  return value;
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(item => String(item).trim()).filter(Boolean) : [];
  } catch { return []; }
}

function stableUrlHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

function normalizeHttpUrl(value: string): string {
  let parsed: URL;
  try { parsed = new URL(value); }
  catch { throw new Error('The source adapter returned an invalid URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Source URLs must use credential-free HTTP or HTTPS.');
  }
  parsed.hash = '';
  if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.href;
}

function serializeManga(row: any): any {
  if (!row) return row;
  return { ...row, genres: parseJsonArray(row.genres_json), alt_titles: parseJsonArray(row.alt_titles_json) };
}

// ==================== MANGAS & BIBLIOTECA ====================

// List all mangas with filters and sorting
apiRouter.get('/mangas', (req: Request, res: Response) => {
  try {
    const { type, status, search, sort } = req.query;
    let sql = 'SELECT * FROM mangas WHERE 1=1';
    const params: any[] = [];

    if (type === 'unread') {
      sql += ' AND unread_count > 0';
    } else if (type && type !== 'all') {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (search && typeof search === 'string' && search.trim()) {
      sql += ' AND (title LIKE ? OR description LIKE ? OR author LIKE ? OR genres_json LIKE ? OR alt_titles_json LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    // Sort order
    if (sort === 'title') {
      sql += ' ORDER BY title ASC';
    } else if (sort === 'unread') {
      sql += ' ORDER BY unread_count DESC, updated_at DESC';
    } else if (sort === 'latest_chapter') {
      sql += ' ORDER BY last_known_chapter_number DESC';
    } else {
      sql += ' ORDER BY updated_at DESC';
    }

    const mangas = dbAll(sql, params).map(serializeManga);
    res.json(mangas);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single manga with sources, chapters, and reader preferences
apiRouter.get('/mangas/:id', (req: Request, res: Response) => {
  try {
    const manga = serializeManga(dbGet('SELECT * FROM mangas WHERE id = ?', [req.params.id]));
    if (!manga) {
      return res.status(404).json({ error: 'Obra não encontrada' });
    }

    const sources = dbAll('SELECT * FROM sources WHERE manga_id = ? ORDER BY created_at ASC', [manga.id]);
    const chapters = dbAll('SELECT * FROM chapters WHERE manga_id = ? ORDER BY CASE WHEN chapter_number IS NULL THEN 1 ELSE 0 END, chapter_number DESC, release_date DESC, url DESC', [manga.id]);
    const preferences = dbGet('SELECT * FROM reader_preferences WHERE manga_id = ?', [manga.id]) || {
      reading_mode: manga.type === 'webtoon' ? 'webtoon' : 'single',
      direction: manga.type === 'webtoon' ? 'vertical' : 'rtl',
      night_filter: 'none',
      scroll_snap: 0,
      fit_mode: 'fit_width',
      auto_mark_read: 1
    };

    res.json({
      manga,
      sources,
      chapters,
      preferences
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/sources/registry', (_req: Request, res: Response) => {
  res.json({ sources: getRegisteredSources() });
});

// Preview metadata by URL without saving
apiRouter.post('/sources/preview', async (req: Request, res: Response) => {
  try {
    const inputUrl = req.body?.url;
    if (!inputUrl || typeof inputUrl !== 'string') {
      return res.status(400).json({ error: 'URL é obrigatória' });
    }
    const url = normalizeInputUrl(inputUrl);
    const extractor = getSourceForUrl(url);
    const [metadataResult, chapterResult] = await Promise.allSettled([extractor.extractManga(url), extractor.extractChapters(url)]);
    const metadata = metadataResult.status === 'fulfilled' ? metadataResult.value : null;
    const chapters = chapterResult.status === 'fulfilled' ? chapterResult.value : [];
    let pages: any = null;
    let pageError: string | undefined;
    let imageLoadError: string | undefined;
    const sampleChapter = chapters[0];
    if (sampleChapter) {
      try { pages = await extractor.extractPages(sampleChapter.url); }
      catch (error: any) { pageError = error.message; }
    }
    if (pages?.pages?.[0]?.url) {
      try {
        const image = await safeFetch(pages.pages[0].url, { blockedDomains: BLOCKED_AD_DOMAINS, timeoutMs: 8000, maxBytes: 6 * 1024 * 1024, headers: { Accept: 'image/*', 'User-Agent': 'MangaX/1.0 (+source health check)' } });
        const contentType = image.headers.get('content-type') || '';
        if (image.status < 200 || image.status >= 300 || !contentType.toLowerCase().startsWith('image/')) imageLoadError = `First reader URL did not return an image (HTTP ${image.status}, ${contentType || 'unknown content type'}).`;
      } catch (error: any) { imageLoadError = error.message; }
    }
    const chapterNumbers = chapters.length ? 'working' : chapterResult.status === 'rejected' ? 'failed' : 'not-tested';
    const sequence = chapters.map(chapter => chapter.chapterNumber).filter((number): number is number => typeof number === 'number');
    const monotonic = sequence.length < 2 || sequence.every((number, index) => index === 0 || number >= sequence[index - 1]) || sequence.every((number, index) => index === 0 || number <= sequence[index - 1]);
    const health = {
      metadata: metadata?.title ? 'working' : metadataResult.status === 'rejected' ? 'failed' : 'needs-attention',
      cover: metadata?.coverUrl ? 'working' : 'needs-attention',
      chapters: chapters.length ? 'working' : chapterResult.status === 'rejected' ? 'failed' : 'needs-attention',
      chapterNumbers,
      chapterOrdering: sequence.length > 1 ? monotonic ? 'working' : 'needs-attention' : chapters.length ? 'needs-attention' : 'not-tested',
      readerImages: pages?.pages?.length ? 'working' : sampleChapter ? 'failed' : 'not-tested',
      imageLoading: pages?.pages?.length ? imageLoadError ? 'failed' : 'working' : 'not-tested',
      imageOrdering: (pages?.pages?.length || 0) > 1 ? 'working' : pages?.pages?.length ? 'needs-attention' : 'not-tested'
    };
    res.json({
      metadata, chapters, chaptersCount: chapters.length, pages, health,
      warnings: [
        metadataResult.status === 'rejected' ? metadataResult.reason?.message : '',
        ...(metadata?.warnings || []),
        chapterResult.status === 'rejected' ? chapterResult.reason?.message : '',
        ...chapters.flatMap(chapter => chapter.warnings || []),
        pageError || '',
        ...(pages?.warnings || []),
        imageLoadError || ''
      ].filter(Boolean),
      sourceName: extractor.name, sourceId: extractor.id
    });
  } catch (err: any) {
    res.status(400).json({ error: `Falha na extração de metadados: ${err.message}` });
  }
});

// Register new manga (by URL or manual)
apiRouter.post('/mangas', async (req: Request, res: Response) => {
  try {
    const { title, description, coverUrl, type, status, author, artist, genres, altTitles } = req.body;
    const url = typeof req.body?.url === 'string' && req.body.url.trim() ? normalizeInputUrl(req.body.url) : '';
    const now = Date.now();

    let mangaTitle = title;
    let mangaDesc = description || '';
    let mangaCover = coverUrl || '';
    let mangaType = type || '';
    let mangaStatus = status || '';
    let mangaAuthor = author || '';
    let mangaArtist = artist || '';
    let mangaGenres = parseJsonArray(genres);
    let mangaAltTitles = parseJsonArray(altTitles);
    let mainUrl = url ? normalizeHttpUrl(url) : `custom://${now}`;

    let chapters: any[] = [];
    let sourceName = 'Manual';
    let sourceType = url ? 'custom' : 'custom';

    // A supplied website URL must resolve to an explicitly registered adapter.
    if (url) {
      const existingByInputUrl = dbGet<{ id: string; title: string }>('SELECT id, title FROM mangas WHERE main_url = ?', [mainUrl]);
      if (existingByInputUrl) {
        const chaptersCount = dbGet<{ count: number }>('SELECT COUNT(*) AS count FROM chapters WHERE manga_id = ?', [existingByInputUrl.id])?.count || 0;
        return res.status(200).json({ id: existingByInputUrl.id, title: existingByInputUrl.title, chaptersCount, existing: true });
      }
      let extractor;
      try { extractor = getSourceForUrl(url); }
      catch (e: any) { return res.status(400).json({ error: e.message }); }
      sourceName = extractor.name;
      sourceType = extractor.id;

      try {
        const extracted = await extractor.extractManga(url);
        sourceType = extractor.id;
        mainUrl = normalizeHttpUrl(extracted.mainUrl || url);
        if (getSourceForUrl(mainUrl).id !== extractor.id) {
          throw new Error('The adapter returned a canonical manga URL for a different registered source.');
        }
        mangaTitle = mangaTitle || extracted.title;
        mangaDesc = mangaDesc || extracted.description;
        mangaCover = mangaCover || extracted.coverUrl;
        mangaType = mangaType || extracted.type;
        mangaStatus = mangaStatus || extracted.status;
        mangaAuthor = mangaAuthor || extracted.author || '';
        mangaArtist = mangaArtist || extracted.artist || '';
        mangaGenres = extracted.genres?.length ? extracted.genres : mangaGenres;
        mangaAltTitles = extracted.altTitles?.length ? extracted.altTitles : mangaAltTitles;
      } catch (e: any) { return res.status(400).json({ error: `The ${extractor.name} adapter could not extract manga details: ${e.message}` }); }

      const existingByCanonicalUrl = dbGet<{ id: string; title: string }>('SELECT id, title FROM mangas WHERE main_url = ?', [mainUrl]);
      if (existingByCanonicalUrl) {
        const chaptersCount = dbGet<{ count: number }>('SELECT COUNT(*) AS count FROM chapters WHERE manga_id = ?', [existingByCanonicalUrl.id])?.count || 0;
        return res.status(200).json({ id: existingByCanonicalUrl.id, title: existingByCanonicalUrl.title, chaptersCount, existing: true });
      }

      try {
        chapters = await extractor.extractChapters(url);
      } catch (e: any) { return res.status(400).json({ error: `The ${extractor.name} adapter could not extract chapters: ${e.message}` }); }
    }

    if (!mangaTitle) {
      return res.status(400).json({ error: 'Título é obrigatório.' });
    }

    mangaType ||= 'manga';
    mangaStatus ||= 'ongoing';

    if (!mangaCover) {
      mangaCover = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';
    }

    const normalizedChapters: any[] = [];
    const chapterUrlSet = new Set<string>();
    try {
      for (const chapter of chapters) {
        const chapterUrl = normalizeHttpUrl(chapter.url);
        if (getSourceForUrl(chapterUrl).id !== sourceType) {
          throw new Error(`The ${sourceName} adapter returned a chapter URL belonging to a different source.`);
        }
        if (chapterUrlSet.has(chapterUrl)) continue;
        chapterUrlSet.add(chapterUrl);
        normalizedChapters.push({ ...chapter, url: chapterUrl });
      }
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }

    const mangaId = `manga-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const sourceId = `src-${mangaId}`;

    let maxChapterNumber: number | null = null;
    for (const c of normalizedChapters) {
      if (typeof c.chapterNumber === 'number' && (maxChapterNumber === null || c.chapterNumber > maxChapterNumber)) maxChapterNumber = c.chapterNumber;
    }

    // Insert manga
    dbRun(
      `INSERT INTO mangas (id, title, description, cover_url, type, status, main_url, author, artist, genres_json, alt_titles_json, last_known_chapter_number, unread_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [mangaId, mangaTitle, mangaDesc, mangaCover, mangaType, mangaStatus, mainUrl, mangaAuthor, mangaArtist, JSON.stringify(mangaGenres), JSON.stringify(mangaAltTitles), maxChapterNumber, normalizedChapters.length, now, now]
    );

    // Insert primary source
    dbRun(
      `INSERT INTO sources (id, manga_id, source_type, name, url, is_active, check_interval_minutes, last_checked_at, last_status, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 30, ?, 'ok', ?)`,
      [sourceId, mangaId, sourceType, sourceName, mainUrl, now, now]
    );

    // Insert reader preferences
    dbRun(
      `INSERT INTO reader_preferences (manga_id, reading_mode, direction, night_filter, scroll_snap, fit_mode, auto_mark_read, last_page, updated_at)
       VALUES (?, ?, ?, 'none', 0, 'fit_width', 1, 1, ?)`,
      [mangaId, mangaType === 'webtoon' ? 'webtoon' : 'single', mangaType === 'webtoon' ? 'vertical' : 'rtl', now]
    );

    // Insert extracted chapters
    for (const c of normalizedChapters) {
      const chapterUrl = c.url;
      const chId = `ch-${mangaId}-${stableUrlHash(chapterUrl)}`;
      dbRun(
        `INSERT INTO chapters (id, manga_id, source_id, title, chapter_number, chapter_number_text, volume, url, release_date, detected_at, is_read)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [chId, mangaId, sourceId, c.title || c.chapterNumberText, c.chapterNumber, c.chapterNumberText, c.volume || null, chapterUrl, c.releaseDate || null, now]
      );
    }

    res.status(201).json({
      id: mangaId,
      title: mangaTitle,
      chaptersCount: normalizedChapters.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update manga
apiRouter.put('/mangas/:id', (req: Request, res: Response) => {
  try {
    const { title, description, coverUrl, type, status, author, artist, genres, altTitles } = req.body;
    const existing = dbGet<any>('SELECT * FROM mangas WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Obra não encontrada' });
    }

    const updatedTitle = (title && typeof title === 'string' && title.trim()) ? title.trim() : existing.title;
    const updatedDesc = description !== undefined ? description : (existing.description || '');
    const updatedCover = coverUrl !== undefined ? coverUrl : existing.cover_url;
    const updatedType = type || existing.type;
    const updatedStatus = status || existing.status;
    const updatedAuthor = author !== undefined ? author : (existing.author || '');
    const updatedArtist = artist !== undefined ? artist : (existing.artist || '');
    const updatedGenres = genres !== undefined ? JSON.stringify(parseJsonArray(genres)) : (existing.genres_json || '[]');
    const updatedAltTitles = altTitles !== undefined ? JSON.stringify(parseJsonArray(altTitles)) : (existing.alt_titles_json || '[]');

    dbRun(
      `UPDATE mangas SET title = ?, description = ?, cover_url = ?, type = ?, status = ?, author = ?, artist = ?, genres_json = ?, alt_titles_json = ?, updated_at = ? WHERE id = ?`,
      [updatedTitle, updatedDesc, updatedCover, updatedType, updatedStatus, updatedAuthor, updatedArtist, updatedGenres, updatedAltTitles, Date.now(), req.params.id]
    );
    res.json({ success: true, manga: serializeManga(dbGet('SELECT * FROM mangas WHERE id = ?', [req.params.id])) });
  } catch (err: any) {
    console.error('Erro ao atualizar obra:', err);
    res.status(500).json({ error: err.message || 'Erro interno ao atualizar obra' });
  }
});

// Delete manga
apiRouter.delete('/mangas/:id', (req: Request, res: Response) => {
  try {
    dbRun('DELETE FROM mangas WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add alternative source to manga
apiRouter.post('/mangas/:id/sources', async (req: Request, res: Response) => {
  try {
    const { name, checkInterval } = req.body;
    if (typeof req.body?.url !== 'string' || !req.body.url.trim()) return res.status(400).json({ error: 'URL da fonte é obrigatória.' });
    const url = normalizeInputUrl(req.body.url);

    const sourceId = `src-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const extractor = getSourceForUrl(url);
    const sourceType = extractor.id;

    dbRun(
      `INSERT INTO sources (id, manga_id, source_type, name, url, is_active, check_interval_minutes, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [sourceId, req.params.id, sourceType, name || extractor.name, url, checkInterval || 30, Date.now()]
    );

    res.status(201).json({ id: sourceId, name: name || extractor.name });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete source
apiRouter.delete('/sources/:id', (req: Request, res: Response) => {
  try {
    dbRun('DELETE FROM sources WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Refresh chapters for a manga
apiRouter.post('/mangas/:id/refresh', async (req: Request, res: Response) => {
  try {
    const result = await monitoringService.runVerificationCycle(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== CONTROLE DE LEITURA ====================

// Toggle or set chapter read state
apiRouter.post('/chapters/:id/read', (req: Request, res: Response) => {
  try {
    const { isRead, lastPageRead } = req.body;
    const chapter = dbGet('SELECT * FROM chapters WHERE id = ?', [req.params.id]);
    if (!chapter) return res.status(404).json({ error: 'Capítulo não encontrado' });

    const newReadState = typeof isRead === 'boolean' ? (isRead ? 1 : 0) : (chapter.is_read ? 0 : 1);
    const readAt = newReadState === 1 ? Date.now() : null;

    dbRun(
      'UPDATE chapters SET is_read = ?, read_at = ?, last_page_read = ? WHERE id = ?',
      [newReadState, readAt, lastPageRead || chapter.last_page_read || 1, chapter.id]
    );

    // If marked as read, update manga's last_read_chapter
    if (newReadState === 1) {
      dbRun(
        'UPDATE mangas SET last_read_chapter_id = ?, last_read_chapter_number = ?, updated_at = ? WHERE id = ?',
        [chapter.id, chapter.chapter_number, Date.now(), chapter.manga_id]
      );
    }

    // Recalculate unread count
    const unreadRes = dbGet<{ count: number }>(
      'SELECT COUNT(*) as count FROM chapters WHERE manga_id = ? AND is_read = 0',
      [chapter.manga_id]
    );

    dbRun('UPDATE mangas SET unread_count = ? WHERE id = ?', [unreadRes?.count || 0, chapter.manga_id]);

    res.json({ isRead: newReadState === 1, unreadCount: unreadRes?.count || 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mark all previous chapters as read
apiRouter.post('/chapters/:id/read-previous', (req: Request, res: Response) => {
  try {
    const chapter = dbGet('SELECT * FROM chapters WHERE id = ?', [req.params.id]);
    if (!chapter) return res.status(404).json({ error: 'Capítulo não encontrado' });

    const now = Date.now();
    const ordered = dbAll<{ id: string }>('SELECT id FROM chapters WHERE manga_id = ? ORDER BY CASE WHEN chapter_number IS NULL THEN 1 ELSE 0 END, chapter_number ASC, url ASC', [chapter.manga_id]);
    const boundary = ordered.findIndex(item => item.id === chapter.id);
    const previousIds = boundary >= 0 ? ordered.slice(0, boundary + 1).map(item => item.id) : [];
    if (previousIds.length) dbRun(`UPDATE chapters SET is_read = 1, read_at = ? WHERE id IN (${previousIds.map(() => '?').join(',')})`, [now, ...previousIds]);

    dbRun(
      'UPDATE mangas SET last_read_chapter_id = ?, last_read_chapter_number = ?, updated_at = ? WHERE id = ?',
      [chapter.id, chapter.chapter_number, now, chapter.manga_id]
    );

    const unreadRes = dbGet<{ count: number }>(
      'SELECT COUNT(*) as count FROM chapters WHERE manga_id = ? AND is_read = 0',
      [chapter.manga_id]
    );

    dbRun('UPDATE mangas SET unread_count = ? WHERE id = ?', [unreadRes?.count || 0, chapter.manga_id]);

    res.json({ success: true, unreadCount: unreadRes?.count || 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update reader preferences for manga
apiRouter.put('/mangas/:id/preferences', (req: Request, res: Response) => {
  try {
    const { readingMode, direction, nightFilter, scrollSnap, fitMode, autoMarkRead, lastPage } = req.body;
    dbRun(
      `INSERT INTO reader_preferences (manga_id, reading_mode, direction, night_filter, scroll_snap, fit_mode, auto_mark_read, last_page, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(manga_id) DO UPDATE SET
         reading_mode = excluded.reading_mode,
         direction = excluded.direction,
         night_filter = excluded.night_filter,
         scroll_snap = excluded.scroll_snap,
         fit_mode = excluded.fit_mode,
         auto_mark_read = excluded.auto_mark_read,
         last_page = excluded.last_page,
         updated_at = excluded.updated_at`,
      [
        req.params.id,
        readingMode || 'single',
        direction || 'rtl',
        nightFilter || 'none',
        scrollSnap ? 1 : 0,
        fitMode || 'fit_width',
        autoMarkRead ? 1 : 0,
        lastPage || 1,
        Date.now()
      ]
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== INTEGRATED READER & PROXY ====================

// Get chapter reading pages
apiRouter.get('/reader/chapter/:id', async (req: Request, res: Response) => {
  try {
    const chapter = dbGet('SELECT * FROM chapters WHERE id = ?', [req.params.id]);
    if (!chapter) return res.status(404).json({ error: 'Capítulo não encontrado' });

    const manga = dbGet('SELECT * FROM mangas WHERE id = ?', [chapter.manga_id]);
    const preferences = dbGet('SELECT * FROM reader_preferences WHERE manga_id = ?', [chapter.manga_id]);

    // Use one stable order so repeated numbers and special chapters navigate reliably.
    const orderedChapters = dbAll<{ id: string; chapter_number: number | null; chapter_number_text: string }>(
      'SELECT id, chapter_number, chapter_number_text FROM chapters WHERE manga_id = ? ORDER BY CASE WHEN chapter_number IS NULL THEN 1 ELSE 0 END, chapter_number ASC, url ASC', [chapter.manga_id]);
    const chapterIndex = orderedChapters.findIndex(item => item.id === chapter.id);
    const prevChapter = chapterIndex > 0 ? orderedChapters[chapterIndex - 1] : null;
    const nextChapter = chapterIndex >= 0 && chapterIndex < orderedChapters.length - 1 ? orderedChapters[chapterIndex + 1] : null;

    // Extract pages from source
    const extractor = getSourceForUrl(chapter.url);
    const result = await extractor.extractPages(chapter.url || chapter.id);

    // Update total_pages in database
    if (result.pages.length > 0) {
      dbRun('UPDATE chapters SET total_pages = ? WHERE id = ?', [result.pages.length, chapter.id]);
    }

    res.json({
      chapter,
      manga,
      preferences,
      pages: result.pages,
      nextChapter,
      prevChapter
    });
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao carregar páginas: ${err.message}` });
  }
});

apiRouter.post('/reader/probe', async (req: Request, res: Response) => {
  try {
    let chapterUrl = String(req.body?.url || '');
    let chapterTitle = 'Reader probe';
    let mangaTitle: string | undefined;
    if (req.body?.chapterId) {
      const chapter = dbGet<any>('SELECT * FROM chapters WHERE id = ?', [req.body.chapterId]);
      if (!chapter) return res.status(404).json({ error: 'Chapter not found.' });
      chapterUrl = chapter.url;
      chapterTitle = chapter.chapter_number_text || chapter.title || chapterTitle;
      mangaTitle = dbGet<any>('SELECT title FROM mangas WHERE id = ?', [chapter.manga_id])?.title;
    }
    if (!chapterUrl) return res.status(400).json({ error: 'A chapter URL or chapter ID is required.' });
    const startedAt = Date.now();
    const extractor = getSourceForUrl(chapterUrl);
    const result = await extractor.extractPages(chapterUrl);
    const firstPage = result.pages[0]?.url || null;
    let proxyWorking = false;
    if (firstPage) {
      const image = await safeFetch(firstPage, { blockedDomains: BLOCKED_AD_DOMAINS, timeoutMs: 8000, maxBytes: 3 * 1024 * 1024 });
      proxyWorking = image.status >= 200 && image.status < 300 && (image.headers.get('content-type') || '').toLowerCase().startsWith('image/');
    }
    res.json({
      ok: result.pages.length > 0 && proxyWorking,
      chapterTitle, mangaTitle, chapterUrl, sourceName: extractor.name,
      pagesCount: result.pages.length, latencyMs: Date.now() - startedAt,
      proxyWorking, firstPagePreviewUrl: firstPage, canOpenInNewTab: true,
      message: result.pages.length ? `${result.pages.length} reader pages detected.` : 'The selected source adapter returned no reader pages.'
    });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// Safe Image Proxy: strips referrers, protects against malicious ads/scripts
apiRouter.get('/proxy/image', async (req: Request, res: Response) => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send('Missing url');

    const check = securityService.isUrlAllowed(imageUrl);
    if (!check.allowed) {
      return res.status(403).send('URL blocked by MangaX Ad-Protection: ' + check.reason);
    }

    const response = await safeFetch(imageUrl, {
      blockedDomains: BLOCKED_AD_DOMAINS,
      timeoutMs: 15000,
      maxBytes: 20 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': new URL(imageUrl).origin
      }
    });

    if (response.status < 200 || response.status >= 300) {
      return res.status(response.status).send('Upstream image error');
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.toLowerCase().startsWith('image/')) return res.status(415).send('Upstream response is not an image.');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    res.send(Buffer.from(response.body));
  } catch (err: any) {
    res.status(500).send('Proxy error: ' + err.message);
  }
});

// ==================== MONITORAMENTO & LOGS ====================

apiRouter.get('/monitor/status', (_req: Request, res: Response) => {
  res.json(monitoringService.getStatus());
});

apiRouter.post('/monitor/run', async (_req: Request, res: Response) => {
  const result = await monitoringService.runVerificationCycle();
  res.json(result);
});

apiRouter.get('/monitor/logs', (_req: Request, res: Response) => {
  const logs = dbAll('SELECT * FROM check_logs ORDER BY timestamp DESC LIMIT 60');
  res.json(logs);
});

apiRouter.put('/monitor/config', (req: Request, res: Response) => {
  try {
    const { intervalMinutes, concurrency, notificationsEnabled } = req.body;
    monitoringService.updateConfig(intervalMinutes || 30, concurrency || 3, notificationsEnabled !== false);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== NOTIFICAÇÕES ====================

apiRouter.get('/notifications', (_req: Request, res: Response) => {
  const notifs = dbAll('SELECT * FROM notifications ORDER BY detected_at DESC LIMIT 50');
  res.json(notifs);
});

apiRouter.post('/notifications/:id/read', (req: Request, res: Response) => {
  dbRun('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

apiRouter.delete('/notifications', (_req: Request, res: Response) => {
  dbRun('DELETE FROM notifications');
  res.json({ success: true });
});

// ==================== DIAGNÓSTICO & SEGURANÇA ====================

apiRouter.get('/sources/diagnostic', async (_req: Request, res: Response) => {
  const health = await testSourceHealth();
  const security = securityService.getBlockedStats();
  res.json({ health, security });
});
