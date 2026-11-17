export type GasCode = 'N2' | 'Ar' | 'CO2' | 'O2' | 'LP';

export type TankPresetId = 'small' | 'medium' | 'large' | 'industrial' | 'custom';

export type NavTab = 'inicio' | 'historial' | 'ahorrar' | 'conexion';

export type DataSourceMode = 'simulator' | 'ble';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type AlertLevel = 'ok' | 'warn' | 'danger';

export interface GasConfig {
  code: GasCode;
  symbol: string;
  name: string;
  accent: string;
  category: string;
  application: string;
  tips: string[];
  safetyNote: string;
}

export interface TankPreset {
  id: Exclude<TankPresetId, 'custom'>;
  label: string;
  shortLabel: string;
  capacityKg: number;
  tareKg: number;
}

/**
 * Contrato JSON oficial transmitido por el ESP32 vía BLE GATT Notify
 * según Especificación Técnica Gas-Zero v1.0.0.
 */
export interface Esp32TelemetryPayload {
  weight: number;
  tare: number;
  net: number;
  pct: number;
  gas: GasCode;
}

export interface HistoryReading {
  id: string;
  timestamp: number;
  weightKg: number;
  netKg: number;
  pct: number;
  gas: GasCode;
}

export interface GasEvent {
  id: string;
  timestamp: number;
  type: 'config' | 'refill' | 'warn' | 'danger' | 'tare' | 'ble';
  message: string;
}

export interface LogEntry {
  id: string;
  elapsed: string;
  message: string;
  kind?: 'info' | 'data' | 'warn' | 'ble';
}

export interface AlertThresholds {
  warnPct: number;
  dangerPct: number;
}
