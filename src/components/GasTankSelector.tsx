import { useState, type CSSProperties, type FormEvent } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { GAS_CATALOG, GAS_ORDER, TANK_PRESETS } from '../constants/gases';
import type { GasCode, TankPresetId } from '../types/gas';

interface GasTankSelectorProps {
  gasCode: GasCode;
  tankPresetId: TankPresetId;
  capacityKg: number;
  tareKg: number;
  onSelectGas: (gas: GasCode) => void;
  onSelectPreset: (presetId: Exclude<TankPresetId, 'custom'>) => void;
  onUpdateCustomTank: (capacityKg: number, tareKg: number) => void;
}

export function GasTankSelector({
  gasCode,
  tankPresetId,
  capacityKg,
  tareKg,
  onSelectGas,
  onSelectPreset,
  onUpdateCustomTank,
}: GasTankSelectorProps) {
  const [showCustom, setShowCustom] = useState(tankPresetId === 'custom');
  const [customCap, setCustomCap] = useState(String(capacityKg));
  const [customTare, setCustomTare] = useState(String(tareKg));

  const handleApplyCustom = (e: FormEvent) => {
    e.preventDefault();
    const cap = Number(customCap);
    const tare = Number(customTare);
    if (!Number.isNaN(cap) && !Number.isNaN(tare) && cap > 0 && tare >= 0) {
      onUpdateCustomTank(cap, tare);
    }
  };

  return (
    <section className="gz-panel">
      <div className="gz-selector-group">
        <div className="gz-selector-head">
          <span className="gz-section-label">Tipo de gas</span>
          <span className="gz-section-hint">{GAS_CATALOG[gasCode].application}</span>
        </div>

        <div className="gz-chip-row" role="radiogroup" aria-label="Selector de tipo de gas">
          {GAS_ORDER.map((code) => {
            const g = GAS_CATALOG[code];
            const active = code === gasCode;
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSelectGas(code)}
                className={`gz-chip ${active ? 'is-active' : ''}`}
                style={{ '--chip-accent': g.accent } as CSSProperties}
              >
                <span className="gz-chip-symbol">{g.symbol}</span>
                <span className="gz-chip-name">{g.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="gz-selector-group">
        <div className="gz-selector-head">
          <span className="gz-section-label">Capacidad y tara del cilindro</span>
          <button
            type="button"
            className="gz-link-btn"
            onClick={() => {
              setCustomCap(String(capacityKg));
              setCustomTare(String(tareKg));
              setShowCustom((s) => !s);
            }}
          >
            <SlidersHorizontal size={13} />
            {showCustom ? 'Ocultar manual' : 'Tara / cap. manual'}
          </button>
        </div>

        <div className="gz-chip-row gz-chip-row--tanks">
          {TANK_PRESETS.map((preset) => {
            const active = tankPresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setShowCustom(false);
                  onSelectPreset(preset.id);
                }}
                className={`gz-chip gz-chip--wide ${active ? 'is-active' : ''}`}
              >
                <strong>{preset.label}</strong>
                <span>Tara {preset.tareKg} kg</span>
              </button>
            );
          })}
        </div>

        {showCustom && (
          <form className="gz-custom-tank" onSubmit={handleApplyCustom}>
            <label>
              <span>Capacidad gas (kg)</span>
              <input
                type="number"
                step="0.5"
                min="1"
                max="180"
                value={customCap}
                onChange={(e) => setCustomCap(e.target.value)}
              />
            </label>
            <label>
              <span>Tara cilindro vacío (kg)</span>
              <input
                type="number"
                step="0.5"
                min="0"
                max="150"
                value={customTare}
                onChange={(e) => setCustomTare(e.target.value)}
              />
            </label>
            <button type="submit" className="gz-btn gz-btn--sm">
              Aplicar
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
