import { useState, type FormEvent } from 'react';
import { Bluetooth, BluetoothOff, Check, Cpu, Radio, Sliders } from 'lucide-react';
import type { AlertThresholds, ConnectionStatus, DataSourceMode } from '../types/gas';

interface SettingsBleViewProps {
  mode: DataSourceMode;
  connectionStatus: ConnectionStatus;
  connectionDetail: string;
  bleDeviceName: string | null;
  bleSupported: boolean;
  cylinderLabel: string;
  thresholds: AlertThresholds;
  serviceUuid: string;
  telemetryUuid: string;
  commandUuid: string;
  onConnectBle: () => void;
  onDisconnectBle: () => void;
  onSwitchToSimulator: () => void;
  onUpdateCylinderLabel: (label: string) => void;
  onUpdateThresholds: (thresholds: AlertThresholds) => void;
  onUpdateBleUuids: (service: string, telemetry: string, command: string) => void;
}

export function SettingsBleView({
  mode,
  connectionStatus,
  connectionDetail,
  bleDeviceName,
  bleSupported,
  cylinderLabel,
  thresholds,
  serviceUuid,
  telemetryUuid,
  commandUuid,
  onConnectBle,
  onDisconnectBle,
  onSwitchToSimulator,
  onUpdateCylinderLabel,
  onUpdateThresholds,
  onUpdateBleUuids,
}: SettingsBleViewProps) {
  const [labelDraft, setLabelDraft] = useState(cylinderLabel);
  const [warnDraft, setWarnDraft] = useState(thresholds.warnPct);
  const [dangerDraft, setDangerDraft] = useState(thresholds.dangerPct);
  const [svcDraft, setSvcDraft] = useState(serviceUuid);
  const [telDraft, setTelDraft] = useState(telemetryUuid);
  const [cmdDraft, setCmdDraft] = useState(commandUuid);
  const [savedFlag, setSavedFlag] = useState(false);

  const handleSaveSettings = (e: FormEvent) => {
    e.preventDefault();
    onUpdateCylinderLabel(labelDraft);
    onUpdateThresholds({ warnPct: warnDraft, dangerPct: dangerDraft });
    onUpdateBleUuids(svcDraft, telDraft, cmdDraft);
    setSavedFlag(true);
    window.setTimeout(() => setSavedFlag(false), 1800);
  };

  return (
    <div className="gz-view-stack">
      <section className="gz-panel">
        <div className="gz-panel-head">
          <div className="gz-title-icon">
            <Bluetooth size={16} />
            <h2>Fuente de datos (BLE / Simulador)</h2>
          </div>
          <span className="gz-mono-pill">{mode === 'ble' ? 'MODO HARDWARE BLE' : 'MODO SIMULADOR'}</span>
        </div>

        <p className="gz-subcopy">
          Estado actual: <strong>{connectionDetail}</strong>
          {bleDeviceName ? ` (${bleDeviceName})` : ''}
        </p>

        {!bleSupported && (
          <div className="gz-alert gz-alert--warn">
            <span>
              Este navegador no expone Web Bluetooth API. Para enlazar el ESP32 físico usa Chrome o Edge en Windows, macOS o Android (en HTTPS o localhost).
            </span>
          </div>
        )}

        <div className="gz-ble-actions">
          <button
            type="button"
            className="gz-btn"
            onClick={onConnectBle}
            disabled={!bleSupported || connectionStatus === 'connecting'}
          >
            <Bluetooth size={16} />
            <span>
              {mode === 'ble' && connectionStatus === 'connected'
                ? 'Reconectar ESP32 BLE'
                : 'Escanear y conectar ESP32 (BLE)'}
            </span>
          </button>

          {mode === 'ble' && connectionStatus === 'connected' ? (
            <button type="button" className="gz-btn gz-btn--ghost" onClick={onDisconnectBle}>
              <BluetoothOff size={16} />
              <span>Desconectar BLE</span>
            </button>
          ) : null}

          {mode === 'ble' && (
            <button type="button" className="gz-btn gz-btn--subtle" onClick={onSwitchToSimulator}>
              <Radio size={15} />
              <span>Volver a modo simulador</span>
            </button>
          )}
        </div>
      </section>

      <form className="gz-panel gz-settings-form" onSubmit={handleSaveSettings}>
        <div className="gz-panel-head">
          <div className="gz-title-icon">
            <Sliders size={16} />
            <h2>Cilindro y alertas de umbral</h2>
          </div>
        </div>

        <div className="gz-form-grid">
          <label className="gz-field">
            <span>Nombre / ID del cilindro</span>
            <input
              type="text"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              placeholder="Ej. Cilindro #001 · Taller"
            />
          </label>

          <label className="gz-field">
            <span>Alerta nivel bajo (%)</span>
            <input
              type="number"
              min={5}
              max={50}
              value={warnDraft}
              onChange={(e) => setWarnDraft(Number(e.target.value))}
            />
          </label>

          <label className="gz-field">
            <span>Alerta crítica (%)</span>
            <input
              type="number"
              min={1}
              max={45}
              value={dangerDraft}
              onChange={(e) => setDangerDraft(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="gz-divider" />

        <div className="gz-panel-head">
          <div className="gz-title-icon">
            <Cpu size={16} />
            <h2>Contrato GATT BLE para futuro firmware ESP32</h2>
          </div>
        </div>

        <div className="gz-form-stack">
          <label className="gz-field">
            <span>Service UUID</span>
            <input
              type="text"
              className="gz-mono-input"
              value={svcDraft}
              onChange={(e) => setSvcDraft(e.target.value)}
            />
          </label>

          <label className="gz-field">
            <span>Telemetry Characteristic UUID (Notify · JSON ESP32 → App)</span>
            <input
              type="text"
              className="gz-mono-input"
              value={telDraft}
              onChange={(e) => setTelDraft(e.target.value)}
            />
          </label>

          <label className="gz-field">
            <span>Command Characteristic UUID (Write · JSON App → ESP32)</span>
            <input
              type="text"
              className="gz-mono-input"
              value={cmdDraft}
              onChange={(e) => setCmdDraft(e.target.value)}
            />
          </label>
        </div>

        <div className="gz-contract-box">
          <span className="gz-json-label">Formato JSON esperado del ESP32:</span>
          <code>{'{"weight":32.0, "tare":12.0, "net":20.0, "pct":100, "gas":"N2"}'}</code>
        </div>

        <div className="gz-form-footer">
          <button type="submit" className="gz-btn">
            {savedFlag ? <Check size={16} /> : null}
            <span>{savedFlag ? 'Configuración guardada' : 'Guardar configuración'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
