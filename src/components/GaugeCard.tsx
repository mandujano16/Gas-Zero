import { AlertTriangle, CheckCircle2, Flame } from 'lucide-react';
import type { AlertLevel, GasConfig } from '../types/gas';

interface GaugeCardProps {
  pct: number;
  weightKg: number;
  netKg: number;
  tareKg: number;
  capacityKg: number;
  autonomyDays: number | null;
  alertLevel: AlertLevel;
  gasConfig: GasConfig;
}

export function GaugeCard({
  pct,
  weightKg,
  netKg,
  tareKg,
  capacityKg,
  autonomyDays,
  alertLevel,
  gasConfig,
}: GaugeCardProps) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(100, Math.max(0, pct));
  const strokeOffset = circumference * (1 - clampedPct / 100);

  const statusColor =
    alertLevel === 'danger'
      ? 'var(--danger)'
      : alertLevel === 'warn'
      ? 'var(--warn)'
      : 'var(--ok)';

  const statusLabel =
    alertLevel === 'danger'
      ? 'Crítico'
      : alertLevel === 'warn'
      ? 'Nivel bajo'
      : 'Óptimo';

  return (
    <section className="gz-panel gz-gauge-panel" aria-label="Nivel de gas en tiempo real">
      <div className="gz-panel-head">
        <div className="gz-gas-pill">
          <span className="gz-gas-dot" />
          <strong>
            {gasConfig.name} ({gasConfig.symbol})
          </strong>
          <span className="gz-gas-cat">{gasConfig.category}</span>
        </div>
        <span className={`gz-status-tag gz-status-tag--${alertLevel}`}>
          {alertLevel === 'ok' ? (
            <CheckCircle2 size={13} />
          ) : alertLevel === 'warn' ? (
            <AlertTriangle size={13} />
          ) : (
            <Flame size={13} />
          )}
          {statusLabel}
        </span>
      </div>

      <div className="gz-gauge-body">
        {/* Visual combinada: Anillo SVG (prototipo) + Cilindro interactivo */}
        <div className="gz-visual-pair">
          <div className="gz-gauge-wrap">
            <svg viewBox="0 0 120 120" className="gz-gauge-svg" role="img" aria-label={`${clampedPct}% gas restante`}>
              <circle cx="60" cy="60" r={radius} className="gz-gauge-track" />
              <circle
                cx="60"
                cy="60"
                r={radius}
                className="gz-gauge-fill"
                style={{
                  stroke: statusColor,
                  strokeDasharray: `${circumference.toFixed(1)}`,
                  strokeDashoffset: `${strokeOffset.toFixed(1)}`,
                }}
              />
            </svg>
            <div className="gz-gauge-center">
              <span className="gz-gauge-pct">{clampedPct}%</span>
              <span className="gz-gauge-sub">gas restante</span>
            </div>
          </div>

          <div className="gz-cylinder-wrap" aria-hidden="true">
            <div className="gz-cyl-valve" />
            <div className="gz-cyl-neck" />
            <div className="gz-cyl-body">
              <div
                className="gz-cyl-liquid"
                style={{
                  height: `${Math.max(3, clampedPct)}%`,
                  background: `linear-gradient(180deg, ${statusColor}, color-mix(in srgb, ${statusColor} 55%, #0C0A13))`,
                  boxShadow: `0 0 18px color-mix(in srgb, ${statusColor} 60%, transparent)`,
                }}
              />
              <span className="gz-cyl-symbol">{gasConfig.symbol}</span>
            </div>
          </div>
        </div>

        {/* Métricas numéricas principales */}
        <div className="gz-readout-block">
          <div className="gz-readout-hero">
            <span className="gz-readout-big">{weightKg.toFixed(2)} kg</span>
            <span className="gz-readout-caption">peso bruto leído por sensor HX711</span>
          </div>

          <div className="gz-metrics-grid">
            <div className="gz-metric-box">
              <span className="gz-metric-label">Gas restante</span>
              <strong className="gz-metric-val">{netKg.toFixed(2)} kg</strong>
            </div>
            <div className="gz-metric-box">
              <span className="gz-metric-label">Tara del tanque</span>
              <strong className="gz-metric-val">{tareKg.toFixed(2)} kg</strong>
            </div>
            <div className="gz-metric-box">
              <span className="gz-metric-label">Capacidad nominal</span>
              <strong className="gz-metric-val">{capacityKg.toFixed(2)} kg</strong>
            </div>
            <div className="gz-metric-box">
              <span className="gz-metric-label">Autonomía estimada</span>
              <strong className="gz-metric-val">
                {autonomyDays !== null ? `${autonomyDays.toFixed(1)} días` : 'calculando…'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {alertLevel === 'warn' && (
        <div className="gz-alert gz-alert--warn" role="status">
          <AlertTriangle size={16} />
          <span>Nivel bajo. Considera programar una recarga pronto.</span>
        </div>
      )}

      {alertLevel === 'danger' && (
        <div className="gz-alert gz-alert--danger" role="alert">
          <AlertTriangle size={16} />
          <span>Nivel crítico. Prepara el reemplazo o recarga del cilindro de inmediato.</span>
        </div>
      )}
    </section>
  );
}
