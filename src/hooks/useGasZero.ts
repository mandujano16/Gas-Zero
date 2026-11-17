import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GAS_ZERO_BLE } from '../constants/ble';
import { GAS_CATALOG, TANK_PRESETS } from '../constants/gases';
import { GasZeroBleClient, isWebBluetoothSupported } from '../services/bleService';
import type {
  AlertLevel,
  AlertThresholds,
  ConnectionStatus,
  DataSourceMode,
  Esp32TelemetryPayload,
  GasCode,
  GasEvent,
  HistoryReading,
  LogEntry,
  TankPresetId,
} from '../types/gas';

const STORAGE_KEY = 'gas-zero-config-v1';

interface StoredConfig {
  cylinderLabel: string;
  gasCode: GasCode;
  tankPresetId: TankPresetId;
  capacityKg: number;
  tareKg: number;
  thresholds: AlertThresholds;
  serviceUuid: string;
  telemetryUuid: string;
  commandUuid: string;
}

const DEFAULT_CONFIG: StoredConfig = {
  cylinderLabel: 'Cilindro #001',
  gasCode: 'N2',
  tankPresetId: 'medium',
  capacityKg: 20,
  tareKg: 12,
  thresholds: {
    warnPct: 15,
    dangerPct: 5,
  },
  serviceUuid: GAS_ZERO_BLE.SERVICE_UUID,
  telemetryUuid: GAS_ZERO_BLE.TELEMETRY_CHAR_UUID,
  commandUuid: GAS_ZERO_BLE.COMMAND_CHAR_UUID,
};

function loadConfig(): StoredConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<StoredConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      thresholds: {
        ...DEFAULT_CONFIG.thresholds,
        ...(parsed.thresholds ?? {}),
      },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function formatElapsed(startMs: number): string {
  const totalSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useGasZero() {
  const initialConfig = useMemo(() => loadConfig(), []);
  const sessionStartRef = useRef<number>(Date.now());
  const bleClientRef = useRef<GasZeroBleClient | null>(null);
  const warnNotifiedRef = useRef<boolean>(false);
  const dangerNotifiedRef = useRef<boolean>(false);

  const [config, setConfig] = useState<StoredConfig>(initialConfig);
  const [mode, setMode] = useState<DataSourceMode>('simulator');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [connectionDetail, setConnectionDetail] = useState<string>('Iniciando simulador ESP32…');
  const [bleDeviceName, setBleDeviceName] = useState<string | null>(null);

  const [simRunning, setSimRunning] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<'normal' | 'fast'>('normal');

  const initialFullWeight = Number((initialConfig.tareKg + initialConfig.capacityKg).toFixed(2));
  const [weightKg, setWeightKg] = useState<number>(initialFullWeight);
  const [netKg, setNetKg] = useState<number>(initialConfig.capacityKg);
  const [pct, setPct] = useState<number>(100);
  const [consumedSessionKg, setConsumedSessionKg] = useState<number>(0);
  const [refillCount, setRefillCount] = useState<number>(0);
  const [simElapsedHours, setSimElapsedHours] = useState<number>(0);

  const [lastRawJson, setLastRawJson] = useState<string>(() =>
    JSON.stringify({
      weight: initialFullWeight,
      tare: initialConfig.tareKg,
      net: initialConfig.capacityKg,
      pct: 100,
      gas: initialConfig.gasCode,
    })
  );

  const [history, setHistory] = useState<HistoryReading[]>(() => [
    {
      id: makeId(),
      timestamp: Date.now(),
      weightKg: initialFullWeight,
      netKg: initialConfig.capacityKg,
      pct: 100,
      gas: initialConfig.gasCode,
    },
  ]);

  const [events, setEvents] = useState<GasEvent[]>(() => [
    {
      id: makeId(),
      timestamp: Date.now(),
      type: 'config',
      message: `Cilindro configurado — ${GAS_CATALOG[initialConfig.gasCode].name} · ${initialConfig.capacityKg.toFixed(0)} kg`,
    },
  ]);

  const [logs, setLogs] = useState<LogEntry[]>(() => [
    {
      id: makeId(),
      elapsed: '00:00',
      message: 'Iniciando Gas-Zero Dashboard v1.0.0…',
      kind: 'info',
    },
    {
      id: makeId(),
      elapsed: '00:00',
      message: 'Buscando módulo ESP32 (HX711 + BLE GATT)…',
      kind: 'ble',
    },
  ]);

  // Persistir configuración
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignorar errores de cuota de almacenamiento
    }
  }, [config]);

  const addLog = useCallback((message: string, kind: LogEntry['kind'] = 'info') => {
    setLogs((prev) => [
      {
        id: makeId(),
        elapsed: formatElapsed(sessionStartRef.current),
        message,
        kind,
      },
      ...prev.slice(0, 59),
    ]);
  }, []);

  const addEvent = useCallback((type: GasEvent['type'], message: string) => {
    setEvents((prev) => [
      {
        id: makeId(),
        timestamp: Date.now(),
        type,
        message,
      },
      ...prev.slice(0, 49),
    ]);
  }, []);

  const evaluateAlerts = useCallback(
    (nextPct: number, gasCode: GasCode, thresholds: AlertThresholds) => {
      const gasName = GAS_CATALOG[gasCode].name;
      if (nextPct <= thresholds.dangerPct && !dangerNotifiedRef.current) {
        dangerNotifiedRef.current = true;
        warnNotifiedRef.current = true;
        addEvent('danger', `Alerta crítica: cilindro de ${gasName} casi vacío (${nextPct}%)`);
        addLog(`ALERTA CRÍTICA: nivel de ${gasName} en ${nextPct}%`, 'warn');
      } else if (
        nextPct <= thresholds.warnPct &&
        nextPct > thresholds.dangerPct &&
        !warnNotifiedRef.current
      ) {
        warnNotifiedRef.current = true;
        addEvent('warn', `Alerta: nivel bajo (${nextPct}%) en cilindro de ${gasName}`);
        addLog(`Aviso de nivel bajo: ${nextPct}% restante`, 'warn');
      }
    },
    [addEvent, addLog]
  );

  // Handshake inicial en modo simulador
  useEffect(() => {
    if (mode !== 'simulator') return;
    setConnectionStatus('connecting');
    setConnectionDetail('Sincronizando simulador ESP32…');
    const timer = window.setTimeout(() => {
      setConnectionStatus('connected');
      setConnectionDetail('ESP32 simulado · BLE GATT');
      addLog('Enlace BLE simulado establecido (MTU 128 bytes)', 'ble');
      addLog(`Peso inicial HX711: ${(config.tareKg + config.capacityKg).toFixed(2)} kg`, 'data');
    }, 950);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const applySimulatedStep = useCallback(
    (dropKg: number, reason: 'auto' | 'manual' | 'leak') => {
      setNetKg((prevNet) => {
        if (prevNet <= 0) return 0;
        const actualDrop = Math.min(prevNet, Math.max(0.05, dropKg));
        const nextNet = Number(Math.max(0, prevNet - actualDrop).toFixed(2));
        const nextWeight = Number((config.tareKg + nextNet).toFixed(2));
        const nextPct =
          config.capacityKg > 0
            ? Math.min(100, Math.max(0, Math.round((nextNet / config.capacityKg) * 100)))
            : 0;

        const payload: Esp32TelemetryPayload = {
          weight: nextWeight,
          tare: config.tareKg,
          net: nextNet,
          pct: nextPct,
          gas: config.gasCode,
        };

        setWeightKg(nextWeight);
        setPct(nextPct);
        setLastRawJson(JSON.stringify(payload));
        setConsumedSessionKg((c) => Number((c + actualDrop).toFixed(2)));
        setSimElapsedHours((h) => Number((h + (reason === 'manual' ? 0.85 : 0.45)).toFixed(2)));

        setHistory((prev) => [
          ...prev.slice(-39),
          {
            id: makeId(),
            timestamp: Date.now(),
            weightKg: nextWeight,
            netKg: nextNet,
            pct: nextPct,
            gas: config.gasCode,
          },
        ]);

        if (reason === 'manual') {
          addLog(`Lectura forzada HX711: ${nextWeight.toFixed(2)} kg (neto ${nextNet.toFixed(2)} kg)`, 'data');
        } else if (reason === 'leak') {
          addLog(`Caída acelerada detectada: -${actualDrop.toFixed(2)} kg (${nextPct}%)`, 'warn');
        } else {
          addLog(`Peso recibido: ${nextWeight.toFixed(2)} kg · ${nextPct}% restante`, 'data');
        }

        evaluateAlerts(nextPct, config.gasCode, config.thresholds);
        return nextNet;
      });
    },
    [addLog, config.capacityKg, config.gasCode, config.tareKg, config.thresholds, evaluateAlerts]
  );

  // Bucle periódico del simulador
  useEffect(() => {
    if (mode !== 'simulator' || connectionStatus !== 'connected' || !simRunning) return;
    const intervalMs = simSpeed === 'fast' ? 2200 : 5200;
    const id = window.setInterval(() => {
      const baseStep = Math.max(0.18, config.capacityKg * (simSpeed === 'fast' ? 0.045 : 0.018));
      const jitter = (Math.random() - 0.35) * baseStep * 0.4;
      applySimulatedStep(Number((baseStep + jitter).toFixed(2)), 'auto');
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [applySimulatedStep, config.capacityKg, connectionStatus, mode, simRunning, simSpeed]);

  // Limpiar conexión BLE al desmontar
  useEffect(() => {
    return () => {
      bleClientRef.current?.disconnect();
    };
  }, []);

  const resetCylinderReading = useCallback(
    (
      nextGas: GasCode,
      nextTare: number,
      nextCapacity: number,
      eventMessage: string,
      eventType: GasEvent['type'] = 'config'
    ) => {
      const fullWeight = Number((nextTare + nextCapacity).toFixed(2));
      warnNotifiedRef.current = false;
      dangerNotifiedRef.current = false;

      setWeightKg(fullWeight);
      setNetKg(nextCapacity);
      setPct(100);
      setLastRawJson(
        JSON.stringify({
          weight: fullWeight,
          tare: nextTare,
          net: nextCapacity,
          pct: 100,
          gas: nextGas,
        })
      );
      setHistory((prev) => [
        ...prev.slice(-39),
        {
          id: makeId(),
          timestamp: Date.now(),
          weightKg: fullWeight,
          netKg: nextCapacity,
          pct: 100,
          gas: nextGas,
        },
      ]);
      addEvent(eventType, eventMessage);
    },
    [addEvent]
  );

  const selectGas = useCallback(
    (gasCode: GasCode) => {
      setConfig((prev) => ({ ...prev, gasCode }));
      const gas = GAS_CATALOG[gasCode];
      addLog(`Gas seleccionado: ${gas.name} (${gas.symbol})`, 'info');

      if (mode === 'ble' && bleClientRef.current?.isConnected) {
        void bleClientRef.current.sendCommand({
          cmd: 'SET_CONFIG',
          gas: gasCode,
          tare: config.tareKg,
          capacity: config.capacityKg,
        });
        addEvent('config', `Gas sincronizado en ESP32 — ${gas.name}`);
      } else {
        resetCylinderReading(
          gasCode,
          config.tareKg,
          config.capacityKg,
          `Cilindro configurado — ${gas.name} · ${config.capacityKg.toFixed(0)} kg`,
          'config'
        );
      }
    },
    [addEvent, addLog, config.capacityKg, config.tareKg, mode, resetCylinderReading]
  );

  const selectTankPreset = useCallback(
    (presetId: Exclude<TankPresetId, 'custom'>) => {
      const preset = TANK_PRESETS.find((t) => t.id === presetId);
      if (!preset) return;
      setConfig((prev) => ({
        ...prev,
        tankPresetId: presetId,
        capacityKg: preset.capacityKg,
        tareKg: preset.tareKg,
      }));
      const gas = GAS_CATALOG[config.gasCode];
      addLog(
        `Tanque actualizado: ${preset.shortLabel} (Cap ${preset.capacityKg} kg, Tara ${preset.tareKg} kg)`,
        'info'
      );

      if (mode === 'ble' && bleClientRef.current?.isConnected) {
        void bleClientRef.current.sendCommand({
          cmd: 'SET_CONFIG',
          gas: config.gasCode,
          tare: preset.tareKg,
          capacity: preset.capacityKg,
        });
        addEvent('config', `Capacidad sincronizada — ${gas.name} · Tanque ${preset.shortLabel}`);
      } else {
        resetCylinderReading(
          config.gasCode,
          preset.tareKg,
          preset.capacityKg,
          `Cilindro configurado — ${gas.name} · Tanque ${preset.shortLabel}`,
          'config'
        );
      }
    },
    [addEvent, addLog, config.gasCode, mode, resetCylinderReading]
  );

  const updateCustomTank = useCallback(
    (capacityKg: number, tareKg: number) => {
      const safeCap = Math.max(1, Math.min(180, Number(capacityKg.toFixed(2))));
      const safeTare = Math.max(0, Math.min(150, Number(tareKg.toFixed(2))));
      setConfig((prev) => ({
        ...prev,
        tankPresetId: 'custom',
        capacityKg: safeCap,
        tareKg: safeTare,
      }));
      addLog(`Parámetros personalizados: Cap ${safeCap} kg · Tara ${safeTare} kg`, 'info');
      if (mode === 'ble' && bleClientRef.current?.isConnected) {
        void bleClientRef.current.sendCommand({
          cmd: 'SET_CONFIG',
          gas: config.gasCode,
          tare: safeTare,
          capacity: safeCap,
        });
      } else {
        resetCylinderReading(
          config.gasCode,
          safeTare,
          safeCap,
          `Tanque personalizado — Cap ${safeCap} kg / Tara ${safeTare} kg`,
          'config'
        );
      }
    },
    [addLog, config.gasCode, mode, resetCylinderReading]
  );

  const forceReading = useCallback(() => {
    if (mode === 'ble' && bleClientRef.current?.isConnected) {
      void bleClientRef.current.sendCommand({ cmd: 'READ_NOW' });
      return;
    }
    const drop = Number(Math.max(0.45, config.capacityKg * 0.085).toFixed(2));
    applySimulatedStep(drop, 'manual');
  }, [applySimulatedStep, config.capacityKg, mode]);

  const simulateLeak = useCallback(() => {
    if (mode !== 'simulator') return;
    const drop = Number(Math.max(1.2, config.capacityKg * 0.22).toFixed(2));
    applySimulatedStep(drop, 'leak');
  }, [applySimulatedStep, config.capacityKg, mode]);

  const registerRefill = useCallback(() => {
    setRefillCount((n) => n + 1);
    setSimElapsedHours(0);
    setConsumedSessionKg(0);
    const gas = GAS_CATALOG[config.gasCode];
    addLog('Cilindro reemplazado / recargado manualmente (100%)', 'info');
    resetCylinderReading(
      config.gasCode,
      config.tareKg,
      config.capacityKg,
      `Recarga registrada — ${gas.name} al 100% (${config.capacityKg.toFixed(1)} kg)`,
      'refill'
    );
  }, [addLog, config.capacityKg, config.gasCode, config.tareKg, resetCylinderReading]);

  const applyTare = useCallback(() => {
    if (mode === 'ble' && bleClientRef.current?.isConnected) {
      void bleClientRef.current.sendCommand({ cmd: 'TARE' });
      addEvent('tare', 'Comando de tara enviado a báscula ESP32');
      return;
    }
    addLog(`Tara verificada en báscula HX711: ${config.tareKg.toFixed(2)} kg`, 'info');
    addEvent('tare', `Tara aplicada (${config.tareKg.toFixed(2)} kg)`);
  }, [addEvent, addLog, config.tareKg, mode]);

  const connectBle = useCallback(async () => {
    if (!bleClientRef.current) {
      bleClientRef.current = new GasZeroBleClient();
    }
    setMode('ble');
    await bleClientRef.current.connect(
      {
        onTelemetry: (payload, rawJson) => {
          setWeightKg(payload.weight);
          setNetKg(payload.net);
          setPct(payload.pct);
          setLastRawJson(rawJson);
          setConfig((prev) =>
            prev.gasCode === payload.gas && prev.tareKg === payload.tare
              ? prev
              : { ...prev, gasCode: payload.gas, tareKg: payload.tare }
          );
          setHistory((prev) => {
            const last = prev[prev.length - 1];
            if (last && payload.net < last.netKg) {
              const delta = Number((last.netKg - payload.net).toFixed(2));
              if (delta > 0 && delta < 5) {
                setConsumedSessionKg((c) => Number((c + delta).toFixed(2)));
              }
            }
            return [
              ...prev.slice(-39),
              {
                id: makeId(),
                timestamp: Date.now(),
                weightKg: payload.weight,
                netKg: payload.net,
                pct: payload.pct,
                gas: payload.gas,
              },
            ];
          });
          addLog(`BLE JSON: ${rawJson}`, 'data');
          evaluateAlerts(payload.pct, payload.gas, config.thresholds);
        },
        onStatusChange: (status, detail) => {
          setConnectionStatus(status);
          if (detail) setConnectionDetail(detail);
          setBleDeviceName(bleClientRef.current?.deviceName ?? null);
          if (status === 'connected') {
            addEvent('ble', `Conectado por BLE a ${bleClientRef.current?.deviceName ?? 'ESP32 Gas-Zero'}`);
          }
        },
        onLog: addLog,
      },
      config.serviceUuid,
      config.telemetryUuid,
      config.commandUuid
    );
  }, [addEvent, addLog, config.commandUuid, config.serviceUuid, config.telemetryUuid, config.thresholds, evaluateAlerts]);

  const disconnectBle = useCallback(() => {
    bleClientRef.current?.disconnect();
    setBleDeviceName(null);
    addEvent('ble', 'Sesión BLE finalizada');
  }, [addEvent]);

  const switchToSimulator = useCallback(() => {
    bleClientRef.current?.disconnect();
    setBleDeviceName(null);
    setMode('simulator');
    addLog('Modo simulador reactivado', 'info');
  }, [addLog]);

  const updateThresholds = useCallback((next: AlertThresholds) => {
    const warnPct = Math.min(50, Math.max(5, Math.round(next.warnPct)));
    const dangerPct = Math.min(warnPct - 1, Math.max(1, Math.round(next.dangerPct)));
    setConfig((prev) => ({
      ...prev,
      thresholds: { warnPct, dangerPct },
    }));
  }, []);

  const updateCylinderLabel = useCallback((label: string) => {
    setConfig((prev) => ({ ...prev, cylinderLabel: label.trim() || 'Cilindro #001' }));
  }, []);

  const updateBleUuids = useCallback(
    (serviceUuid: string, telemetryUuid: string, commandUuid: string) => {
      setConfig((prev) => ({
        ...prev,
        serviceUuid: serviceUuid.trim() || GAS_ZERO_BLE.SERVICE_UUID,
        telemetryUuid: telemetryUuid.trim() || GAS_ZERO_BLE.TELEMETRY_CHAR_UUID,
        commandUuid: commandUuid.trim() || GAS_ZERO_BLE.COMMAND_CHAR_UUID,
      }));
    },
    []
  );

  const exportHistoryCsv = useCallback(() => {
    const header = 'Fecha_Hora,Gas,Peso_Bruto_kg,Gas_Neto_kg,Nivel_pct';
    const rows = history.map((h) =>
      [
        new Date(h.timestamp).toISOString(),
        h.gas,
        h.weightKg.toFixed(2),
        h.netKg.toFixed(2),
        h.pct,
      ].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gas-zero-historial-${config.gasCode}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('Historial exportado en formato CSV', 'info');
  }, [addLog, config.gasCode, history]);

  const alertLevel: AlertLevel = useMemo(() => {
    if (pct <= config.thresholds.dangerPct) return 'danger';
    if (pct <= config.thresholds.warnPct) return 'warn';
    return 'ok';
  }, [config.thresholds.dangerPct, config.thresholds.warnPct, pct]);

  const avgDailyConsumptionKg = useMemo(() => {
    if (consumedSessionKg <= 0 || simElapsedHours <= 0.1) return null;
    const perDay = (consumedSessionKg / simElapsedHours) * 24;
    return Number(perDay.toFixed(2));
  }, [consumedSessionKg, simElapsedHours]);

  const autonomyDays = useMemo(() => {
    if (!avgDailyConsumptionKg || avgDailyConsumptionKg <= 0 || netKg <= 0) return null;
    return Number((netKg / avgDailyConsumptionKg).toFixed(1));
  }, [avgDailyConsumptionKg, netKg]);

  const gasConfig = GAS_CATALOG[config.gasCode];

  return {
    config,
    gasConfig,
    mode,
    connectionStatus,
    connectionDetail,
    bleDeviceName,
    bleSupported: isWebBluetoothSupported(),
    simRunning,
    setSimRunning,
    simSpeed,
    setSimSpeed,
    weightKg,
    netKg,
    pct,
    alertLevel,
    consumedSessionKg,
    refillCount,
    simElapsedHours,
    avgDailyConsumptionKg,
    autonomyDays,
    lastRawJson,
    history,
    events,
    logs,
    selectGas,
    selectTankPreset,
    updateCustomTank,
    forceReading,
    simulateLeak,
    registerRefill,
    applyTare,
    connectBle,
    disconnectBle,
    switchToSimulator,
    updateThresholds,
    updateCylinderLabel,
    updateBleUuids,
    exportHistoryCsv,
  };
}
