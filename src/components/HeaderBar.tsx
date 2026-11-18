import {
  Bluetooth,
  BluetoothConnected,
  BluetoothSearching,
  MapPin,
  Radio,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import type { ConnectionStatus, DataSourceMode } from '../types/gas';

interface HeaderBarProps {
  cylinderLabel: string;
  cylinderLocation: string;
  mode: DataSourceMode;
  connectionStatus: ConnectionStatus;
  bleDeviceName: string | null;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenConnection: () => void;
}

export function HeaderBar({
  cylinderLabel,
  cylinderLocation,
  mode,
  connectionStatus,
  bleDeviceName,
  soundEnabled,
  onToggleSound,
  onOpenConnection,
}: HeaderBarProps) {
  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';

  const statusText = (() => {
    if (mode === 'simulator') {
      return 'Modo Demo';
    }
    if (isConnected) return bleDeviceName ? `BLE · ${bleDeviceName}` : 'ESP32 BLE conectado';
    if (isConnecting) return 'Escaneando BLE…';
    if (connectionStatus === 'error') return 'Error BLE';
    return 'Esperando ESP32';
  })();

  const Icon = (() => {
    if (mode === 'simulator') return Radio;
    if (isConnected) return BluetoothConnected;
    if (isConnecting) return BluetoothSearching;
    if (connectionStatus === 'error') return WifiOff;
    return Bluetooth;
  })();

  return (
    <header className="gz-header">
      <div className="gz-header-title">
        <span className="gz-eyebrow">GAS-ZERO · MEDIDOR INTELIGENTE DE GAS</span>
        <div className="gz-title-line">
          <h1>{cylinderLabel}</h1>
          <span className="gz-loc-chip">
            <MapPin size={12} />
            {cylinderLocation}
          </span>
        </div>
      </div>

      <div className="gz-header-actions">
        <button
          type="button"
          className={`gz-sound-btn ${soundEnabled ? 'is-on' : ''}`}
          onClick={onToggleSound}
          title={soundEnabled ? 'Silenciar alertas sonoras' : 'Activar alertas sonoras'}
          aria-label={soundEnabled ? 'Silenciar alertas sonoras' : 'Activar alertas sonoras'}
        >
          {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>

        <button
          type="button"
          onClick={onOpenConnection}
          className={`gz-conn ${
            mode === 'ble' && isConnected
              ? 'gz-conn--connected'
              : mode === 'simulator'
              ? 'gz-conn--demo'
              : isConnecting
              ? 'gz-conn--connecting'
              : 'gz-conn--offline'
          }`}
          title="Cambiar entre Modo Demo y ESP32 BLE"
        >
          <Icon size={15} />
          <span>{statusText}</span>
        </button>
      </div>
    </header>
  );
}
