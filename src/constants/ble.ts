/**
 * UUIDs GATT personalizados para Gas-Zero (ESP32 DevKit V1 + HX711).
 * Estos mismos UUIDs se usarán en el firmware ESP32 en la fase de hardware.
 */
export const GAS_ZERO_BLE = {
  DEVICE_NAME_PREFIX: 'GasZero',
  SERVICE_UUID: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
  TELEMETRY_CHAR_UUID: 'beb5483e-36e1-4688-b7f5-ea07361b26a8', // Notify (JSON ESP32 -> App)
  COMMAND_CHAR_UUID: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',   // Write  (JSON App -> ESP32)
} as const;

export type BleCommandPayload =
  | { cmd: 'TARE' }
  | { cmd: 'READ_NOW' }
  | { cmd: 'SET_CONFIG'; gas: string; tare: number; capacity: number }
  | { cmd: 'CALIBRATE'; knownWeightKg: number };
