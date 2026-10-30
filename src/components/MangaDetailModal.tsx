import React, { useState, useEffect } from 'react';
import { 
  X, BookOpen, Check, CheckCheck, RefreshCw, Trash2, Edit3, Plus, 
  ExternalLink, Sliders, Shield, AlertTriangle, Layers, Eye, EyeOff, Loader2 
} from 'lucide-react';
import { api } from '../services/api';
import { Manga, Source, Chapter, ReaderPreferences, ReadingMode, ReadingDirection, NightFilter } from '../types';

interface MangaDetailModalProps {
  mangaId: string;
  isOpen: boolean;
  onClose: () => void;
  onStartReading: (chapterId: string) => void;
  onMangaUpdated: () => void;
  onMangaDeleted: () => void;
}

export const MangaDetailModal: React.FC<MangaDetailModalProps> = ({
  mangaId,
  isOpen,
  onClose,
  onStartReading,
  onMangaUpdated,
  onMangaDeleted
}) => {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<{
    manga: Manga;
    sources: Source[];
    chapters: Chapter[];
    preferences: ReaderPreferences;
  } | null>(null);

  const [chapterFilter, setChapterFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'chapters' | 'sources' | 'preferences' | 'edit'>('chapters');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCover, setEditCover] = useState('');
  const [editType, setEditType] = useState('manga');
  const [editStatus, setEditStatus] = useState('ongoing');
  const [editAuthor, setEditAuthor] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Add source state
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');

  // Reader preferences state
  const [prefMode, setPrefMode] = useState<ReadingMode>('single');
  const [prefDirection, setPrefDirection] = useState<ReadingDirection>('rtl');
  const [prefNight, setPrefNight] = useState<NightFilter>('none');
  const [prefSnap, setPrefSnap] = useState(false);

  const loadDetails = async () => {
    try {
      setLoading(true);
      const res = await api.getManga(mangaId);
      setData(res);
      setEditTitle(res.manga.title || '');
      setEditDesc(res.manga.description || '');
      setEditCover(res.manga.cover_url || '');
      setEditType(res.manga.type || 'manga');
      setEditStatus(res.manga.status || 'ongoing');
      setEditAuthor(res.manga.author || '');
      setEditArtist(res.manga.artist || '');
      setEditError(null);

      const isScroll = ['manhwa', 'manhua', 'webtoon'].includes(res.manga.type);
      setPrefMode(isScroll ? 'webtoon' : (res.preferences?.reading_mode || 'single'));
      setPrefDirection(isScroll ? 'vertical' : (res.preferences?.direction || 'rtl'));
      setPrefNight((res.preferences?.night_filter as any) === 'invert' ? 'night' : (res.preferences?.night_filter || 'none'));
      setPrefSnap(Boolean(res.preferences?.scroll_snap));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [mangaId]);

  const handleRefreshChapters = async () => {
    setRefreshing(true);
    try {
      await api.refreshManga(mangaId);
      await loadDetails();
      onMangaUpdated();
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleRead = async (chapter: Chapter) => {
    try {
      const res = await api.setChapterRead(chapter.id, !chapter.is_read);
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          manga: { ...prev.manga, unread_count: res.unreadCount },
          chapters: prev.chapters.map(c => c.id === chapter.id ? { ...c, is_read: res.isRead ? 1 : 0 } : c)
        };
      });
      onMangaUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkPreviousRead = async (chapter: Chapter) => {
    try {
      const res = await api.markPreviousAsRead(chapter.id);
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          manga: { ...prev.manga, unread_count: res.unreadCount },
          chapters: prev.chapters.map(c => c.chapter_number <= chapter.chapter_number ? { ...c, is_read: 1 } : c)
        };
      });
      onMangaUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSavePreferences = async () => {
    try {
      await api.updatePreferences(mangaId, {
        reading_mode: prefMode,
        direction: prefDirection,
        night_filter: prefNight,
        scroll_snap: prefSnap ? 1 : 0
      });
      await loadDetails();
      setActiveTab('chapters');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setIsSavingEdit(true);
    try {
      await api.updateManga(mangaId, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        cover_url: editCover.trim(),
        type: editType as any,
        status: editStatus as any,
        author: editAuthor.trim(),
        artist: editArtist.trim()
      });
      await loadDetails();
      onMangaUpdated();
      setActiveTab('chapters');
    } catch (err: any) {
      console.error('Falha ao salvar edição:', err);
      setEditError(err.message || 'Erro ao salvar alterações da obra.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceUrl.trim()) return;
    try {
      await api.addSource(mangaId, { name: newSourceName.trim(), url: newSourceUrl.trim() });
      setNewSourceName('');
      setNewSourceUrl('');
      await loadDetails();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    try {
      await api.deleteSource(sourceId);
      await loadDetails();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteManga = async () => {
    try {
      await api.deleteManga(mangaId);
      onMangaDeleted();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  if (!data && loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="p-8 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center gap-3 text-neutral-300">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Carregando dados da obra...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { manga, sources, chapters } = data;
  const isScrollStyle = ['manhwa', 'manhua', 'webtoon'].includes(manga.type);

  // Filtered chapters
  const filteredChapters = chapters.filter(c => {
    if (!chapterFilter.trim()) return true;
    const term = chapterFilter.toLowerCase();
    return c.chapter_number_text.toLowerCase().includes(term) || c.title.toLowerCase().includes(term);
  });

  // Next chapter to read
  const nextToRead = chapters.slice().reverse().find(c => !c.is_read) || chapters[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div 
        className="relative w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden my-4 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Scrim Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/70 shrink-0">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="font-semibold text-white capitalize">{manga.type}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{chapters.length} capítulos</span>
            {manga.unread_count > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-400 font-mono font-medium">{manga.unread_count} não lidos</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hero Banner Split */}
        <div className="p-6 border-b border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950 shrink-0">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Cover Image (3:4 ratio) */}
            <div className="w-36 sm:w-44 aspect-[3/4] rounded-xl bg-neutral-950 overflow-hidden border border-neutral-800 shadow-xl shrink-0">
              <img
                src={manga.cover_url}
                alt={manga.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            </div>

            {/* Info and Synopsis */}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {manga.title}
                </h1>
                
                {/* Quiet unboxed metadata */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 mt-1.5">
                  {manga.author && <span>Autor: <strong className="text-neutral-200 font-medium">{manga.author}</strong></span>}
                  {manga.artist && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Arte: <strong className="text-neutral-200 font-medium">{manga.artist}</strong></span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{manga.status === 'completed' ? 'Concluído' : 'Em lançamento'}</span>
                </div>

                <p className="mt-3 text-xs sm:text-sm text-neutral-400 line-clamp-3 leading-relaxed">
                  {manga.description || 'Nenhuma sinopse cadastrada para esta obra.'}
                </p>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-2.5 mt-4 pt-3 border-t border-neutral-800/60">
                {nextToRead && (
                  <button
                    onClick={() => onStartReading(nextToRead.id)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors"
                  >
                    <BookOpen className="w-4 h-4 stroke-[2.5]" />
                    <span>{manga.last_read_chapter_number ? `Continuar ${nextToRead.chapter_number_text}` : `Ler ${nextToRead.chapter_number_text}`}</span>
                  </button>
                )}

                <button
                  onClick={handleRefreshChapters}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 rounded-lg border border-neutral-700 transition-colors"
                  title="Consultar fonte para novos capítulos"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
                  <span>{refreshing ? 'Verificando...' : 'Atualizar Capítulos'}</span>
                </button>

                <button
                  onClick={() => setActiveTab(activeTab === 'preferences' ? 'chapters' : 'preferences')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                    activeTab === 'preferences'
                      ? 'bg-amber-400/10 border-amber-400/30 text-amber-400'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Preferências do Reader</span>
                </button>

                <button
                  onClick={() => setActiveTab(activeTab === 'sources' ? 'chapters' : 'sources')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                    activeTab === 'sources'
                      ? 'bg-amber-400/10 border-amber-400/30 text-amber-400'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Fontes ({sources.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab(activeTab === 'edit' ? 'chapters' : 'edit')}
                  className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg border border-neutral-700/60 transition-colors"
                  title="Editar Metadados"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-neutral-700/60 transition-colors ml-auto"
                  title="Remover Obra"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Subviews */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Delete confirmation modal overlay */}
          {deleteConfirm && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <div className="text-xs text-rose-200">
                  <p className="font-semibold">Tem certeza que deseja excluir esta obra da biblioteca?</p>
                  <p className="text-rose-300/80">O progresso de leitura e as preferências salvas serão removidos.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteManga}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          )}

          {/* Preferences Subview */}
          {activeTab === 'preferences' && (
            <div className="space-y-4 max-w-xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>Preferências de Leitura para {manga.title}</span>
              </h3>
              <p className="text-xs text-neutral-400">Estas configurações são salvas individualmente para cada obra.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">Modo de Exibição Padrão</label>
                  <select
                    value={prefMode}
                    onChange={(e) => setPrefMode(e.target.value as ReadingMode)}
                    disabled={isScrollStyle}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    {isScrollStyle ? (
                      <option value="webtoon">Rolagem vertical contínua</option>
                    ) : (
                      <>
                        <option value="single">Single (Página única)</option>
                        <option value="double">Double (Páginas duplas lado a lado)</option>
                        <option value="book">Book (Formato livro com spreads)</option>
                      </>
                    )}
                  </select>
                  {isScrollStyle && <p className="mt-1 text-[11px] text-neutral-500">O formato de rolagem é definido pelo estilo desta obra.</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">Direção da Leitura</label>
                  <select
                    value={prefDirection}
                    onChange={(e) => setPrefDirection(e.target.value as ReadingDirection)}
                    disabled={isScrollStyle}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="rtl">Direita para Esquerda (Manga tradicional - RTL)</option>
                    <option value="ltr">Esquerda para Direita (Ocidental - LTR)</option>
                    <option value="vertical">Vertical contínua (Webtoon)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">Filtro Noturno</label>
                  <select
                    value={prefNight}
                    onChange={(e) => setPrefNight(e.target.value as NightFilter)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="none">Desativado (Cores naturais)</option>
                    <option value="night">Noturno suave (Contraste escuro)</option>
                    <option value="sepia">Sépia aquecido</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="prefSnap"
                    checked={prefSnap}
                    onChange={(e) => setPrefSnap(e.target.checked)}
                    className="w-4 h-4 rounded bg-neutral-950 border-neutral-800 text-amber-400 focus:ring-0"
                  />
                  <label htmlFor="prefSnap" className="text-xs text-neutral-300 cursor-pointer">
                    Habilitar Scroll Snap (Alinhamento na rolagem)
                  </label>
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  className="px-4 py-2 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors"
                >
                  Salvar Preferências
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('chapters')}
                  className="px-4 py-2 text-xs text-neutral-400 hover:text-white rounded-lg transition-colors"
                >
                  Voltar aos Capítulos
                </button>
              </div>
            </div>
          )}

          {/* Sources Subview */}
          {activeTab === 'sources' && (
            <div className="space-y-4 max-w-xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Fontes Cadastradas ({sources.length})</span>
              </h3>
              <p className="text-xs text-neutral-400">Uma mesma obra pode ser monitorada em múltiplos sites sem duplicar a obra.</p>

              <div className="space-y-2 pt-2">
                {sources.map((s) => (
                  <div key={s.id} className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white truncate">{s.name}</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Ativa</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">{s.url}</p>
                    </div>
                    {sources.length > 1 && (
                      <button
                        onClick={() => handleDeleteSource(s.id)}
                        className="p-1.5 text-neutral-500 hover:text-rose-400 rounded-lg transition-colors"
                        title="Remover fonte"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add alternative source form */}
              <form onSubmit={handleAddSource} className="pt-4 border-t border-neutral-800 space-y-3">
                <h4 className="text-xs font-semibold text-neutral-300">Adicionar Fonte Alternativa</h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Nome da Fonte (ex: Scan X)"
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    className="sm:w-1/3 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                  <input
                    type="url"
                    required
                    placeholder="URL no site da fonte"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-neutral-700 transition-colors shrink-0"
                  >
                    Adicionar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Edit Manga Subview */}
          {activeTab === 'edit' && (
            <form onSubmit={handleSaveEdit} className="space-y-4 max-w-xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Editar Informações da Obra</span>
              </h3>

              {editError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">URL da Capa</label>
                <input
                  type="url"
                  value={editCover}
                  onChange={(e) => setEditCover(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Tipo</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="manga">Mangá</option>
                    <option value="manhwa">Manhwa</option>
                    <option value="manhua">Manhua</option>
                    <option value="webtoon">Webtoon</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="ongoing">Em lançamento</option>
                    <option value="completed">Concluído</option>
                    <option value="hiatus">Em hiato</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Autor</label>
                  <input
                    type="text"
                    value={editAuthor}
                    onChange={(e) => setEditAuthor(e.target.value)}
                    placeholder="Nome do autor"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Artista / Estúdio</label>
                  <input
                    type="text"
                    value={editArtist}
                    onChange={(e) => setEditArtist(e.target.value)}
                    placeholder="Nome do ilustrador"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Sinopse</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Salvar Alterações</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('chapters')}
                  className="px-4 py-2 text-xs text-neutral-400 hover:text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Chapters Subview (Default) */}
          {activeTab === 'chapters' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Lista de Capítulos</h3>
                  <span className="text-xs text-neutral-400 font-mono tabular-nums">({chapters.length})</span>
                </div>

                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Filtrar capítulo por número ou título..."
                    value={chapterFilter}
                    onChange={(e) => setChapterFilter(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Chapters list */}
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {filteredChapters.map((ch) => (
                  <div
                    key={ch.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      ch.is_read
                        ? 'bg-neutral-950/40 border-neutral-800/60 text-neutral-400'
                        : 'bg-neutral-950 border-neutral-800 text-white hover:border-amber-400/40'
                    }`}
                  >
                    <div 
                      onClick={() => onStartReading(ch.id)}
                      className="flex-1 flex items-center gap-3 cursor-pointer min-w-0"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleRead(ch);
                        }}
                        className={`w-5 h-5 rounded flex items-center justify-center transition-colors shrink-0 ${
                          ch.is_read
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-neutral-900 border border-neutral-700 text-transparent hover:text-neutral-500'
                        }`}
                        title={ch.is_read ? 'Capítulo lido (clique para desmarcar)' : 'Marcar como lido'}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold truncate ${ch.is_read ? 'text-neutral-400' : 'text-neutral-100'}`}>
                            {ch.title || ch.chapter_number_text}
                          </span>
                        </div>
                        {ch.release_date && (
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {ch.release_date}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleMarkPreviousRead(ch)}
                        className="px-2 py-1 text-[11px] text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors hidden sm:flex items-center gap-1"
                        title="Marcar todos os capítulos anteriores a este como lidos"
                      >
                        <CheckCheck className="w-3 h-3 text-neutral-500" />
                        <span>Marcar anteriores</span>
                      </button>

                      <button
                        onClick={() => onStartReading(ch.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-neutral-900 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors flex items-center gap-1"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>Ler</span>
                      </button>
                    </div>
                  </div>
                ))}

                {filteredChapters.length === 0 && (
                  <div className="text-center py-8 text-neutral-500 text-xs">
                    Nenhum capítulo encontrado para o filtro digitado.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
