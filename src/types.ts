export type MangaType = 'manga' | 'manhwa' | 'manhua' | 'webtoon';
export type MangaStatus = 'ongoing' | 'completed' | 'hiatus';
export type ReadingMode = 'single' | 'double' | 'book' | 'webtoon';
export type ReadingDirection = 'rtl' | 'ltr' | 'vertical';
export type NightFilter = 'none' | 'night' | 'sepia';

export interface Manga {
  id: string;
  title: string;
  description: string;
  cover_url: string;
  type: MangaType;
  status: MangaStatus;
  main_url: string;
  author?: string;
  artist?: string;
  last_read_chapter_id?: string | null;
  last_read_chapter_number?: number | null;
  last_known_chapter_number?: number | null;
  unread_count: number;
  created_at: number;
  updated_at: number;
}

export interface Source {
  id: string;
  manga_id: string;
  source_type: string;
  name: string;
  url: string;
  is_active: number;
  check_interval_minutes: number;
  last_checked_at?: number | null;
  last_status: string;
  error_message?: string | null;
  created_at: number;
}

export interface Chapter {
  id: string;
  manga_id: string;
  source_id: string;
  title: string;
  chapter_number: number;
  chapter_number_text: string;
  volume?: string;
  url: string;
  release_date?: string;
  detected_at: number;
  is_read: number;
  read_at?: number | null;
  last_page_read: number;
  total_pages: number;
}

export interface ReaderPreferences {
  manga_id: string;
  reading_mode: ReadingMode;
  direction: ReadingDirection;
  night_filter: NightFilter;
  scroll_snap: number;
  fit_mode: 'fit_width' | 'fit_height' | 'original';
  auto_mark_read: number;
  last_page: number;
}

export interface NotificationItem {
  id: string;
  manga_id: string;
  chapter_id: string;
  title: string;
  chapter_number_text: string;
  source_name: string;
  detected_at: number;
  is_read: number;
}

export interface CheckLog {
  id: string;
  manga_id?: string;
  source_id?: string;
  timestamp: number;
  status: 'success' | 'new_chapters' | 'error' | 'skipped';
  chapters_found: number;
  new_chapters_count: number;
  message: string;
  duration_ms: number;
}

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
