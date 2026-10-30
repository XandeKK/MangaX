import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Server,
  AlertCircle,
  RefreshCw,
  Globe,
  Terminal,
  Check,
  Loader2,
  BookOpen,
  ExternalLink,
  Layers,
  Zap,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { Manga } from '../types';

export const DiagnosticView: React.FC = () => {
  const [data, setData] = useState<{
    health: { id: string; name: string; status: 'ok' | 'degraded' | 'offline'; latencyMs: number }[];
    security: { totalBlocked: number; recentLogs: { timestamp: number; url: string; reason: string }[] };
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [testUrl, setTestUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Reader health verifier state
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [probeUrl, setProbeUrl] = useState('');
  const [selectedMangaId, setSelectedMangaId] = useState('');
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<{
    ok: boolean;
    chapterTitle: string;
    mangaTitle?: string;
    chapterUrl: string;
    sourceName: string;
    pagesCount: number;
    latencyMs: number;
    proxyWorking: boolean;
    firstPagePreviewUrl: string | null;
    canOpenInNewTab: boolean;
    message: string;
  } | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [res, mangaList] = await Promise.all([
        api.getDiagnostics(),
        api.getMangas()
      ]);
      setData(res);
      setMangas(mangaList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTestUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testUrl.trim()) return;
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await api.previewUrl(testUrl.trim());
      setTestResult(res);
    } catch (err: any) {
      setTestError(err.message || 'Erro durante a extração de teste');
    } finally {
      setTesting(false);
    }
  };

  const handleProbeReader = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!probeUrl.trim() && !selectedMangaId) {
      setProbeError('Por favor, informe uma URL de capítulo ou selecione uma obra da biblioteca.');
      return;
    }

    setProbing(true);
    setProbeResult(null);
    setProbeError(null);

    try {
      let payload: { chapterId?: string; url?: string } = {};

      if (selectedMangaId && !probeUrl.trim()) {
        // Fetch manga details to get first chapter
        const details = await api.getManga(selectedMangaId);
        if (details.chapters.length > 0) {
          payload.chapterId = details.chapters[0].id;
        } else {
          throw new Error('Esta obra selecionada não possui capítulos identificados.');
        }
      } else {
        payload.url = probeUrl.trim();
      }

      const res = await api.probeReader(payload);
      setProbeResult(res);
    } catch (err: any) {
      setProbeError(err.message || 'Falha ao testar leitor');
    } finally {
      setProbing(false);
    }
  };

  const handleOpenInNewTab = (url?: string) => {
    const targetUrl = url || probeResult?.chapterUrl;
    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Diagnóstico de Fontes &amp; Integridade do Leitor</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Status dos extratores, telemetria de latência, verificação heurística do leitor e proteção anti-anúncios
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-neutral-700 transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar Diagnóstico</span>
        </button>
      </div>

      {/* Reader Health & Heuristic Verifier */}
      <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Verificador de Integridade do Reader &amp; Heurísticas</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
                  MangaX Engine
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Testa a capacidade do leitor em extrair páginas de capítulos, valida o proxy de imagens e ativa heurísticas inteligentes quando necessário.
              </p>
            </div>
          </div>
        </div>

        {/* Input & Selector Form */}
        <form onSubmit={handleProbeReader} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                URL do Capítulo ou MangaDex UUID / ID
              </label>
              <input
                type="text"
                placeholder="Ex: https://mangadex.org/chapter/uuid ou URL de capítulo genérico"
                value={probeUrl}
                onChange={(e) => {
                  setProbeUrl(e.target.value);
                  if (e.target.value) setSelectedMangaId('');
                }}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                Ou Selecione da Sua Biblioteca
              </label>
              <select
                value={selectedMangaId}
                onChange={(e) => {
                  setSelectedMangaId(e.target.value);
                  if (e.target.value) setProbeUrl('');
                }}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="">-- Selecionar obra salva --</option>
                {mangas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.type.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Heurística adaptativa de HTML (multi-atributos &amp; scripts deep-scan) ativa por padrão</span>
            </div>

            <button
              type="submit"
              disabled={probing}
              className="px-4 py-2 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
            >
              {probing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>{probing ? 'Diagnosticando Leitor...' : 'Verificar Funcionamento do Reader'}</span>
            </button>
          </div>
        </form>

        {/* Error message */}
        {probeError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Falha na verificação do leitor</p>
              <p className="text-neutral-400">{probeError}</p>
            </div>
          </div>
        )}

        {/* Probe Diagnostic Card Result */}
        {probeResult && (
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <span className={`w-3 h-3 rounded-full shrink-0 ${probeResult.ok ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-rose-500 shadow-sm shadow-rose-500/50'}`} />
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    <span>{probeResult.chapterTitle || 'Capítulo Analisado'}</span>
                    {probeResult.mangaTitle && (
                      <span className="text-neutral-400 font-normal">({probeResult.mangaTitle})</span>
                    )}
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Fonte: <span className="text-neutral-200 font-medium">{probeResult.sourceName}</span> &bull; Status do Leitor:{' '}
                    <span className={`font-semibold ${probeResult.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {probeResult.ok ? 'Totalmente Operacional' : 'Incompatível / Parcial'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {probeResult.chapterUrl && (
                  <button
                    onClick={() => handleOpenInNewTab()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 hover:text-white rounded-lg border border-neutral-700 transition-colors"
                    title="Abre a fonte original diretamente em uma nova aba do navegador"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                    <span>Abrir na Fonte Original (Nova Aba)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Diagnostic Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800">
                <span className="text-[11px] text-neutral-400 block mb-0.5">Páginas Extraídas</span>
                <span className="text-sm font-bold font-mono text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  {probeResult.pagesCount} páginas
                </span>
              </div>

              <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800">
                <span className="text-[11px] text-neutral-400 block mb-0.5">Proxy de Imagens</span>
                <span className={`text-xs font-bold ${probeResult.proxyWorking ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {probeResult.proxyWorking ? 'Ativo & Bypass OK' : 'Em Teste'}
                </span>
              </div>

              <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800">
                <span className="text-[11px] text-neutral-400 block mb-0.5">Latência do Reader</span>
                <span className="text-sm font-bold font-mono text-neutral-200">
                  {probeResult.latencyMs}ms
                </span>
              </div>

              <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800">
                <span className="text-[11px] text-neutral-400 block mb-0.5">Heurística Embutida</span>
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Ativa &amp; Resiliente
                </span>
              </div>
            </div>

            {/* Diagnostic Message */}
            <div className={`p-3 rounded-lg text-xs flex items-center justify-between ${
              probeResult.ok ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
            }`}>
              <div className="flex items-center gap-2">
                {probeResult.ok ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                <span>{probeResult.message}</span>
              </div>

              {!probeResult.ok && probeResult.chapterUrl && (
                <button
                  onClick={() => handleOpenInNewTab()}
                  className="underline font-semibold ml-2 text-amber-400 hover:text-amber-300 shrink-0"
                >
                  Abrir no site da fonte &rarr;
                </button>
              )}
            </div>

            {/* First Page Preview if available */}
            {probeResult.firstPagePreviewUrl && (
              <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800 flex items-center gap-4">
                <img
                  src={probeResult.firstPagePreviewUrl}
                  alt="Prévia da página 1"
                  className="w-14 h-20 object-cover rounded bg-neutral-950 border border-neutral-800 shadow"
                />
                <div className="text-xs space-y-1">
                  <span className="font-semibold text-white">Prévia da Página 1 renderizada com sucesso</span>
                  <p className="text-neutral-400">
                    O pipeline de proxy do MangaX foi capaz de carregar e renderizar os dados da imagem sem bloqueio por CORS ou Referer.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sources Health Cards */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-amber-400" />
          <span>Status de Conexão com os Motores de Fontes</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data?.health.map((h) => (
            <div key={h.id} className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white">{h.name}</h3>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                    h.status === 'ok' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                  }`}>
                    {h.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">ID do Extrator: <span className="font-mono text-neutral-300">{h.id}</span></p>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
                <span>Latência de resposta:</span>
                <span className="font-mono tabular-nums text-neutral-200 font-semibold">{h.latencyMs}ms</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security & Ad-Protection Telemetry */}
      <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Módulo de Proteção contra Anúncios &amp; Pop-ups</h2>
              <p className="text-xs text-neutral-400">Inspirado no FRANK Scanlation: intercepta e bloqueia redirecionamentos predatórios</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-neutral-400">Total de ameaças neutralizadas:</span>
            <p className="text-lg font-bold font-mono text-emerald-400">{data?.security.totalBlocked || 0}</p>
          </div>
        </div>

        {/* Recent block logs */}
        <div className="pt-2">
          <h3 className="text-xs font-semibold text-neutral-300 mb-2">Últimos Eventos Bloqueados</h3>
          <div className="max-h-48 overflow-y-auto space-y-1.5 bg-neutral-950 p-3 rounded-xl border border-neutral-800 text-xs font-mono">
            {data?.security.recentLogs && data.security.recentLogs.length > 0 ? (
              data.security.recentLogs.map((log, i) => (
                <div key={i} className="flex items-start justify-between gap-4 text-neutral-400 py-1 border-b border-neutral-800/50 last:border-0">
                  <span className="text-rose-400 shrink-0">[BLOQUEADO]</span>
                  <span className="truncate flex-1 text-neutral-300">{log.url}</span>
                  <span className="text-neutral-500 shrink-0">{log.reason}</span>
                </div>
              ))
            ) : (
              <div className="text-neutral-500 text-center py-4 text-xs font-sans">
                Nenhum redirecionamento invasivo detectado recentemente. O leitor está seguro.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Extractor Tester Console */}
      <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white">Console de Teste de Extração de URLs</h2>
        </div>
        <p className="text-xs text-neutral-400">
          Valide a extração de metadados e capítulos de qualquer URL antes de cadastrar uma nova obra.
        </p>

        <form onSubmit={handleTestUrl} className="flex gap-2">
          <input
            type="text"
            required
            placeholder="Cole uma URL ou MangaDex UUID (ex: 32d76d19-8a05-4db0-9fc2-e0b0648fe9d0)"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={testing}
            className="px-4 py-2 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
            <span>Testar Extração</span>
          </button>
        </form>

        {testError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{testError}</span>
          </div>
        )}

        {testResult && (
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-xs space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <Check className="w-4 h-4" />
              <span>Extração bem-sucedida via motor: {testResult.sourceName}</span>
            </div>
            <pre className="p-3 bg-neutral-900 rounded-lg text-neutral-300 overflow-x-auto text-[11px] font-mono">
              {JSON.stringify(testResult.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>

    </div>
  );
};
