# JW Modbus Tool — Decisiones de desarrollo del Modo sencillo

Fecha de trabajo: 2026-07-09
Rama: `feature/simple-mode-mvp`

Este documento resume las decisiones tomadas durante la depuración real del **Modo sencillo** usando un JWPLC Basic actuando como slave Modbus RTU.

---

## 1. Criterio general del Modo sencillo

El Modo sencillo debe partir siempre de una **sesión limpia**. Esto evita que la interfaz mezcle datos visuales de mockup con datos reales de comunicación.

Al iniciar una sesión limpia:

- No debe haber dispositivos precargados.
- No debe haber lecturas precargadas.
- No debe haber tráfico precargado.
- Los contadores deben iniciar en cero: solicitudes, respuestas, errores y timeouts.
- El usuario debe conectar, escanear y leer para generar información real.

---

## 2. Vista Dispositivos — cerrada como primera versión real

La vista **Dispositivos** queda cerrada como primera versión operativa del MVP sencillo. Ya no se está trabajando como mockup estático: la vista está conectada al backend real de Electron y a lecturas Modbus reales.

### 2.1 Panel `1. Conectar`

Decisiones aplicadas:

- El flujo principal es **RTU**.
- TCP queda visible, pero todavía no es el foco del MVP.
- La lista de puertos se obtiene desde el backend real de Electron.
- Se agregó botón de recarga de puertos junto al selector `Puerto`.
- El label `Timeout` cambió a `Timeout (ms)`.
- El estado de conexión es visualmente claro:
  - `Conectado` en verde.
  - `Desconectado` en rojo.
- Este panel **no debe tener scroll interno**.
- La fila superior de la vista se dimensiona por contenido, no por altura fija, para evitar cortes.

Pendiente posterior:

- Mejorar la detección de puertos residuales de Windows si el backend sigue listando COM no físicos.
- Mostrar metadatos útiles del puerto cuando existan: fabricante, serial, VID/PID.

---

### 2.2 Panel `2. Dispositivos detectados`

Decisiones aplicadas:

- Ya no se precargan dispositivos ficticios como `PLC_Principal`, `HMI_Panel` o `Variador_01` en sesión limpia.
- Al escanear, los dispositivos reales aparecen como `Slave ID X`.
- Si el dispositivo no tiene nombre asignado, se muestra etiqueta `NOMBRE PEND.`.
- El usuario o una plantilla futura deberá asignar nombres amigables.
- Este panel sí puede tener **scroll interno** cuando aparezcan muchos slaves.

Pendiente posterior:

- Permitir renombrar un slave detectado desde la UI.
- Guardar el nombre dentro de la sesión.
- Asociar el slave a un template de dispositivo.

---

### 2.3 Panel `Resumen`

Decisiones aplicadas:

- Empieza en cero.
- `Solicitudes` aumenta con escaneos y lecturas reales.
- `Respuestas` aumenta solo con respuestas reales OK.
- `Errores` y `Timeouts` no deben inflarse durante un escaneo normal cuando un ID no existe.
- El escaneo 1–10 debe detectar slaves reales sin castigar como error cada ID que no responde.
- Este panel **no debe tener scroll interno**.
- Debe entrar completo en la fila superior sin cortarse.

---

### 2.4 Panel `3. Lectura rápida de registros`

Decisiones aplicadas:

- Empieza sin lecturas.
- Se llena solo al presionar `Leer`.
- La función Modbus se elige con desplegable.
- El slave activo se toma desde la lista detectada.
- Para `FC01` y `FC02`, los valores booleanos se muestran como chips:
  - `ON` en verde.
  - `OFF` en gris.
- Los controles superiores se ven alineados y compactos: etiqueta arriba, campo debajo, botón `Leer` a la misma altura de los campos.
- La tabla tiene **scroll interno** cuando la lectura trae muchos registros o bits.
- La vista general no debe crecer ni mostrar scroll global por esta tabla.

Decisión importante sobre rangos:

- Los **function codes** de Modbus sí son estándar: `FC01`, `FC02`, `FC03`, `FC04`, `FC05`, `FC06`, `FC15`, `FC16`, etc.
- Las **áreas de datos** también son conceptos estándar: coils, discrete inputs, input registers y holding registers.
- Pero los **rangos exactos disponibles** dependen de cada slave.
- La notación tipo `40000`, `30000`, `10000` es una convención de direccionamiento de interfaz/documentación, no una regla universal impuesta por el protocolo Modbus.
- En el MVP se evita presentar rangos específicos como si fueran universales.
- El texto de ayuda dice que el rango real depende del mapa del dispositivo o del template aplicado.

---

### 2.5 Panel `Actividad reciente`

Decisiones aplicadas:

- Se amplió visualmente respecto a la primera integración.
- Incluye el valor leído, no solo la dirección y cantidad.
- Se agregó columna `Info` para revisar el detalle de una actividad.
- La columna `Fecha/hora` debe procurar verse completa y sin cortes innecesarios.
- La tabla tiene **scroll interno** cuando hay muchas actividades.
- La vista general no debe crecer ni mostrar scroll global por esta tabla.

Detalle de `Info` aprobado:

- El botón `Info` abre el detalle **dentro de la misma área de Actividad reciente**, ocupando todo ese panel.
- El detalle tiene botón `X` para cerrar y volver a la tabla de actividad.
- No se envía al panel lateral de ayuda porque agrupa la información de forma poco útil.
- El detalle replica la tabla de `Lectura rápida`, pero con datos no editables:
  - función ejecutada,
  - slave ID,
  - dirección inicial,
  - cantidad,
  - duración,
  - resultado,
  - listado completo de valores,
  - tipo y acceso cuando exista mapa,
  - TX/RX y excepción en una etapa posterior.

---

## 3. Direccionamiento Modbus y templates

### 3.1 Qué es estándar

Son estándar:

- `FC01 Read Coils`.
- `FC02 Read Discrete Inputs`.
- `FC03 Read Holding Registers`.
- `FC04 Read Input Registers`.
- `FC05 Write Single Coil`.
- `FC06 Write Single Register`.
- `FC15 Write Multiple Coils`.
- `FC16 Write Multiple Registers`.

También es estándar la idea de leer coils, entradas discretas, input registers y holding registers.

### 3.2 Qué depende del dispositivo

Depende del dispositivo:

- Qué direcciones existen.
- Qué cantidad máxima se debe leer por operación.
- Qué significa cada dirección.
- Qué tipo de dato representa cada registro.
- Si un registro es solo lectura o lectura/escritura.
- Si requiere escala, offset, unidad, endianess o combinación de registros.

### 3.3 Templates propuestos

Se propone implementar templates por familia de dispositivo:

```text
Template JWPLC Basic Remote IO
Template Variador genérico
Template HMI panel
Template custom
```

Cada template debería definir:

- nombre del dispositivo,
- ID sugerido,
- funciones soportadas,
- rangos permitidos,
- mapa de registros,
- nombres amigables,
- tipo de dato,
- unidad,
- acceso: R, W, R/W,
- validaciones de cantidad máxima,
- pruebas preconfiguradas.

Con templates, la UI puede restringir o sugerir direcciones sin fingir que todos los slaves comparten el mismo mapa.

---

## 4. Siguiente vista: Sesiones

Punto de partida visual:

- Referencia aprobada: imagen dashboard de `Sencillo / Sesiones` con `Sesión actual`, `Sesiones recientes`, `Resumen de la sesión actual`, `Actividad reciente` y panel `¿Qué guarda una sesión?`.
- Estado real actual: ya existe una pantalla funcional básica, pero todavía está más simple y no replica por completo el dashboard aprobado.

Criterio para depuración:

- Trabajar la vista **Sesiones** una pantalla a la vez, igual que se hizo con Dispositivos.
- Mantener sesión limpia cuando no haya archivo abierto.
- Mostrar datos reales generados desde la sesión actual cuando existan: dispositivos detectados, registros leídos, actividad reciente y errores.
- Evitar datos mock fijos cuando la sesión sea limpia.
- Preservar la idea visual de la propuesta aprobada, pero adaptada al estado real del MVP.

Secciones esperadas en la versión final de Sesiones:

1. Acciones superiores: `Nueva sesión`, `Abrir sesión`, `Guardar sesión`.
2. Tarjeta `Sesión actual` con nombre editable, estado, rol, protocolo, slave activo, conexión y última actividad.
3. Botón ancho `Continuar sesión`.
4. Panel `¿Qué guarda una sesión?`.
5. Panel `Sesiones recientes` con lista compacta y acciones por fila.
6. Panel `Resumen de la sesión actual` con tarjetas con iconos.
7. Panel `Actividad reciente` con eventos reales de la sesión.

---

## 5. Estado avanzado del MVP

Implementado:

- UI base de Modo sencillo.
- Vista Dispositivos conectada a backend real.
- Listado de puertos desde Electron.
- Conexión/desconexión serial real.
- Escaneo de slaves 1–10.
- Lectura rápida real con `FC01`, `FC02`, `FC03`, `FC04`.
- Resumen limpio sin datos mock iniciales.
- Actividad reciente con valores leídos.
- Chips visuales para ON/OFF.
- Estado `Desconectado` en rojo.
- Alineación compacta del bloque superior de lectura rápida.
- Scroll interno en `Lectura rápida`, `Actividad reciente` y detalle de lectura.
- Vista Dispositivos cerrada como primera versión real.

Pendiente inmediato:

- Validar `npm run typecheck`.
- Ajustar cualquier error de TypeScript/React que salga en local.
- Revisar visualmente la columna `Fecha/hora` de `Actividad reciente` luego del ajuste de ancho.
- Iniciar refinamiento de la vista `Sesiones`.

Pendiente medio plazo:

- Sesiones reales persistentes.
- Templates de dispositivo.
- Editor de nombres de slaves.
- Editor de mapa de registros.
- Autolectura con intervalo real.
- Vista Registros conectada y refinada.
- Vista Tráfico con detalle TX/RX expandible.
- Plan de pruebas editable real.
- Escritura real con `FC05`, `FC06`, `FC15`, `FC16` en UI.
- Simulador slave PC como slave.

---

## 6. Criterio UX para próximos cambios

Trabajar una pantalla a la vez:

1. Dispositivos — cerrada como primera versión real.
2. Sesiones — siguiente vista a depurar.
3. Pruebas.
4. Registros.
5. Tráfico Modbus.

Cada pantalla debe quedar primero limpia y operativa con datos reales antes de agregar funciones avanzadas.
