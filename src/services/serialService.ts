import type { BleCommandPayload } from '../constants/ble';
import type { Esp32TelemetryPayload } from '../types/gas';
import type { SerialPort } from '../types/web-serial';
import { parseEsp32Json } from './bleService';

export interface SerialCallbacks {
  onTelemetry: (payload: Esp32TelemetryPayload, rawJson: string) => void;
  onStatusChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error', detail?: string) => void;
  onLog: (message: string, kind?: 'info' | 'data' | 'warn' | 'ble') => void;
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.serial !== 'undefined';
}

function formatPortLabel(port: SerialPort): string {
  const info = port.getInfo();
  if (info.usbVendorId === 0x2341 || info.usbVendorId === 0x2a03) {
    return 'Arduino UNO (USB)';
  }
  if (info.usbVendorId === 0x1a86) {
    return 'Arduino UNO CH340 (USB)';
  }
  if (info.usbVendorId === 0x10c4) {
    return 'Placa CP2102 (USB)';
  }
  return 'Arduino / Báscula USB';
}

export class GasZeroSerialClient {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private callbacks: SerialCallbacks | null = null;
  private decoder = new TextDecoder('utf-8');
  private encoder = new TextEncoder();
  private rxBuffer = '';
  private label: string | null = null;
  private connected = false;
  private closing = false;

  get deviceName(): string | null {
    return this.label;
  }

  get isConnected(): boolean {
    return this.connected && this.port !== null;
  }

  private async openPort(
    port: SerialPort,
    callbacks: SerialCallbacks,
    baudRate: number
  ): Promise<boolean> {
    await port.open({ baudRate });

    this.port = port;
    this.label = formatPortLabel(port);
    this.connected = true;
    this.rxBuffer = '';

    callbacks.onStatusChange('connected', `${this.label} · ${baudRate} baudios`);
    callbacks.onLog(`Conectado por cable USB a ${this.label} (${baudRate} baudios)`, 'ble');

    void this.readLoop(port);
    return true;
  }

  async autoReconnect(callbacks: SerialCallbacks, baudRate = 115200): Promise<boolean> {
    if (!isWebSerialSupported() || !navigator.serial || this.connected) {
      return false;
    }

    try {
      const ports = await navigator.serial.getPorts();
      if (!ports.length) return false;

      this.callbacks = callbacks;
      this.closing = false;
      for (const port of ports) {
        try {
          return await this.openPort(port, callbacks, baudRate);
        } catch {
          // Intentar con el siguiente puerto autorizado si el primero está ocupado o desconectado
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  async connect(callbacks: SerialCallbacks, baudRate = 115200): Promise<boolean> {
    this.callbacks = callbacks;

    if (!isWebSerialSupported() || !navigator.serial) {
      callbacks.onStatusChange(
        'error',
        'Web Serial (USB) solo está disponible en Chrome o Edge de escritorio (Windows, macOS o Linux).'
      );
      callbacks.onLog('Web Serial API no soportada en este navegador', 'warn');
      return false;
    }

    // Cerrar conexión previa si existía
    if (this.port) {
      await this.disconnect(true);
    }

    try {
      this.closing = false;
      callbacks.onStatusChange('connecting', 'Selecciona el puerto COM de tu Arduino UNO…');
      callbacks.onLog('Solicitando puerto USB (Web Serial)…', 'ble');

      const port = await navigator.serial.requestPort();
      return await this.openPort(port, callbacks, baudRate);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al abrir el puerto USB';
      const friendly = message.toLowerCase().includes('no port selected')
        ? 'Selección de puerto USB cancelada'
        : message.toLowerCase().includes('failed to open')
        ? 'No se pudo abrir el puerto COM. Cierra el Monitor Serie de Arduino IDE e inténtalo de nuevo.'
        : message;
      callbacks.onStatusChange('error', friendly);
      callbacks.onLog(`Error USB: ${friendly}`, 'warn');
      return false;
    }
  }

  private async readLoop(port: SerialPort): Promise<void> {
    if (!port.readable) return;
    const reader = port.readable.getReader();
    this.reader = reader;

    try {
      while (this.connected && !this.closing) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          this.handleChunk(this.decoder.decode(value, { stream: true }));
        }
      }
    } catch (err) {
      if (!this.closing) {
        const msg = err instanceof Error ? err.message : 'Cable USB desconectado';
        this.callbacks?.onLog(`Conexión USB interrumpida: ${msg}`, 'warn');
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // Ignorar si ya fue liberado
      }
      if (this.reader === reader) {
        this.reader = null;
      }
      if (!this.closing) {
        await this.disconnect(false);
      }
    }
  }

  private handleChunk(chunk: string): void {
    this.rxBuffer += chunk;
    const lines = this.rxBuffer.split(/\r?\n/);
    this.rxBuffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.startsWith('{')) {
        const parsed = parseEsp32Json(line);
        if (parsed) {
          this.callbacks?.onTelemetry(parsed, line);
          continue;
        }
      }

      this.callbacks?.onLog(`USB: ${line}`, 'info');
    }

    if (this.rxBuffer.length > 512) {
      this.rxBuffer = '';
    }
  }

  async sendCommand(payload: BleCommandPayload): Promise<boolean> {
    if (!this.port?.writable || !this.isConnected) {
      return false;
    }
    const writer = this.port.writable.getWriter();
    try {
      const serialized = `${JSON.stringify(payload)}\n`;
      await writer.write(this.encoder.encode(serialized));
      this.callbacks?.onLog(`Comando enviado por USB: ${serialized.trim()}`, 'ble');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al escribir por USB';
      this.callbacks?.onLog(`Fallo al enviar comando USB: ${message}`, 'warn');
      return false;
    } finally {
      try {
        writer.releaseLock();
      } catch {
        // Ignorar
      }
    }
  }

  async disconnect(silent = false): Promise<void> {
    this.closing = true;
    this.connected = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // Ignorar
      }
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // Ignorar
      }
      this.port = null;
    }

    this.label = null;
    this.rxBuffer = '';

    if (!silent) {
      this.callbacks?.onStatusChange('disconnected', 'Cable USB desconectado');
    }
  }
}
