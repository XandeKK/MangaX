import { getDatabase, dbAll, dbRun, dbGet, saveDatabase } from '../db/database';
import { getSourceForUrl } from '../sources';
import { ChapterMetadata } from '../sources/types';

export interface MonitoringStatus {
  isRunning: boolean;
  isChecking: boolean;
  lastRunTimestamp: number | null;
  nextRunTimestamp: number | null;
  totalTrackedMangas: number;
  totalSources: number;
  checkIntervalMinutes: number;
  concurrencyLimit: number;
  lastCheckSummary: string;
}

export class MonitoringService {
  private timer: NodeJS.Timeout | null = null;
  private isChecking = false;
  private lastRunTime: number | null = null;

  async start(): Promise<void> {
    if (this.timer) clearInterval(this.timer);

    const config = this.getConfig();
    const intervalMs = Math.max(1, config.checkIntervalMinutes) * 60 * 1000;

    // Run first check after 10 seconds of server startup
    setTimeout(() => {
      this.runVerificationCycle().catch(err => console.error('Error in initial monitor cycle:', err));
    }, 10000);

    // Setup periodic interval
    this.timer = setInterval(() => {
      this.runVerificationCycle().catch(err => console.error('Error in scheduled monitor cycle:', err));
    }, intervalMs);

    console.log(`[Monitoring] Service started. Interval: ${config.checkIntervalMinutes} min.`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getConfig() {
    try {
      const intervalRow = dbGet<{ value: string }>('SELECT value FROM monitor_config WHERE key = ?', ['check_interval_minutes']);
      const concurrencyRow = dbGet<{ value: string }>('SELECT value FROM monitor_config WHERE key = ?', ['concurrency_limit']);
      const notifRow = dbGet<{ value: string }>('SELECT value FROM monitor_config WHERE key = ?', ['notifications_enabled']);

      return {
        checkIntervalMinutes: intervalRow ? parseInt(intervalRow.value, 10) : 30,
        concurrencyLimit: concurrencyRow ? parseInt(concurrencyRow.value, 10) : 3,
        notificationsEnabled: notifRow ? notifRow.value === '1' : true
      };
    } catch {
      return {
        checkIntervalMinutes: 30,
        concurrencyLimit: 3,
        notificationsEnabled: true
      };
    }
  }

  updateConfig(intervalMinutes: number, concurrency: number, notificationsEnabled: boolean) {
    dbRun('INSERT OR REPLACE INTO monitor_config (key, value) VALUES (?, ?)', ['check_interval_minutes', intervalMinutes.toString()]);
    dbRun('INSERT OR REPLACE INTO monitor_config (key, value) VALUES (?, ?)', ['concurrency_limit', concurrency.toString()]);
    dbRun('INSERT OR REPLACE INTO monitor_config (key, value) VALUES (?, ?)', ['notifications_enabled', notificationsEnabled ? '1' : '0']);
    this.start();
  }

  getStatus(): MonitoringStatus {
    const config = this.getConfig();
    const mangasCount = dbGet<{ count: number }>('SELECT COUNT(*) as count FROM mangas');
    const sourcesCount = dbGet<{ count: number }>('SELECT COUNT(*) as count FROM sources WHERE is_active = 1');
    const lastLog = dbGet<{ message: string; timestamp: number }>('SELECT message, timestamp FROM check_logs ORDER BY timestamp DESC LIMIT 1');

    const nextRun = this.lastRunTime 
      ? this.lastRunTime + config.checkIntervalMinutes * 60 * 1000 
      : Date.now() + 10000;

    return {
      isRunning: this.timer !== null,
      isChecking: this.isChecking,
      lastRunTimestamp: this.lastRunTime,
      nextRunTimestamp: nextRun,
      totalTrackedMangas: mangasCount?.count || 0,
      totalSources: sourcesCount?.count || 0,
      checkIntervalMinutes: config.checkIntervalMinutes,
      concurrencyLimit: config.concurrencyLimit,
      lastCheckSummary: lastLog?.message || 'Nenhuma verificação executada ainda.'
    };
  }

  async runVerificationCycle(targetMangaId?: string): Promise<{ checkedCount: number; newChaptersCount: number; errors: string[] }> {
    if (this.isChecking) {
      return { checkedCount: 0, newChaptersCount: 0, errors: ['Uma verificação já está em andamento.'] };
    }

    this.isChecking = true;
    this.lastRunTime = Date.now();
    const errors: string[] = [];
    let totalNewChapters = 0;
    let checkedCount = 0;

    try {
      await getDatabase();
      const sourcesQuery = targetMangaId
        ? 'SELECT s.*, m.title as manga_title, m.last_known_chapter_number FROM sources s JOIN mangas m ON s.manga_id = m.id WHERE s.is_active = 1 AND s.manga_id = ?'
        : 'SELECT s.*, m.title as manga_title, m.last_known_chapter_number FROM sources s JOIN mangas m ON s.manga_id = m.id WHERE s.is_active = 1';

      const sources = dbAll<any>(sourcesQuery, targetMangaId ? [targetMangaId] : []);
      const config = this.getConfig();

      // Chunk execution according to concurrency limit
      const chunkSize = Math.max(1, config.concurrencyLimit);
      for (let i = 0; i < sources.length; i += chunkSize) {
        const chunk = sources.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (source) => {
            const start = Date.now();
            try {
              const res = await this.checkSingleSource(source, config.notificationsEnabled);
              checkedCount++;
              totalNewChapters += res.newCount;

              dbRun(
                `INSERT INTO check_logs (id, manga_id, source_id, timestamp, status, chapters_found, new_chapters_count, message, duration_ms)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                  source.manga_id,
                  source.id,
                  Date.now(),
                  res.newCount > 0 ? 'new_chapters' : 'success',
                  res.totalFound,
                  res.newCount,
                  res.newCount > 0 
                    ? `Detectado(s) ${res.newCount} novo(s) capítulo(s) para "${source.manga_title}".`
                    : `Verificação OK para "${source.manga_title}" (${res.totalFound} capítulos catalogados).`,
                  Date.now() - start
                ]
              );

              dbRun('UPDATE sources SET last_checked_at = ?, last_status = ?, error_message = NULL WHERE id = ?', [Date.now(), 'ok', source.id]);
            } catch (err: any) {
              const msg = err.message || 'Erro desconhecido ao consultar fonte';
              errors.push(`${source.manga_title}: ${msg}`);

              dbRun(
                `INSERT INTO check_logs (id, manga_id, source_id, timestamp, status, chapters_found, new_chapters_count, message, duration_ms)
                 VALUES (?, ?, ?, ?, 'error', 0, 0, ?, ?)`,
                [`log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, source.manga_id, source.id, Date.now(), `Falha: ${msg}`, Date.now() - start]
              );

              dbRun('UPDATE sources SET last_checked_at = ?, last_status = ?, error_message = ? WHERE id = ?', [Date.now(), 'error', msg, source.id]);
            }
          })
        );
      }
    } finally {
      this.isChecking = false;
      saveDatabase();
    }

    return { checkedCount, newChaptersCount: totalNewChapters, errors };
  }

  private async checkSingleSource(source: any, notificationsEnabled: boolean): Promise<{ newCount: number; totalFound: number }> {
    const extractor = getSourceForUrl(source.url);
    const chapters: ChapterMetadata[] = await extractor.extractChapters(source.url);

    if (!chapters || chapters.length === 0) {
      return { newCount: 0, totalFound: 0 };
    }

    // Get currently known chapters from database for this manga
    const existingChapters = dbAll<{ id: string; chapter_number: number; chapter_number_text: string }>(
      'SELECT id, chapter_number, chapter_number_text FROM chapters WHERE manga_id = ?',
      [source.manga_id]
    );

    const existingNumSet = new Set<number>();
    for (const ec of existingChapters) {
      existingNumSet.add(ec.chapter_number);
    }

    let newCount = 0;
    let maxFoundNumber = source.last_known_chapter_number || 0;

    for (const chapter of chapters) {
      if (chapter.chapterNumber > maxFoundNumber) {
        maxFoundNumber = chapter.chapterNumber;
      }

      // Check if this chapter is already stored
      if (!existingNumSet.has(chapter.chapterNumber)) {
        newCount++;
        const chapterId = `ch-${source.manga_id}-${chapter.chapterNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        dbRun(
          `INSERT INTO chapters (id, manga_id, source_id, title, chapter_number, chapter_number_text, volume, url, release_date, detected_at, is_read)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            chapterId,
            source.manga_id,
            source.id,
            chapter.title || chapter.chapterNumberText,
            chapter.chapterNumber,
            chapter.chapterNumberText,
            chapter.volume || null,
            chapter.url,
            chapter.releaseDate || new Date().toISOString().split('T')[0],
            Date.now()
          ]
        );

        // Create notification
        if (notificationsEnabled) {
          dbRun(
            `INSERT INTO notifications (id, manga_id, chapter_id, title, chapter_number_text, source_name, detected_at, is_read)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
            [
              `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              source.manga_id,
              chapterId,
              source.manga_title,
              chapter.chapterNumberText,
              source.name,
              Date.now()
            ]
          );
        }
      }
    }

    // Update manga metadata with latest chapter number and unread count
    const unreadRes = dbGet<{ count: number }>(
      'SELECT COUNT(*) as count FROM chapters WHERE manga_id = ? AND is_read = 0',
      [source.manga_id]
    );

    dbRun(
      'UPDATE mangas SET last_known_chapter_number = ?, unread_count = ?, updated_at = ? WHERE id = ?',
      [maxFoundNumber, unreadRes?.count || 0, Date.now(), source.manga_id]
    );

    return { newCount, totalFound: chapters.length };
  }
}

export const monitoringService = new MonitoringService();
