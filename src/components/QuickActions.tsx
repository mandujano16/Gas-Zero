import { Activity, Pause, Play, RotateCcw, Scale, Zap } from 'lucide-react';
import type { DataSourceMode } from '../types/gas';

interface QuickActionsProps {
  mode: DataSourceMode;
  simRunning: boolean;
  simSpeed: 'normal' | 'fast';
  onToggleSim: () => void;
  onToggleSpeed: () => void;
  onForceReading: () => void;
  onSimulateLeak: () => void;
  onApplyTare: () => void;
  onRegisterRefill: () => void;
}

export function QuickActions({
  mode,
  simRunning,
  simSpeed,
  onToggleSim,
  onToggleSpeed,
  onForceReading,
  onSimulateLeak,
  onApplyTare,
  onRegisterRefill,
}: QuickActionsProps) {
  return (
    <section className="gz-panel gz-actions-panel">
      <div className="gz-actions-main">
        <button type="button" className="gz-btn" onClick={onForceReading}>
          <Zap size={16} />
          <span>Forzar lectura</span>
        </button>

        <button type="button" className="gz-btn gz-btn--ghost" onClick={onRegisterRefill}>
          <RotateCcw size={16} />
          <span>Registrar recarga / cambio</span>
        </button>

        <button type="button" className="gz-btn gz-btn--subtle" onClick={onApplyTare}>
          <Scale size={15} />
          <span>Aplicar tara</span>
        </button>
      </div>

      {mode === 'simulator' && (
        <div className="gz-sim-controls">
          <span className="gz-sim-tag">Controles del simulador</span>
          <div className="gz-sim-btns">
            <button type="button" className="gz-mini-btn" onClick={onToggleSim}>
              {simRunning ? <Pause size={13} /> : <Play size={13} />}
              {simRunning ? 'Pausar consumo' : 'Reanudar'}
            </button>
            <button type="button" className="gz-mini-btn" onClick={onToggleSpeed}>
              Velocidad: {simSpeed === 'fast' ? 'Rápida (2s)' : 'Normal (5s)'}
            </button>
            <button type="button" className="gz-mini-btn gz-mini-btn--warn" onClick={onSimulateLeak}>
              <Activity size={13} />
              Simular consumo alto
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
