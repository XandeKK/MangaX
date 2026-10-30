import { MangaSource, MangaMetadata, ChapterMetadata, ChapterPagesResult, MangaType } from './types';

export class MangaDexSource implements MangaSource {
  id = 'mangadex';
  name = 'MangaDex (API Oficial)';
  baseUrl = 'https://mangadex.org';
  private apiBase = 'https://api.mangadex.org';

  canHandle(url: string): boolean {
    return url.includes('mangadex.org') || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url.trim());
  }

  private extractIdFromUrl(url: string): string {
    const trimmed = url.trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      return trimmed;
    }
    const match = url.match(/(?:title|chapter)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (match) return match[1];
    throw new Error('URL inválida do MangaDex. Não foi possível identificar o UUID da obra.');
  }

  async extractManga(url: string): Promise<MangaMetadata> {
    const mangaId = this.extractIdFromUrl(url);
    const res = await fetch(`${this.apiBase}/manga/${mangaId}?includes[]=cover_art&includes[]=author&includes[]=artist`);
    if (!res.ok) {
      throw new Error(`Falha ao consultar MangaDex API (${res.status}): ${res.statusText}`);
    }

    const data = await res.json();
    const attributes = data.data.attributes;
    const relationships = data.data.relationships || [];

    // Title preference: pt-br -> en -> ja-ro -> first
    const titleObj = attributes.title || {};
    const title = titleObj['pt-br'] || titleObj['en'] || titleObj['ja-ro'] || Object.values(titleObj)[0] || 'Sem Título';

    // Description preference: pt-br -> en -> first
    const descObj = attributes.description || {};
    const description = descObj['pt-br'] || descObj['en'] || Object.values(descObj)[0] || '';

    // Cover Art
    let coverFileName = '';
    const coverRel = relationships.find((r: any) => r.type === 'cover_art');
    if (coverRel && coverRel.attributes && coverRel.attributes.fileName) {
      coverFileName = coverRel.attributes.fileName;
    }
    const coverUrl = coverFileName 
      ? `https://uploads.mangadex.org/covers/${mangaId}/${coverFileName}.512.jpg`
      : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

    // Author & Artist
    const authorRel = relationships.find((r: any) => r.type === 'author');
    const artistRel = relationships.find((r: any) => r.type === 'artist');
    const author = authorRel?.attributes?.name || undefined;
    const artist = artistRel?.attributes?.name || undefined;

    // Type detection
    let type: MangaType = 'manga';
    const originalLanguage = attributes.originalLanguage;
    if (originalLanguage === 'ko') type = 'manhwa';
    else if (originalLanguage === 'zh' || originalLanguage === 'zh-hk') type = 'manhua';
    
    // Check tags for webtoon
    const tags = attributes.tags?.map((t: any) => t.attributes?.name?.en) || [];
    if (tags.includes('Long Strip') || tags.includes('Web Comic')) {
      type = originalLanguage === 'ko' ? 'manhwa' : 'webtoon';
    }

    return {
      title,
      description,
      coverUrl,
      type,
      status: attributes.status === 'completed' ? 'completed' : attributes.status === 'hiatus' ? 'hiatus' : 'ongoing',
      author,
      artist,
      mainUrl: `https://mangadex.org/title/${mangaId}`,
      externalId: mangaId,
      genres: tags.slice(0, 5)
    };
  }

  async extractChapters(urlOrExternalId: string): Promise<ChapterMetadata[]> {
    const mangaId = this.extractIdFromUrl(urlOrExternalId);
    
    // We fetch chapters prioritizing Portuguese (pt-br), then English
    const res = await fetch(
      `${this.apiBase}/manga/${mangaId}/feed?translatedLanguage[]=pt-br&translatedLanguage[]=en&limit=100&order[chapter]=desc&order[volume]=desc&includes[]=scanlation_group`
    );

    if (!res.ok) {
      throw new Error(`Erro ao obter capítulos do MangaDex: ${res.status}`);
    }

    const data = await res.json();
    const items = data.data || [];

    const chaptersMap = new Map<string, ChapterMetadata>();

    for (const item of items) {
      const attr = item.attributes;
      const chNum = attr.chapter ? parseFloat(attr.chapter) : 0;
      const chText = attr.chapter ? `Capítulo ${attr.chapter}` : (attr.title || 'Capítulo Extra');
      const key = `${attr.chapter || 'extra'}-${attr.translatedLanguage}`;

      if (!chaptersMap.has(key)) {
        chaptersMap.set(key, {
          id: item.id,
          title: attr.title ? `${chText}: ${attr.title}` : chText,
          chapterNumber: isNaN(chNum) ? 0 : chNum,
          chapterNumberText: chText,
          volume: attr.volume || undefined,
          url: `https://mangadex.org/chapter/${item.id}`,
          releaseDate: attr.publishAt ? attr.publishAt.split('T')[0] : undefined,
          language: attr.translatedLanguage,
          pagesCount: attr.pages || 0
        });
      }
    }

    // Sort chapters descending by chapter number
    return Array.from(chaptersMap.values()).sort((a, b) => b.chapterNumber - a.chapterNumber);
  }

  async extractPages(chapterUrlOrId: string): Promise<ChapterPagesResult> {
    const chapterId = this.extractIdFromUrl(chapterUrlOrId);
    
    const res = await fetch(`${this.apiBase}/at-home/server/${chapterId}`);
    if (!res.ok) {
      throw new Error(`Falha ao obter páginas do servidor MangaDex@Home (${res.status})`);
    }

    const json = await res.json();
    const baseUrl = json.baseUrl;
    const hash = json.chapter.hash;
    const files: string[] = json.chapter.data || [];

    const pages = files.map((fileName, index) => ({
      index: index + 1,
      url: `${baseUrl}/data/${hash}/${fileName}`
    }));

    return {
      chapterId,
      pages
    };
  }

  async search(query: string): Promise<MangaMetadata[]> {
    if (!query.trim()) return [];
    const res = await fetch(`${this.apiBase}/manga?title=${encodeURIComponent(query)}&limit=8&includes[]=cover_art`);
    if (!res.ok) return [];

    const data = await res.json();
    const results: MangaMetadata[] = [];

    for (const item of data.data || []) {
      const attr = item.attributes;
      const rels = item.relationships || [];
      const titleObj = attr.title || {};
      const title = titleObj['pt-br'] || titleObj['en'] || Object.values(titleObj)[0] || 'Sem Título';

      let coverFileName = '';
      const coverRel = rels.find((r: any) => r.type === 'cover_art');
      if (coverRel?.attributes?.fileName) {
        coverFileName = coverRel.attributes.fileName;
      }
      const coverUrl = coverFileName
        ? `https://uploads.mangadex.org/covers/${item.id}/${coverFileName}.256.jpg`
        : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

      results.push({
        title,
        description: attr.description?.['en'] || '',
        coverUrl,
        type: attr.originalLanguage === 'ko' ? 'manhwa' : 'manga',
        status: attr.status === 'completed' ? 'completed' : 'ongoing',
        mainUrl: `https://mangadex.org/title/${item.id}`,
        externalId: item.id
      });
    }

    return results;
  }
}
