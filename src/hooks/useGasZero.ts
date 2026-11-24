import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GAS_ZERO_BLE, type BleCommandPayload } from '../constants/ble';
import { GAS_CATALOG, TANK_PRESETS } from '../constants/gases';
import {
  getNotificationPermission,
  playAlertChime,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
} from '../services/alertService';
import { GasZeroBleClient, isWebBluetoothSupported } from '../services/bleService';
import { GasZeroSerialClient, isWebSerialSupported } from '../services/serialService';
import type {
  AlertLevel,
  AlertPreferences,
  AlertThresholds,
  ConnectionStatus,
  CylinderState,
  DataSourceMode,
  Esp32TelemetryPayload,
  GasCode,
  GasEvent,
  HardwareTelemetrySnapshot,
  LogEntry,
  NewCylinderInput,
  TankPresetId,
} from '../types/gas';

const STORAGE_V2_KEY = 'gas-zero-state-v2';
const LEGACY_V1_KEY = 'gas-zero-config-v1';

interface PersistedSettings {
  thresholds: AlertThresholds;
  alerts: AlertPreferences;
  serviceUuid: string;
  telemetryUuid: string;
  commandUuid: string;
}

interface PersistedStore {
  activeCylinderId: string;
  cylinders: CylinderState[];
  settings: PersistedSettings;
}

const DEFAULT_SETTINGS: PersistedSettings = {
  thresholds: {
    warnPct: 15,
    dangerPct: 5,
  },
  alerts: {
    soundEnabled: true,
    browserNotificationsEnabled: false,
  },
  serviceUuid: GAS_ZERO_BLE.SERVICE_UUID,
  telemetryUuid: GAS_ZERO_BLE.TELEMETRY_CHAR_UUID,
  commandUuid: GAS_ZERO_BLE.COMMAND_CHAR_UUID,
};

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatElapsed(startMs: number): string {
  const totalSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function getAlertLevel(pct: number, thresholds: AlertThresholds): AlertLevel {
  if (pct <= thresholds.dangerPct) return 'danger';
  if (pct <= thresholds.warnPct) return 'warn';
  return 'ok';
}

function createCylinder(input: NewCylinderInput, initialPct = 100): CylinderState {
  const now = Date.now();
  const safePct = Math.min(100, Math.max(0, Math.round(initialPct)));
  const netKg = Number(((input.capacityKg * safePct) / 100).toFixed(2));
  const weightKg = Number((input.tareKg + netKg).toFixed(2));
  const payload: Esp32TelemetryPayload = {
    weight: weightKg,
    tare: input.tareKg,
    net: netKg,
    pct: safePct,
    gas: input.gasCode,
  };

  return {
    id: makeId(),
    label: input.label.trim() || 'Cilindro #001',
    location: input.location.trim() || 'Área principal',
    gasCode: input.gasCode,
    tankPresetId: input.tankPresetId,
    capacityKg: input.capacityKg,
    tareKg: input.tareKg,
    weightKg,
    netKg,
    pct: safePct,
    consumedSessionKg: Number((input.capacityKg - netKg).toFixed(2)),
    refillCount: 0,
    monitoredHours: 0,
    lastRawJson: JSON.stringify(payload),
    history: [
      {
        id: makeId(),
        timestamp: now,
        weightKg,
        netKg,
        pct: safePct,
        gas: input.gasCode,
      },
    ],
    events: [
      {
        id: makeId(),
        timestamp: now,
        type: 'config',
        message: `Cilindro creado — ${GAS_CATALOG[input.gasCode].name} · ${input.capacityKg.toFixed(0)} kg`,
      },
    ],
    warnNotified: false,
    dangerNotified: false,
    updatedAt: now,
  };
}

function buildDefaultStore(): PersistedStore {
  // Migrar configuración v1 si el usuario ya había usado la versión anterior
  try {
    const legacyRaw = localStorage.getItem(LEGACY_V1_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as {
        cylinderLabel?: string;
        gasCode?: GasCode;
        tankPresetId?: TankPresetId;
        capacityKg?: number;
        tareKg?: number;
        thresholds?: AlertThresholds;
        serviceUuid?: string;
        telemetryUuid?: string;
        commandUuid?: string;
      };
      const primary = createCylinder({
        label: legacy.cylinderLabel ?? 'Cilindro #001',
        location: 'Estación principal',
        gasCode: legacy.gasCode ?? 'N2',
        tankPresetId: legacy.tankPresetId ?? 'medium',
        capacityKg: legacy.capacityKg ?? 20,
        tareKg: legacy.tareKg ?? 12,
      });
      return {
        activeCylinderId: primary.id,
        cylinders: [primary],
        settings: {
          ...DEFAULT_SETTINGS,
          thresholds: legacy.thresholds ?? DEFAULT_SETTINGS.thresholds,
          serviceUuid: legacy.serviceUuid ?? DEFAULT_SETTINGS.serviceUuid,
          telemetryUuid: legacy.telemetryUuid ?? DEFAULT_SETTINGS.telemetryUuid,
          commandUuid: legacy.commandUuid ?? DEFAULT_SETTINGS.commandUuid,
        },
      };
    }
  } catch {
    // Continuar con valores por defecto
  }

  const c1 = createCylinder(
    {
      label: 'Cilindro #001',
      location: 'Taller principal',
      gasCode: 'N2',
      tankPresetId: 'medium',
      capacityKg: 20,
      tareKg: 12,
    },
    100
  );
  const c2 = createCylinder(
    {
      label: 'Cilindro #002',
      location: 'Zona soldadura',
      gasCode: 'Ar',
      tankPresetId: 'large',
      capacityKg: 30,
      tareKg: 22,
    },
    68
  );

  return {
    activeCylinderId: c1.id,
    cylinders: [c1, c2],
    settings: DEFAULT_SETTINGS,
  };
}

function loadStore(): PersistedStore {
  try {
    const raw = localStorage.getItem(STORAGE_V2_KEY);
    if (!raw) return buildDefaultStore();
    const parsed = JSON.parse(raw) as Partial<PersistedStore>;
    if (!Array.isArray(parsed.cylinders) || parsed.cylinders.length === 0) {
      return buildDefaultStore();
    }
    const activeExists = parsed.cylinders.some((c) => c.id === parsed.activeCylinderId);
    return {
      activeCylinderId: activeExists
        ? (parsed.activeCylinderId as string)
        : parsed.cylinders[0].id,
      cylinders: parsed.cylinders,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings ?? {}),
        thresholds: {
          ...DEFAULT_SETTINGS.thresholds,
          ...(parsed.settings?.thresholds ?? {}),
        },
        alerts: {
          ...DEFAULT_SETTINGS.alerts,
          ...(parsed.settings?.alerts ?? {}),
        },
      },
    };
  } catch {
    return buildDefaultStore();
  }
}

export function useGasZero() {
  const sessionStartRef = useRef<number>(Date.now());
  const bleClientRef = useRef<GasZeroBleClient | null>(null);
  const serialClientRef = useRef<GasZeroSerialClient | null>(null);
  const lastTelemetryLogMsRef = useRef<number>(0);

  const [store, setStore] = useState<PersistedStore>(() => loadStore());
  const [mode, setMode] = useState<DataSourceMode>('simulator');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');
  const [connectionDetail, setConnectionDetail] = useState<string>(
    'Modo Demo activo · Sin hardware físico'
  );
  const [bleDeviceName, setBleDeviceName] = useState<string | null>(null);
  const [hardwareTelemetry, setHardwareTelemetry] = useState<HardwareTelemetrySnapshot | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => getNotificationPermission());

  // Consumo automático PAUSADO por defecto para que el nivel no baje solo sin aviso
  const [simAutoConsume, setSimAutoConsume] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<'normal' | 'fast'>('normal');

  const [logs, setLogs] = useState<LogEntry[]>(() => [
    {
      id: makeId(),
      elapsed: '00:00',
      message: 'Gas-Zero v2.0 iniciado · Persistencia local activa',
      kind: 'info',
    },
    {
      id: makeId(),
      elapsed: '00:00',
      message: 'Modo Demo listo (consumo automático en pausa). Usa el slider o BLE real.',
      kind: 'ble',
    },
  ]);

  const storeRef = useRef(store);
  storeRef.current = store;

  // Guardar automáticamente todo el estado en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_V2_KEY, JSON.stringify(store));
    } catch {
      // Ignorar errores de almacenamiento lleno
    }
  }, [store]);

  const addLog = useCallback((message: string, kind: LogEntry['kind'] = 'info') => {
    setLogs((prev) => [
      {
        id: makeId(),
        elapsed: formatElapsed(sessionStartRef.current),
        message,
        kind,
      },
      ...prev.slice(0, 69),
    ]);
  }, []);

  const dispatchAlertSideEffects = useCallback(
    (level: Exclude<AlertLevel, 'ok'>, cylinderLabel: string, gasCode: GasCode, nextPct: number) => {
      const { alerts } = storeRef.current.settings;
      const gasName = GAS_CATALOG[gasCode].name;
      if (alerts.soundEnabled) {
        playAlertChime(level);
      }
      if (alerts.browserNotificationsEnabled) {
        const title =
          level === 'danger'
            ? `Gas-Zero · Nivel CRÍTICO (${nextPct}%)`
            : `Gas-Zero · Nivel bajo (${nextPct}%)`;
        const body = `${cylinderLabel} (${gasName}) requiere recarga o reemplazo pronto.`;
        sendBrowserNotification(title, body);
      }
    },
    []
  );

  const activeCylinder = useMemo(() => {
    return (
      store.cylinders.find((c) => c.id === store.activeCylinderId) ?? store.cylinders[0]
    );
  }, [store.activeCylinderId, store.cylinders]);

  const mutateActiveCylinder = useCallback(
    (updater: (cyl: CylinderState, settings: PersistedSettings) => CylinderState) => {
      setStore((prev) => ({
        ...prev,
        cylinders: prev.cylinders.map((c) =>
          c.id === prev.activeCylinderId ? updater(c, prev.settings) : c
        ),
      }));
    },
    []
  );

  // Limpiar BLE y USB Serial al desmontar
  useEffect(() => {
    return () => {
      bleClientRef.current?.disconnect();
      void serialClientRef.current?.disconnect(true);
    };
  }, []);

  const sendHardwareCommand = useCallback(
    (payload: BleCommandPayload) => {
      if (mode === 'ble' && bleClientRef.current?.isConnected) {
        void bleClientRef.current.sendCommand(payload);
        return true;
      }
      if (mode === 'serial' && serialClientRef.current?.isConnected) {
        void serialClientRef.current.sendCommand(payload);
        return true;
      }
      return false;
    },
    [mode]
  );

  const applyNewLevelToActive = useCallback(
    (
      nextNetRaw: number,
      reason: 'auto' | 'sim-step' | 'sim-leak' | 'sim-slider' | 'ble' | 'serial',
      overridePayload?: { weight?: number; tare?: number; gas?: GasCode; rawJson?: string }
    ) => {
      const snapshot = storeRef.current;
      const currentCyl =
        snapshot.cylinders.find((c) => c.id === snapshot.activeCylinderId) ?? snapshot.cylinders[0];
      if (!currentCyl) return;

      const settings = snapshot.settings;
      const gasCode = overridePayload?.gas ?? currentCyl.gasCode;
      const tareKg = overridePayload?.tare ?? currentCyl.tareKg;
      const nextNet = Number(Math.max(0, Math.min(currentCyl.capacityKg, nextNetRaw)).toFixed(2));
      const nextWeight =
        overridePayload?.weight !== undefined
          ? Number(overridePayload.weight.toFixed(2))
          : Number((tareKg + nextNet).toFixed(2));
      const nextPct =
        currentCyl.capacityKg > 0
          ? Math.min(100, Math.max(0, Math.round((nextNet / currentCyl.capacityKg) * 100)))
          : 0;

      const deltaConsumed =
        nextNet < currentCyl.netKg ? Number((currentCyl.netKg - nextNet).toFixed(2)) : 0;
      const payload: Esp32TelemetryPayload = {
        weight: nextWeight,
        tare: tareKg,
        net: nextNet,
        pct: nextPct,
        gas: gasCode,
      };
      const rawJson = overridePayload?.rawJson ?? JSON.stringify(payload);
      const now = Date.now();
      const nextEvents: GasEvent[] = [...currentCyl.events];

      let warnNotified = currentCyl.warnNotified;
      let dangerNotified = currentCyl.dangerNotified;
      const gasName = GAS_CATALOG[gasCode].name;
      let alertToFire: Exclude<AlertLevel, 'ok'> | null = null;

      if (nextPct > settings.thresholds.warnPct) {
        warnNotified = false;
        dangerNotified = false;
      } else if (nextPct <= settings.thresholds.dangerPct && !dangerNotified) {
        dangerNotified = true;
        warnNotified = true;
        nextEvents.unshift({
          id: makeId(),
          timestamp: now,
          type: 'danger',
          message: `Alerta crítica: ${currentCyl.label} (${gasName}) en ${nextPct}%`,
        });
        alertToFire = 'danger';
      } else if (
        nextPct <= settings.thresholds.warnPct &&
        nextPct > settings.thresholds.dangerPct &&
        !warnNotified
      ) {
        warnNotified = true;
        nextEvents.unshift({
          id: makeId(),
          timestamp: now,
          type: 'warn',
          message: `Alerta: nivel bajo (${nextPct}%) en ${currentCyl.label} (${gasName})`,
        });
        alertToFire = 'warn';
      }

      const addedHours =
        reason === 'auto'
          ? 0.35
          : reason === 'sim-step' || reason === 'sim-leak'
          ? 0.75
          : reason === 'serial'
          ? 0.0002
          : 0.1;

      const weightChanged = Math.abs(nextWeight - currentCyl.weightKg) >= 0.03;
      const lastHistTs = currentCyl.history[currentCyl.history.length - 1]?.timestamp ?? 0;
      const shouldAppendHistory =
        reason !== 'serial' || weightChanged || now - lastHistTs >= 12000;

      const nextHistory = shouldAppendHistory
        ? [
            ...currentCyl.history.slice(-59),
            {
              id: makeId(),
              timestamp: now,
              weightKg: nextWeight,
              netKg: nextNet,
              pct: nextPct,
              gas: gasCode,
            },
          ]
        : currentCyl.history;

      const updatedCyl: CylinderState = {
        ...currentCyl,
        gasCode,
        tareKg,
        weightKg: nextWeight,
        netKg: nextNet,
        pct: nextPct,
        consumedSessionKg: Number((currentCyl.consumedSessionKg + deltaConsumed).toFixed(2)),
        monitoredHours: Number((currentCyl.monitoredHours + addedHours).toFixed(2)),
        lastRawJson: rawJson,
        history: nextHistory,
        events: nextEvents.slice(0, 49),
        warnNotified,
        dangerNotified,
        updatedAt: now,
      };

      setStore((prev) => ({
        ...prev,
        cylinders: prev.cylinders.map((c) => (c.id === updatedCyl.id ? updatedCyl : c)),
      }));

      if (reason === 'sim-leak') {
        addLog(`Simulación de consumo alto: ${nextWeight.toFixed(2)} kg (${nextPct}%)`, 'warn');
      } else if (reason === 'sim-slider') {
        addLog(
          `Nivel ajustado manualmente (Demo): ${nextPct}% (${nextNet.toFixed(2)} kg netos)`,
          'info'
        );
      } else if (reason === 'ble') {
        addLog(`BLE JSON: ${rawJson}`, 'data');
      } else if (reason === 'serial') {
        if (weightChanged || now - lastTelemetryLogMsRef.current >= 8000) {
          lastTelemetryLogMsRef.current = now;
          addLog(`USB JSON: ${rawJson}`, 'data');
        }
      } else {
        addLog(`Lectura actualizada: ${nextWeight.toFixed(2)} kg · ${nextPct}% restante`, 'data');
      }

      if (alertToFire) {
        addLog(
          alertToFire === 'danger'
            ? `ALERTA CRÍTICA: ${currentCyl.label} en ${nextPct}%`
            : `Aviso de nivel bajo: ${currentCyl.label} en ${nextPct}%`,
          'warn'
        );
        dispatchAlertSideEffects(alertToFire, currentCyl.label, gasCode, nextPct);
      }
    },
    [addLog, dispatchAlertSideEffects]
  );

  // Bucle de consumo automático SOLO si el usuario lo activa explícitamente
  useEffect(() => {
    if (mode !== 'simulator' || !simAutoConsume) return;
    const intervalMs = simSpeed === 'fast' ? 2200 : 5000;
    const id = window.setInterval(() => {
      const cyl =
        storeRef.current.cylinders.find((c) => c.id === storeRef.current.activeCylinderId) ??
        storeRef.current.cylinders[0];
      if (!cyl || cyl.netKg <= 0) return;
      const baseStep = Math.max(0.15, cyl.capacityKg * (simSpeed === 'fast' ? 0.04 : 0.015));
      const jitter = (Math.random() - 0.35) * baseStep * 0.35;
      applyNewLevelToActive(cyl.netKg - Math.max(0.05, baseStep + jitter), 'auto');
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [applyNewLevelToActive, mode, simAutoConsume, simSpeed]);

  // Acciones realistas vs simulación explícita
  const forceReading = useCallback(() => {
    if (sendHardwareCommand({ cmd: 'READ_NOW' })) {
      return;
    }
    // En Modo Demo, "Forzar lectura" consulta el estado actual SIN restar gas falsamente
    const now = Date.now();
    mutateActiveCylinder((cyl) => ({
      ...cyl,
      updatedAt: now,
      history: [
        ...cyl.history.slice(-59),
        {
          id: makeId(),
          timestamp: now,
          weightKg: cyl.weightKg,
          netKg: cyl.netKg,
          pct: cyl.pct,
          gas: cyl.gasCode,
        },
      ],
    }));
    addLog(
      `Lectura verificada (${activeCylinder.label}): ${activeCylinder.weightKg.toFixed(2)} kg · ${activeCylinder.pct}% (sin cambios)`,
      'data'
    );
  }, [activeCylinder.label, activeCylinder.pct, activeCylinder.weightKg, addLog, mutateActiveCylinder, sendHardwareCommand]);

  const simulateConsumption = useCallback(() => {
    if (mode !== 'simulator') return;
    const drop = Math.max(0.4, activeCylinder.capacityKg * 0.085);
    applyNewLevelToActive(activeCylinder.netKg - drop, 'sim-step');
  }, [activeCylinder.capacityKg, activeCylinder.netKg, applyNewLevelToActive, mode]);

  const simulateLeak = useCallback(() => {
    if (mode !== 'simulator') return;
    const drop = Math.max(1.2, activeCylinder.capacityKg * 0.22);
    applyNewLevelToActive(activeCylinder.netKg - drop, 'sim-leak');
  }, [activeCylinder.capacityKg, activeCylinder.netKg, applyNewLevelToActive, mode]);

  const setSimulatedPct = useCallback(
    (targetPct: number) => {
      if (mode !== 'simulator') return;
      const clamped = Math.min(100, Math.max(0, Math.round(targetPct)));
      const targetNet = (activeCylinder.capacityKg * clamped) / 100;
      applyNewLevelToActive(targetNet, 'sim-slider');
    },
    [activeCylinder.capacityKg, applyNewLevelToActive, mode]
  );

  const registerRefill = useCallback(() => {
    const now = Date.now();
    mutateActiveCylinder((cyl) => {
      const fullWeight = Number((cyl.tareKg + cyl.capacityKg).toFixed(2));
      const payload: Esp32TelemetryPayload = {
        weight: fullWeight,
        tare: cyl.tareKg,
        net: cyl.capacityKg,
        pct: 100,
        gas: cyl.gasCode,
      };
      return {
        ...cyl,
        weightKg: fullWeight,
        netKg: cyl.capacityKg,
        pct: 100,
        consumedSessionKg: 0,
        monitoredHours: 0,
        refillCount: cyl.refillCount + 1,
        lastRawJson: JSON.stringify(payload),
        warnNotified: false,
        dangerNotified: false,
        updatedAt: now,
        history: [
          ...cyl.history.slice(-59),
          {
            id: makeId(),
            timestamp: now,
            weightKg: fullWeight,
            netKg: cyl.capacityKg,
            pct: 100,
            gas: cyl.gasCode,
          },
        ],
        events: [
          {
            id: makeId(),
            timestamp: now,
            type: 'refill',
            message: `Recarga registrada — ${GAS_CATALOG[cyl.gasCode].name} al 100% (${cyl.capacityKg.toFixed(1)} kg)`,
          },
          ...cyl.events.slice(0, 48),
        ],
      };
    });
    addLog(`Recarga registrada en ${activeCylinder.label}: 100%`, 'info');
  }, [activeCylinder.label, addLog, mutateActiveCylinder]);

  const applyTare = useCallback(() => {
    const now = Date.now();
    const sent = sendHardwareCommand({ cmd: 'TARE' });
    mutateActiveCylinder((cyl) => ({
      ...cyl,
      events: [
        {
          id: makeId(),
          timestamp: now,
          type: 'tare',
          message: sent
            ? `Comando de tara (0 kg) enviado a la báscula (${mode === 'serial' ? 'USB' : 'BLE'})`
            : `Tara verificada (${cyl.tareKg.toFixed(2)} kg)`,
        },
        ...cyl.events.slice(0, 48),
      ],
    }));
    addLog(
      sent
        ? `Cero de báscula (TARE) enviado por ${mode === 'serial' ? 'USB' : 'BLE'}`
        : `Tara aplicada en ${activeCylinder.label}: ${activeCylinder.tareKg.toFixed(2)} kg`,
      'info'
    );
  }, [activeCylinder.label, activeCylinder.tareKg, addLog, mode, mutateActiveCylinder, sendHardwareCommand]);

  const calibrateHardware = useCallback(
    (knownWeightKg: number) => {
      if (!Number.isFinite(knownWeightKg) || knownWeightKg <= 0.05) {
        addLog('Ingresa un peso conocido mayor a 0.05 kg para calibrar', 'warn');
        return false;
      }
      const sent = sendHardwareCommand({
        cmd: 'CALIBRATE',
        knownWeightKg: Number(knownWeightKg.toFixed(2)),
      });
      if (sent) {
        addLog(`Calibrando báscula con peso conocido de ${knownWeightKg.toFixed(2)} kg…`, 'ble');
      } else {
        addLog('Conecta tu Arduino UNO (USB) o ESP32 (BLE) antes de calibrar', 'warn');
      }
      return sent;
    },
    [addLog, sendHardwareCommand]
  );

  const selectGas = useCallback(
    (gasCode: GasCode) => {
      const now = Date.now();
      const gas = GAS_CATALOG[gasCode];
      mutateActiveCylinder((cyl) => {
        const payload: Esp32TelemetryPayload = {
          weight: cyl.weightKg,
          tare: cyl.tareKg,
          net: cyl.netKg,
          pct: cyl.pct,
          gas: gasCode,
        };
        return {
          ...cyl,
          gasCode,
          lastRawJson: JSON.stringify(payload),
          updatedAt: now,
          events: [
            {
              id: makeId(),
              timestamp: now,
              type: 'config',
              message: `Tipo de gas actualizado a ${gas.name} (${gas.symbol})`,
            },
            ...cyl.events.slice(0, 48),
          ],
        };
      });
      sendHardwareCommand({
        cmd: 'SET_CONFIG',
        gas: gasCode,
        tare: activeCylinder.tareKg,
        capacity: activeCylinder.capacityKg,
      });
      addLog(`Gas cambiado en ${activeCylinder.label}: ${gas.name} (${gas.symbol})`, 'info');
    },
    [activeCylinder.capacityKg, activeCylinder.label, activeCylinder.tareKg, addLog, mutateActiveCylinder, sendHardwareCommand]
  );

  const selectTankPreset = useCallback(
    (presetId: Exclude<TankPresetId, 'custom'>) => {
      const preset = TANK_PRESETS.find((t) => t.id === presetId);
      if (!preset) return;
      const now = Date.now();
      mutateActiveCylinder((cyl) => {
        const nextNet = Number(((preset.capacityKg * cyl.pct) / 100).toFixed(2));
        const nextWeight = Number((preset.tareKg + nextNet).toFixed(2));
        const payload: Esp32TelemetryPayload = {
          weight: nextWeight,
          tare: preset.tareKg,
          net: nextNet,
          pct: cyl.pct,
          gas: cyl.gasCode,
        };
        return {
          ...cyl,
          tankPresetId: presetId,
          capacityKg: preset.capacityKg,
          tareKg: preset.tareKg,
          netKg: nextNet,
          weightKg: nextWeight,
          lastRawJson: JSON.stringify(payload),
          updatedAt: now,
          events: [
            {
              id: makeId(),
              timestamp: now,
              type: 'config',
              message: `Capacidad cambiada a Tanque ${preset.shortLabel} (${preset.capacityKg} kg / Tara ${preset.tareKg} kg)`,
            },
            ...cyl.events.slice(0, 48),
          ],
        };
      });
      sendHardwareCommand({
        cmd: 'SET_CONFIG',
        gas: activeCylinder.gasCode,
        tare: preset.tareKg,
        capacity: preset.capacityKg,
      });
      addLog(`Tanque ${preset.shortLabel} aplicado en ${activeCylinder.label}`, 'info');
    },
    [activeCylinder.gasCode, activeCylinder.label, addLog, mutateActiveCylinder, sendHardwareCommand]
  );

  const updateCustomTank = useCallback(
    (capacityKg: number, tareKg: number) => {
      const safeCap = Math.max(1, Math.min(180, Number(capacityKg.toFixed(2))));
      const safeTare = Math.max(0, Math.min(150, Number(tareKg.toFixed(2))));
      const now = Date.now();
      mutateActiveCylinder((cyl) => {
        const nextNet = Number(((safeCap * cyl.pct) / 100).toFixed(2));
        const nextWeight = Number((safeTare + nextNet).toFixed(2));
        const payload: Esp32TelemetryPayload = {
          weight: nextWeight,
          tare: safeTare,
          net: nextNet,
          pct: cyl.pct,
          gas: cyl.gasCode,
        };
        return {
          ...cyl,
          tankPresetId: 'custom',
          capacityKg: safeCap,
          tareKg: safeTare,
          netKg: nextNet,
          weightKg: nextWeight,
          lastRawJson: JSON.stringify(payload),
          updatedAt: now,
          events: [
            {
              id: makeId(),
              timestamp: now,
              type: 'config',
              message: `Tanque personalizado: Cap ${safeCap} kg · Tara ${safeTare} kg`,
            },
            ...cyl.events.slice(0, 48),
          ],
        };
      });
      sendHardwareCommand({
        cmd: 'SET_CONFIG',
        gas: activeCylinder.gasCode,
        tare: safeTare,
        capacity: safeCap,
      });
      addLog(`Parámetros personalizados aplicados: ${safeCap} kg / Tara ${safeTare} kg`, 'info');
    },
    [activeCylinder.gasCode, addLog, mutateActiveCylinder, sendHardwareCommand]
  );

  // Gestión de flota multi-cilindro
  const selectCylinder = useCallback(
    (cylinderId: string) => {
      setStore((prev) => {
        if (!prev.cylinders.some((c) => c.id === cylinderId)) return prev;
        return { ...prev, activeCylinderId: cylinderId };
      });
      const target = storeRef.current.cylinders.find((c) => c.id === cylinderId);
      if (target) {
        addLog(`Cambiado a ${target.label} (${GAS_CATALOG[target.gasCode].symbol})`, 'info');
      }
    },
    [addLog]
  );

  const addCylinder = useCallback(
    (input: NewCylinderInput) => {
      const next = createCylinder(input, 100);
      setStore((prev) => ({
        ...prev,
        activeCylinderId: next.id,
        cylinders: [...prev.cylinders, next],
      }));
      addLog(`Nuevo cilindro agregado: ${next.label} (${GAS_CATALOG[next.gasCode].name})`, 'info');
      return next.id;
    },
    [addLog]
  );

  const deleteCylinder = useCallback(
    (cylinderId: string) => {
      setStore((prev) => {
        if (prev.cylinders.length <= 1) return prev;
        const remaining = prev.cylinders.filter((c) => c.id !== cylinderId);
        const nextActive =
          prev.activeCylinderId === cylinderId ? remaining[0].id : prev.activeCylinderId;
        return {
          ...prev,
          activeCylinderId: nextActive,
          cylinders: remaining,
        };
      });
      addLog('Cilindro eliminado de la flota', 'info');
    },
    [addLog]
  );

  const updateCylinderMeta = useCallback(
    (label: string, location: string) => {
      mutateActiveCylinder((cyl) => ({
        ...cyl,
        label: label.trim() || cyl.label,
        location: location.trim() || 'Área principal',
      }));
    },
    [mutateActiveCylinder]
  );

  const recordHardwarePacket = useCallback((payload: Esp32TelemetryPayload, rawJson: string) => {
    setHardwareTelemetry((prev) => ({
      payload,
      rawJson,
      packetCount: (prev?.packetCount ?? 0) + 1,
      receivedAt: Date.now(),
    }));
  }, []);

  // BLE real
  const connectBle = useCallback(async () => {
    await serialClientRef.current?.disconnect(true);
    if (!bleClientRef.current) {
      bleClientRef.current = new GasZeroBleClient();
    }
    setMode('ble');
    setSimAutoConsume(false);
    const { serviceUuid, telemetryUuid, commandUuid } = storeRef.current.settings;

    await bleClientRef.current.connect(
      {
        onTelemetry: (payload, rawJson) => {
          recordHardwarePacket(payload, rawJson);
          applyNewLevelToActive(payload.net, 'ble', {
            weight: payload.weight,
            tare: payload.tare,
            gas: payload.gas,
            rawJson,
          });
        },
        onStatusChange: (status, detail) => {
          setConnectionStatus(status);
          if (detail) setConnectionDetail(detail);
          setBleDeviceName(bleClientRef.current?.deviceName ?? null);
          if (status === 'connected') {
            const devName = bleClientRef.current?.deviceName ?? 'ESP32 Gas-Zero';
            mutateActiveCylinder((cyl) => ({
              ...cyl,
              events: [
                {
                  id: makeId(),
                  timestamp: Date.now(),
                  type: 'ble',
                  message: `Conectado por BLE a ${devName}`,
                },
                ...cyl.events.slice(0, 48),
              ],
            }));
          }
        },
        onLog: addLog,
      },
      serviceUuid,
      telemetryUuid,
      commandUuid
    );
  }, [addLog, applyNewLevelToActive, mutateActiveCylinder, recordHardwarePacket]);

  const disconnectBle = useCallback(() => {
    bleClientRef.current?.disconnect();
    setBleDeviceName(null);
    setConnectionStatus('disconnected');
    setConnectionDetail('Esperando enlace BLE con ESP32');
  }, []);

  const createSerialCallbacks = useCallback(
    () => ({
      onTelemetry: (payload: Esp32TelemetryPayload, rawJson: string) => {
        recordHardwarePacket(payload, rawJson);
        const snapshot = storeRef.current;
        const currentCyl =
          snapshot.cylinders.find((c) => c.id === snapshot.activeCylinderId) ??
          snapshot.cylinders[0];
        const activeTare = currentCyl ? currentCyl.tareKg : payload.tare;
        const computedNet = Math.max(0, payload.weight - activeTare);
        applyNewLevelToActive(computedNet, 'serial', {
          weight: payload.weight,
          tare: activeTare,
          gas: currentCyl ? currentCyl.gasCode : payload.gas,
          rawJson,
        });
      },
      onStatusChange: (
        status: 'connecting' | 'connected' | 'disconnected' | 'error',
        detail?: string
      ) => {
        setConnectionStatus(status);
        if (detail) setConnectionDetail(detail);
        setBleDeviceName(serialClientRef.current?.deviceName ?? null);
        if (status === 'connected') {
          setMode('serial');
          setSimAutoConsume(false);
          const devName = serialClientRef.current?.deviceName ?? 'Arduino UNO (USB)';
          mutateActiveCylinder((cyl) => ({
            ...cyl,
            events: [
              {
                id: makeId(),
                timestamp: Date.now(),
                type: 'ble',
                message: `Conectado por cable USB a ${devName}`,
              },
              ...cyl.events.slice(0, 48),
            ],
          }));
        }
      },
      onLog: addLog,
    }),
    [addLog, applyNewLevelToActive, mutateActiveCylinder, recordHardwarePacket]
  );

  const scheduleSerialConfigSync = useCallback(() => {
    // Arduino UNO se reinicia ~1.6 s al abrir el puerto USB; sincronizamos configuracion despues
    window.setTimeout(() => {
      if (!serialClientRef.current?.isConnected) return;
      const snapshot = storeRef.current;
      const currentCyl =
        snapshot.cylinders.find((c) => c.id === snapshot.activeCylinderId) ??
        snapshot.cylinders[0];
      if (currentCyl) {
        void serialClientRef.current.sendCommand({
          cmd: 'SET_CONFIG',
          gas: currentCyl.gasCode,
          tare: currentCyl.tareKg,
          capacity: currentCyl.capacityKg,
        });
      }
    }, 2000);
  }, []);

  // Cable USB (Web Serial API para Arduino UNO + HX711)
  const connectSerial = useCallback(async () => {
    bleClientRef.current?.disconnect();
    if (!serialClientRef.current) {
      serialClientRef.current = new GasZeroSerialClient();
    }
    setMode('serial');
    setSimAutoConsume(false);

    const ok = await serialClientRef.current.connect(createSerialCallbacks(), 115200);
    if (ok) {
      scheduleSerialConfigSync();
    }
  }, [createSerialCallbacks, scheduleSerialConfigSync]);

  // Auto-reconexión silenciosa para clientes que ya autorizaron su Arduino USB antes
  const autoConnectAttemptedRef = useRef(false);
  useEffect(() => {
    if (autoConnectAttemptedRef.current || !isWebSerialSupported()) return;
    autoConnectAttemptedRef.current = true;
    if (!serialClientRef.current) {
      serialClientRef.current = new GasZeroSerialClient();
    }
    void serialClientRef.current.autoReconnect(createSerialCallbacks(), 115200).then((ok) => {
      if (ok) {
        scheduleSerialConfigSync();
      }
    });
  }, [createSerialCallbacks, scheduleSerialConfigSync]);

  const disconnectSerial = useCallback(() => {
    void serialClientRef.current?.disconnect(false);
    setBleDeviceName(null);
    setConnectionStatus('disconnected');
    setConnectionDetail('Cable USB desconectado');
  }, []);

  const switchToSimulator = useCallback(() => {
    bleClientRef.current?.disconnect();
    void serialClientRef.current?.disconnect(true);
    setBleDeviceName(null);
    setHardwareTelemetry(null);
    setMode('simulator');
    setConnectionStatus('connected');
    setConnectionDetail('Modo Demo activo · Sin hardware físico');
    addLog('Modo Demo (simulador) activado', 'info');
  }, [addLog]);

  // Ajustes, alertas y notificaciones
  const updateThresholds = useCallback((next: AlertThresholds) => {
    const warnPct = Math.min(50, Math.max(5, Math.round(next.warnPct)));
    const dangerPct = Math.min(warnPct - 1, Math.max(1, Math.round(next.dangerPct)));
    setStore((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        thresholds: { warnPct, dangerPct },
      },
    }));
  }, []);

  const toggleSoundAlerts = useCallback(() => {
    setStore((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        alerts: {
          ...prev.settings.alerts,
          soundEnabled: !prev.settings.alerts.soundEnabled,
        },
      },
    }));
  }, []);

  const toggleBrowserNotifications = useCallback(async () => {
    const current = storeRef.current.settings.alerts.browserNotificationsEnabled;
    if (!current) {
      const perm = await requestBrowserNotificationPermission();
      setNotificationPermission(perm);
      if (perm !== 'granted') {
        addLog('Permiso de notificaciones del navegador denegado o no soportado', 'warn');
        return;
      }
    }
    setStore((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        alerts: {
          ...prev.settings.alerts,
          browserNotificationsEnabled: !prev.settings.alerts.browserNotificationsEnabled,
        },
      },
    }));
  }, [addLog]);

  const testAlert = useCallback(
    (level: Exclude<AlertLevel, 'ok'> = 'warn') => {
      playAlertChime(level);
      if (storeRef.current.settings.alerts.browserNotificationsEnabled) {
        sendBrowserNotification(
          `Gas-Zero · Prueba de alerta (${level === 'danger' ? 'Crítica' : 'Baja'})`,
          `${activeCylinder.label} · ${GAS_CATALOG[activeCylinder.gasCode].name} (${activeCylinder.pct}%)`
        );
      }
      addLog(`Prueba de alerta ${level === 'danger' ? 'crítica' : 'nivel bajo'} ejecutada`, 'warn');
    },
    [activeCylinder.gasCode, activeCylinder.label, activeCylinder.pct, addLog]
  );

  const updateBleUuids = useCallback(
    (serviceUuid: string, telemetryUuid: string, commandUuid: string) => {
      setStore((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          serviceUuid: serviceUuid.trim() || GAS_ZERO_BLE.SERVICE_UUID,
          telemetryUuid: telemetryUuid.trim() || GAS_ZERO_BLE.TELEMETRY_CHAR_UUID,
          commandUuid: commandUuid.trim() || GAS_ZERO_BLE.COMMAND_CHAR_UUID,
        },
      }));
    },
    []
  );

  const resetAllData = useCallback(() => {
    localStorage.removeItem(STORAGE_V2_KEY);
    localStorage.removeItem(LEGACY_V1_KEY);
    const fresh = buildDefaultStore();
    setStore(fresh);
    setSimAutoConsume(false);
    addLog('Datos locales restablecidos a valores iniciales', 'info');
  }, [addLog]);

  const exportHistoryCsv = useCallback(() => {
    const header = 'Cilindro,Ubicacion,Fecha_Hora,Gas,Peso_Bruto_kg,Gas_Neto_kg,Nivel_pct';
    const rows = activeCylinder.history.map((h) =>
      [
        `"${activeCylinder.label.replace(/"/g, '""')}"`,
        `"${activeCylinder.location.replace(/"/g, '""')}"`,
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
    a.download = `gas-zero-${activeCylinder.gasCode}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addLog(`Historial de ${activeCylinder.label} exportado a CSV`, 'info');
  }, [activeCylinder, addLog]);

  const alertLevel = useMemo(
    () => getAlertLevel(activeCylinder.pct, store.settings.thresholds),
    [activeCylinder.pct, store.settings.thresholds]
  );

  const fleetSummary = useMemo(() => {
    let ok = 0;
    let warn = 0;
    let danger = 0;
    for (const c of store.cylinders) {
      const lvl = getAlertLevel(c.pct, store.settings.thresholds);
      if (lvl === 'danger') danger += 1;
      else if (lvl === 'warn') warn += 1;
      else ok += 1;
    }
    return {
      total: store.cylinders.length,
      ok,
      warn,
      danger,
      alertsCount: warn + danger,
    };
  }, [store.cylinders, store.settings.thresholds]);

  const avgDailyConsumptionKg = useMemo(() => {
    if (activeCylinder.consumedSessionKg <= 0 || activeCylinder.monitoredHours <= 0.1) return null;
    return Number(((activeCylinder.consumedSessionKg / activeCylinder.monitoredHours) * 24).toFixed(2));
  }, [activeCylinder.consumedSessionKg, activeCylinder.monitoredHours]);

  const autonomyDays = useMemo(() => {
    if (!avgDailyConsumptionKg || avgDailyConsumptionKg <= 0 || activeCylinder.netKg <= 0) {
      return null;
    }
    return Number((activeCylinder.netKg / avgDailyConsumptionKg).toFixed(1));
  }, [activeCylinder.netKg, avgDailyConsumptionKg]);

  const gasConfig = GAS_CATALOG[activeCylinder.gasCode];

  return {
    cylinders: store.cylinders,
    activeCylinder,
    settings: store.settings,
    gasConfig,
    fleetSummary,
    mode,
    connectionStatus,
    connectionDetail,
    bleDeviceName,
    hardwareTelemetry,
    bleSupported: isWebBluetoothSupported(),
    serialSupported: isWebSerialSupported(),
    notificationPermission,
    simAutoConsume,
    setSimAutoConsume,
    simSpeed,
    setSimSpeed,
    alertLevel,
    avgDailyConsumptionKg,
    autonomyDays,
    logs,
    selectCylinder,
    addCylinder,
    deleteCylinder,
    updateCylinderMeta,
    selectGas,
    selectTankPreset,
    updateCustomTank,
    forceReading,
    simulateConsumption,
    simulateLeak,
    setSimulatedPct,
    registerRefill,
    applyTare,
    calibrateHardware,
    connectBle,
    disconnectBle,
    connectSerial,
    disconnectSerial,
    switchToSimulator,
    updateThresholds,
    toggleSoundAlerts,
    toggleBrowserNotifications,
    testAlert,
    updateBleUuids,
    resetAllData,
    exportHistoryCsv,
  };
}
