export type MangaType = 'manga' | 'manhwa' | 'manhua' | 'webtoon';
export type MangaStatus = 'ongoing' | 'completed' | 'hiatus';

export interface MangaMetadata {
  id?: string;
  title: string;
  altTitles?: string[];
  description: string;
  coverUrl: string;
  type: MangaType;
  status: MangaStatus;
  author?: string;
  artist?: string;
  mainUrl: string;
  externalId?: string;
  genres?: string[];
}

export interface ChapterMetadata {
  id: string;
  mangaId?: string;
  sourceId?: string;
  title: string;
  chapterNumber: number;
  chapterNumberText: string;
  volume?: string;
  url: string;
  releaseDate?: string;
  language?: string;
  pagesCount?: number;
}

export interface ChapterPagesResult {
  chapterId: string;
  pages: {
    index: number;
    url: string;
    width?: number;
    height?: number;
  }[];
  title?: string;
  chapterNumberText?: string;
  nextChapterId?: string | null;
  prevChapterId?: string | null;
}

export interface MangaSource {
  id: string;
  name: string;
  baseUrl: string;
  canHandle(url: string): boolean;
  extractManga(url: string): Promise<MangaMetadata>;
  extractChapters(urlOrExternalId: string): Promise<ChapterMetadata[]>;
  extractPages(chapterUrlOrId: string): Promise<ChapterPagesResult>;
  search?(query: string): Promise<MangaMetadata[]>;
}
