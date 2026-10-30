import React, { useState } from 'react';
import { X, Search, Globe, Plus, AlertCircle, Check, Loader2, Sparkles, BookOpen } from 'lucide-react';
import { api } from '../services/api';
import { MangaType, MangaStatus } from '../types';

interface AddMangaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (mangaId: string) => void;
}

export const AddMangaModal: React.FC<AddMangaModalProps> = ({ isOpen, onClose, onSuccess }) => {
  if (!isOpen) return null;

  const [mode, setMode] = useState<'url' | 'search'>('url');
  const [url, setUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extracted or manual form values
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [type, setType] = useState<MangaType>('manga');
  const [status, setStatus] = useState<MangaStatus>('ongoing');
  const [author, setAuthor] = useState('');
  const [artist, setArtist] = useState('');
  const [detectedChaptersCount, setDetectedChaptersCount] = useState<number | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);

  // Search results
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleExtractFromUrl = async () => {
    let target = url.trim();
    if (!target) {
      setError('Por favor, informe uma URL ou ID do MangaDex.');
      return;
    }

    // Auto-normalize raw MangaDex UUID/ID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target)) {
      target = `https://mangadex.org/title/${target}`;
      setUrl(target);
    } else if (target.startsWith('mangadex.org/')) {
      target = `https://${target}`;
      setUrl(target);
    }

    setError(null);
    setIsExtracting(true);

    try {
      const res = await api.previewUrl(target);
      const meta = res.metadata;
      setTitle(meta.title || '');
      setDescription(meta.description || '');
      setCoverUrl(meta.coverUrl || '');
      setType(meta.type || 'manga');
      setStatus(meta.status || 'ongoing');
      setAuthor(meta.author || '');
      setArtist(meta.artist || '');
      setSourceName(res.sourceName || 'Fonte detectada');
    } catch (err: any) {
      setError(err.message || 'Falha ao extrair metadados. Você ainda pode preencher os campos manualmente.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSearchMangaDex = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setError(null);
    try {
      const res = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(searchQuery)}&limit=6&includes[]=cover_art`);
      if (!res.ok) throw new Error('Falha na busca do MangaDex');
      const data = await res.json();
      const items = (data.data || []).map((item: any) => {
        const attr = item.attributes;
        const rels = item.relationships || [];
        const titleObj = attr.title || {};
        const mTitle = titleObj['pt-br'] || titleObj['en'] || Object.values(titleObj)[0] || 'Sem Título';
        let fileName = '';
        const cover = rels.find((r: any) => r.type === 'cover_art');
        if (cover?.attributes?.fileName) fileName = cover.attributes.fileName;

        return {
          id: item.id,
          title: mTitle,
          description: attr.description?.['en'] || '',
          coverUrl: fileName ? `https://uploads.mangadex.org/covers/${item.id}/${fileName}.256.jpg` : '',
          type: attr.originalLanguage === 'ko' ? 'manhwa' : 'manga',
          url: `https://mangadex.org/title/${item.id}`
        };
      });
      setSearchResults(items);
    } catch (err: any) {
      setError('Não foi possível conectar ao MangaDex para busca.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (item: any) => {
    setUrl(item.url);
    setTitle(item.title);
    setDescription(item.description);
    setCoverUrl(item.coverUrl);
    setType(item.type);
    setSourceName('MangaDex (Oficial)');
    setMode('url');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('O título da obra é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.createManga({
        url: url.trim() || undefined,
        title: title.trim(),
        description: description.trim(),
        coverUrl: coverUrl.trim() || undefined,
        type,
        status,
        author: author.trim() || undefined,
        artist: artist.trim() || undefined
      });

      onSuccess(res.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar obra.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div 
        className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-bold text-white">Cadastrar Nova Obra</h2>
            <p className="text-xs text-neutral-400">Adicione por URL ou busque no catálogo oficial MangaDex</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/50 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-colors ${
              mode === 'url' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Cadastrar por URL da Fonte</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('search')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-colors ${
              mode === 'search' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscar no MangaDex</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'search' ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: Solo Leveling, One Piece, Dandadan, Berserk..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchMangaDex()}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleSearchMangaDex}
                  disabled={isSearching}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors shrink-0"
                >
                  {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>Buscar</span>
                </button>
              </div>

              {/* Search Results Grid */}
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectSearchResult(item)}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 hover:border-amber-400/50 hover:bg-neutral-800/40 cursor-pointer transition-all"
                  >
                    <div className="w-12 h-16 rounded bg-neutral-900 overflow-hidden shrink-0">
                      {item.coverUrl ? (
                        <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-600">
                          <BookOpen className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">{item.title}</h4>
                      <p className="text-xs text-neutral-400 capitalize">{item.type} · MangaDex</p>
                      <p className="text-xs text-neutral-400 line-clamp-1 mt-0.5">{item.description || 'Sem sinopse disponível'}</p>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg hover:bg-amber-400 hover:text-neutral-950 transition-colors shrink-0"
                    >
                      Selecionar
                    </button>
                  </div>
                ))}

                {searchResults.length === 0 && !isSearching && (
                  <div className="text-center py-8 text-neutral-400 text-xs">
                    Digite o nome de uma obra acima para pesquisar.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* URL or MangaDex ID Input with Auto-extract button */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  URL da Obra ou ID / UUID do MangaDex
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Cole a URL ou o ID MangaDex (ex: 32d76d19-8a05-4db0-9fc2-e0b0648fe9d0)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleExtractFromUrl}
                    disabled={isExtracting || !url.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 rounded-lg border border-neutral-700 transition-colors shrink-0"
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Extraindo...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Extrair Dados</span>
                      </>
                    )}
                  </button>
                </div>
                {sourceName && (
                  <p className="mt-1 text-[11px] text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Metadados obtidos via {sourceName}</span>
                  </p>
                )}
              </div>

              {/* Title & Type row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">Título da Obra *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Solo Leveling"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">Tipo</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as MangaType)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="manga">Mangá</option>
                    <option value="manhwa">Manhwa</option>
                    <option value="manhua">Manhua</option>
                    <option value="webtoon">Webtoon</option>
                  </select>
                </div>
              </div>

              {/* Cover URL & Status row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">URL da Imagem da Capa</label>
                  <input
                    type="url"
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="https://.../cover.jpg"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MangaStatus)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="ongoing">Em lançamento</option>
                    <option value="completed">Concluído</option>
                    <option value="hiatus">Em hiato</option>
                  </select>
                </div>
              </div>

              {/* Author & Artist row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">Autor</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Nome do autor"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">Artista / Estúdio</label>
                  <input
                    type="text"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="Nome do ilustrador"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">Sinopse</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve descrição da obra..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors shadow-sm"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Salvar na Biblioteca</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
