import { MangaSource, MangaMetadata, ChapterMetadata, ChapterPagesResult } from './types';

// High-definition sample illustrations for reading testing
export const samplePagesSoloLeveling = [
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1563089145-599997674d42?w=1200&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1200&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1200&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1200&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1200&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1200&auto=format&fit=crop&q=85'
];

export const samplePagesFrieren = [
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1518709414768-a88981a4515d?w=1200&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&auto=format&fit=crop&q=85'
];

export class SampleMangaSource implements MangaSource {
  id = 'sample-local';
  name = 'MangaX Sample & Offline Archive';
  baseUrl = 'https://frank.local';

  canHandle(url: string): boolean {
    return url.includes('sample-') || url.includes('frank.local') || url.includes('solo-leveling-seed') || url.includes('frieren-seed');
  }

  async extractManga(url: string): Promise<MangaMetadata> {
    if (url.includes('frieren')) {
      return {
        title: 'Sousou no Frieren (Frieren: Beyond Journey\'s End)',
        description: 'A maga elfa Frieren e seus corajosos companheiros derrotaram o Rei Demônio e trouxeram paz à terra. Para os elfos imortais, uma década é um piscar de olhos; Frieren embarca em uma nova jornada para compreender a efemeridade humana.',
        coverUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
        type: 'manga',
        status: 'ongoing',
        author: 'Yamada Kanehito',
        artist: 'Abe Tsukasa',
        mainUrl: url,
        genres: ['Aventura', 'Fantasia', 'Drama', 'Slice of Life']
      };
    }

    return {
      title: 'Solo Leveling (Only I Level Up)',
      description: 'Em um mundo onde caçadores despertam com poderes mágicos, Sung Jin-woo é conhecido como o caçador mais fraco da humanidade. Após uma expedição quase fatal, ele acorda em um hospital com uma interface misteriosa que só ele pode ver.',
      coverUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
      type: 'manhwa',
      status: 'completed',
      author: 'Chugong',
      artist: 'DUBU (REDICE Studio)',
      mainUrl: url,
      genres: ['Ação', 'Fantasia', 'Sobrenatural', 'RPG']
    };
  }

  async extractChapters(urlOrExternalId: string): Promise<ChapterMetadata[]> {
    const isFrieren = urlOrExternalId.includes('frieren');
    if (isFrieren) {
      return [
        {
          id: 'fr-ch-01',
          title: 'Capítulo 1: O Fim da Aventura',
          chapterNumber: 1,
          chapterNumberText: 'Capítulo 1',
          url: 'https://frank.local/read/fr-ch-01',
          releaseDate: '2024-02-10',
          pagesCount: samplePagesFrieren.length
        },
        {
          id: 'fr-ch-02',
          title: 'Capítulo 2: A Mentira do Mago',
          chapterNumber: 2,
          chapterNumberText: 'Capítulo 2',
          url: 'https://frank.local/read/fr-ch-02',
          releaseDate: '2024-02-17',
          pagesCount: samplePagesFrieren.length
        },
        {
          id: 'fr-ch-03',
          title: 'Capítulo 3: Flores Lunares Azuis',
          chapterNumber: 3,
          chapterNumberText: 'Capítulo 3',
          url: 'https://frank.local/read/fr-ch-03',
          releaseDate: '2024-02-24',
          pagesCount: samplePagesFrieren.length
        }
      ];
    }

    return [
      {
        id: 'sl-ch-01',
        title: 'Capítulo 1: O Caçador Mais Fraco',
        chapterNumber: 1,
        chapterNumberText: 'Capítulo 1',
        url: 'https://frank.local/read/sl-ch-01',
        releaseDate: '2024-01-10',
        pagesCount: samplePagesSoloLeveling.length
      },
      {
        id: 'sl-ch-02',
        title: 'Capítulo 2: O Covil Duplo',
        chapterNumber: 2,
        chapterNumberText: 'Capítulo 2',
        url: 'https://frank.local/read/sl-ch-02',
        releaseDate: '2024-01-17',
        pagesCount: samplePagesSoloLeveling.length
      },
      {
        id: 'sl-ch-03',
        title: 'Capítulo 3: Os Mandamentos da Estátua',
        chapterNumber: 3,
        chapterNumberText: 'Capítulo 3',
        url: 'https://frank.local/read/sl-ch-03',
        releaseDate: '2024-01-24',
        pagesCount: samplePagesSoloLeveling.length
      },
      {
        id: 'sl-ch-04',
        title: 'Capítulo 4: Despertar Secreto',
        chapterNumber: 4,
        chapterNumberText: 'Capítulo 4',
        url: 'https://frank.local/read/sl-ch-04',
        releaseDate: '2024-01-31',
        pagesCount: samplePagesSoloLeveling.length
      }
    ];
  }

  async extractPages(chapterUrlOrId: string): Promise<ChapterPagesResult> {
    const isFrieren = chapterUrlOrId.includes('fr-');
    const pageList = isFrieren ? samplePagesFrieren : samplePagesSoloLeveling;

    return {
      chapterId: chapterUrlOrId,
      title: isFrieren ? 'Sousou no Frieren' : 'Solo Leveling',
      pages: pageList.map((url, index) => ({
        index: index + 1,
        url,
        width: 1200,
        height: 1800
      }))
    };
  }

  async search(query: string): Promise<MangaMetadata[]> {
    const mangas = [
      await this.extractManga('https://frank.local/solo-leveling'),
      await this.extractManga('https://frank.local/frieren')
    ];
    return mangas.filter(m => m.title.toLowerCase().includes(query.toLowerCase()));
  }
}
