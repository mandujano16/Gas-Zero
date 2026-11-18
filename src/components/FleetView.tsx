import { useState, type CSSProperties, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Flame,
  MapPin,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { GAS_CATALOG, GAS_ORDER, TANK_PRESETS } from '../constants/gases';
import { getAlertLevel } from '../hooks/useGasZero';
import type {
  AlertThresholds,
  CylinderState,
  GasCode,
  NewCylinderInput,
  TankPresetId,
} from '../types/gas';

interface FleetViewProps {
  cylinders: CylinderState[];
  activeCylinderId: string;
  thresholds: AlertThresholds;
  fleetSummary: {
    total: number;
    ok: number;
    warn: number;
    danger: number;
    alertsCount: number;
  };
  onSelectCylinder: (id: string) => void;
  onAddCylinder: (input: NewCylinderInput) => void;
  onDeleteCylinder: (id: string) => void;
}

export function FleetView({
  cylinders,
  activeCylinderId,
  thresholds,
  fleetSummary,
  onSelectCylinder,
  onAddCylinder,
  onDeleteCylinder,
}: FleetViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [location, setLocation] = useState('');
  const [gasCode, setGasCode] = useState<GasCode>('N2');
  const [presetId, setPresetId] = useState<Exclude<TankPresetId, 'custom'>>('medium');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const preset = TANK_PRESETS.find((t) => t.id === presetId) ?? TANK_PRESETS[1];
    const nextNumber = String(cylinders.length + 1).padStart(3, '0');
    onAddCylinder({
      label: label.trim() || `Cilindro #${nextNumber}`,
      location: location.trim() || 'Área general',
      gasCode,
      tankPresetId: preset.id,
      capacityKg: preset.capacityKg,
      tareKg: preset.tareKg,
    });
    setLabel('');
    setLocation('');
    setShowForm(false);
  };

  return (
    <div className="gz-view-stack">
      <div className="gz-stats-grid">
        <div className="gz-stat-card">
          <div className="gz-stat-head">
            <span>Total cilindros</span>
          </div>
          <strong className="gz-stat-value">{fleetSummary.total}</strong>
        </div>

        <div className="gz-stat-card">
          <div className="gz-stat-head gz-text-ok">
            <CheckCircle2 size={14} />
            <span>Óptimos</span>
          </div>
          <strong className="gz-stat-value">{fleetSummary.ok}</strong>
        </div>

        <div className="gz-stat-card">
          <div className="gz-stat-head gz-text-warn">
            <AlertTriangle size={14} />
            <span>Nivel bajo</span>
          </div>
          <strong className="gz-stat-value">{fleetSummary.warn}</strong>
        </div>

        <div className="gz-stat-card">
          <div className="gz-stat-head gz-text-danger">
            <Flame size={14} />
            <span>Críticos</span>
          </div>
          <strong className="gz-stat-value">{fleetSummary.danger}</strong>
        </div>
      </div>

      <section className="gz-panel">
        <div className="gz-panel-head">
          <div>
            <h2>Flota de cilindros monitoreados</h2>
            <p className="gz-subcopy">
              Selecciona cualquier cilindro para abrir su monitor en vivo y su historial.
            </p>
          </div>
          <button
            type="button"
            className="gz-btn gz-btn--sm"
            onClick={() => setShowForm((s) => !s)}
          >
            {showForm ? <X size={15} /> : <Plus size={15} />}
            <span>{showForm ? 'Cancelar' : 'Nuevo cilindro'}</span>
          </button>
        </div>

        {showForm && (
          <form className="gz-new-cyl-form" onSubmit={handleSubmit}>
            <div className="gz-form-grid-2">
              <label className="gz-field">
                <span>Nombre o código</span>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={`Ej. Cilindro #${String(cylinders.length + 1).padStart(3, '0')}`}
                />
              </label>

              <label className="gz-field">
                <span>Ubicación / estación</span>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ej. Laboratorio, Cocina, Taller B"
                />
              </label>
            </div>

            <div className="gz-field">
              <span>Tipo de gas</span>
              <div className="gz-chip-row">
                {GAS_ORDER.map((code) => {
                  const g = GAS_CATALOG[code];
                  return (
                    <button
                      key={code}
                      type="button"
                      className={`gz-chip ${gasCode === code ? 'is-active' : ''}`}
                      style={{ '--chip-accent': g.accent } as CSSProperties}
                      onClick={() => setGasCode(code)}
                    >
                      <span className="gz-chip-symbol">{g.symbol}</span>
                      <span className="gz-chip-name">{g.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="gz-field">
              <span>Tamaño inicial del tanque</span>
              <div className="gz-chip-row gz-chip-row--tanks">
                {TANK_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`gz-chip gz-chip--wide ${presetId === preset.id ? 'is-active' : ''}`}
                    onClick={() => setPresetId(preset.id)}
                  >
                    <strong>{preset.label}</strong>
                    <span>Tara {preset.tareKg} kg</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="gz-form-footer">
              <button type="submit" className="gz-btn gz-btn--sm">
                <Plus size={15} />
                <span>Guardar y monitorear</span>
              </button>
            </div>
          </form>
        )}

        <div className="gz-fleet-grid">
          {cylinders.map((cyl) => {
            const gas = GAS_CATALOG[cyl.gasCode];
            const level = getAlertLevel(cyl.pct, thresholds);
            const isActive = cyl.id === activeCylinderId;
            const statusColor =
              level === 'danger'
                ? 'var(--danger)'
                : level === 'warn'
                ? 'var(--warn)'
                : 'var(--ok)';

            return (
              <article
                key={cyl.id}
                className={`gz-fleet-card ${isActive ? 'is-active' : ''}`}
                style={{ '--chip-accent': gas.accent } as CSSProperties}
              >
                <div className="gz-fleet-card-top">
                  <button
                    type="button"
                    className="gz-fleet-select"
                    onClick={() => onSelectCylinder(cyl.id)}
                  >
                    <div className="gz-fleet-title-row">
                      <span className="gz-fleet-dot" style={{ background: gas.accent }} />
                      <strong>{cyl.label}</strong>
                      {isActive && <span className="gz-active-pill">Activo</span>}
                    </div>
                    <span className="gz-fleet-loc">
                      <MapPin size={12} />
                      {cyl.location} · {gas.name} ({gas.symbol})
                    </span>
                  </button>

                  {cylinders.length > 1 && (
                    <button
                      type="button"
                      className="gz-icon-danger"
                      title={`Eliminar ${cyl.label}`}
                      aria-label={`Eliminar ${cyl.label}`}
                      onClick={() => onDeleteCylinder(cyl.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="gz-fleet-body"
                  onClick={() => onSelectCylinder(cyl.id)}
                >
                  <div className="gz-fleet-nums">
                    <span className="gz-fleet-pct" style={{ color: statusColor }}>
                      {cyl.pct}%
                    </span>
                    <span className="gz-fleet-kg">
                      {cyl.netKg.toFixed(1)} / {cyl.capacityKg.toFixed(0)} kg
                    </span>
                  </div>

                  <div className="gz-fleet-bar-track">
                    <div
                      className="gz-fleet-bar-fill"
                      style={{
                        width: `${Math.max(3, cyl.pct)}%`,
                        background: statusColor,
                        boxShadow: `0 0 12px ${statusColor}`,
                      }}
                    />
                  </div>
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
