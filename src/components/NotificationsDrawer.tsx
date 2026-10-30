import React from 'react';
import { X, Bell, BookOpen, Trash2, Check, Clock } from 'lucide-react';
import { NotificationItem } from '../types';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onReadNotification: (id: string) => void;
  onClearAll: () => void;
  onOpenChapter: (chapterId: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onReadNotification,
  onClearAll,
  onOpenChapter
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="absolute inset-y-0 right-0 w-full max-w-sm bg-neutral-900 border-l border-neutral-800 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">Notificações de Lançamentos</h2>
            <span className="text-xs text-neutral-400 font-mono tabular-nums">({notifications.length})</span>
          </div>

          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="p-1.5 text-neutral-400 hover:text-rose-400 rounded-lg hover:bg-neutral-800 transition-colors"
                title="Limpar todas as notificações"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-3 rounded-xl border transition-all ${
                notif.is_read
                  ? 'bg-neutral-950/40 border-neutral-800/60 text-neutral-400'
                  : 'bg-neutral-950 border-neutral-800 text-white hover:border-amber-400/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-white line-clamp-1">{notif.title}</h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium mt-0.5">
                    <span>{notif.chapter_number_text}</span>
                    <span aria-hidden="true" className="text-neutral-600">·</span>
                    <span className="text-neutral-400">{notif.source_name}</span>
                  </div>
                </div>

                {!notif.is_read && (
                  <button
                    onClick={() => onReadNotification(notif.id)}
                    className="p-1 text-neutral-500 hover:text-emerald-400 transition-colors"
                    title="Marcar como lida"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between text-[10px] text-neutral-500">
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(notif.detected_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                </span>

                <button
                  onClick={() => {
                    onReadNotification(notif.id);
                    onOpenChapter(notif.chapter_id);
                    onClose();
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors flex items-center gap-1"
                >
                  <BookOpen className="w-3 h-3" />
                  <span>Ler Agora</span>
                </button>
              </div>
            </div>
          ))}

          {notifications.length === 0 && (
            <div className="text-center py-16 text-neutral-500 text-xs">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30 text-neutral-400" />
              <p>Nenhuma nova notificação no momento.</p>
              <p className="text-[11px] text-neutral-600 mt-1">O agendador avisará quando novos capítulos forem publicados.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
