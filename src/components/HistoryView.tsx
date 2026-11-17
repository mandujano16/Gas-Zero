import { useState } from 'react';
import { BarChart3, Clock, Download, RefreshCw, TrendingDown } from 'lucide-react';
import type { AlertThresholds, GasEvent, HistoryReading } from '../types/gas';

interface HistoryViewProps {
  history: HistoryReading[];
  events: GasEvent[];
  thresholds: AlertThresholds;
  avgDailyConsumptionKg: number | null;
  consumedSessionKg: number;
  simElapsedHours: number;
  refillCount: number;
  onExportCsv: () => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function HistoryView({
  history,
  events,
  thresholds,
  avgDailyConsumptionKg,
  consumedSessionKg,
  simElapsedHours,
  refillCount,
  onExportCsv,
}: HistoryViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const bars = history.slice(-24);
  const activeReading = bars.find((b) => b.id === hoveredId) ?? bars[bars.length - 1] ?? null;

  const monitoredText =
    simElapsedHours >= 1
      ? `${simElapsedHours.toFixed(1)} h`
      : `${Math.max(1, Math.round(simElapsedHours * 60))} min`;

  return (
    <div className="gz-view-stack">
      <div className="gz-stats-grid">
        <div className="gz-stat-card">
          <div className="gz-stat-head">
            <TrendingDown size={14} />
            <span>Consumo promedio</span>
          </div>
          <strong className="gz-stat-value">
            {avgDailyConsumptionKg !== null ? `${avgDailyConsumptionKg.toFixed(2)} kg/día` : '— kg/día'}
          </strong>
        </div>

        <div className="gz-stat-card">
          <div className="gz-stat-head">
            <BarChart3 size={14} />
            <span>Consumido en esta sesión</span>
          </div>
          <strong className="gz-stat-value">{consumedSessionKg.toFixed(2)} kg</strong>
        </div>

        <div className="gz-stat-card">
          <div className="gz-stat-head">
            <Clock size={14} />
            <span>Tiempo monitoreado</span>
          </div>
          <strong className="gz-stat-value">{monitoredText}</strong>
        </div>

        <div className="gz-stat-card">
          <div className="gz-stat-head">
            <RefreshCw size={14} />
            <span>Recargas registradas</span>
          </div>
          <strong className="gz-stat-value">{refillCount}</strong>
        </div>
      </div>

      <section className="gz-panel">
        <div className="gz-panel-head">
          <div>
            <h2>Nivel de gas por lectura</h2>
            {activeReading && (
              <p className="gz-subcopy">
                {formatTime(activeReading.timestamp)} · <strong>{activeReading.pct}%</strong> (
                {activeReading.netKg.toFixed(2)} kg netos / {activeReading.weightKg.toFixed(2)} kg bruto)
              </p>
            )}
          </div>
          <button type="button" className="gz-mini-btn" onClick={onExportCsv}>
            <Download size={14} />
            Exportar CSV
          </button>
        </div>

        <div className="gz-chart-box" role="img" aria-label="Gráfica de nivel de gas por lectura">
          <div className="gz-bars">
            {bars.map((item) => {
              const barColor =
                item.pct <= thresholds.dangerPct
                  ? 'var(--danger)'
                  : item.pct <= thresholds.warnPct
                  ? 'var(--warn)'
                  : 'var(--ok)';
              const isSelected = activeReading?.id === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`gz-bar-slot ${isSelected ? 'is-selected' : ''}`}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onFocus={() => setHoveredId(item.id)}
                  onClick={() => setHoveredId(item.id)}
                  aria-label={`${item.pct}% a las ${formatTime(item.timestamp)}`}
                >
                  <span
                    className="gz-bar"
                    style={{
                      height: `${Math.max(4, item.pct)}%`,
                      backgroundColor: barColor,
                      color: barColor,
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="gz-panel">
        <div className="gz-panel-head">
          <h2>Eventos</h2>
          <span className="gz-muted-count">{events.length} registrados</span>
        </div>

        <ul className="gz-events-list">
          {events.map((ev) => (
            <li key={ev.id} className={`gz-event-row gz-event-row--${ev.type}`}>
              <span className="gz-event-dot" />
              <div className="gz-event-content">
                <p>{ev.message}</p>
                <time>{formatTime(ev.timestamp)}</time>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
