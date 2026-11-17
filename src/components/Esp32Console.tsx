import { Terminal } from 'lucide-react';
import type { LogEntry } from '../types/gas';

interface Esp32ConsoleProps {
  logs: LogEntry[];
  lastRawJson: string;
}

export function Esp32Console({ logs, lastRawJson }: Esp32ConsoleProps) {
  return (
    <section className="gz-panel gz-console-panel">
      <div className="gz-panel-head">
        <div className="gz-title-icon">
          <Terminal size={15} />
          <h2>Registro del ESP32</h2>
        </div>
        <span className="gz-mono-pill">BLE GATT · JSON</span>
      </div>

      <div className="gz-json-box" title="Último paquete JSON recibido">
        <span className="gz-json-label">Último payload:</span>
        <code>{lastRawJson}</code>
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
