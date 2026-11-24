# Manual de Uso — Gas-Zero (Guía para Clientes)

Bienvenido a **Gas-Zero**, tu báscula inteligente para medir exactamente cuánto gas queda en tu cilindro en tiempo real, evitar quedarte sin gas a mitad de un trabajo y llevar el control de tu consumo de forma sencilla.

> **No necesitas saber de electrónica ni de programación.** Tu báscula ya viene programada y lista para usar. Solo sigue estos pasos.

---

## 1. ¿Qué es Gas-Zero y cómo funciona?

Muchos gases (como el **Gas LP** o el **CO₂**) están líquidos dentro del tanque, por lo que un manómetro de presión normal **no te dice cuánto gas te queda** hasta que ya se acabó por completo.

**Gas-Zero resuelve esto pesando tu cilindro:**
1. La báscula mide el **peso total** de todo lo que hay encima (**Peso bruto**).
2. Le resta automáticamente el peso del tanque metálico vacío (**Tara del tanque**).
3. El resultado exacto es el **Gas restante (en kilos y en porcentaje %)** que todavía puedes usar.

```text
  Gas restante (kg)  =  Peso total sobre la báscula  −  Peso del tanque vacío (Tara)
```

---

## 2. Qué necesitas para usarla

* **Tu báscula Gas-Zero** colocada sobre una superficie **plana, firme y nivelada** (piso de concreto, mesa rígida o base estable; evita alfombras blandas o pisos desnivelados).
* **Para ver el Dashboard en tu computadora (Versión Cable USB — Arduino UNO):**
  * Una computadora o laptop (Windows, Mac o Linux).
  * El cable USB incluido.
  * Navegador **Google Chrome** o **Microsoft Edge** actualizado.
* **Para ver el Dashboard sin cables (Versión Bluetooth — ESP32):**
  * Celular Android o computadora con **Google Chrome** o **Microsoft Edge** y Bluetooth encendido.
  * *(En iPhone/iPad se requiere la app gratuita **Bluefy** del App Store, ya que Safari no incluye Bluetooth Web.)*
* **Si tu báscula incluye pantalla LCD y pilas:**
  * ¡No necesitas computadora ni celular para ver el peso y el porcentaje! Solo enciende el interruptor lateral.

---

## 3. Primer uso en 4 pasos (Conexión por Cable USB)

### Paso 1: Coloca la báscula en su lugar
Pon la báscula en una superficie plana y **déjala vacía** (sin el cilindro encima todavía).

### Paso 2: Conecta el cable USB a tu computadora
Conecta el cable USB de la báscula a cualquier puerto USB libre de tu PC o laptop.

### Paso 3: Abre la página web de Gas-Zero
1. Abre **Google Chrome** o **Microsoft Edge**.
2. Entra a la dirección web de **Gas-Zero** (o escanea el código QR impreso en tu báscula).
3. *(Opcional recomendado)* Haz clic en el ícono de **Instalar aplicación** en la barra de direcciones de Chrome/Edge para que Gas-Zero quede como un programa normal con ícono en tu escritorio.

### Paso 4: Conecta tu báscula en 1 clic
1. En la parte superior de la pantalla verás el botón **`Conectar Arduino USB`** (también disponible en la pestaña **USB / BLE**).
2. Haz clic en **`Conectar Arduino USB`**.
3. Aparecerá una ventanita del navegador con los puertos disponibles (por ejemplo `Arduino Uno (COM3)` o `USB-SERIAL CH340 (COM4)`).
4. Selecciónalo y presiona **Conectar**.
5. ¡Listo! Arriba a la derecha aparecerá en color azul brillante **`USB · Arduino UNO`** y verás el peso actualizándose en vivo cada segundo.

> **Buena noticia:** Solo tienes que elegir el puerto **la primera vez**. Las siguientes veces que abras la página con la báscula conectada, Gas-Zero se conectará **automáticamente**.

---

## 4. Cómo leer el Dashboard (pantalla principal)

En la pestaña **Monitor** verás toda la información de tu tanque de un vistazo:

| Dato en pantalla | Qué significa |
|---|---|
| **Círculo y cilindro animado (`%`)** | Porcentaje de gas que aún te queda disponible (de `0%` a `100%`). |
| **Peso bruto (`XX.XX kg`)** | Peso total real que la báscula está cargando en este momento (tanque + gas). |
| **Gas restante (`XX.XX kg`)** | Kilos reales de gas disponibles dentro del cilindro. |
| **Tara del tanque (`XX.XX kg`)** | Cuánto pesa tu cilindro **vacío** (solo el metal). |
| **Capacidad nominal (`XX.XX kg`)** | Cuántos kilos de gas le caben a tu cilindro cuando está lleno. |
| **Autonomía estimada** | Días aproximados que te durará el gas según tu ritmo actual de consumo. |
| **Estado (etiqueta de color)** | 🔵 **Óptimo** (nivel seguro) · 🟣 **Nivel bajo** (planea recarga) · 🔴 **Crítico** (casi vacío). |
| **Información del Arduino UNO** | Muestra el estado en vivo de tu báscula: sensor HX711 (`OK · Activo`), lectura cruda, factor de calibración guardado, lecturas recibidas y registro de eventos. |

---

## 5. Cómo configurar tu tipo de gas y tamaño de cilindro

Para que el porcentaje (`%`) y el gas restante (`kg`) sean exactos, indícale a Gas-Zero qué tanque estás poniendo encima:

1. En el panel **Tipo de gas**, selecciona el gas de tu cilindro:
   * **`N₂`** Nitrógeno · **`Ar`** Argón · **`CO₂`** Dióxido de carbono · **`O₂`** Oxígeno · **`LP`** Gas LP.
2. En **Capacidad y tara del cilindro**, elige uno de los tamaños rápidos:
   * **Chico:** 10 kg de gas (Tara 8 kg)
   * **Mediano:** 20 kg de gas (Tara 12 kg)
   * **Grande:** 30 kg de gas (Tara 22 kg)
   * **Industrial:** 50 kg de gas (Tara 35 kg)
3. **¿Tu cilindro tiene otro peso exacto?** Toca **`Tara / cap. manual`**, escribe la capacidad real de gas y el peso vacío exacto de tu cilindro, y pulsa **Aplicar**.

> **¿Cómo saber cuánto pesa tu cilindro vacío (Tara)?**
> Todos los cilindros de gas tienen grabada su tara en el cuello, asa o collarín metálico con las letras **`TARA`**, **`TW`** o **`T.W.`** (por ejemplo `TARA 12.5 KG`). Si solo quieres pesar objetos comunes (cajas, garrafones, paquetes), pon la **Tara manual en `0`**.

---

## 6. Cómo poner en cero (Tarear) y Calibrar la báscula

### Poner en cero (`Tarear báscula`)
Haz esto cuando la báscula esté **vacía** y marque unos gramos de más (por ejemplo `0.15 kg` sin nada encima):
1. Quita todo lo que haya sobre la báscula.
2. En el Dashboard, haz clic en el botón azul **`Tarear báscula (0 kg)`** (o en **`Tarear (0 kg)`** de la barra superior verde/azul).
3. Verás la confirmación **`¡Báscula tarada (0 kg)!`** y el peso bruto quedará en **`0.00 kg`**.

### Calibrar (solo si notas que marca de más o de menos)
Tu báscula ya sale calibrada de fábrica, pero si algún día necesitas recalibrarla:
1. Deja la báscula **vacía** y presiona **`Tarear báscula (0 kg)`**.
2. Coloca en el centro un objeto del cual conozcas su peso exacto *(por ejemplo un garrafón de 10 litros = `10.0` kg, una pesa de `5.0` kg o una botella llena de 1 litro = `1.0` kg; entre más pesado el objeto de referencia, más precisa queda la calibración)*.
3. En la sección **Calibración rápida** del Dashboard, escribe ese peso en kilos (ejemplo: `10.0`) y pulsa **`Calibrar con este peso (kg)`**.
4. Espera 2 segundos: el nuevo factor de calibración se guarda automáticamente en la memoria interna de la báscula y **no se borra aunque la desconectes**.

---

## 7. Otras herramientas incluidas en la App

* **Registrar recarga (100%):** Presiónalo cuando cambies o rellenes tu tanque para reiniciar las estadísticas de consumo del ciclo y sumar una recarga a tu historial.
* **Flota:** ¿Manejas más de un cilindro? Aquí puedes dar de alta varios cilindros (por ejemplo *"Cocina principal"*, *"Soldadura TIG"*, *"Respaldo"*), ver el estado de todos en una sola pantalla y cambiar entre ellos.
* **Historial:** Consulta la gráfica de evolución de tu nivel de gas, el consumo promedio diario, la línea de tiempo de eventos y presiona **Exportar CSV** para descargar tu reporte y abrirlo en Excel.
* **Ahorro gas:** Consejos prácticos de ahorro y seguridad específicos para el gas que seleccionaste.
* **Alertas de sonido y notificaciones:** En el ícono de bocina (arriba a la derecha) o en la pestaña **USB / BLE** puedes activar alertas sonoras, notificaciones en tu computadora y elegir a qué porcentaje quieres recibir aviso de **Nivel bajo** (por defecto `15%`) y **Crítico** (por defecto `5%`).

---

## 8. Si tu báscula incluye Pantalla LCD y Pilas (Uso sin computadora)

Si adquiriste la versión autónoma con pantalla integrada y paquete de pilas:
1. **Encendido:** Activa el interruptor lateral **ON/OFF**. En 2 segundos aparecerá en la pantalla el tipo de gas, el porcentaje restante (`%`), el peso bruto y el gas neto (`Net`).
2. **Ahorro de pilas:** Apaga el interruptor cuando no estés consultando el tanque. Así las pilas durarán varios meses.
3. **Botón físico de Tara** *(si tu modelo lo incluye)*: con la báscula vacía, presiona el botón lateral 1 segundo para ponerla en `0.0 kg`.
4. **Cambio de pilas:** Si notas la luz de la pantalla muy tenue o parpadeando, reemplaza las pilas por un juego nuevo del mismo tipo (o recarga el módulo por USB-C si es versión recargable).
5. **Uso combinado:** Incluso con pantalla LCD, puedes conectar el cable USB a tu computadora cuando quieras ver gráficas, historial o recalibrar desde el Dashboard.

---

## 9. Solución rápida de problemas (Preguntas Frecuentes)

| Problema | Causa probable | Solución |
|---|---|---|
| **Dice `Error USB: No se pudo abrir el puerto COM`** | Otro programa o pestaña está usando la báscula. | Cierra otras pestañas de Gas-Zero (o cualquier programa serial), desconecta y vuelve a conectar el cable USB, y pulsa **Conectar Arduino USB**. |
| **No aparece ningún puerto COM al conectar el USB** | Cable USB dañado (o solo de carga), o falta driver CH340 en Windows. | Prueba otro puerto USB de tu PC. Si tu Windows es nuevo y no reconoce el adaptador USB, instala el driver gratuito **CH340** y reinicia el navegador. |
| **No aparece el botón de USB o Bluetooth** | Estás usando un navegador incompatible (Firefox o Safari). | Abre la página en **Google Chrome** o **Microsoft Edge**. |
| **El peso bruto sube, pero `Gas restante` y `%` siguen en `0`** | El objeto que pusiste pesa menos que la **Tara del tanque** configurada (ej. tara `12 kg` y pusiste `2 kg`). | Es comportamiento normal para tanques vacíos. Si estás probando objetos ligeros, cambia la **Tara manual** a `0 kg`. |
| **Sin nada encima no marca `0.00 kg`** | Cambió la temperatura o se movió la báscula de lugar. | Con la báscula vacía, pulsa **`Tarear báscula (0 kg)`**. |
| **Pongo peso y el número casi no cambia** | Algo está tocando el centro por debajo de las celdas o la báscula está sobre una superficie muy blanda. | Colócala en piso firme y plano, y verifica que nada obstruya las 4 esquinas inferiores. |
| **El panel dice `Sin señal HX711`** | Se aflojó la conexión interna del sensor. | Desconecta el cable USB, espera 5 segundos y vuelve a conectar. Si persiste, contacta a soporte técnico. |

---

## 10. Cuidados y Seguridad

* **Carga máxima:** No excedas el peso máximo de la plataforma (**200 kg** combinados en versión de 4 celdas de 50 kg). Coloca el cilindro suavemente sin dejarlo caer de golpe.
* **Ambiente:** Mantén la caja electrónica protegida contra lluvia directa, chorros de agua y golpes fuertes.
* **Seguridad con gases:**
  * **Gas LP:** Almacena los cilindros en exteriores bien ventilados y lejos de flamas o chispas. Gas-Zero es un monitor de peso auxiliar y **no sustituye detectores de fugas ni válvulas de seguridad certificadas**.
  * **Oxígeno (`O₂`):** Nunca apliques aceites ni grasas en válvulas o reguladores.
  * **Nitrógeno (`N₂`), Argón (`Ar`) y `CO₂`:** Mantén ventilación adecuada; son gases inodoros que pueden desplazar el oxígeno en espacios cerrados.

---

## 11. Tarjeta de Inicio Rápido (Lista para imprimir e incluir en la caja)

> ### GAS-ZERO · Inicio Rápido en 3 pasos
> 1. **Coloca** tu báscula en una superficie plana y **conecta** el cable USB a tu PC *(o enciéndela si es versión Bluetooth/LCD)*.
> 2. **Abre** `https://TU-URL-GAS-ZERO.netlify.app` en **Google Chrome** o **Microsoft Edge** *(escanea el QR)*.
> 3. **Pulsa** **`Conectar Arduino USB`**, elige el puerto de tu báscula, selecciona tu **Tipo de gas y tamaño de tanque**, ¡y listo!
>
> *¿Necesitas ponerla en cero?* Deja la báscula vacía y presiona **`Tarear báscula (0 kg)`**.
