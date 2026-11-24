import { Cpu, Terminal } from 'lucide-react';
import type {
  ConnectionStatus,
  DataSourceMode,
  HardwareTelemetrySnapshot,
  LogEntry,
} from '../types/gas';

interface Esp32ConsoleProps {
  mode: DataSourceMode;
  connectionStatus: ConnectionStatus;
  deviceName: string | null;
  hardwareTelemetry: HardwareTelemetrySnapshot | null;
  logs: LogEntry[];
  lastRawJson: string;
}

function formatUptime(sec: number): string {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const rem = sec % 60;
  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m`;
  }
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function Esp32Console({
  mode,
  connectionStatus,
  deviceName,
  hardwareTelemetry,
  logs,
  lastRawJson,
}: Esp32ConsoleProps) {
  const isHardware = mode === 'serial' || mode === 'ble';
  const isConnected = isHardware && connectionStatus === 'connected';
  const payload = hardwareTelemetry?.payload;

  const title =
    mode === 'serial'
      ? 'Información del Arduino UNO'
      : mode === 'ble'
      ? 'Información del ESP32 BLE'
      : 'Información del Sensor (Demo)';

  const badge =
    mode === 'serial'
      ? 'USB SERIAL · 115200'
      : mode === 'ble'
      ? 'BLE GATT · JSON'
      : 'MODO DEMO · JSON';

  const hxStatusText = !isHardware
    ? 'Simulado'
    : !isConnected
    ? 'Desconectado'
    : payload?.hxOk === false
    ? 'Sin señal HX711'
    : payload
    ? 'OK · Activo'
    : 'Esperando datos…';

  return (
    <section className="gz-panel gz-console-panel" aria-label="Telemetría en vivo del Arduino">
      <div className="gz-panel-head">
        <div className="gz-title-icon">
          {isHardware ? <Cpu size={15} /> : <Terminal size={15} />}
          <h2>{title}</h2>
        </div>
        <span className="gz-mono-pill">{badge}</span>
      </div>

      {/* Todos los datos en vivo reportados por el Arduino */}
      <div className="gz-hw-grid">
        <div className="gz-hw-item">
          <span className="gz-hw-label">Placa / Enlace</span>
          <strong className={`gz-hw-val ${isConnected ? 'is-live' : ''}`}>
            {isConnected ? deviceName ?? (mode === 'serial' ? 'Arduino UNO' : 'ESP32') : 'Sin conectar'}
          </strong>
        </div>

        <div className="gz-hw-item">
          <span className="gz-hw-label">Sensor HX711</span>
          <strong
            className={`gz-hw-val ${
              payload?.hxOk === false ? 'is-err' : isConnected && payload ? 'is-live' : ''
            }`}
          >
            {hxStatusText}
          </strong>
        </div>

        <div className="gz-hw-item">
          <span className="gz-hw-label">Peso bruto (Arduino)</span>
          <strong className="gz-hw-val">
            {payload ? `${payload.weight.toFixed(2)} kg` : '—'}
          </strong>
        </div>

        <div className="gz-hw-item">
          <span className="gz-hw-label">Neto / Nivel (Arduino)</span>
          <strong className="gz-hw-val">
            {payload ? `${payload.net.toFixed(2)} kg (${payload.pct}%)` : '—'}
          </strong>
        </div>

        <div className="gz-hw-item">
          <span className="gz-hw-label">Tara / Capacidad</span>
          <strong className="gz-hw-val">
            {payload
              ? `${payload.tare.toFixed(1)} kg${
                  payload.capacity !== undefined ? ` / ${payload.capacity.toFixed(0)} kg` : ''
                }`
              : '—'}
          </strong>
        </div>

        <div className="gz-hw-item">
          <span className="gz-hw-label">Gas en placa</span>
          <strong className="gz-hw-val">{payload ? payload.gas : '—'}</strong>
        </div>

        <div className="gz-hw-item">
          <span className="gz-hw-label">Lectura cruda HX711</span>
          <strong className="gz-hw-val">
            {payload?.raw !== undefined ? payload.raw.toLocaleString('es-MX') : '—'}
          </strong>
        </div>

        <div className="gz-hw-item">
          <span className="gz-hw-label">Factor calibración</span>
          <strong className="gz-hw-val">
            {payload?.factor !== undefined ? payload.factor.toFixed(2) : '—'}
          </strong>
        </div>

        <div className="gz-hw-item gz-hw-item--wide">
          <span className="gz-hw-label">Paquetes recibidos / Tiempo encendido</span>
          <strong className="gz-hw-val">
            {hardwareTelemetry
              ? `#${hardwareTelemetry.packetCount}${
                  payload?.uptime !== undefined ? ` · ${formatUptime(payload.uptime)}` : ''
                }`
              : '0 paquetes'}
          </strong>
        </div>
      </div>

      <div className="gz-json-box" title="Último paquete JSON recibido">
        <span className="gz-json-label">Último JSON del Arduino:</span>
        <code>{hardwareTelemetry?.rawJson ?? lastRawJson}</code>
      </div>

      <div className="gz-log-list" role="log" aria-live="polite">
        {logs.map((entry) => (
          <div key={entry.id} className={`gz-log-row gz-log-row--${entry.kind ?? 'info'}`}>
            <span className="gz-log-time">{entry.elapsed}</span>
            <span className="gz-log-msg">{entry.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
