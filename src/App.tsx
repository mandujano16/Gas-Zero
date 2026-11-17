import { useState, type CSSProperties } from 'react';
import { BarChart3, Bluetooth, Gauge, Lightbulb, Radio } from 'lucide-react';
import { Esp32Console } from './components/Esp32Console';
import { GasTankSelector } from './components/GasTankSelector';
import { GaugeCard } from './components/GaugeCard';
import { HeaderBar } from './components/HeaderBar';
import { HistoryView } from './components/HistoryView';
import { QuickActions } from './components/QuickActions';
import { SettingsBleView } from './components/SettingsBleView';
import { TipsView } from './components/TipsView';
import { useGasZero } from './hooks/useGasZero';
import type { NavTab } from './types/gas';

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: typeof Gauge }> = [
  { id: 'inicio', label: 'Inicio', icon: Gauge },
  { id: 'historial', label: 'Historial', icon: BarChart3 },
  { id: 'ahorrar', label: 'Ahorrar gas', icon: Lightbulb },
  { id: 'conexion', label: 'BLE / Ajustes', icon: Bluetooth },
];

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('inicio');
  const gz = useGasZero();

  return (
    <div
      className="gz-shell"
      style={{ '--gas-accent': gz.gasConfig.accent } as CSSProperties}
    >
      {/* Sidebar fijo en escritorio */}
      <aside className="gz-sidebar" aria-label="Navegación principal">
        <div className="gz-brand">
          <div className="gz-brand-mark" aria-hidden="true">
            <span />
          </div>
          <div>
            <strong>Gas-Zero</strong>
            <span>Báscula IoT · v1.0</span>
          </div>
        </div>

        <nav className="gz-side-nav">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`gz-side-link ${activeTab === id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="gz-side-footer">
          <div className="gz-side-summary">
            <span className="gz-side-label">Cilindro activo</span>
            <strong>{gz.config.cylinderLabel}</strong>
            <div className="gz-side-meta">
              <span>{gz.gasConfig.symbol} · {gz.gasConfig.name}</span>
              <strong className="gz-mono">{gz.pct}%</strong>
            </div>
          </div>
        </div>
      </aside>

      {/* Contenedor principal con halo dinámico */}
      <main className="gz-main">
        <div className="gz-card-frame">
          <HeaderBar
            cylinderLabel={gz.config.cylinderLabel}
            mode={gz.mode}
            connectionStatus={gz.connectionStatus}
            bleDeviceName={gz.bleDeviceName}
            onOpenConnection={() => setActiveTab('conexion')}
          />

          {gz.mode === 'simulator' && (
            <div className="gz-simbadge">
              <Radio size={14} />
              <span>Datos simulados — sin hardware físico ESP32 conectado aún</span>
            </div>
          )}

          {/* Barra de pestañas visible en móvil/tablet */}
          <nav className="gz-tabs" aria-label="Secciones">
            {NAV_ITEMS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`gz-tab ${activeTab === id ? 'is-active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          {activeTab === 'inicio' && (
            <div className="gz-dashboard-grid">
              <div className="gz-col-primary">
                <GaugeCard
                  pct={gz.pct}
                  weightKg={gz.weightKg}
                  netKg={gz.netKg}
                  tareKg={gz.config.tareKg}
                  capacityKg={gz.config.capacityKg}
                  autonomyDays={gz.autonomyDays}
                  alertLevel={gz.alertLevel}
                  gasConfig={gz.gasConfig}
                />

                <QuickActions
                  mode={gz.mode}
                  simRunning={gz.simRunning}
                  simSpeed={gz.simSpeed}
                  onToggleSim={() => gz.setSimRunning((v) => !v)}
                  onToggleSpeed={() =>
                    gz.setSimSpeed((s) => (s === 'normal' ? 'fast' : 'normal'))
                  }
                  onForceReading={gz.forceReading}
                  onSimulateLeak={gz.simulateLeak}
                  onApplyTare={gz.applyTare}
                  onRegisterRefill={gz.registerRefill}
                />
              </div>

              <div className="gz-col-secondary">
                <GasTankSelector
                  gasCode={gz.config.gasCode}
                  tankPresetId={gz.config.tankPresetId}
                  capacityKg={gz.config.capacityKg}
                  tareKg={gz.config.tareKg}
                  onSelectGas={gz.selectGas}
                  onSelectPreset={gz.selectTankPreset}
                  onUpdateCustomTank={gz.updateCustomTank}
                />

                <Esp32Console logs={gz.logs} lastRawJson={gz.lastRawJson} />
              </div>
            </div>
          )}

          {activeTab === 'historial' && (
            <HistoryView
              history={gz.history}
              events={gz.events}
              thresholds={gz.config.thresholds}
              avgDailyConsumptionKg={gz.avgDailyConsumptionKg}
              consumedSessionKg={gz.consumedSessionKg}
              simElapsedHours={gz.simElapsedHours}
              refillCount={gz.refillCount}
              onExportCsv={gz.exportHistoryCsv}
            />
          )}

          {activeTab === 'ahorrar' && (
            <TipsView gasConfig={gz.gasConfig} autonomyDays={gz.autonomyDays} />
          )}

          {activeTab === 'conexion' && (
            <SettingsBleView
              mode={gz.mode}
              connectionStatus={gz.connectionStatus}
              connectionDetail={gz.connectionDetail}
              bleDeviceName={gz.bleDeviceName}
              bleSupported={gz.bleSupported}
              cylinderLabel={gz.config.cylinderLabel}
              thresholds={gz.config.thresholds}
              serviceUuid={gz.config.serviceUuid}
              telemetryUuid={gz.config.telemetryUuid}
              commandUuid={gz.config.commandUuid}
              onConnectBle={() => void gz.connectBle()}
              onDisconnectBle={gz.disconnectBle}
              onSwitchToSimulator={gz.switchToSimulator}
              onUpdateCylinderLabel={gz.updateCylinderLabel}
              onUpdateThresholds={gz.updateThresholds}
              onUpdateBleUuids={gz.updateBleUuids}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
