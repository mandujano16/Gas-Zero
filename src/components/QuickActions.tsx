import {
  Activity,
  ArrowDownRight,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Scale,
  Sliders,
} from 'lucide-react';
import type { DataSourceMode } from '../types/gas';

interface QuickActionsProps {
  mode: DataSourceMode;
  pct: number;
  simAutoConsume: boolean;
  simSpeed: 'normal' | 'fast';
  onToggleSimAuto: () => void;
  onToggleSpeed: () => void;
  onForceReading: () => void;
  onSimulateConsumption: () => void;
  onSimulateLeak: () => void;
  onSetSimulatedPct: (pct: number) => void;
  onApplyTare: () => void;
  onRegisterRefill: () => void;
}

export function QuickActions({
  mode,
  pct,
  simAutoConsume,
  simSpeed,
  onToggleSimAuto,
  onToggleSpeed,
  onForceReading,
  onSimulateConsumption,
  onSimulateLeak,
  onSetSimulatedPct,
  onApplyTare,
  onRegisterRefill,
}: QuickActionsProps) {
  return (
    <section className="gz-panel gz-actions-panel">
      <div className="gz-actions-main">
        <button
          type="button"
          className="gz-btn"
          onClick={onForceReading}
          title="Consulta el peso actual del sensor sin alterar el nivel"
        >
          <RefreshCw size={15} />
          <span>Forzar lectura</span>
        </button>

        <button type="button" className="gz-btn gz-btn--ghost" onClick={onRegisterRefill}>
          <RotateCcw size={15} />
          <span>Registrar recarga</span>
        </button>

        <button type="button" className="gz-btn gz-btn--subtle" onClick={onApplyTare}>
          <Scale size={15} />
          <span>Aplicar tara</span>
        </button>
      </div>

      {mode === 'simulator' && (
        <div className="gz-sim-controls">
          <div className="gz-sim-head">
            <span className="gz-sim-tag">
              <Sliders size={12} />
              Laboratorio Demo (pruebas sin hardware)
            </span>
            <span className="gz-sim-pct">{pct}%</span>
          </div>

          <label className="gz-slider-row">
            <span>Nivel simulado</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={pct}
              onChange={(e) => onSetSimulatedPct(Number(e.target.value))}
              aria-label="Ajustar porcentaje de gas simulado"
            />
          </label>

          <div className="gz-sim-btns">
            <button type="button" className="gz-mini-btn" onClick={onSimulateConsumption}>
              <ArrowDownRight size={13} />
              Simular consumo (-8%)
            </button>

            <button
              type="button"
              className="gz-mini-btn gz-mini-btn--warn"
              onClick={onSimulateLeak}
            >
              <Activity size={13} />
              Simular fuga (-22%)
            </button>

            <button
              type="button"
              className={`gz-mini-btn ${simAutoConsume ? 'is-active' : ''}`}
              onClick={onToggleSimAuto}
            >
              {simAutoConsume ? <Pause size={13} /> : <Play size={13} />}
              {simAutoConsume ? 'Auto-consumo: ON' : 'Auto-consumo: OFF'}
            </button>

            {simAutoConsume && (
              <button type="button" className="gz-mini-btn" onClick={onToggleSpeed}>
                {simSpeed === 'fast' ? 'Velocidad: Rápida' : 'Velocidad: Normal'}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
