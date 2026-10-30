import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, Filter, Plus, RefreshCw, BookOpen, Layers, Grid, List, 
  Clock, CheckCircle, AlertCircle, Sparkles, SlidersHorizontal 
} from 'lucide-react';
import { Header } from './components/Header';
import { MangaCard } from './components/MangaCard';
import { MangaDetailModal } from './components/MangaDetailModal';
import { AddMangaModal } from './components/AddMangaModal';
import { Reader } from './components/Reader';
import { MonitoringView } from './components/MonitoringView';
import { DiagnosticView } from './components/DiagnosticView';
import { ShortcutsModal } from './components/ShortcutsModal';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { api } from './services/api';
import { Manga, NotificationItem } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'library' | 'monitoring' | 'diagnostic'>('library');
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');

  // Modals and Active Reader
  const [selectedMangaId, setSelectedMangaId] = useState<string | null>(null);
  const [activeReadingChapterId, setActiveReadingChapterId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Load mangas from backend
  const loadMangas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getMangas({
        type: typeFilter,
        status: statusFilter,
        search,
        sort: sortBy
      });
      setMangas(data);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar biblioteca.');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, search, sortBy]);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      const items = await api.getNotifications();
      setNotifications(items);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadMangas();
  }, [loadMangas]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 15000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Global key listener for shortcuts modal (?)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (activeReadingChapterId) return; // Reader handles its own keys
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [activeReadingChapterId]);

  // Quick read: opens last read chapter or first unread chapter
  const handleQuickRead = async (manga: Manga) => {
    try {
      const details = await api.getManga(manga.id);
      if (details.chapters.length === 0) {
        setSelectedMangaId(manga.id);
        return;
      }

      let targetChapterId = manga.last_read_chapter_id;
      if (!targetChapterId) {
        // Find first chapter (oldest by chapter number)
        const sorted = details.chapters.slice().sort((a, b) => a.chapter_number - b.chapter_number);
        targetChapterId = sorted[0]?.id;
      }

      if (targetChapterId) {
        setActiveReadingChapterId(targetChapterId);
      } else {
        setSelectedMangaId(manga.id);
      }
    } catch (err) {
      console.error(err);
      setSelectedMangaId(manga.id);
    }
  };

  const handleReadNotification = async (id: string) => {
    await api.markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
  };

  const handleClearNotifications = async () => {
    await api.clearNotifications();
    setNotifications([]);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      
      {/* Top Bar Contract Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        notifications={notifications}
        onToggleNotifications={() => setIsNotificationsOpen(prev => !prev)}
        isNotificationsOpen={isNotificationsOpen}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* View 1: Biblioteca de Obras */}
        {activeTab === 'library' && (
          <div className="space-y-6">
            
            {/* Control Bar: Search & Interactive Filter Segmented Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
              
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Pesquisar por título, autor ou gênero..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

              {/* Segmented Controls for Types and Unread Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'unread', label: 'Não Lidos' },
                  { id: 'manga', label: 'Mangás' },
                  { id: 'manhwa', label: 'Manhwas' },
                  { id: 'manhua', label: 'Manhuas' },
                  { id: 'webtoon', label: 'Webtoons' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTypeFilter(t.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      typeFilter === t.id
                        ? 'bg-amber-400 text-neutral-950 font-semibold shadow-sm'
                        : 'text-neutral-400 hover:text-white bg-neutral-950/40 hover:bg-neutral-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Sort selector & Layout toggle */}
              <div className="flex items-center gap-2.5 shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="updated">Mais Recentes</option>
                  <option value="unread">Mais Não Lidos</option>
                  <option value="title">Título (A-Z)</option>
                  <option value="latest_chapter">Maior Capítulo</option>
                </select>

                <div className="flex items-center p-0.5 bg-neutral-950 border border-neutral-800 rounded-lg">
                  <button
                    onClick={() => setViewLayout('grid')}
                    className={`p-1.5 rounded-md transition-colors ${
                      viewLayout === 'grid' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'
                    }`}
                    title="Exibição em Grade"
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewLayout('list')}
                    className={`p-1.5 rounded-md transition-colors ${
                      viewLayout === 'list' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'
                    }`}
                    title="Exibição em Lista"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>

            {/* Error banner */}
            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={loadMangas} className="text-amber-400 hover:underline">Tentar novamente</button>
              </div>
            )}

            {/* Manga Library Cards Grid */}
            {viewLayout === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {mangas.map((m) => (
                  <MangaCard
                    key={m.id}
                    manga={m}
                    onSelect={(selected) => setSelectedMangaId(selected.id)}
                    onQuickRead={handleQuickRead}
                  />
                ))}
              </div>
            ) : (
              /* List view */
              <div className="space-y-2">
                {mangas.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMangaId(m.id)}
                    className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/40 cursor-pointer transition-all gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-16 rounded-lg bg-neutral-950 overflow-hidden shrink-0 border border-neutral-800">
                        <img src={m.cover_url} alt={m.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">{m.title}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-0.5">
                          <span className="capitalize">{m.type}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">Cap. {m.last_known_chapter_number || 0}</span>
                          {m.author && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">{m.author}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {m.unread_count > 0 && (
                        <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-amber-400 text-neutral-950 rounded">
                          {m.unread_count} novos
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickRead(m);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Ler</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {mangas.length === 0 && !loading && (
              <div className="py-20 text-center flex flex-col items-center justify-center">
                <BookOpen className="w-12 h-12 text-neutral-600 mb-3" />
                <h3 className="text-base font-bold text-white">Nenhuma obra encontrada</h3>
                <p className="text-xs text-neutral-400 mt-1 max-w-sm">
                  {search
                    ? 'Nenhum resultado corresponde à sua pesquisa. Tente outros termos.'
                    : 'Cadastre sua primeira obra inserindo uma URL ou buscando no catálogo MangaDex.'}
                </p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="mt-5 flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Adicionar Primeira Obra</span>
                </button>
              </div>
            )}

          </div>
        )}

        {/* View 2: Monitoramento & Logs */}
        {activeTab === 'monitoring' && <MonitoringView />}

        {/* View 3: Fontes & Diagnóstico */}
        {activeTab === 'diagnostic' && <DiagnosticView />}

      </main>

      {/* Manga Detail Modal */}
      {selectedMangaId && (
        <MangaDetailModal
          mangaId={selectedMangaId}
          isOpen={true}
          onClose={() => setSelectedMangaId(null)}
          onStartReading={(chapterId) => {
            setSelectedMangaId(null);
            setActiveReadingChapterId(chapterId);
          }}
          onMangaUpdated={loadMangas}
          onMangaDeleted={loadMangas}
        />
      )}

      {/* Add Manga Modal */}
      <AddMangaModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={(newId) => {
          loadMangas();
          setSelectedMangaId(newId);
        }}
      />

      {/* Fullscreen MangaX Reader */}
      {activeReadingChapterId && (
        <Reader
          chapterId={activeReadingChapterId}
          onClose={() => {
            setActiveReadingChapterId(null);
            loadMangas();
          }}
          onChapterChange={(nextId) => setActiveReadingChapterId(nextId)}
          onChapterFinished={() => loadMangas()}
        />
      )}

      {/* Shortcuts Cheat Sheet Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Notifications Drawer */}
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onReadNotification={handleReadNotification}
        onClearAll={handleClearNotifications}
        onOpenChapter={(chapterId) => setActiveReadingChapterId(chapterId)}
      />

    </div>
  );
}
