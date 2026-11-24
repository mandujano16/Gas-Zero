import { useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  Check,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Scale,
  Sliders,
} from 'lucide-react';
import type { ConnectionStatus, DataSourceMode } from '../types/gas';

interface QuickActionsProps {
  mode: DataSourceMode;
  connectionStatus: ConnectionStatus;
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
  onCalibrateHardware: (knownWeightKg: number) => boolean;
  onRegisterRefill: () => void;
}

export function QuickActions({
  mode,
  connectionStatus,
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
  onCalibrateHardware,
  onRegisterRefill,
}: QuickActionsProps) {
  const [taredFeedback, setTaredFeedback] = useState(false);
  const [calibWeight, setCalibWeight] = useState('1.0');
  const [calibFeedback, setCalibFeedback] = useState(false);

  const isHardwareConnected =
    (mode === 'serial' || mode === 'ble') && connectionStatus === 'connected';

  const handleTareClick = () => {
    onApplyTare();
    setTaredFeedback(true);
    window.setTimeout(() => setTaredFeedback(false), 1800);
  };

  const handleCalibrateClick = () => {
    const ok = onCalibrateHardware(Number(calibWeight));
    if (ok) {
      setCalibFeedback(true);
      window.setTimeout(() => setCalibFeedback(false), 2000);
    }
  };

  return (
    <section className="gz-panel gz-actions-panel">
      <div className="gz-actions-main">
        <button
          type="button"
          className="gz-btn"
          onClick={handleTareClick}
          title={
            isHardwareConnected
              ? 'Envía comando TARE al Arduino para poner la báscula en 0.00 kg'
              : 'Pone la báscula en cero / verifica tara del cilindro'
          }
        >
          {taredFeedback ? <Check size={16} /> : <Scale size={16} />}
          <span>{taredFeedback ? '¡Báscula tarada (0 kg)!' : 'Tarear báscula (0 kg)'}</span>
        </button>

        <button
          type="button"
          className="gz-btn gz-btn--ghost"
          onClick={onForceReading}
          title="Consulta el peso actual del sensor sin alterar el nivel"
        >
          <RefreshCw size={15} />
          <span>Forzar lectura</span>
        </button>

        <button type="button" className="gz-btn gz-btn--subtle" onClick={onRegisterRefill}>
          <RotateCcw size={15} />
          <span>Registrar recarga (100%)</span>
        </button>
      </div>

      {isHardwareConnected && (
        <div className="gz-calib-inline">
          <div className="gz-sim-head">
            <span className="gz-sim-tag">
              <Scale size={12} />
              Calibración rápida (guardada en Arduino)
            </span>
          </div>
          <div className="gz-calib-row">
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="150"
              value={calibWeight}
              onChange={(e) => setCalibWeight(e.target.value)}
              aria-label="Peso conocido en kilogramos"
              placeholder="Ej. 1.0 kg"
              className="gz-mono-input"
            />
            <button
              type="button"
              className="gz-btn gz-btn--ghost gz-btn--sm"
              onClick={handleCalibrateClick}
            >
              {calibFeedback ? <Check size={14} /> : <Scale size={14} />}
              <span>{calibFeedback ? 'Calibrando…' : 'Calibrar con este peso (kg)'}</span>
            </button>
          </div>
        </div>
      )}

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
