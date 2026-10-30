import React from 'react';
import { BookOpen, Check, Clock } from 'lucide-react';
import { Manga } from '../types';

interface MangaCardProps {
  manga: Manga;
  onSelect: (manga: Manga) => void;
  onQuickRead: (manga: Manga) => void;
}

export const MangaCard: React.FC<MangaCardProps> = ({ manga, onSelect, onQuickRead }) => {
  const typeLabels: Record<string, string> = {
    manga: 'Mangá',
    manhwa: 'Manhwa',
    manhua: 'Manhua',
    webtoon: 'Webtoon'
  };

  const statusLabels: Record<string, string> = {
    ongoing: 'Em lançamento',
    completed: 'Concluído',
    hiatus: 'Em hiato'
  };

  return (
    <div
      onClick={() => onSelect(manga)}
      className="group relative flex flex-col bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
    >
      {/* Cover Image Container (3:4 ratio) */}
      <div className="relative aspect-[3/4] w-full bg-neutral-950 overflow-hidden">
        <img
          src={manga.cover_url}
          alt={manga.title}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            // High-grade styled fallback
            (e.target as HTMLElement).style.display = 'none';
          }}
        />

        {/* Fallback pattern in case image fails */}
        <div className="absolute inset-0 -z-10 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-neutral-900 to-neutral-950 text-neutral-600">
          <BookOpen className="w-10 h-10 mb-2 opacity-40" />
          <span className="text-xs text-center font-medium line-clamp-2 text-neutral-400">{manga.title}</span>
        </div>

        {/* Contrast Scrim at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent pointer-events-none" />

        {/* Unread indicator - clean unboxed indicator */}
        {manga.unread_count > 0 && (
          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 text-[11px] font-mono font-semibold bg-amber-400 text-neutral-950 rounded shadow-md">
            {manga.unread_count} novos
          </div>
        )}

        {/* Quick Read Button on hover */}
        <div className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickRead(manga);
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-lg transition-colors whitespace-nowrap"
          >
            <BookOpen className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{manga.last_read_chapter_number ? `Continuar Cap. ${manga.last_read_chapter_number}` : 'Começar Leitura'}</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-col flex-1 p-3.5 gap-2">
        {/* Zero-Pill Unboxed Metadata with typographic separators */}
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <span>{typeLabels[manga.type] || 'Mangá'}</span>
          <span aria-hidden="true" className="text-neutral-600">·</span>
          <span>{statusLabels[manga.status] || 'Em lançamento'}</span>
          {manga.last_known_chapter_number ? (
            <>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span className="font-mono tabular-nums">Cap. {manga.last_known_chapter_number}</span>
            </>
          ) : null}
        </div>

        {/* Manga Title */}
        <h3 className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors line-clamp-2 leading-snug">
          {manga.title}
        </h3>

        {/* Author / Artist */}
        {manga.author && (
          <p className="text-xs text-neutral-400 truncate">
            {manga.author}
          </p>
        )}

        {/* Reading progress status */}
        <div className="mt-auto pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
          <span>
            {manga.last_read_chapter_number ? (
              <span className="text-neutral-300">Lido até <span className="font-mono tabular-nums font-medium text-amber-400">Cap. {manga.last_read_chapter_number}</span></span>
            ) : (
              <span>Não iniciado</span>
            )}
          </span>
          {manga.unread_count === 0 && manga.last_read_chapter_number ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <Check className="w-3.5 h-3.5" />
              <span>Em dia</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
