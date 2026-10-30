import React from 'react';
import { BookOpen, Bell, Plus, ShieldCheck, Activity, HelpCircle } from 'lucide-react';
import { NotificationItem } from '../types';

interface HeaderProps {
  activeTab: 'library' | 'monitoring' | 'diagnostic';
  setActiveTab: (tab: 'library' | 'monitoring' | 'diagnostic') => void;
  onOpenAddModal: () => void;
  onOpenShortcuts: () => void;
  notifications: NotificationItem[];
  onToggleNotifications: () => void;
  isNotificationsOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddModal,
  onOpenShortcuts,
  notifications,
  onToggleNotifications,
  isNotificationsOpen
}) => {
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <header className="sticky top-0 z-40 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Strict Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (4-5 Nav Links) — Zone 3 (Primary Action) */}
        <div className="flex items-center justify-between gap-8 h-16">
          
          {/* Zone 1: Single text element wordmark */}
          <button
            onClick={() => setActiveTab('library')}
            className="flex items-center gap-2.5 text-left text-lg font-bold tracking-tight text-white hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-mono text-sm font-black">
              X
            </div>
            <span>MangaX</span>
          </button>

          {/* Zone 2: 4-5 concise single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-neutral-400">
            <button
              onClick={() => setActiveTab('library')}
              className={`transition-colors whitespace-nowrap shrink-0 hover:text-white ${
                activeTab === 'library' ? 'text-amber-400 border-b-2 border-amber-400 py-4 -mb-[2px]' : ''
              }`}
            >
              Biblioteca
            </button>
            <button
              onClick={() => setActiveTab('monitoring')}
              className={`transition-colors whitespace-nowrap shrink-0 hover:text-white ${
                activeTab === 'monitoring' ? 'text-amber-400 border-b-2 border-amber-400 py-4 -mb-[2px]' : ''
              }`}
            >
              Monitoramento &amp; Logs
            </button>
            <button
              onClick={() => setActiveTab('diagnostic')}
              className={`transition-colors whitespace-nowrap shrink-0 hover:text-white ${
                activeTab === 'diagnostic' ? 'text-amber-400 border-b-2 border-amber-400 py-4 -mb-[2px]' : ''
              }`}
            >
              Fontes &amp; Diagnóstico
            </button>
            <button
              onClick={onOpenShortcuts}
              className="text-neutral-400 hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <span>Atalhos</span>
              <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-neutral-900 border border-neutral-700 rounded text-neutral-300">?</kbd>
            </button>
          </nav>

          {/* Zone 3: Primary Action + Notifications */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onToggleNotifications}
              title="Central de Notificações"
              className={`relative p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors ${
                isNotificationsOpen ? 'bg-neutral-900 text-white' : ''
              }`}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold font-mono text-neutral-950 bg-amber-400 rounded-full">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Adicionar Obra</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
