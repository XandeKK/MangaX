import React, { useEffect, useState } from 'react';
import { Activity, Globe, RefreshCw, Server } from 'lucide-react';
import { api } from '../services/api';

type RegisteredSource = { id: string; name: string; domains: string[]; allowSubdomains: boolean };
type HealthResult = { id: string; status: 'ok' | 'degraded' | 'offline' | 'registered'; latencyMs: number; error?: string };

export const SourceManagementView: React.FC = () => {
  const [sources, setSources] = useState<RegisteredSource[]>([]);
  const [health, setHealth] = useState<HealthResult[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [registered, diagnostics] = await Promise.all([api.getRegisteredSources(), api.getDiagnostics()]);
      setSources(registered);
      setHealth(diagnostics.health);
    } catch (cause: any) {
      setError(cause.message || 'Could not load supported source adapters.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const statusStyles: Record<HealthResult['status'], string> = {
    ok: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
    degraded: 'text-amber-200 bg-amber-400/10 border-amber-400/20',
    offline: 'text-rose-300 bg-rose-400/10 border-rose-400/20',
    registered: 'text-sky-200 bg-sky-400/10 border-sky-400/20'
  };

  return <section className="space-y-6 animate-fade-in">
    <header className="flex flex-col gap-3 border-b border-neutral-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Supported Sources</h1>
        <p className="mt-1 text-xs text-neutral-400">MangaX chooses a reviewed TypeScript adapter automatically from a manga URL.</p>
      </div>
      <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 self-start rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-50">
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh status
      </button>
    </header>

    {error && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}
    {!loading && sources.length === 0 && <p className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-400">No source adapters are registered.</p>}

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {sources.map(source => {
        const current = health.find(result => result.id === source.id);
        const status = current?.status || 'registered';
        return <article key={source.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300"><Server className="h-4 w-4" /></span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-white">{source.name}</h2>
                <p className="mt-1 text-[11px] text-neutral-500">Adapter: <code>{source.id}</code></p>
              </div>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium capitalize ${statusStyles[status]}`}>{status}</span>
          </div>
          <div className="mt-5 flex items-start gap-2 text-xs text-neutral-300">
            <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" />
            <div>
              <p>{source.domains.join(', ')}</p>
              {source.allowSubdomains && <p className="mt-1 text-[10px] text-neutral-500">Subdomains are supported.</p>}
            </div>
          </div>
          {current && current.status !== 'registered' && <p className="mt-4 flex items-center gap-1.5 text-[10px] text-neutral-500"><Activity className="h-3 w-3" />Latest check: {current.latencyMs} ms</p>}
          {current?.status === 'degraded' && <p className="mt-3 text-xs text-amber-200">The adapter is registered, but its latest service check failed. Review Fontes &amp; Diagnóstico for details.</p>}
          {current?.error && <p className="mt-2 break-words text-[11px] text-rose-300">{current.error}</p>}
        </article>;
      })}
    </div>
    <p className="text-xs text-neutral-500">A website without a registered adapter is reported as unsupported. Adapter implementation and registration are developer tasks.</p>
  </section>;
};
