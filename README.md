# Gas-Zero · Medidor Inteligente de Gases con Báscula IoT

Aplicación web responsiva (móvil y escritorio · PWA) en **React + TypeScript + Vite** para monitorear cilindros industriales y medicinales de gas (`N₂`, `Ar`, `CO₂`, `O₂`, `LP`) con integración preparada para **ESP32 DevKit V1 + HX711 vía Bluetooth Low Energy (Web Bluetooth API)** y un **Simulador IoT integrado** para desarrollar sin hardware físico.

## Inicio rápido

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` en tu navegador (Chrome o Edge recomendado para Web Bluetooth).

## Funcionalidades actuales (Fase 1: App y Dashboard)

- **Monitor en tiempo real (`Inicio`):** Gauge circular SVG con brillo dinámico, cilindro animado por nivel, peso bruto/neto/tara/capacidad y cálculo de autonomía estimada.
- **Selectores de gas y cilindro:** `N₂`, `Ar`, `CO₂`, `O₂` y `LP` (con paleta de acento propia), presets de capacidad/tara (`10 kg`, `20 kg`, `30 kg`, `50 kg`) y edición manual de tara y capacidad persistida en `localStorage`.
- **Simulador ESP32 integrado:** Controles para pausar/reanudar consumo, cambiar velocidad, forzar lectura, simular consumo alto, aplicar tara y registrar recarga/cambio.
- **Historial y analítica (`Historial`):** KPIs de consumo, gráfica interactiva de barras por nivel con código de color, línea de tiempo de eventos y exportación a **CSV**.
- **Ahorro y seguridad (`Ahorrar gas`):** Consejos rotativos y notas de seguridad específicas por tipo de gas.
- **Conexión BLE y ajustes (`BLE / Ajustes`):** Cliente Web Bluetooth listo para enlazar el futuro ESP32, umbrales de alerta configurables y UUIDs GATT editables.

## Contrato BLE previsto (Fase 2: Firmware ESP32 + HX711)

- **Service UUID:** `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- **Telemetry Characteristic (Notify):** `beb5483e-36e1-4688-b7f5-ea07361b26a8`
- **Command Characteristic (Write):** `6e400002-b5a3-f393-e0a9-e50e24dcca9e`
- **Payload JSON (ESP32 → App):**
  ```json
  {"weight": 32.0, "tare": 12.0, "net": 20.0, "pct": 100, "gas": "N2"}
  ```
