import { Manga, Source, Chapter, ReaderPreferences, NotificationItem, CheckLog, MonitoringStatus } from '../types';

export const api = {
  // Manga endpoints
  async getMangas(params?: { type?: string; status?: string; search?: string; sort?: string }): Promise<Manga[]> {
    const query = new URLSearchParams();
    if (params?.type && params.type !== 'all') query.set('type', params.type);
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.sort) query.set('sort', params.sort);

    const res = await fetch(`/api/mangas?${query.toString()}`);
    if (!res.ok) throw new Error('Falha ao listar obras');
    return res.json();
  },

  async getManga(id: string): Promise<{ manga: Manga; sources: Source[]; chapters: Chapter[]; preferences: ReaderPreferences }> {
    const res = await fetch(`/api/mangas/${id}`);
    if (!res.ok) throw new Error('Falha ao obter detalhes da obra');
    return res.json();
  },

  async createManga(data: {
    url?: string;
    title?: string;
    description?: string;
    coverUrl?: string;
    type?: string;
    status?: string;
    author?: string;
    artist?: string;
  }): Promise<{ id: string; title: string; chaptersCount: number }> {
    const res = await fetch('/api/mangas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao cadastrar obra');
    }
    return res.json();
  },

  async updateManga(id: string, data: Partial<Manga> & { coverUrl?: string }): Promise<void> {
    const res = await fetch(`/api/mangas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        description: data.description,
        coverUrl: data.coverUrl !== undefined ? data.coverUrl : data.cover_url,
        type: data.type,
        status: data.status,
        author: data.author,
        artist: data.artist
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao atualizar obra');
    }
  },

  async deleteManga(id: string): Promise<void> {
    const res = await fetch(`/api/mangas/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erro ao excluir obra');
  },

  async refreshManga(id: string): Promise<any> {
    const res = await fetch(`/api/mangas/${id}/refresh`, { method: 'POST' });
    if (!res.ok) throw new Error('Erro ao atualizar capítulos da obra');
    return res.json();
  },

  // Sources endpoints
  async addSource(mangaId: string, data: { name?: string; url: string; checkInterval?: number }): Promise<void> {
    const res = await fetch(`/api/mangas/${mangaId}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erro ao adicionar fonte');
  },

  async deleteSource(sourceId: string): Promise<void> {
    const res = await fetch(`/api/sources/${sourceId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erro ao remover fonte');
  },

  async previewUrl(url: string): Promise<{ metadata: any; sourceName: string }> {
    const res = await fetch('/api/sources/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao extrair prévia da URL');
    }
    return res.json();
  },

  // Reading progress
  async setChapterRead(chapterId: string, isRead?: boolean, lastPageRead?: number): Promise<{ isRead: boolean; unreadCount: number }> {
    const res = await fetch(`/api/chapters/${chapterId}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead, lastPageRead })
    });
    if (!res.ok) throw new Error('Erro ao alterar status do capítulo');
    return res.json();
  },

  async markPreviousAsRead(chapterId: string): Promise<{ success: boolean; unreadCount: number }> {
    const res = await fetch(`/api/chapters/${chapterId}/read-previous`, { method: 'POST' });
    if (!res.ok) throw new Error('Erro ao marcar capítulos anteriores');
    return res.json();
  },

  async updatePreferences(mangaId: string, preferences: Partial<ReaderPreferences>): Promise<void> {
    const res = await fetch(`/api/mangas/${mangaId}/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        readingMode: preferences.reading_mode,
        direction: preferences.direction,
        nightFilter: preferences.night_filter,
        scrollSnap: preferences.scroll_snap,
        fitMode: preferences.fit_mode,
        autoMarkRead: preferences.auto_mark_read,
        lastPage: preferences.last_page
      })
    });
    if (!res.ok) throw new Error('Erro ao salvar preferências do reader');
  },

  // Reader pages
  async getChapterPages(chapterId: string): Promise<{
    chapter: Chapter;
    manga: Manga;
    preferences: ReaderPreferences;
    pages: { index: number; url: string; width?: number; height?: number }[];
    nextChapter: { id: string; chapter_number: number; chapter_number_text: string } | null;
    prevChapter: { id: string; chapter_number: number; chapter_number_text: string } | null;
  }> {
    const res = await fetch(`/api/reader/chapter/${chapterId}`);
    if (!res.ok) throw new Error('Falha ao carregar páginas do capítulo');
    return res.json();
  },

  async probeReader(data: { chapterId?: string; url?: string }): Promise<{
    ok: boolean;
    chapterTitle: string;
    mangaTitle?: string;
    chapterUrl: string;
    sourceName: string;
    pagesCount: number;
    latencyMs: number;
    proxyWorking: boolean;
    firstPagePreviewUrl: string | null;
    canOpenInNewTab: boolean;
    message: string;
  }> {
    const res = await fetch('/api/reader/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao testar leitor');
    return res.json();
  },

  // Monitoring
  async getMonitorStatus(): Promise<MonitoringStatus> {
    const res = await fetch('/api/monitor/status');
    if (!res.ok) throw new Error('Erro ao consultar status do monitor');
    return res.json();
  },

  async runMonitor(): Promise<any> {
    const res = await fetch('/api/monitor/run', { method: 'POST' });
    if (!res.ok) throw new Error('Erro ao disparar verificação');
    return res.json();
  },

  async getMonitorLogs(): Promise<CheckLog[]> {
    const res = await fetch('/api/monitor/logs');
    if (!res.ok) throw new Error('Erro ao obter logs');
    return res.json();
  },

  async updateMonitorConfig(data: { intervalMinutes: number; concurrency: number; notificationsEnabled: boolean }): Promise<void> {
    const res = await fetch('/api/monitor/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erro ao atualizar configurações do monitor');
  },

  // Notifications
  async getNotifications(): Promise<NotificationItem[]> {
    const res = await fetch('/api/notifications');
    if (!res.ok) return [];
    return res.json();
  },

  async markNotificationRead(id: string): Promise<void> {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
  },

  async clearNotifications(): Promise<void> {
    await fetch('/api/notifications', { method: 'DELETE' });
  },

  // Diagnostic
  async getDiagnostics(): Promise<{
    health: { id: string; name: string; status: 'ok' | 'degraded' | 'offline'; latencyMs: number }[];
    security: { totalBlocked: number; recentLogs: { timestamp: number; url: string; reason: string }[] };
  }> {
    const res = await fetch('/api/sources/diagnostic');
    if (!res.ok) throw new Error('Erro ao obter diagnóstico');
    return res.json();
  }
};
