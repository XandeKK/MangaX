import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, Clock, CheckCircle2, AlertCircle, Layers, Bell, Server, Settings2, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { MonitoringStatus, CheckLog } from '../types';

export const MonitoringView: React.FC = () => {
  const [status, setStatus] = useState<MonitoringStatus | null>(null);
  const [logs, setLogs] = useState<CheckLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningManual, setRunningManual] = useState(false);
  const [manualResult, setManualResult] = useState<string | null>(null);

  // Settings
  const [intervalMin, setIntervalMin] = useState(30);
  const [concurrency, setConcurrency] = useState(3);
  const [notifsEnabled, setNotifsEnabled] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  const loadData = async () => {
    try {
      const [s, l] = await Promise.all([
        api.getMonitorStatus(),
        api.getMonitorLogs()
      ]);
      setStatus(s);
      setLogs(l);
      setIntervalMin(s.checkIntervalMinutes);
      setConcurrency(s.concurrencyLimit);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRunManual = async () => {
    setRunningManual(true);
    setManualResult(null);
    try {
      const res = await api.runMonitor();
      setManualResult(
        `Ciclo concluído: ${res.checkedCount} fontes verificadas, ${res.newChaptersCount} novos capítulos identificados.`
      );
      await loadData();
    } catch (err: any) {
      setManualResult('Falha na execução: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setRunningManual(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setConfigSuccess(false);
    try {
      await api.updateMonitorConfig({
        intervalMinutes: intervalMin,
        concurrency,
        notificationsEnabled: notifsEnabled
      });
      setConfigSuccess(true);
      await loadData();
      setTimeout(() => setConfigSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center p-12 text-neutral-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-amber-400" />
        <span>Carregando telemetria do monitor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Top Banner and Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Monitoramento Automático</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Agendador em segundo plano com detecção de novos lançamentos e prevenção de duplicatas
          </p>
        </div>

        <button
          onClick={handleRunManual}
          disabled={runningManual}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg shadow-sm transition-colors shrink-0"
        >
          {runningManual ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Verificando fontes...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Verificar Agora</span>
            </>
          )}
        </button>
      </div>

      {manualResult && (
        <div className="p-3.5 rounded-xl bg-amber-400/10 border border-amber-400/20 text-xs text-amber-200 flex items-center justify-between">
          <span>{manualResult}</span>
          <button onClick={() => setManualResult(null)} className="text-amber-400 hover:underline">Dispensar</button>
        </div>
      )}

      {/* Metrics Row (Strict single-level cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Status do Agendador</span>
          </div>
          <p className="text-lg font-bold text-emerald-400">Ativo</p>
          <span className="text-[11px] text-neutral-500">Executando em segundo plano</span>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Obras Rastreadas</span>
          </div>
          <p className="text-lg font-bold text-white font-mono tabular-nums">{status?.totalTrackedMangas || 0}</p>
          <span className="text-[11px] text-neutral-500">{status?.totalSources || 0} fontes cadastradas</span>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
            <Clock className="w-4 h-4 text-neutral-400" />
            <span>Intervalo de Checagem</span>
          </div>
          <p className="text-lg font-bold text-white font-mono tabular-nums">{status?.checkIntervalMinutes} min</p>
          <span className="text-[11px] text-neutral-500">Concorrência máx.: {status?.concurrencyLimit}</span>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
            <CheckCircle2 className="w-4 h-4 text-neutral-400" />
            <span>Última Execução</span>
          </div>
          <p className="text-xs font-medium text-neutral-200 mt-1 line-clamp-1">
            {status?.lastRunTimestamp ? new Date(status.lastRunTimestamp).toLocaleTimeString() : 'Recentemente'}
          </p>
          <span className="text-[11px] text-neutral-500 line-clamp-1">{status?.lastCheckSummary}</span>
        </div>
      </div>

      {/* Configuration & Schedule Tuning */}
      <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800">
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white">Configurações do Agendador de Fontes</h2>
        </div>

        <form onSubmit={handleSaveConfig} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Intervalo entre Verificações</label>
            <select
              value={intervalMin}
              onChange={(e) => setIntervalMin(parseInt(e.target.value, 10))}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white"
            >
              <option value="5">A cada 5 minutos (Mais frequente)</option>
              <option value="15">A cada 15 minutos</option>
              <option value="30">A cada 30 minutos (Recomendado)</option>
              <option value="60">A cada 1 hora</option>
              <option value="180">A cada 3 horas</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Limite de Concorrência</label>
            <select
              value={concurrency}
              onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white"
            >
              <option value="1">1 fonte por vez (Mais seguro / sem sobrecarga)</option>
              <option value="2">2 fontes paralelas</option>
              <option value="3">3 fontes paralelas (Padrão)</option>
              <option value="5">5 fontes paralelas</option>
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <button
              type="submit"
              disabled={isSavingConfig}
              className="w-full py-2 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              {isSavingConfig && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{configSuccess ? 'Salvo com Sucesso!' : 'Atualizar Agendador'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Verification Logs Table */}
      <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Histórico de Verificações das Fontes</h2>
            <p className="text-xs text-neutral-400">Auditoria dos últimos ciclos de monitoramento</p>
          </div>
          <button
            onClick={loadData}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            title="Atualizar logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950/80 text-neutral-400 border-b border-neutral-800 font-medium">
              <tr>
                <th className="py-3 px-4">Horário</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Capítulos Encontrados</th>
                <th className="py-3 px-4">Novos</th>
                <th className="py-3 px-4">Mensagem</th>
                <th className="py-3 px-4 text-right">Duração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-800/30 transition-colors">
                  <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-neutral-400">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {log.status === 'new_chapters' ? (
                      <span className="text-amber-400 font-semibold">Novos Capítulos</span>
                    ) : log.status === 'error' ? (
                      <span className="text-rose-400 font-semibold">Erro</span>
                    ) : (
                      <span className="text-emerald-400 font-medium">OK</span>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums">
                    {log.chapters_found}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums">
                    {log.new_chapters_count > 0 ? (
                      <span className="text-amber-400 font-bold font-mono">+{log.new_chapters_count}</span>
                    ) : (
                      <span className="text-neutral-500">0</span>
                    )}
                  </td>
                  <td className="py-3 px-4 max-w-md truncate text-neutral-400">
                    {log.message}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-500 whitespace-nowrap">
                    {log.duration_ms}ms
                  </td>
                </tr>
              ))}

              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-500 text-xs">
                    Nenhum log registrado ainda. O agendador registrará a cada ciclo de verificação.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
