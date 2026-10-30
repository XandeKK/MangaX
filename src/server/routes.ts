import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from './db/database';
import { getSourceForUrl, testSourceHealth } from './sources';
import { monitoringService } from './services/monitoring';
import { securityService } from './services/security';

export const apiRouter = Router();

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
      sql += ' AND (title LIKE ? OR description LIKE ? OR author LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
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

    const mangas = dbAll(sql, params);
    res.json(mangas);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single manga with sources, chapters, and reader preferences
apiRouter.get('/mangas/:id', (req: Request, res: Response) => {
  try {
    const manga = dbGet('SELECT * FROM mangas WHERE id = ?', [req.params.id]);
    if (!manga) {
      return res.status(404).json({ error: 'Obra não encontrada' });
    }

    const sources = dbAll('SELECT * FROM sources WHERE manga_id = ? ORDER BY created_at ASC', [manga.id]);
    const chapters = dbAll('SELECT * FROM chapters WHERE manga_id = ? ORDER BY chapter_number DESC', [manga.id]);
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

// Preview metadata by URL without saving
apiRouter.post('/sources/preview', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL é obrigatória' });
    }

    const extractor = getSourceForUrl(url);
    const metadata = await extractor.extractManga(url);
    res.json({ metadata, sourceName: extractor.name });
  } catch (err: any) {
    res.status(400).json({ error: `Falha na extração de metadados: ${err.message}` });
  }
});

// Register new manga (by URL or manual)
apiRouter.post('/mangas', async (req: Request, res: Response) => {
  try {
    const { url, title, description, coverUrl, type, status, author, artist } = req.body;
    const now = Date.now();

    let mangaTitle = title;
    let mangaDesc = description || '';
    let mangaCover = coverUrl || '';
    let mangaType = type || 'manga';
    let mangaStatus = status || 'ongoing';
    let mangaAuthor = author || '';
    let mangaArtist = artist || '';
    const mainUrl = url || `custom://${now}`;

    let chapters: any[] = [];
    let sourceName = 'Manual';

    // If URL is provided, try automatic extraction
    if (url && url.startsWith('http')) {
      const extractor = getSourceForUrl(url);
      sourceName = extractor.name;

      try {
        const extracted = await extractor.extractManga(url);
        mangaTitle = mangaTitle || extracted.title;
        mangaDesc = mangaDesc || extracted.description;
        mangaCover = mangaCover || extracted.coverUrl;
        mangaType = mangaType || extracted.type;
        mangaStatus = mangaStatus || extracted.status;
        mangaAuthor = mangaAuthor || extracted.author || '';
        mangaArtist = mangaArtist || extracted.artist || '';
      } catch (e: any) {
        console.warn('Auto-extraction fallback for manga metadata:', e.message);
      }

      try {
        chapters = await extractor.extractChapters(url);
      } catch (e: any) {
        console.warn('Auto-extraction fallback for chapters:', e.message);
      }
    }

    if (!mangaTitle) {
      return res.status(400).json({ error: 'Título é obrigatório.' });
    }

    if (!mangaCover) {
      mangaCover = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';
    }

    const mangaId = `manga-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const sourceId = `src-${mangaId}`;

    let maxChapterNumber = 0;
    for (const c of chapters) {
      if (c.chapterNumber > maxChapterNumber) maxChapterNumber = c.chapterNumber;
    }

    // Insert manga
    dbRun(
      `INSERT INTO mangas (id, title, description, cover_url, type, status, main_url, author, artist, last_known_chapter_number, unread_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [mangaId, mangaTitle, mangaDesc, mangaCover, mangaType, mangaStatus, mainUrl, mangaAuthor, mangaArtist, maxChapterNumber, chapters.length, now, now]
    );

    // Insert primary source
    dbRun(
      `INSERT INTO sources (id, manga_id, source_type, name, url, is_active, check_interval_minutes, last_checked_at, last_status, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 30, ?, 'ok', ?)`,
      [sourceId, mangaId, url ? (url.includes('mangadex') ? 'mangadex' : 'generic') : 'custom', sourceName, mainUrl, now, now]
    );

    // Insert reader preferences
    dbRun(
      `INSERT INTO reader_preferences (manga_id, reading_mode, direction, night_filter, scroll_snap, fit_mode, auto_mark_read, last_page, updated_at)
       VALUES (?, ?, ?, 'none', 0, 'fit_width', 1, 1, ?)`,
      [mangaId, mangaType === 'webtoon' ? 'webtoon' : 'single', mangaType === 'webtoon' ? 'vertical' : 'rtl', now]
    );

    // Insert extracted chapters
    for (const c of chapters) {
      const chId = `ch-${mangaId}-${c.chapterNumber}-${Math.random().toString(36).substring(2, 6)}`;
      dbRun(
        `INSERT INTO chapters (id, manga_id, source_id, title, chapter_number, chapter_number_text, volume, url, release_date, detected_at, is_read)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [chId, mangaId, sourceId, c.title || c.chapterNumberText, c.chapterNumber, c.chapterNumberText, c.volume || null, c.url, c.releaseDate || new Date().toISOString().split('T')[0], now]
      );
    }

    res.status(201).json({
      id: mangaId,
      title: mangaTitle,
      chaptersCount: chapters.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update manga
apiRouter.put('/mangas/:id', (req: Request, res: Response) => {
  try {
    const { title, description, coverUrl, type, status, author, artist } = req.body;
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

    dbRun(
      `UPDATE mangas SET title = ?, description = ?, cover_url = ?, type = ?, status = ?, author = ?, artist = ?, updated_at = ? WHERE id = ?`,
      [updatedTitle, updatedDesc, updatedCover, updatedType, updatedStatus, updatedAuthor, updatedArtist, Date.now(), req.params.id]
    );
    res.json({ success: true });
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
    const { name, url, checkInterval } = req.body;
    if (!url) return res.status(400).json({ error: 'URL da fonte é obrigatória.' });

    const sourceId = `src-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const extractor = getSourceForUrl(url);

    dbRun(
      `INSERT INTO sources (id, manga_id, source_type, name, url, is_active, check_interval_minutes, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [sourceId, req.params.id, extractor.id, name || extractor.name, url, checkInterval || 30, Date.now()]
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
    dbRun(
      'UPDATE chapters SET is_read = 1, read_at = ? WHERE manga_id = ? AND chapter_number <= ?',
      [now, chapter.manga_id, chapter.chapter_number]
    );

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

    // Find next and previous chapters
    const nextChapter = dbGet(
      'SELECT id, chapter_number, chapter_number_text FROM chapters WHERE manga_id = ? AND chapter_number > ? ORDER BY chapter_number ASC LIMIT 1',
      [chapter.manga_id, chapter.chapter_number]
    );

    const prevChapter = dbGet(
      'SELECT id, chapter_number, chapter_number_text FROM chapters WHERE manga_id = ? AND chapter_number < ? ORDER BY chapter_number DESC LIMIT 1',
      [chapter.manga_id, chapter.chapter_number]
    );

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

// Safe Image Proxy: strips referrers, protects against malicious ads/scripts
apiRouter.get('/proxy/image', async (req: Request, res: Response) => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send('Missing url');

    const check = securityService.isUrlAllowed(imageUrl);
    if (!check.allowed) {
      return res.status(403).send('URL blocked by MangaX Ad-Protection: ' + check.reason);
    }

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': new URL(imageUrl).origin
      }
    });

    if (!response.ok) {
      return res.status(response.status).send('Upstream image error');
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
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
