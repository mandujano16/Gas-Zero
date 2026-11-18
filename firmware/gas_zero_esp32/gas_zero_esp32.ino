/*
 * ============================================================================
 *  GAS-ZERO — Firmware ESP32 DevKit V1 + HX711 + BLE GATT (v1.0.0)
 * ============================================================================
 *  Compatible 100% con la App Web React Gas-Zero (Web Bluetooth API).
 *
 *  LIBRERÍAS NECESARIAS EN ARDUINO IDE:
 *   1. Tarjetas ESP32: "esp32" by Espressif Systems (desde Gestor de Tarjetas)
 *   2. Librería HX711: "HX711 Arduino Library" by Bogdan Necula
 *   3. (Solo si activas USE_LCD_I2C = 1): "LiquidCrystal I2C" by Frank de Brabander
 *
 *  CONEXIONES PRINCIPALES:
 *   HX711 VCC  -> ESP32 3V3   (IMPORTANTE: usar 3.3V para proteger el ESP32)
 *   HX711 GND  -> ESP32 GND
 *   HX711 DT   -> ESP32 GPIO 4
 *   HX711 SCK  -> ESP32 GPIO 5
 *   (Opcional LCD I2C: SDA -> GPIO 21, SCL -> GPIO 22, VCC -> VIN 5V, GND -> GND)
 * ============================================================================
 */

#include <Arduino.h>
#include <HX711.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// Cambia a 1 si conectas la pantalla LCD 16x2 con adaptador I2C
#define USE_LCD_I2C 0

#if USE_LCD_I2C
  #include <Wire.h>
  #include <LiquidCrystal_I2C.h>
  LiquidCrystal_I2C lcd(0x27, 16, 2); // Si no muestra texto, prueba 0x3F
#endif

// ==================== CONFIGURACIÓN DE PINES ====================
static const uint8_t PIN_HX711_DOUT = 4;
static const uint8_t PIN_HX711_SCK  = 5;
static const uint8_t PIN_LED_STATUS = 2; // LED azul integrado en ESP32 DevKit V1

// ==================== UUIDs BLE (COINCIDEN CON src/constants/ble.ts) ====================
#define BLE_DEVICE_NAME     "GasZero-001"
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define TELEMETRY_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8" // Notify (ESP32 -> App)
#define COMMAND_CHAR_UUID   "6e400002-b5a3-f393-e0a9-e50e24dcca9e" // Write  (App -> ESP32)

// ==================== PARÁMETROS DE FILTRO Y ENERGÍA ====================
static const uint8_t  HX_SAMPLES        = 8;     // Promedio por lectura HX711
static const float    EMA_ALPHA         = 0.35f; // Filtro paso bajo digital (0.1 muy suave - 0.6 rápido)
static const uint32_t INTERVAL_CONN_MS  = 1500;  // Envío cada 1.5 s cuando hay app conectada
static const uint32_t INTERVAL_IDLE_MS  = 4000;  // Lectura cada 4 s en espera (ahorro energético)

// ==================== OBJETOS GLOBALES ====================
HX711 scale;
Preferences prefs;

BLEServer*         pServer        = nullptr;
BLECharacteristic* pTelemetryChar = nullptr;
BLECharacteristic* pCommandChar   = nullptr;

volatile bool deviceConnected    = false;
volatile bool oldDeviceConnected = false;
volatile bool forceReadFlag      = false;
volatile bool pendingZeroFlag    = false;
volatile bool pendingCalibFlag   = false;
float         pendingCalibKg     = 0.0f;

// ==================== ESTADO PERSISTENTE DEL CILINDRO ====================
float  scaleFactor     = 22800.0f; // Reemplazar usando calibracion_hx711.ino
float  cylinderTareKg  = 12.0f;    // Peso del cilindro vacío (kg)
float  capacityKg      = 20.0f;    // Capacidad nominal de gas (kg)
String gasCode         = "N2";     // N2, Ar, CO2, O2, LP

float  filteredWeightKg = 0.0f;
bool   filterInitialized = false;
uint32_t lastReadMs = 0;

// ==================== UTILIDADES DE MEMORIA (NVS) ====================
void loadConfig() {
  prefs.begin("gaszero", true);
  scaleFactor    = prefs.getFloat("scale", 22800.0f);
  cylinderTareKg = prefs.getFloat("tare", 12.0f);
  capacityKg     = prefs.getFloat("cap", 20.0f);
  gasCode        = prefs.getString("gas", "N2");
  prefs.end();

  if (scaleFactor == 0.0f || isnan(scaleFactor)) scaleFactor = 22800.0f;
  if (capacityKg <= 0.1f || isnan(capacityKg))   capacityKg = 20.0f;
  if (cylinderTareKg < 0.0f || isnan(cylinderTareKg)) cylinderTareKg = 0.0f;
}

void saveConfig() {
  prefs.begin("gaszero", false);
  prefs.putFloat("scale", scaleFactor);
  prefs.putFloat("tare", cylinderTareKg);
  prefs.putFloat("cap", capacityKg);
  prefs.putString("gas", gasCode);
  prefs.end();
  Serial.println("[NVS] Configuración guardada en memoria permanente.");
}

// ==================== PARSER LIGERO DE COMANDOS JSON ====================
// Extrae un número después de una clave JSON, ej: "tare":12.5
bool extractJsonFloat(const String& json, const char* key, float& outVal) {
  String pattern = String("\"") + key + "\":";
  int idx = json.indexOf(pattern);
  if (idx < 0) return false;
  int start = idx + pattern.length();
  while (start < (int)json.length() && (json[start] == ' ' || json[start] == '\t')) start++;
  int end = start;
  while (end < (int)json.length() &&
         (isDigit(json[end]) || json[end] == '.' || json[end] == '-')) {
    end++;
  }
  if (end == start) return false;
  outVal = json.substring(start, end).toFloat();
  return true;
}

// Extrae un string después de una clave JSON, ej: "gas":"Ar"
bool extractJsonString(const String& json, const char* key, String& outStr) {
  String pattern = String("\"") + key + "\":\"";
  int idx = json.indexOf(pattern);
  if (idx < 0) return false;
  int start = idx + pattern.length();
  int end = json.indexOf('"', start);
  if (end < 0) return false;
  outStr = json.substring(start, end);
  return true;
}

// ==================== CALLBACKS BLE ====================
class GasZeroServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* server) override {
    (void)server;
    deviceConnected = true;
    digitalWrite(PIN_LED_STATUS, HIGH);
    Serial.println("[BLE] App Gas-Zero conectada.");
    forceReadFlag = true;
  }

  void onDisconnect(BLEServer* server) override {
    (void)server;
    deviceConnected = false;
    digitalWrite(PIN_LED_STATUS, LOW);
    Serial.println("[BLE] App desconectada. Reiniciando anuncio BLE...");
  }
};

class GasZeroCommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) override {
    String raw = pChar->getValue().c_str();
    raw.trim();
    if (raw.length() == 0) return;

    Serial.print("[BLE CMD] Recibido: ");
    Serial.println(raw);

    String cmd;
    if (!extractJsonString(raw, "cmd", cmd)) return;

    if (cmd == "READ_NOW") {
      forceReadFlag = true;
    } else if (cmd == "TARE") {
      pendingZeroFlag = true;
    } else if (cmd == "SET_CONFIG") {
      String newGas;
      float newTare = cylinderTareKg;
      float newCap  = capacityKg;
      if (extractJsonString(raw, "gas", newGas) && newGas.length() > 0 && newGas.length() <= 4) {
        gasCode = newGas;
      }
      if (extractJsonFloat(raw, "tare", newTare) && newTare >= 0.0f) {
        cylinderTareKg = newTare;
      }
      if (extractJsonFloat(raw, "capacity", newCap) && newCap > 0.5f) {
        capacityKg = newCap;
      }
      saveConfig();
      forceReadFlag = true;
    } else if (cmd == "CALIBRATE") {
      float knownKg = 0.0f;
      if (extractJsonFloat(raw, "knownWeightKg", knownKg) && knownKg > 0.2f) {
        pendingCalibKg = knownKg;
        pendingCalibFlag = true;
      }
    }
  }
};

// ==================== LECTURA CON FILTRO Y AHORRO ENERGÉTICO ====================
float readFilteredWeightKg() {
  // Despertar HX711 solo durante la medición (ahorro energético)
  scale.power_up();
  delay(120); // Estabilización del ADC 24-bit

  float rawKg = 0.0f;
  if (scale.wait_ready_timeout(600)) {
    rawKg = scale.get_units(HX_SAMPLES);
  } else {
    Serial.println("[HX711] Aviso: sensor no respondió a tiempo. Verifica DT/SCK/3V3.");
    rawKg = filteredWeightKg;
  }

  scale.power_down(); // Modo bajo consumo (< 1 uA)

  // Eliminar micro-derivas negativas menores a 0.05 kg
  if (rawKg < 0.0f && rawKg > -0.08f) rawKg = 0.0f;
  if (rawKg < 0.0f) rawKg = 0.0f;

  // Filtro paso bajo digital (EMA) + salto rápido si cambia más de 0.8 kg (ej. quitar/poner cilindro)
  if (!filterInitialized || fabsf(rawKg - filteredWeightKg) > 0.8f) {
    filteredWeightKg = rawKg;
    filterInitialized = true;
  } else {
    filteredWeightKg = (EMA_ALPHA * rawKg) + ((1.0f - EMA_ALPHA) * filteredWeightKg);
  }

  // Redondeo a resolución operativa de 0.05 kg (o 0.01 kg para suavidad en UI)
  return roundf(filteredWeightKg * 20.0f) / 20.0f;
}

void updateLcd(float weightKg, float netKg, int pct) {
#if USE_LCD_I2C
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(gasCode);
  lcd.print(" ");
  lcd.print(pct);
  lcd.print("% ");
  lcd.print(netKg, 1);
  lcd.print("kg");

  lcd.setCursor(0, 1);
  lcd.print("Peso:");
  lcd.print(weightKg, 2);
  lcd.print("kg ");
  lcd.print(deviceConnected ? "BLE" : "---");
#else
  (void)weightKg;
  (void)netKg;
  (void)pct;
#endif
}

void publishTelemetry() {
  float weightKg = readFilteredWeightKg();
  float netKg    = weightKg - cylinderTareKg;
  if (netKg < 0.0f) netKg = 0.0f;
  if (netKg > capacityKg) netKg = capacityKg;

  int pct = (int)roundf((netKg / capacityKg) * 100.0f);
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;

  char jsonBuf[128];
  snprintf(
    jsonBuf,
    sizeof(jsonBuf),
    "{\"weight\":%.2f,\"tare\":%.2f,\"net\":%.2f,\"pct\":%d,\"gas\":\"%s\"}\n",
    weightKg,
    cylinderTareKg,
    netKg,
    pct,
    gasCode.c_str()
  );

  Serial.print("[TELEMETRIA] ");
  Serial.print(jsonBuf);

  updateLcd(weightKg, netKg, pct);

  if (deviceConnected && pTelemetryChar != nullptr) {
    pTelemetryChar->setValue((uint8_t*)jsonBuf, strlen(jsonBuf));
    pTelemetryChar->notify();
  }
}

// ==================== COMANDOS POR MONITOR SERIE (USB) ====================
void handleSerialCommands() {
  if (!Serial.available()) return;
  String line = Serial.readStringUntil('\n');
  line.trim();
  if (line.length() == 0) return;

  if (line.equalsIgnoreCase("T")) {
    pendingZeroFlag = true;
  } else if (line.equalsIgnoreCase("R")) {
    forceReadFlag = true;
  } else if (line.startsWith("C ") || line.startsWith("c ")) {
    float known = line.substring(2).toFloat();
    if (known > 0.2f) {
      pendingCalibKg = known;
      pendingCalibFlag = true;
    } else {
      Serial.println("[CALIB] Usa un peso mayor a 0.2 kg, ej: C 10.0");
    }
  } else if (line.startsWith("F ") || line.startsWith("f ")) {
    float f = line.substring(2).toFloat();
    if (fabsf(f) > 10.0f) {
      scaleFactor = f;
      scale.set_scale(scaleFactor);
      saveConfig();
      Serial.printf("[CALIB] Factor manual aplicado: %.2f\n", scaleFactor);
      forceReadFlag = true;
    }
  } else {
    Serial.println("Comandos Serie disponibles:");
    Serial.println("  T         -> Poner bascula vacia en 0.00 kg (tara de plataforma)");
    Serial.println("  C 10.0    -> Calibrar con un peso conocido sobre la bascula (ej. 10.0 kg)");
    Serial.println("  F 22800   -> Fijar factor de escala directamente");
    Serial.println("  R         -> Forzar lectura inmediata");
  }
}

// ==================== SETUP & LOOP ====================
void setup() {
  Serial.begin(115200);
  delay(300);

  // Reducir reloj de 240 MHz a 80 MHz para ahorrar batería sin afectar BLE
  setCpuFrequencyMhz(80);

  pinMode(PIN_LED_STATUS, OUTPUT);
  digitalWrite(PIN_LED_STATUS, LOW);

  Serial.println("\n==========================================");
  Serial.println("   GAS-ZERO ESP32 · Báscula IoT BLE v1.0  ");
  Serial.println("==========================================");

  loadConfig();
  Serial.printf("[CFG] Gas=%s | Cap=%.2f kg | Tara=%.2f kg | Factor=%.2f\n",
                gasCode.c_str(), capacityKg, cylinderTareKg, scaleFactor);

#if USE_LCD_I2C
  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Gas-Zero v1.0");
  lcd.setCursor(0, 1);
  lcd.print("Iniciando BLE...");
#endif

  // Inicializar HX711
  scale.begin(PIN_HX711_DOUT, PIN_HX711_SCK);
  scale.set_scale(scaleFactor);
  if (scale.wait_ready_timeout(1000)) {
    scale.tare(10);
    Serial.println("[HX711] Sensor listo y puesto a cero inicial.");
  } else {
    Serial.println("[HX711] ADVERTENCIA: No se detectó HX711 al arrancar (revisa cables).");
  }
  scale.power_down();

  // Inicializar servidor BLE GATT
  BLEDevice::init(BLE_DEVICE_NAME);
  BLEDevice::setMTU(128);

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new GasZeroServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);

  pTelemetryChar = pService->createCharacteristic(
    TELEMETRY_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pTelemetryChar->addDescriptor(new BLE2902());

  pCommandChar = pService->createCharacteristic(
    COMMAND_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pCommandChar->setCallbacks(new GasZeroCommandCallbacks());

  pService->start();

  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  BLEDevice::startAdvertising();

  Serial.println("[BLE] Anunciando como '" BLE_DEVICE_NAME "'. Listo para conectar desde la App.");
}

void loop() {
  handleSerialCommands();

  // Ejecutar puesta a cero de báscula vacía
  if (pendingZeroFlag) {
    pendingZeroFlag = false;
    Serial.println("[HX711] Aplicando cero de báscula...");
    scale.power_up();
    delay(150);
    if (scale.wait_ready_timeout(800)) {
      scale.tare(12);
      filterInitialized = false;
      Serial.println("[HX711] Cero aplicado correctamente.");
    }
    scale.power_down();
    forceReadFlag = true;
  }

  // Ejecutar calibración automática con peso conocido
  if (pendingCalibFlag) {
    pendingCalibFlag = false;
    Serial.printf("[CALIB] Calibrando con peso conocido: %.2f kg...\n", pendingCalibKg);
    scale.power_up();
    delay(200);
    if (scale.wait_ready_timeout(800)) {
      scale.set_scale(1.0f);
      float rawUnits = scale.get_units(15);
      if (fabsf(rawUnits) > 50.0f) {
        scaleFactor = rawUnits / pendingCalibKg;
        scale.set_scale(scaleFactor);
        saveConfig();
        filterInitialized = false;
        Serial.printf("[CALIB] Exito! Nuevo factor de escala = %.2f\n", scaleFactor);
      } else {
        scale.set_scale(scaleFactor);
        Serial.println("[CALIB] Error: lectura demasiado baja. Asegurate de tener el peso encima.");
      }
    }
    scale.power_down();
    forceReadFlag = true;
  }

  // Reanudar advertising si la app se desconectó
  if (!deviceConnected && oldDeviceConnected) {
    delay(300);
    pServer->startAdvertising();
    oldDeviceConnected = false;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = true;
  }

  // Lectura periódica o forzada
  uint32_t now = millis();
  uint32_t interval = deviceConnected ? INTERVAL_CONN_MS : INTERVAL_IDLE_MS;
  if (forceReadFlag || (now - lastReadMs >= interval)) {
    forceReadFlag = false;
    lastReadMs = now;
    publishTelemetry();
  }

  delay(40);
}
