import { GAS_ZERO_BLE, type BleCommandPayload } from '../constants/ble';
import type { Esp32TelemetryPayload, GasCode } from '../types/gas';
import type {
  BluetoothDevice,
  BluetoothRemoteGATTCharacteristic,
} from '../types/web-bluetooth';

const VALID_GASES = new Set<GasCode>(['N2', 'Ar', 'CO2', 'O2', 'LP']);

export interface BleCallbacks {
  onTelemetry: (payload: Esp32TelemetryPayload, rawJson: string) => void;
  onStatusChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error', detail?: string) => void;
  onLog: (message: string, kind?: 'info' | 'data' | 'warn' | 'ble') => void;
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.bluetooth !== 'undefined';
}

export function parseEsp32Json(raw: string): Esp32TelemetryPayload | null {
  try {
    const trimmed = raw.trim();
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const weight = Number(parsed.weight);
    const tare = Number(parsed.tare);
    const net = Number(parsed.net);
    const pct = Number(parsed.pct);
    const gas = String(parsed.gas ?? 'N2') as GasCode;

    if (
      Number.isNaN(weight) ||
      Number.isNaN(tare) ||
      Number.isNaN(net) ||
      Number.isNaN(pct)
    ) {
      return null;
    }

    return {
      weight: Math.max(0, weight),
      tare: Math.max(0, tare),
      net: Math.max(0, net),
      pct: Math.min(100, Math.max(0, Math.round(pct))),
      gas: VALID_GASES.has(gas) ? gas : 'N2',
    };
  } catch {
    return null;
  }
}

export class GasZeroBleClient {
  private device: BluetoothDevice | null = null;
  private telemetryChar: BluetoothRemoteGATTCharacteristic | null = null;
  private commandChar: BluetoothRemoteGATTCharacteristic | null = null;
  private callbacks: BleCallbacks | null = null;
  private decoder = new TextDecoder('utf-8');
  private encoder = new TextEncoder();
  private rxBuffer = '';
  private boundNotifyHandler: ((ev: Event) => void) | null = null;
  private boundDisconnectHandler: (() => void) | null = null;

  get deviceName(): string | null {
    return this.device?.name ?? null;
  }

  get isConnected(): boolean {
    return Boolean(this.device?.gatt?.connected);
  }

  async connect(
    callbacks: BleCallbacks,
    serviceUuid: string = GAS_ZERO_BLE.SERVICE_UUID,
    telemetryUuid: string = GAS_ZERO_BLE.TELEMETRY_CHAR_UUID,
    commandUuid: string = GAS_ZERO_BLE.COMMAND_CHAR_UUID
  ): Promise<boolean> {
    this.callbacks = callbacks;

    if (!isWebBluetoothSupported() || !navigator.bluetooth) {
      callbacks.onStatusChange(
        'error',
        'Web Bluetooth no está disponible en este navegador. Usa Chrome o Edge en escritorio o Android.'
      );
      callbacks.onLog('Web Bluetooth no soportado por este navegador', 'warn');
      return false;
    }

    try {
      callbacks.onStatusChange('connecting', 'Escaneando dispositivos BLE cercanos…');
      callbacks.onLog(`Escaneando BLE (${GAS_ZERO_BLE.DEVICE_NAME_PREFIX}*)…`, 'ble');

      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: GAS_ZERO_BLE.DEVICE_NAME_PREFIX },
          { services: [serviceUuid] },
        ],
        optionalServices: [serviceUuid],
      });

      this.device = device;
      this.boundDisconnectHandler = () => {
        this.callbacks?.onLog('Dispositivo ESP32 desconectado vía BLE', 'warn');
        this.callbacks?.onStatusChange('disconnected', 'Conexión BLE cerrada');
      };
      device.addEventListener('gattserverdisconnected', this.boundDisconnectHandler);

      callbacks.onLog(`Emparejado con "${device.name ?? 'ESP32 Gas-Zero'}". Conectando GATT…`, 'ble');
      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error('No se pudo inicializar el servidor GATT.');
      }

      const service = await server.getPrimaryService(serviceUuid);
      const telemetryChar = await service.getCharacteristic(telemetryUuid);
      this.telemetryChar = telemetryChar;

      try {
        this.commandChar = await service.getCharacteristic(commandUuid);
      } catch {
        this.commandChar = null;
        callbacks.onLog('Característica de comandos Write no encontrada (modo solo lectura)', 'warn');
      }

      this.boundNotifyHandler = (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        if (!target.value) return;
        const chunk = this.decoder.decode(target.value);
        this.handleChunk(chunk);
      };

      await telemetryChar.startNotifications();
      telemetryChar.addEventListener('characteristicvaluechanged', this.boundNotifyHandler);

      callbacks.onStatusChange('connected', device.name ?? 'ESP32 Gas-Zero');
      callbacks.onLog(`Suscrito a telemetría BLE (${device.name ?? 'ESP32'})`, 'ble');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de conexión BLE';
      callbacks.onStatusChange('error', message);
      callbacks.onLog(`Error BLE: ${message}`, 'warn');
      return false;
    }
  }

  private handleChunk(chunk: string): void {
    // Soporta paquetes completos en una notificación o fragmentados por MTU terminados en \n o }
    this.rxBuffer += chunk;

    const direct = parseEsp32Json(this.rxBuffer);
    if (direct) {
      const raw = this.rxBuffer.trim();
      this.rxBuffer = '';
      this.callbacks?.onTelemetry(direct, raw);
      return;
    }

    const newlineIdx = this.rxBuffer.indexOf('\n');
    if (newlineIdx !== -1) {
      const line = this.rxBuffer.slice(0, newlineIdx).trim();
      this.rxBuffer = this.rxBuffer.slice(newlineIdx + 1);
      const parsed = parseEsp32Json(line);
      if (parsed) {
        this.callbacks?.onTelemetry(parsed, line);
      }
    }

    if (this.rxBuffer.length > 512) {
      this.rxBuffer = '';
    }
  }

  async sendCommand(payload: BleCommandPayload): Promise<boolean> {
    if (!this.commandChar || !this.isConnected) {
      return false;
    }
    try {
      const serialized = JSON.stringify(payload);
      await this.commandChar.writeValue(this.encoder.encode(serialized));
      this.callbacks?.onLog(`Comando enviado al ESP32: ${serialized}`, 'ble');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo enviar comando';
      this.callbacks?.onLog(`Fallo al enviar comando BLE: ${message}`, 'warn');
      return false;
    }
  }

  disconnect(): void {
    if (this.telemetryChar && this.boundNotifyHandler) {
      this.telemetryChar.removeEventListener('characteristicvaluechanged', this.boundNotifyHandler);
      void this.telemetryChar.stopNotifications().catch(() => undefined);
    }
    if (this.device && this.boundDisconnectHandler) {
      this.device.removeEventListener('gattserverdisconnected', this.boundDisconnectHandler);
    }
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.telemetryChar = null;
    this.commandChar = null;
    this.rxBuffer = '';
    this.callbacks?.onStatusChange('disconnected', 'Desconectado manualmente');
  }
}
