# Gas-Zero · Medidor Inteligente de Gases con Báscula IoT

Aplicación web responsiva (móvil y escritorio · PWA) en **React + TypeScript + Vite** para monitorear cilindros industriales y medicinales de gas (`N₂`, `Ar`, `CO₂`, `O₂`, `LP`) con integración preparada para **ESP32 DevKit V1 + HX711 vía Bluetooth Low Energy (Web Bluetooth API)** y un **Simulador IoT integrado** para desarrollar sin hardware físico.

## Inicio rápido

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` en tu navegador (Chrome o Edge recomendado para Web Bluetooth).

## Funcionalidades actuales (Fase 2: App de Producción)

- **Multi-cilindro (`Flota`):** Alta, edición, ubicación, eliminación y cambio rápido entre múltiples cilindros con resumen de estado (Óptimos, Nivel bajo, Críticos) y badge de alertas activas.
- **Monitor en tiempo real (`Monitor`):** Gauge circular SVG con brillo dinámico, cilindro animado por nivel, peso bruto/neto/tara/capacidad y cálculo de autonomía estimada.
- **Persistencia local automática:** Todos los cilindros, historiales, eventos, recargas y ajustes se guardan automáticamente en `localStorage`.
- **Alertas reales:** Alertas sonoras sintetizadas (Web Audio API), notificaciones nativas del navegador (Notification API) y botones de prueba de alerta.
- **Laboratorio Demo separado de lectura real:** `Forzar lectura` consulta el nivel actual sin restar gas; las pruebas sin hardware se controlan explícitamente con slider (`0%–100%`), botones de consumo/fuga y auto-consumo opcional.
- **Historial y analítica (`Historial`):** KPIs de consumo, gráfica interactiva de barras por nivel, línea de tiempo de eventos y exportación a **CSV**.
- **Ahorro y seguridad (`Ahorro`):** Consejos rotativos y notas de seguridad específicas por gas (`N₂`, `Ar`, `CO₂`, `O₂`, `LP`).
- **Conexión BLE y ajustes (`BLE / Ajustes`):** Cliente Web Bluetooth listo para enlazar el futuro ESP32, umbrales de alerta configurables y UUIDs GATT editables.

## Contrato BLE previsto (Fase 2: Firmware ESP32 + HX711)

- **Service UUID:** `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- **Telemetry Characteristic (Notify):** `beb5483e-36e1-4688-b7f5-ea07361b26a8`
- **Command Characteristic (Write):** `6e400002-b5a3-f393-e0a9-e50e24dcca9e`
- **Payload JSON (ESP32 → App):**
  ```json
  {"weight": 32.0, "tare": 12.0, "net": 20.0, "pct": 100, "gas": "N2"}
  ```
