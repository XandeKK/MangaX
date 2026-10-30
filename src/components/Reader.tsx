import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  X, ChevronLeft, ChevronRight, BookOpen, Moon, Sun, Shield, 
  HelpCircle, Settings, Maximize2, Minimize2, Check, ArrowLeft, Loader2, Sparkles, ExternalLink, RefreshCw 
} from 'lucide-react';
import { api } from '../services/api';
import { Chapter, Manga, ReaderPreferences, ReadingMode, NightFilter } from '../types';
import { ShortcutsModal } from './ShortcutsModal';

interface ReaderProps {
  chapterId: string;
  onClose: () => void;
  onChapterChange: (nextChapterId: string) => void;
  onChapterFinished?: () => void;
}

export const Reader: React.FC<ReaderProps> = ({
  chapterId,
  onClose,
  onChapterChange,
  onChapterFinished
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [manga, setManga] = useState<Manga | null>(null);
  const [pages, setPages] = useState<{ index: number; url: string }[]>([]);
  const [nextChapter, setNextChapter] = useState<{ id: string; chapter_number: number; chapter_number_text: string } | null>(null);
  const [prevChapter, setPrevChapter] = useState<{ id: string; chapter_number: number; chapter_number_text: string } | null>(null);

  // Active Reader state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [readingMode, setReadingMode] = useState<ReadingMode>('single');
  const [nightFilter, setNightFilter] = useState<NightFilter>('none');
  const [scrollSnap, setScrollSnap] = useState(false);
  const [fitMode, setFitMode] = useState<'fit_width' | 'fit_height' | 'original'>('fit_height');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [isMarkedAsRead, setIsMarkedAsRead] = useState(false);

  // Webtoon scroll container ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Load chapter data & pages
  const loadChapter = async (cId: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getChapterPages(cId);
      setChapter(res.chapter);
      setManga(res.manga);
      setPages(res.pages);
      setNextChapter(res.nextChapter);
      setPrevChapter(res.prevChapter);

      // Default mode: manhwa, manhua and webtoon default to webtoon (scroll); manga defaults to single
      const isScroll = ['manhwa', 'manhua', 'webtoon'].includes(res.manga.type);
      setReadingMode(isScroll ? 'webtoon' : (res.preferences?.reading_mode || 'single'));
      setNightFilter((res.preferences?.night_filter as any) === 'invert' ? 'night' : (res.preferences?.night_filter || 'none'));
      setScrollSnap(Boolean(res.preferences?.scroll_snap));
      setFitMode(res.preferences?.fit_mode || 'fit_height');

      // Restore last page position
      const initialPage = res.chapter.last_page_read && res.chapter.last_page_read <= res.pages.length
        ? res.chapter.last_page_read
        : 1;
      setCurrentPage(initialPage);
      setIsMarkedAsRead(Boolean(res.chapter.is_read));
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar páginas deste capítulo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChapter(chapterId);
  }, [chapterId]);

  // Save progress & preferences on page changes
  const saveProgress = useCallback(async (page: number) => {
    if (!chapter || !manga) return;
    try {
      const isLast = page >= pages.length;
      if (isLast && !isMarkedAsRead) {
        setIsMarkedAsRead(true);
        await api.setChapterRead(chapter.id, true, page);
        if (onChapterFinished) onChapterFinished();
      } else {
        await api.setChapterRead(chapter.id, undefined, page);
      }

      await api.updatePreferences(manga.id, {
        reading_mode: readingMode,
        night_filter: nightFilter,
        scroll_snap: scrollSnap ? 1 : 0,
        fit_mode: fitMode,
        last_page: page
      });
    } catch (e) {
      console.error('Error saving reading progress:', e);
    }
  }, [chapter, manga, pages.length, isMarkedAsRead, readingMode, nightFilter, scrollSnap, fitMode, onChapterFinished]);

  // Page Navigation functions
  const advancePage = useCallback(() => {
    if (pages.length === 0) return;
    const step = (readingMode === 'double' || readingMode === 'book') ? 2 : 1;
    setCurrentPage(prev => {
      const next = Math.min(prev + step, pages.length);
      saveProgress(next);
      return next;
    });
  }, [pages.length, readingMode, saveProgress]);

  const previousPage = useCallback(() => {
    const step = (readingMode === 'double' || readingMode === 'book') ? 2 : 1;
    setCurrentPage(prev => {
      const next = Math.max(prev - step, 1);
      saveProgress(next);
      return next;
    });
  }, [readingMode, saveProgress]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const reachedEnd = element.scrollTop + element.clientHeight >= element.scrollHeight - 32;
    if (reachedEnd && pages.length > 0 && !isMarkedAsRead) {
      saveProgress(pages.length);
    }
  }, [pages.length, isMarkedAsRead, saveProgress]);

  const toggleReadingMode = useCallback(() => {
    if (manga && ['manhwa', 'manhua', 'webtoon'].includes(manga.type)) return;
    setReadingMode(prev => {
      let next: ReadingMode = 'single';
      if (prev === 'single') next = 'double';
      else if (prev === 'double') next = 'book';
      else if (prev === 'book') next = 'webtoon';
      else next = 'single';
      return next;
    });
  }, [manga]);

  const toggleNightFilter = useCallback(() => {
    setNightFilter(prev => {
      if (prev === 'none') return 'night';
      if (prev === 'night') return 'sepia';
      return 'none';
    });
  }, []);

  const toggleScrollSnap = useCallback(() => {
    setScrollSnap(prev => !prev);
  }, []);

  // Keyboard navigation strictly adhering to prompt Section 9.2 table:
  // Space: Advance
  // ArrowLeft: Previous
  // ArrowRight: Next
  // D: Toggle Single → Double → Book
  // N: Toggle night filter
  // S: Toggle scroll snap
  // Enter: Open next chapter
  // Backspace: Open previous chapter
  // ?: Show shortcuts modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Conflict detection: ignore if typing in input/textarea/select
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      switch (e.key) {
        case ' ': // Space
          e.preventDefault();
          advancePage();
          break;
        case 'ArrowRight':
          e.preventDefault();
          // For RTL manga, ArrowRight goes forward
          advancePage();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          previousPage();
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          toggleReadingMode();
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          toggleNightFilter();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          toggleScrollSnap();
          break;
        case 'Enter':
          e.preventDefault();
          if (nextChapter) onChapterChange(nextChapter.id);
          break;
        case 'Backspace':
          e.preventDefault();
          if (prevChapter) onChapterChange(prevChapter.id);
          break;
        case '?':
          e.preventDefault();
          setShowShortcutsModal(true);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [advancePage, previousPage, toggleReadingMode, toggleNightFilter, toggleScrollSnap, nextChapter, prevChapter, onChapterChange, onClose]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Filter CSS class
  const getFilterClass = () => {
    if (nightFilter === 'night') return 'reader-filter-night';
    if (nightFilter === 'sepia') return 'reader-filter-sepia';
    return '';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400 mb-3" />
        <p className="text-sm font-medium">Abrindo páginas no MangaX Reader...</p>
        <p className="text-xs text-neutral-500 mt-1">Carregando com proteção contra anúncios e redirecionamentos</p>
      </div>
    );
  }

  if (error || !chapter || !manga || pages.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-950 text-white p-6">
        <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg text-center shadow-2xl">
          <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-5 h-5" />
          </div>
          <p className="text-base font-bold text-white mb-1">
            {pages.length === 0 && !error ? 'Páginas Não Detectadas' : 'Dificuldade ao Carregar Leitura'}
          </p>
          <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
            {error || 'O site da fonte pode estar utilizando scripts dinâmicos ou proteção contra leitura embutida. Você pode tentar a heurística profunda de extração ou abrir o capítulo diretamente na fonte original.'}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            {chapter?.url && (
              <button
                onClick={() => window.open(chapter.url, '_blank')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir na Fonte Original (Nova Aba)</span>
              </button>
            )}

            <button
              onClick={() => loadChapter(chapterId)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-neutral-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar Heurística Novamente</span>
            </button>

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-neutral-400 hover:text-white rounded-lg transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 flex flex-col bg-neutral-950 select-none overflow-hidden ${getFilterClass()}`}>
      
      {/* Top Floating Bar / Reader Controls */}
      <div 
        className={`transition-all duration-300 z-30 bg-neutral-950/95 backdrop-blur-md border-b border-neutral-800/80 px-4 py-2.5 flex items-center justify-between gap-4 ${
          showToolbar ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        {/* Left: Back + Manga/Chapter Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors shrink-0"
            title="Voltar para a biblioteca (Esc)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white truncate">{manga.title}</h2>
            <div className="flex items-center gap-2 text-[11px] text-neutral-400">
              <span className="text-amber-400 font-medium">{chapter.chapter_number_text}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">Página {currentPage} de {pages.length}</span>
            </div>
          </div>
        </div>

        {/* Center: Mode selectors & Navigation */}
        <div className="hidden md:flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-lg">
          {manga && !['manhwa', 'manhua', 'webtoon'].includes(manga.type) && <>
          <button
            onClick={() => setReadingMode('single')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              readingMode === 'single' ? 'bg-amber-400 text-neutral-950 font-semibold' : 'text-neutral-400 hover:text-white'
            }`}
            title="Página Única (Tecla D)"
          >
            Single
          </button>
          <button
            onClick={() => setReadingMode('double')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              readingMode === 'double' ? 'bg-amber-400 text-neutral-950 font-semibold' : 'text-neutral-400 hover:text-white'
            }`}
            title="Duas Páginas (Tecla D)"
          >
            Double
          </button>
          <button
            onClick={() => setReadingMode('book')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              readingMode === 'book' ? 'bg-amber-400 text-neutral-950 font-semibold' : 'text-neutral-400 hover:text-white'
            }`}
            title="Livro / Spreads (Tecla D)"
          >
            Book
          </button>
          </>}
          <button
            onClick={() => setReadingMode('webtoon')}
            disabled={Boolean(manga && ['manhwa', 'manhua', 'webtoon'].includes(manga.type))}
            hidden={Boolean(manga && !['manhwa', 'manhua', 'webtoon'].includes(manga.type))}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              readingMode === 'webtoon' ? 'bg-amber-400 text-neutral-950 font-semibold' : 'text-neutral-400 hover:text-white'
            }`}
            title="Webtoon Vertical"
          >
            Webtoon
          </button>
        </div>

        {/* Right: Actions, Filters, Shortcuts */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Ad Shield Indicator */}
          <div 
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[11px] font-medium text-emerald-400"
            title="Proteção MangaX ativa: Pop-ups e redirecionamentos externos bloqueados"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Anti-Ad Ativo</span>
          </div>

          {/* Night filter toggle */}
          <button
            onClick={toggleNightFilter}
            className={`p-1.5 rounded-lg border transition-colors ${
              nightFilter !== 'none'
                ? 'bg-amber-400/10 border-amber-400/30 text-amber-400'
                : 'text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-800'
            }`}
            title={`Filtro Noturno: ${nightFilter} (Tecla N)`}
          >
            <Moon className="w-4 h-4" />
          </button>

          {/* Help shortcuts */}
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="p-1.5 text-neutral-400 border border-neutral-800 rounded-lg hover:text-white hover:bg-neutral-800 transition-colors"
            title="Atalhos de Teclado (Tecla ?)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Open in external source in new tab */}
          {chapter?.url && (
            <button
              onClick={() => window.open(chapter.url, '_blank')}
              className="p-1.5 text-neutral-400 border border-neutral-800 rounded-lg hover:text-white hover:bg-neutral-800 transition-colors hidden sm:block"
              title="Abrir capítulo na fonte original (Nova Aba)"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-neutral-400 border border-neutral-800 rounded-lg hover:text-white hover:bg-neutral-800 transition-colors"
            title="Tela Cheia"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 border border-neutral-800 rounded-lg hover:text-white hover:bg-neutral-800 transition-colors"
            title="Fechar Reader"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Reading Canvas */}
      <div 
        className="flex-1 relative overflow-hidden bg-neutral-950 flex items-center justify-center"
        onClick={() => setShowToolbar(prev => !prev)}
      >
        {/* Previous Page Click Target Zone (Left) */}
        {readingMode !== 'webtoon' && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              previousPage();
            }}
            className="absolute left-0 inset-y-0 w-1/5 z-20 cursor-w-resize hover:bg-white/[0.02] transition-colors"
            title="Página Anterior"
          />
        )}

        {/* Next Page Click Target Zone (Right) */}
        {readingMode !== 'webtoon' && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              advancePage();
            }}
            className="absolute right-0 inset-y-0 w-1/5 z-20 cursor-e-resize hover:bg-white/[0.02] transition-colors"
            title="Próxima Página"
          />
        )}

        {/* Rendering based on reading mode */}
        {readingMode === 'webtoon' ? (
          /* Webtoon: Continuous vertical strip with scroll-snap support */
          <div 
            ref={scrollContainerRef}
            className={`w-full h-full overflow-y-auto overflow-x-hidden flex flex-col items-center py-4 ${
              scrollSnap ? 'snap-y-mandatory' : ''
            }`}
            onClick={(e) => e.stopPropagation()}
            onScroll={handleScroll}
          >
            <div className="max-w-3xl w-full flex flex-col items-center space-y-0.5">
              {pages.map((p, idx) => (
                <div 
                  key={idx} 
                  className={`w-full flex justify-center bg-neutral-950 ${scrollSnap ? 'snap-start-always' : ''}`}
                >
                  <img
                    src={`/api/proxy/image?url=${encodeURIComponent(p.url)}`}
                    alt={`Página ${p.index}`}
                    loading="lazy"
                    className="w-full h-auto object-contain max-w-full pointer-events-none"
                    onError={(e) => {
                      // Direct fallback if proxy has issues
                      (e.target as HTMLImageElement).src = p.url;
                    }}
                  />
                </div>
              ))}

              {/* End of chapter box */}
              <div className="w-full py-12 px-6 flex flex-col items-center justify-center text-center bg-neutral-900 border border-neutral-800 rounded-2xl mt-8 mb-12">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </div>
                <h3 className="text-base font-bold text-white">Você concluiu {chapter.chapter_number_text}!</h3>
                <p className="text-xs text-neutral-400 mt-1">Capítulo marcado automaticamente como lido.</p>

                {nextChapter ? (
                  <button
                    onClick={() => onChapterChange(nextChapter.id)}
                    className="mt-5 px-5 py-2.5 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                  >
                    <span>Ir para o {nextChapter.chapter_number_text}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="mt-5 px-4 py-2 text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-neutral-700 transition-colors"
                  >
                    Voltar à Biblioteca
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : readingMode === 'double' || readingMode === 'book' ? (
          /* Double & Book mode: 2 pages side-by-side */
          <div 
            className="w-full h-full flex items-center justify-center p-2 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center max-h-full max-w-full gap-1 shadow-2xl">
              {/* For RTL Manga: Page 2 is on Left, Page 1 is on Right */}
              {pages[currentPage] && (
                <div className="max-h-[90vh] flex items-center justify-center bg-neutral-950">
                  <img
                    src={`/api/proxy/image?url=${encodeURIComponent(pages[currentPage].url)}`}
                    alt={`Página ${currentPage + 1}`}
                    className="max-h-[90vh] w-auto object-contain pointer-events-none"
                    onError={(e) => { (e.target as HTMLImageElement).src = pages[currentPage].url; }}
                  />
                </div>
              )}
              {pages[currentPage - 1] && (
                <div className="max-h-[90vh] flex items-center justify-center bg-neutral-950">
                  <img
                    src={`/api/proxy/image?url=${encodeURIComponent(pages[currentPage - 1].url)}`}
                    alt={`Página ${currentPage}`}
                    className="max-h-[90vh] w-auto object-contain pointer-events-none"
                    onError={(e) => { (e.target as HTMLImageElement).src = pages[currentPage - 1].url; }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Single page mode: centered single page */
          <div 
            className="w-full h-full flex items-center justify-center p-2 sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {pages[currentPage - 1] ? (
              <img
                src={`/api/proxy/image?url=${encodeURIComponent(pages[currentPage - 1].url)}`}
                alt={`Página ${currentPage}`}
                className="max-h-[92vh] max-w-[94vw] object-contain shadow-2xl pointer-events-none"
                onError={(e) => { (e.target as HTMLImageElement).src = pages[currentPage - 1].url; }}
              />
            ) : null}
          </div>
        )}
      </div>

      {/* Bottom Floating Scrim Bar (Page Jumper & Chapter Navigation) */}
      <div 
        className={`transition-all duration-300 z-30 bg-neutral-950/95 backdrop-blur-md border-t border-neutral-800/80 px-4 py-2.5 flex items-center justify-between gap-4 ${
          showToolbar ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        {/* Previous chapter button */}
        <button
          onClick={() => prevChapter && onChapterChange(prevChapter.id)}
          disabled={!prevChapter}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white disabled:opacity-40 rounded-lg hover:bg-neutral-800 transition-colors"
          title="Capítulo Anterior (Backspace)"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{prevChapter?.chapter_number_text || 'Cap. Anterior'}</span>
        </button>

        {/* Page progress slider (for non-webtoon) */}
        {readingMode !== 'webtoon' && (
          <div className="flex-1 max-w-md flex items-center gap-3">
            <span className="text-[11px] font-mono tabular-nums text-neutral-400 w-8 text-right">
              {currentPage}
            </span>
            <input
              type="range"
              min={1}
              max={pages.length || 1}
              value={currentPage}
              onChange={(e) => {
                const p = parseInt(e.target.value, 10);
                setCurrentPage(p);
                saveProgress(p);
              }}
              className="flex-1 accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
            />
            <span className="text-[11px] font-mono tabular-nums text-neutral-400 w-8">
              {pages.length}
            </span>
          </div>
        )}

        {/* Next chapter button */}
        <button
          onClick={() => nextChapter && onChapterChange(nextChapter.id)}
          disabled={!nextChapter}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 disabled:bg-neutral-800 disabled:text-neutral-500 rounded-lg shadow-sm transition-colors"
          title="Próximo Capítulo (Enter)"
        >
          <span className="hidden sm:inline">{nextChapter?.chapter_number_text || 'Próximo Cap.'}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Shortcuts modal dialog */}
      <ShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
};
