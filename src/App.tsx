import { useState, type CSSProperties } from 'react';
import {
  BarChart3,
  Gauge,
  Layers,
  Lightbulb,
  Radio,
  Scale,
  Unplug,
  Usb,
} from 'lucide-react';
import { Esp32Console } from './components/Esp32Console';
import { FleetView } from './components/FleetView';
import { GasTankSelector } from './components/GasTankSelector';
import { GaugeCard } from './components/GaugeCard';
import { HeaderBar } from './components/HeaderBar';
import { HistoryView } from './components/HistoryView';
import { QuickActions } from './components/QuickActions';
import { SettingsBleView } from './components/SettingsBleView';
import { TipsView } from './components/TipsView';
import { GAS_CATALOG } from './constants/gases';
import { getAlertLevel, useGasZero } from './hooks/useGasZero';
import type { NavTab } from './types/gas';

const NAV_ITEMS: Array<{ id: NavTab; label: string; shortLabel: string; icon: typeof Gauge }> = [
  { id: 'inicio', label: 'Monitor', shortLabel: 'Monitor', icon: Gauge },
  { id: 'flota', label: 'Flota', shortLabel: 'Flota', icon: Layers },
  { id: 'historial', label: 'Historial', shortLabel: 'Historial', icon: BarChart3 },
  { id: 'ahorrar', label: 'Ahorrar gas', shortLabel: 'Ahorro', icon: Lightbulb },
  { id: 'conexion', label: 'USB / BLE', shortLabel: 'Conexión', icon: Usb },
];

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('inicio');
  const gz = useGasZero();
  const cyl = gz.activeCylinder;

  const handleSelectCylinderAndOpen = (id: string) => {
    gz.selectCylinder(id);
    setActiveTab('inicio');
  };

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
            <span>Báscula IoT · v2.0</span>
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
              <span className="gz-side-link-text">{label}</span>
              {id === 'flota' && gz.fleetSummary.alertsCount > 0 && (
                <span className="gz-nav-badge">{gz.fleetSummary.alertsCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Selector rápido de cilindros en el sidebar */}
        <div className="gz-side-fleet">
          <div className="gz-side-fleet-head">
            <span className="gz-side-label">Cilindros ({gz.cylinders.length})</span>
            <button
              type="button"
              className="gz-link-btn"
              onClick={() => setActiveTab('flota')}
            >
              Ver todos
            </button>
          </div>
          <div className="gz-side-cyl-list">
            {gz.cylinders.map((item) => {
              const gas = GAS_CATALOG[item.gasCode];
              const lvl = getAlertLevel(item.pct, gz.settings.thresholds);
              const isActive = item.id === cyl.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`gz-side-cyl ${isActive ? 'is-active' : ''}`}
                  onClick={() => gz.selectCylinder(item.id)}
                >
                  <span className="gz-side-cyl-dot" style={{ background: gas.accent }} />
                  <span className="gz-side-cyl-name">{item.label}</span>
                  <strong className={`gz-mono gz-lvl-${lvl}`}>{item.pct}%</strong>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Contenedor principal con halo dinámico */}
      <main className="gz-main">
        <div className="gz-card-frame">
          <HeaderBar
            cylinderLabel={cyl.label}
            cylinderLocation={cyl.location}
            mode={gz.mode}
            connectionStatus={gz.connectionStatus}
            bleDeviceName={gz.bleDeviceName}
            soundEnabled={gz.settings.alerts.soundEnabled}
            onToggleSound={gz.toggleSoundAlerts}
            onOpenConnection={() => setActiveTab('conexion')}
          />

          {/* Selector rápido de cilindros en móvil */}
          {gz.cylinders.length > 1 && (
            <div className="gz-mobile-fleet-strip" role="tablist" aria-label="Cambiar cilindro">
              {gz.cylinders.map((item) => {
                const gas = GAS_CATALOG[item.gasCode];
                const isActive = item.id === cyl.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`gz-strip-pill ${isActive ? 'is-active' : ''}`}
                    style={{ '--chip-accent': gas.accent } as CSSProperties}
                    onClick={() => gz.selectCylinder(item.id)}
                  >
                    <span className="gz-side-cyl-dot" style={{ background: gas.accent }} />
                    <span>{item.label}</span>
                    <strong className="gz-mono">{item.pct}%</strong>
                  </button>
                );
              })}
            </div>
          )}

          {gz.mode === 'simulator' || gz.connectionStatus !== 'connected' ? (
            <div className="gz-simbadge" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Radio size={14} />
                {gz.mode === 'simulator'
                  ? 'Modo Demo — conecta tu báscula Arduino UNO por USB para ver el peso real en vivo.'
                  : gz.connectionDetail}
              </span>
              {gz.serialSupported && (
                <button
                  type="button"
                  className="gz-mini-btn gz-mini-btn--primary"
                  onClick={() => void gz.connectSerial()}
                >
                  <Usb size={13} />
                  Conectar Arduino USB
                </button>
              )}
            </div>
          ) : (
            <div className="gz-livebar">
              <span className="gz-livebar-status">
                <span className="gz-live-dot" aria-hidden="true" />
                <strong>{gz.bleDeviceName ?? 'Arduino UNO (USB)'}</strong>
                <span className="gz-livebar-meta">
                  {gz.hardwareTelemetry
                    ? `· ${gz.hardwareTelemetry.packetCount} lecturas`
                    : '· Esperando lecturas…'}
                </span>
              </span>
              <div className="gz-livebar-actions">
                <button type="button" className="gz-mini-btn gz-mini-btn--primary" onClick={gz.applyTare}>
                  <Scale size={13} />
                  Tarear (0 kg)
                </button>
                <button
                  type="button"
                  className="gz-mini-btn"
                  onClick={gz.mode === 'serial' ? gz.disconnectSerial : gz.disconnectBle}
                >
                  <Unplug size={13} />
                  Desconectar
                </button>
              </div>
            </div>
          )}

          {/* Barra de pestañas visible en móvil/tablet */}
          <nav className="gz-tabs" aria-label="Secciones">
            {NAV_ITEMS.map(({ id, shortLabel }) => (
              <button
                key={id}
                type="button"
                className={`gz-tab ${activeTab === id ? 'is-active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                <span>{shortLabel}</span>
                {id === 'flota' && gz.fleetSummary.alertsCount > 0 && (
                  <span className="gz-tab-dot" aria-label="Alertas activas" />
                )}
              </button>
            ))}
          </nav>

          {activeTab === 'inicio' && (
            <div className="gz-dashboard-grid">
              <div className="gz-col-primary">
                <GaugeCard
                  pct={cyl.pct}
                  weightKg={cyl.weightKg}
                  netKg={cyl.netKg}
                  tareKg={cyl.tareKg}
                  capacityKg={cyl.capacityKg}
                  autonomyDays={gz.autonomyDays}
                  alertLevel={gz.alertLevel}
                  gasConfig={gz.gasConfig}
                />

                <QuickActions
                  mode={gz.mode}
                  connectionStatus={gz.connectionStatus}
                  pct={cyl.pct}
                  simAutoConsume={gz.simAutoConsume}
                  simSpeed={gz.simSpeed}
                  onToggleSimAuto={() => gz.setSimAutoConsume((v) => !v)}
                  onToggleSpeed={() =>
                    gz.setSimSpeed((s) => (s === 'normal' ? 'fast' : 'normal'))
                  }
                  onForceReading={gz.forceReading}
                  onSimulateConsumption={gz.simulateConsumption}
                  onSimulateLeak={gz.simulateLeak}
                  onSetSimulatedPct={gz.setSimulatedPct}
                  onApplyTare={gz.applyTare}
                  onCalibrateHardware={gz.calibrateHardware}
                  onRegisterRefill={gz.registerRefill}
                />
              </div>

              <div className="gz-col-secondary">
                <GasTankSelector
                  gasCode={cyl.gasCode}
                  tankPresetId={cyl.tankPresetId}
                  capacityKg={cyl.capacityKg}
                  tareKg={cyl.tareKg}
                  onSelectGas={gz.selectGas}
                  onSelectPreset={gz.selectTankPreset}
                  onUpdateCustomTank={gz.updateCustomTank}
                />

                <Esp32Console
                  mode={gz.mode}
                  connectionStatus={gz.connectionStatus}
                  deviceName={gz.bleDeviceName}
                  hardwareTelemetry={gz.hardwareTelemetry}
                  logs={gz.logs}
                  lastRawJson={cyl.lastRawJson}
                />
              </div>
            </div>
          )}

          {activeTab === 'flota' && (
            <FleetView
              cylinders={gz.cylinders}
              activeCylinderId={cyl.id}
              thresholds={gz.settings.thresholds}
              fleetSummary={gz.fleetSummary}
              onSelectCylinder={handleSelectCylinderAndOpen}
              onAddCylinder={(input) => {
                gz.addCylinder(input);
                setActiveTab('inicio');
              }}
              onDeleteCylinder={gz.deleteCylinder}
            />
          )}

          {activeTab === 'historial' && (
            <HistoryView
              history={cyl.history}
              events={cyl.events}
              thresholds={gz.settings.thresholds}
              avgDailyConsumptionKg={gz.avgDailyConsumptionKg}
              consumedSessionKg={cyl.consumedSessionKg}
              simElapsedHours={cyl.monitoredHours}
              refillCount={cyl.refillCount}
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
              serialSupported={gz.serialSupported}
              cylinderLabel={cyl.label}
              cylinderLocation={cyl.location}
              thresholds={gz.settings.thresholds}
              alerts={gz.settings.alerts}
              notificationPermission={gz.notificationPermission}
              serviceUuid={gz.settings.serviceUuid}
              telemetryUuid={gz.settings.telemetryUuid}
              commandUuid={gz.settings.commandUuid}
              onConnectBle={() => void gz.connectBle()}
              onDisconnectBle={gz.disconnectBle}
              onConnectSerial={() => void gz.connectSerial()}
              onDisconnectSerial={gz.disconnectSerial}
              onApplyTare={gz.applyTare}
              onCalibrateHardware={gz.calibrateHardware}
              onSwitchToSimulator={gz.switchToSimulator}
              onUpdateCylinderMeta={gz.updateCylinderMeta}
              onUpdateThresholds={gz.updateThresholds}
              onToggleSoundAlerts={gz.toggleSoundAlerts}
              onToggleBrowserNotifications={() => void gz.toggleBrowserNotifications()}
              onTestAlert={gz.testAlert}
              onUpdateBleUuids={gz.updateBleUuids}
              onResetAllData={gz.resetAllData}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
