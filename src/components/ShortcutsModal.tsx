import React from 'react';
import { X, Keyboard, Shield } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space', desc: 'Avançar página ou spread duplo' },
    { key: 'ArrowRight', desc: 'Próxima página (sentido oriental RTL)' },
    { key: 'ArrowLeft', desc: 'Página anterior (sentido oriental RTL)' },
    { key: 'D', desc: 'Alternar modo: Single → Double → Book' },
    { key: 'N', desc: 'Alternar filtro noturno (Desativado → Noturno → Sépia)' },
    { key: 'S', desc: 'Ativar ou desativar scroll snap (Webtoon)' },
    { key: 'Enter', desc: 'Abrir o próximo capítulo' },
    { key: 'Backspace', desc: 'Abrir o capítulo anterior' },
    { key: '?', desc: 'Exibir este guia de atalhos' },
    { key: 'Esc', desc: 'Fechar Reader ou modal' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Atalhos do MangaX Reader</h2>
              <p className="text-xs text-neutral-400">Navegue pelas páginas sem encostar no mouse</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="mt-4 space-y-2.5">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-neutral-800/40 transition-colors text-sm">
              <span className="text-neutral-300">{s.desc}</span>
              <kbd className="px-2.5 py-1 text-xs font-mono font-semibold text-amber-400 bg-neutral-950 border border-neutral-700 rounded-md shadow-sm">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Anti-ad reminder notice */}
        <div className="mt-5 p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 flex items-start gap-2.5 text-xs text-neutral-400">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-neutral-200">Proteção Ativa contra Anúncios:</span> O Reader sanitiza URLs externas, bloqueia popups indesejados e previne redirecionamentos agressivos automaticamente.
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-neutral-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
