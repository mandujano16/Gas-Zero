/*
 * ============================================================================
 *  GAS-ZERO — Firmware Arduino UNO + HX711 por Cable USB (Web Serial) v1.0.0
 * ============================================================================
 *  Sin necesidad de pantalla LCD: envia el peso real en tiempo real directo al
 *  dashboard de la App Web Gas-Zero por el cable USB (Chrome / Edge en PC).
 *
 *  LIBRERIA NECESARIA EN ARDUINO IDE:
 *   - "HX711 Arduino Library" by Bogdan Necula (Gestor de Bibliotecas)
 *
 *  CONEXIONES (SOLO 4 CABLES ENTRE HX711 Y ARDUINO UNO):
 *   HX711 VCC  -> Arduino UNO 5V
 *   HX711 GND  -> Arduino UNO GND
 *   HX711 DT   -> Arduino UNO Pin Digital 4
 *   HX711 SCK  -> Arduino UNO Pin Digital 5
 * ============================================================================
 */

#include <Arduino.h>
#include <EEPROM.h>
#include <HX711.h>
#include <math.h>

// ==================== PINES HX711 ====================
const uint8_t PIN_HX711_DOUT = 4;
const uint8_t PIN_HX711_SCK  = 5;

// ==================== PARAMETROS DE LECTURA ====================
const uint8_t  HX_SAMPLES        = 6;     // Promedio por lectura HX711
const float    EMA_ALPHA         = 0.40f; // Filtro paso bajo suave
const uint32_t TELEMETRY_MS      = 800;   // Actualizacion del dashboard cada 0.8 s

// ==================== PERSISTENCIA EN EEPROM ====================
const uint32_t EEPROM_MAGIC = 0x475A5531UL; // "GZU1"

struct StoredConfig {
  uint32_t magic;
  float    scaleFactor;
  float    cylinderTareKg;
  float    capacityKg;
  char     gasCode[5];
};

HX711 scale;

float scaleFactor       = 22800.0f;
float cylinderTareKg    = 12.0f;
float capacityKg        = 20.0f;
char  gasCode[5]        = "N2";

float filteredWeightKg  = 0.0f;
bool  filterInitialized = false;
uint32_t lastSendMs     = 0;

String serialLineBuf    = "";

void saveConfig() {
  StoredConfig cfg;
  cfg.magic = EEPROM_MAGIC;
  cfg.scaleFactor = scaleFactor;
  cfg.cylinderTareKg = cylinderTareKg;
  cfg.capacityKg = capacityKg;
  strncpy(cfg.gasCode, gasCode, sizeof(cfg.gasCode) - 1);
  cfg.gasCode[sizeof(cfg.gasCode) - 1] = '\0';
  EEPROM.put(0, cfg);
  Serial.println(F("[UNO] Configuracion guardada en EEPROM."));
}

void loadConfig() {
  StoredConfig cfg;
  EEPROM.get(0, cfg);
  if (cfg.magic == EEPROM_MAGIC &&
      !isnan(cfg.scaleFactor) && fabsf(cfg.scaleFactor) > 10.0f &&
      !isnan(cfg.capacityKg) && cfg.capacityKg > 0.2f &&
      !isnan(cfg.cylinderTareKg) && cfg.cylinderTareKg >= 0.0f) {
    scaleFactor = cfg.scaleFactor;
    cylinderTareKg = cfg.cylinderTareKg;
    capacityKg = cfg.capacityKg;
    strncpy(gasCode, cfg.gasCode, sizeof(gasCode) - 1);
    gasCode[sizeof(gasCode) - 1] = '\0';
    if (gasCode[0] == '\0') strcpy(gasCode, "N2");
  }
}

// ==================== PARSER LIGERO DE COMANDOS JSON ====================
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

// ==================== LECTURA Y TELEMETRIA JSON ====================
float readWeightKg() {
  float rawKg = filteredWeightKg;
  if (scale.wait_ready_timeout(400)) {
    rawKg = scale.get_units(HX_SAMPLES);
  } else {
    Serial.println(F("[HX711] Aviso: sensor no respondio. Revisa 5V/GND/D4/D5."));
  }

  if (rawKg < 0.0f && rawKg > -0.08f) rawKg = 0.0f;
  if (rawKg < 0.0f) rawKg = 0.0f;

  if (!filterInitialized || fabsf(rawKg - filteredWeightKg) > 0.5f) {
    filteredWeightKg = rawKg;
    filterInitialized = true;
  } else {
    filteredWeightKg = (EMA_ALPHA * rawKg) + ((1.0f - EMA_ALPHA) * filteredWeightKg);
  }

  return roundf(filteredWeightKg * 100.0f) / 100.0f;
}

void publishTelemetry() {
  float weightKg = readWeightKg();
  float netKg = weightKg - cylinderTareKg;
  if (netKg < 0.0f) netKg = 0.0f;
  if (netKg > capacityKg) netKg = capacityKg;

  int pct = (int)roundf((netKg / capacityKg) * 100.0f);
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;

  // Linea JSON exacta esperada por Gas-Zero Web App
  Serial.print(F("{\"weight\":"));
  Serial.print(weightKg, 2);
  Serial.print(F(",\"tare\":"));
  Serial.print(cylinderTareKg, 2);
  Serial.print(F(",\"net\":"));
  Serial.print(netKg, 2);
  Serial.print(F(",\"pct\":"));
  Serial.print(pct);
  Serial.print(F(",\"gas\":\""));
  Serial.print(gasCode);
  Serial.println(F("\"}"));
}

void runTareZero() {
  if (scale.wait_ready_timeout(800)) {
    scale.tare(12);
    filterInitialized = false;
    filteredWeightKg = 0.0f;
    Serial.println(F("[HX711] Cero de bascula aplicado (0.00 kg)."));
  } else {
    Serial.println(F("[HX711] Error: no se pudo aplicar tara (sensor no listo)."));
  }
  publishTelemetry();
}

void runCalibration(float knownKg) {
  if (knownKg <= 0.05f) {
    Serial.println(F("[CALIB] Usa un peso conocido mayor a 0.05 kg."));
    return;
  }
  if (!scale.wait_ready_timeout(800)) {
    Serial.println(F("[CALIB] Error: HX711 no responde."));
    return;
  }

  scale.set_scale(1.0f);
  float rawUnits = scale.get_units(15);
  if (fabsf(rawUnits) > 40.0f) {
    scaleFactor = rawUnits / knownKg;
    scale.set_scale(scaleFactor);
    saveConfig();
    filterInitialized = false;
    Serial.print(F("[CALIB] Exito! Nuevo factor de escala = "));
    Serial.println(scaleFactor, 2);
  } else {
    scale.set_scale(scaleFactor);
    Serial.println(F("[CALIB] Error: lectura muy baja. Pon el peso conocido sobre la bascula."));
  }
  publishTelemetry();
}

void processCommandLine(String line) {
  line.trim();
  if (line.length() == 0) return;

  // 1. Comandos JSON enviados por la App Web Gas-Zero (Web Serial)
  if (line[0] == '{') {
    String cmd;
    if (!extractJsonString(line, "cmd", cmd)) return;

    if (cmd == "READ_NOW") {
      publishTelemetry();
    } else if (cmd == "TARE") {
      runTareZero();
    } else if (cmd == "SET_CONFIG") {
      String newGas;
      float newTare = cylinderTareKg;
      float newCap  = capacityKg;
      if (extractJsonString(line, "gas", newGas) && newGas.length() > 0 && newGas.length() <= 4) {
        strncpy(gasCode, newGas.c_str(), sizeof(gasCode) - 1);
        gasCode[sizeof(gasCode) - 1] = '\0';
      }
      if (extractJsonFloat(line, "tare", newTare) && newTare >= 0.0f) {
        cylinderTareKg = newTare;
      }
      if (extractJsonFloat(line, "capacity", newCap) && newCap > 0.2f) {
        capacityKg = newCap;
      }
      saveConfig();
      publishTelemetry();
    } else if (cmd == "CALIBRATE") {
      float knownKg = 0.0f;
      if (extractJsonFloat(line, "knownWeightKg", knownKg)) {
        runCalibration(knownKg);
      }
    }
    return;
  }

  // 2. Comandos simples por Monitor Serie (Arduino IDE)
  if (line.equalsIgnoreCase("T")) {
    runTareZero();
  } else if (line.equalsIgnoreCase("R")) {
    publishTelemetry();
  } else if (line.startsWith("C ") || line.startsWith("c ")) {
    runCalibration(line.substring(2).toFloat());
  } else if (line.startsWith("F ") || line.startsWith("f ")) {
    float f = line.substring(2).toFloat();
    if (fabsf(f) > 10.0f) {
      scaleFactor = f;
      scale.set_scale(scaleFactor);
      saveConfig();
      filterInitialized = false;
      Serial.print(F("[CALIB] Factor manual guardado: "));
      Serial.println(scaleFactor, 2);
      publishTelemetry();
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(250);

  loadConfig();
  Serial.println(F("[UNO] Gas-Zero Arduino UNO USB v1.0 listo."));
  Serial.print(F("[UNO] Factor actual: "));
  Serial.println(scaleFactor, 2);

  scale.begin(PIN_HX711_DOUT, PIN_HX711_SCK);
  scale.set_scale(scaleFactor);
  if (scale.wait_ready_timeout(1200)) {
    scale.tare(12);
    Serial.println(F("[HX711] Sensor detectado y puesto en cero inicial."));
  } else {
    Serial.println(F("[HX711] ADVERTENCIA: no se detecto HX711 (revisa 5V, GND, D4, D5)."));
  }
}

void loop() {
  while (Serial.available()) {
    char ch = (char)Serial.read();
    if (ch == '\n' || ch == '\r') {
      if (serialLineBuf.length() > 0) {
        processCommandLine(serialLineBuf);
        serialLineBuf = "";
      }
    } else if (serialLineBuf.length() < 160) {
      serialLineBuf += ch;
    }
  }

  uint32_t now = millis();
  if (now - lastSendMs >= TELEMETRY_MS) {
    lastSendMs = now;
    publishTelemetry();
  }
}
