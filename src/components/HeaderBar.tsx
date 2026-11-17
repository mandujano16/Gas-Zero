import { Bluetooth, BluetoothConnected, BluetoothSearching, Radio, WifiOff } from 'lucide-react';
import type { ConnectionStatus, DataSourceMode } from '../types/gas';

interface HeaderBarProps {
  cylinderLabel: string;
  mode: DataSourceMode;
  connectionStatus: ConnectionStatus;
  bleDeviceName: string | null;
  onOpenConnection: () => void;
}

export function HeaderBar({
  cylinderLabel,
  mode,
  connectionStatus,
  bleDeviceName,
  onOpenConnection,
}: HeaderBarProps) {
  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';

  const statusText = (() => {
    if (mode === 'simulator') {
      return isConnected ? 'ESP32 simulado' : 'Conectando…';
    }
    if (isConnected) return bleDeviceName ? `BLE · ${bleDeviceName}` : 'ESP32 BLE conectado';
    if (isConnecting) return 'Escaneando BLE…';
    if (connectionStatus === 'error') return 'Error BLE';
    return 'Sin conexión BLE';
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
        <h1>{cylinderLabel}</h1>
      </div>

      <button
        type="button"
        onClick={onOpenConnection}
        className={`gz-conn ${
          isConnected
            ? 'gz-conn--connected'
            : isConnecting
            ? 'gz-conn--connecting'
            : 'gz-conn--offline'
        }`}
        title="Gestionar conexión BLE / Simulador"
      >
        <Icon size={15} />
        <span>{statusText}</span>
      </button>
    </header>
  );
}
