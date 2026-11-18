/*
 * ============================================================================
 *  GAS-ZERO — Sketch Rápido de Calibración HX711 (Para Principiantes)
 * ============================================================================
 *  Úsalo UNA SOLA VEZ al armar tu báscula para obtener tu "scaleFactor".
 *
 *  PASOS:
 *   1. Sube este código al ESP32 y abre el Monitor Serie a 115200 baudios.
 *   2. Deja la báscula TOTALMENTE VACÍA y escribe la letra:  t  (Enter).
 *   3. Coloca un objeto de peso conocido (ej. un garrafón de 10 o 20 kg)
 *      y escribe su peso en kg, por ejemplo:  10.0  (Enter).
 *   4. Anota el FACTOR DE ESCALA que aparecerá en pantalla y cópialo en
 *      gas_zero_esp32.ino (o guárdalo allá con el comando "F <numero>").
 * ============================================================================
 */

#include <Arduino.h>
#include <HX711.h>

static const uint8_t PIN_HX711_DOUT = 4;
static const uint8_t PIN_HX711_SCK  = 5;

HX711 scale;
float currentFactor = 22800.0f;

void setup() {
  Serial.begin(115200);
  delay(400);

  Serial.println("\n==========================================");
  Serial.println("     GAS-ZERO · CALIBRADOR HX711 v1.0     ");
  Serial.println("==========================================");

  scale.begin(PIN_HX711_DOUT, PIN_HX711_SCK);
  if (!scale.wait_ready_timeout(2000)) {
    Serial.println("ERROR: No se detecta el módulo HX711.");
    Serial.println("Revisa cables: VCC->3V3, GND->GND, DT->GPIO4, SCK->GPIO5.");
  } else {
    scale.set_scale();
    scale.tare(15);
    Serial.println("HX711 detectado y puesto en 0.00 kg.");
  }

  Serial.println("\nINSTRUCCIONES:");
  Serial.println(" 1) Con la bascula VACIA escribe: t");
  Serial.println(" 2) Pon un peso conocido encima y escribe el peso en kg (ej: 10.0)");
}

void loop() {
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input.equalsIgnoreCase("t")) {
      scale.set_scale();
      scale.tare(15);
      Serial.println(">> Tara en cero completada. Ahora coloca tu peso conocido.");
    } else {
      float knownKg = input.toFloat();
      if (knownKg > 0.2f) {
        scale.set_scale(1.0f);
        float raw = scale.get_units(20);
        currentFactor = raw / knownKg;
        scale.set_scale(currentFactor);

        Serial.println("------------------------------------------");
        Serial.printf("Lectura cruda : %.2f\n", raw);
        Serial.printf("Peso conocido : %.2f kg\n", knownKg);
        Serial.printf(">>> TU FACTOR DE ESCALA ES: %.2f <<<\n", currentFactor);
        Serial.println("------------------------------------------");
        Serial.println("Deja el peso puesto para comprobar si marca correcto:");
      }
    }
  }

  if (scale.wait_ready_timeout(500)) {
    scale.set_scale(currentFactor);
    float kg = scale.get_units(6);
    Serial.printf("Peso medido actual: %.2f kg  (Factor: %.2f)\n", kg, currentFactor);
  }
  delay(1200);
}
