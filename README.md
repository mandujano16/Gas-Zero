# Gas-Zero · Medidor Inteligente de Gases con Báscula IoT

Aplicación web responsiva (móvil y escritorio · PWA) en **React + TypeScript + Vite** para monitorear cilindros industriales, medicinales y domésticos de gas (`N₂`, `Ar`, `CO₂`, `O₂`, `LP`) conectada en tiempo real a una báscula con **Arduino UNO + HX711 vía USB (Web Serial)** o **ESP32 DevKit V1 + HX711 vía Bluetooth (Web Bluetooth BLE)**, con **Modo Demo** integrado para pruebas sin hardware.

---

## Documentación del Proyecto

| Documento | Para quién es | Contenido |
|---|---|---|
| **[Manual de Uso para Clientes (PDF)](docs/Manual_de_Usuario_Gas_Zero.pdf)** · [Markdown](docs/MANUAL_DE_USUARIO_CLIENTE.md) | Compradores y usuarios finales *(desde cero absoluto)* | Cómo conectar la báscula, leer el dashboard, elegir gas/tanque, tarear, calibrar, usar LCD/pilas, preguntas frecuentes y tarjeta imprimible de inicio rápido con espacio para QR. |
| **[Documentación Técnica Completa (PDF)](docs/Documentacion_Tecnica_Gas_Zero.pdf)** · [Markdown](docs/DOCUMENTACION_TECNICA.md) | Desarrolladores, técnicos y fabricantes | Arquitectura con diagramas, estructura de código, contrato JSON bidireccional, firmware UNO/ESP32, pinout, despliegue en Netlify y checklist de control de calidad. |
| **[Guía de Hardware y Conexiones](firmware/GUIA_HARDWARE_Y_CONEXIONES.md)** | Armado físico paso a paso | Lista de compras (BOM), puente de Wheatstone de 4 celdas de 50 kg, pinout y subida de firmware en Arduino IDE. |

---

## Funcionalidades principales

- **Conexión Plug & Play por Cable USB (Arduino UNO) y BLE (ESP32):** enlace directo desde Chrome o Edge sin instalar software intermedio, con **auto-reconexión automática** para clientes que ya autorizaron su báscula.
- **Monitor en tiempo real (`Monitor`):** gauge circular SVG dinámico por tipo de gas, cilindro animado, peso bruto, gas neto, tara, capacidad y autonomía estimada.
- **Tara y calibración desde el Dashboard:** botón principal **`Tarear báscula (0 kg)`** y calibración rápida guardada permanentemente en la EEPROM del Arduino (o NVS del ESP32).
- **Panel de Información del Arduino en vivo:** estado del sensor HX711, peso bruto/neto/tara/capacidad reportados por la placa, lectura cruda HX711, factor de calibración, contador de paquetes, tiempo encendido, JSON crudo y consola en tiempo real.
- **Multi-cilindro (`Flota`):** alta, ubicación, seguimiento simultáneo y cambio rápido entre múltiples cilindros con resumen de alertas.
- **Historial y exportación (`Historial`):** gráfica de barras por nivel, KPIs de consumo diario, registro de eventos y descarga a **CSV** (compatible con Excel).
- **Alertas reales y consejos (`Ahorro`):** alertas sonoras (Web Audio API), notificaciones nativas del navegador y notas de seguridad por gas.
- **Persistencia local automática:** toda la flota, historial y ajustes se guardan automáticamente en `localStorage`.

---

## Inicio rápido (Desarrollo local)

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` en **Chrome o Edge** (requeridos para Web Serial USB y Web Bluetooth).

Para generar el build de producción (también usado automáticamente por Netlify vía `netlify.toml`):

```bash
npm run build
```

---

## Firmware incluido (`firmware/`)

- **[`firmware/gas_zero_uno/gas_zero_uno.ino`](firmware/gas_zero_uno/gas_zero_uno.ino)** — Firmware oficial **Arduino UNO v1.1.0** (Web Serial `115200`, JSON completo con `raw`/`factor`/`hxOk`/`uptime`, EEPROM persistente, soporte opcional para **LCD 16x2 I2C** y **botón físico de tara en Pin 2**).
- **[`firmware/gas_zero_esp32/gas_zero_esp32.ino`](firmware/gas_zero_esp32/gas_zero_esp32.ino)** — Firmware oficial **ESP32 BLE GATT v1.0.0** (NVS persistente, ahorro de energía y LCD 16x2 I2C opcional).
- **[`firmware/calibracion_hx711/calibracion_hx711.ino`](firmware/calibracion_hx711/calibracion_hx711.ino)** — Utilidad rápida de calibración para ESP32.
