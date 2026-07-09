# JW Modbus Tool — Biblia visual y funcional

Guía base para regenerar y evolucionar la interfaz de **JW Modbus Tool** (mockup visual: **Modbus Debug Suite**), una herramienta desktop de JW Control para **simular, probar y depurar comunicaciones Modbus**.

Este documento también contiene los **prompts base** que se usarán para generar imágenes. Cada observación aprobada debe actualizar tanto la especificación funcional como el prompt correspondiente.

---

## 1. Propósito

La herramienta debe permitir:

- Abrir conexión **Modbus RTU** y luego **Modbus TCP**.
- Actuar como **PC Master** para probar slaves reales.
- Actuar como **PC Slave simulado / Servidor Modbus** para probar masters externos.
- Escanear dispositivos.
- Leer y escribir coils y registros cuando aplique.
- Ejecutar planes de prueba.
- Capturar y explicar tráfico Modbus.
- Guardar sesiones de diagnóstico.
- Exportar evidencia o reportes.

---

## 2. Estilo común

- Tema oscuro azul petróleo / navy.
- Acentos cian/azul para acciones.
- Verde para OK/conectado.
- Amarillo/naranja para advertencias o timeouts.
- Rojo para errores, CRC, desconexión o falla crítica.
- Tarjetas con bordes sutiles.
- Tablas legibles.
- Gráficas pequeñas y útiles.
- Densidad progresiva por nivel: **Sencillo → Intermedio → Avanzado**.
- Resolución base de mockups: **1448 × 1086 px** (4:3).

---

## 3. Estructura común

### Barra superior

- Logo / ícono.
- `JW Modbus Tool` o `Modbus Debug Suite`.
- Etiqueta del modo: `Sencillo`, `Intermedio`, `Avanzado`.
- Acciones: `Nuevo`, `Abrir`, `Guardar`, `Conectar`, `Desconectar`, `Escanear`.
- Opcionales: `Opciones`, `Exportar`, `Ayuda`.

### Menú lateral

Orden definitivo:

1. **Dispositivos**
2. **Sesiones**
3. **Pruebas**
4. **Registros**
5. **Tráfico Modbus**

### Barra inferior

Debe mostrar contexto resumido:

```text
Conectado · COM3 · 115200 · 8N1 · Slave activo ID 1 · Sesión activa
```

---

## 4. Relación funcional entre vistas

```text
Dispositivos → Sesiones → Pruebas → Registros → Tráfico Modbus
      ↑             ↓          ↓          ↓             ↓
      └──────── contexto compartido de conexión, sesión y diagnóstico ────────┘
```

- **Dispositivos** define el bus y el slave activo.
- **Sesiones** guarda o recupera el contexto completo.
- **Pruebas** usa ese contexto para validar equipos.
- **Registros** opera directamente sobre datos Modbus.
- **Tráfico Modbus** explica qué ocurrió realmente en la comunicación.

---

## 5. Rol de la PC

### 5.1 Flujo principal: PC como Master

La PC:

- Abre el puerto RTU o la conexión TCP.
- Envía solicitudes.
- Lee/escribe registros.
- Escanea IDs.
- Ejecuta planes de prueba.
- Genera tráfico TX/RX.

Este es el flujo principal de **Dispositivos**, **Pruebas**, **Registros** y **Tráfico Modbus**.

### 5.2 Flujo secundario: PC como Slave simulado

La PC:

- Responde solicitudes de un master externo.
- Tiene ID slave configurable en RTU.
- Escucha como servidor en TCP.
- Expone un mapa de registros simulado.
- Puede inyectar retardo, timeout, excepción o CRC inválido.

Nombres recomendados:

- `Slave simulado`
- `PC como slave`
- `Servidor Modbus`

No usar `Virtual Master`.

---

## 6. Especificación por vista

### 6.1 Dispositivos

**Objetivo:** conectar la PC al bus y detectar equipos.

**Rol por defecto:** `PC Master`.

#### 1. Conectar

Debe mantenerse como en la propuesta aprobada:

- RTU/TCP.
- Puerto.
- Baud rate.
- Bits de datos.
- Paridad.
- Bits de parada.
- Timeout.
- Estado de conexión.

En RTU la PC se conecta al **bus**, no a un único slave.

#### 2. Dispositivos detectados

Debe mantenerse como en la propuesta aprobada:

- Lista de dispositivos encontrados.
- Selección de un dispositivo como `Slave activo`.
- Botón/icono `Recargar` dentro de la sección.

Diferencia funcional:

- `Escanear`: búsqueda principal de slaves disponibles.
- `Recargar`: refresco rápido del último escaneo.

Ejemplo de slave activo:

```text
Slave activo: PLC_Principal — ID 1
```

#### Resumen

Debe volver al enfoque de la propuesta original porque representa mejor un resumen general de comunicación.

Debe incluir indicadores grandes:

- `Solicitudes`
- `Respuestas`
- `Errores`
- `Timeouts`

Y debajo un resumen operativo:

- `Dispositivos encontrados`
- `Rango de escaneo`
- `Último escaneo`
- `Rol: PC Master`

Ejemplo visual deseado:

```text
Resumen
Estado general de la comunicación.

Solicitudes: 128
Respuestas: 126
Errores: 2
Timeouts: 0

Dispositivos encontrados: 3
Rango de escaneo: 1–10
Último escaneo: OK · 09/07/2026 01:02:15
Rol: PC Master
```

#### 3. Lectura rápida de registros

Debe volver al formato de la propuesta anterior, mostrando **lo leído**, no solo los parámetros de lectura.

Debe incluir:

- `Slave activo: PLC_Principal — ID 1`.
- Tipo de función aplicada en un **selector desplegable**, por ejemplo `FC03 Read Holding Registers`.
- `Dirección inicial`.
- `Cantidad`.
- Botón `Leer`.
- Tabla de resultados con columnas:
  - Dirección.
  - Nombre.
  - Valor.
  - Estado.

Ejemplo:

| Dirección | Nombre | Valor | Estado |
|---:|---|---:|---|
| 40000 | Velocidad_Ref (RPM) | 1250 | OK |
| 40001 | Estado_Variador | 0x006F | OK |
| 40002 | Corriente_Salida (A) | 12.1 | OK |
| 40003 | Tensión_DC (V) | 540 | OK |
| 40004 | Temp_Disipador (°C) | 42.3 | OK |
| 40005 | Horas_Marcha (h) | 1523 | OK |

No basta con indicar “leído correctamente”; debe mostrarse qué registros fueron leídos.

#### Actividad reciente

Debe ser compacta. Basta con indicar:

- Fecha/hora de lectura.
- Duración.
- Slave ID.
- Función ejecutada.
- Dirección y cantidad de registros.
- Resultado.

No es necesario separar inicio y fin para esta vista.

Ejemplo:

| Fecha/hora | Duración | Slave ID | Función | Dirección / cantidad | Resultado |
|---|---:|---:|---|---|---|
| 09/07/2026 01:02:15 | 284 ms | 1 | FC03 | 40000 / 6 regs | OK |

### 6.2 Sesiones

**Objetivo:** guardar, abrir y continuar diagnósticos.

Una sesión debe guardar:

- Rol de PC.
- Protocolo RTU/TCP.
- Parámetros de conexión.
- Dispositivos detectados.
- Slave activo.
- Perfil de escaneo.
- Mapa de registros.
- Watch lists.
- Planes de prueba.
- Resultados.
- Tráfico capturado.
- Notas.

#### Diseño final aprobado — Sencillo / Sesiones

La versión aprobada es el layout tipo dashboard amigable con:

1. **Barra superior** estándar de JW Modbus Tool.
2. **Menú lateral** con `Sesiones` activo.
3. Acciones superiores visibles:
   - `Nueva sesión`.
   - `Abrir sesión`.
   - `Guardar sesión`.
4. Tarjeta principal **Sesión actual**:
   - Nombre: `Comisionamiento_Lavadora_S200`.
   - Estado: `Activa`.
   - Rol: `PC Master`.
   - Protocolo: `RTU`.
   - Slave activo: `PLC_Principal — ID 1`.
   - Conexión: `COM3 · 115200 · 8N1`.
   - Última actividad: `Hace 4 min`.
   - Botón principal ancho: `Continuar sesión`.
5. Tarjeta lateral **¿Qué guarda una sesión?**:
   - Conexiones y dispositivos detectados.
   - Registros leídos y valores configurados.
   - Pruebas ejecutadas y resultados.
   - Tráfico Modbus capturado.
   - Notas y observaciones del diagnóstico.
6. Panel **Resumen de la sesión actual** con tarjetas con ícono:
   - `Dispositivos 3 Detectados`.
   - `Registros leídos 120 En total`.
   - `Pruebas 4/4 Aprobadas`.
   - `Tráfico capturado 3.2 MB En total`.
   - `Notas 2 Guardadas`.
   - `Errores 0 Detectados`.
7. Panel **Sesiones recientes** con lista compacta:
   - `Lavadora_S200_Prueba_RTU`.
   - `Variador_01_Lectura_RPM`.
   - `HMI_Panel_Pruebas`.
   - `Banco_Modbus_Taller`.
   - Cada fila muestra dispositivos, pruebas, errores y acciones `Continuar`, `Ver resumen`, `Exportar`.
8. Panel **Actividad reciente**:
   - Conexión establecida.
   - Slave activo seleccionado.
   - Escaneo iniciado.
   - Registros leídos correctamente.
9. Bloques laterales opcionales:
   - `¿Nuevo aquí?`.
   - Licencia / versión.

Esta versión combina la primera propuesta que gustó por su claridad con la segunda propuesta que aportaba métricas útiles como registros leídos, pruebas, tráfico capturado y notas.

Por nivel:

- **Sencillo:** historial amigable, acciones `Nueva`, `Abrir`, `Guardar`, `Continuar`, sesiones recientes y resumen con tarjetas.
- **Intermedio:** filtros por cliente/proyecto/máquina, topología guardada, últimos errores, timeline.
- **Avanzado:** versionado, snapshots, comparación A/B, replay, exportación de evidencia.

### 6.3 Pruebas

**Corrección clave:** la vista no debe centrarse primero en “dispositivo virtual”.

Flujo principal:

```text
Plan de pruebas al slave
PC como Master
Secuencia de tramas
```

La tabla de pasos debe permitir definir:

- Habilitado.
- Paso.
- Slave ID.
- Dispositivo.
- Función.
- Dirección.
- Cantidad.
- Valor a escribir.
- Tipo de dato.
- Esperado.
- Timeout.
- Reintentos.
- Resultado.

Ejemplo:

| Paso | Slave | Función | Dirección | Acción |
|---|---:|---|---:|---|
| 1 | 1 | FC03 | 40000 | Leer 10 registros |
| 2 | 1 | FC06 | 40020 | Escribir valor 1 |
| 3 | 10 | FC04 | 30000 | Leer 4 registros |
| 4 | 2 | FC01 | 00000 | Leer 8 coils |

Flujo secundario:

- `Simulador slave`
- `PC como slave`

Debe existir para probar masters externos, pero no debe ser el foco principal.

### 6.4 Registros

**Objetivo:** leer y escribir datos Modbus en vivo.

Las cuatro áreas Modbus a mostrar son:

| Área | Lectura | Escritura |
|---|---|---|
| Coils | FC01 | FC05 / FC15 |
| Discrete Inputs | FC02 | No |
| Input Registers | FC04 | No |
| Holding Registers | FC03 | FC06 / FC16 |

La vista debe mostrar pestañas:

1. `Coils (01)`
2. `Discrete Inputs (02)`
3. `Input Registers (04)`
4. `Holding Registers (03)`

Debe existir parámetro explícito de frecuencia:

- `Leer`
- `Autolectura`
- `Intervalo`
- `Detener`

### 6.5 Tráfico Modbus

**Objetivo:** explicar el intercambio real de mensajes.

La tabla debe mostrar:

- Hora.
- Origen.
- Destino.
- ID esclavo.
- Tipo.
- Función.
- Resultado.
- Resumen.

Ejemplo RTU:

```text
PC Master → PLC_Principal
PLC_Principal → PC Master
```

Modo sencillo debe mantener explicación simple con panel `¿Qué pasó?`, sin convertirse en analizador byte a byte.

---

## 7. Datos consistentes de ejemplo

### Dispositivos

- `PLC_Principal` — ID 1
- `HMI_Panel` — ID 2
- `Variador_01` — ID 10
- `Remote_IO` — ID 11
- `Gateway_TCP_RTU` — ID 20

### RTU

- COM3
- 115200
- 8N1

### TCP

- 192.168.1.50
- Puerto 502
- Unit ID 1

### Registros ejemplo

- `40000` — `Velocidad_Ref`
- `40001` — `Estado_Variador`
- `40002` — `Corriente_Salida`
- `40003` — `Tension_DC`
- `40004` — `Temp_Disipador`
- `40005` — `Horas_Marcha`
- `40008` — `Frecuencia_Salida`
- `40009` — `Estado_Alarma`

---

## 8. Secuencia de imágenes por modo

Cada modo debe tener 5 imágenes:

1. Dispositivos
2. Sesiones
3. Pruebas
4. Registros
5. Tráfico Modbus

A partir de la revisión del modo sencillo, la generación debe hacerse **una vista a la vez** para afinar con menor demora y menor retrabajo.

---

## 9. Ajustes aprobados para regenerar el modo Sencillo

### Dispositivos

- Mantener `1. Conectar`.
- Mantener `2. Dispositivos detectados`.
- Cambiar `Resumen` para recuperar el formato original con indicadores grandes: solicitudes, respuestas, errores y timeouts.
- En `Resumen`, conservar también datos operativos: dispositivos encontrados, rango de escaneo, último escaneo y rol PC Master.
- Cambiar `3. Lectura rápida de registros` para mostrar tabla de registros leídos.
- En `3. Lectura rápida de registros`, incluir explícitamente la función de lectura aplicada y hacerla un **selector desplegable**.
- Compactar `Actividad reciente`: fecha/hora de lectura, duración, slave ID, función, dirección-cantidad y resultado.

### Sesiones

- Mantener como final la versión dashboard aprobada.
- Acciones superiores: `Nueva sesión`, `Abrir sesión`, `Guardar sesión`.
- Tarjeta principal: `Sesión actual` con `Continuar sesión` ancho.
- Mantener panel `¿Qué guarda una sesión?`.
- Mantener panel `Resumen de la sesión actual` con tarjetas con ícono.
- Mantener `Sesiones recientes` con acciones por fila.
- Mantener `Actividad reciente`.
- Añadir y conservar `Rol: PC Master`, `Slave activo: PLC_Principal — ID 1`, conexión `COM3 · 115200 · 8N1`, registros leídos, pruebas, tráfico capturado y notas.

### Pruebas

- Rediseñar hacia `Plan de pruebas al slave`.
- Poner a la PC como Master en el flujo principal.
- Dejar `Simulador slave` como opción secundaria.

### Registros

- Mostrar las cuatro áreas Modbus.
- Añadir `Autolectura` e `Intervalo`.
- Mostrar `Slave activo`.
- Actividad reciente con inicio/fin/duración.

### Tráfico Modbus

- Mantener estilo aprobado.
- Añadir `Origen`, `Destino` e `ID esclavo`.
- Mantener explicación simple en `¿Qué pasó?`.

---

## 10. Prompts base para generación de imágenes

### Prompt maestro común

Interfaz desktop realista de una herramienta industrial llamada `JW Modbus Tool` / `Modbus Debug Suite`, tema oscuro azul petróleo, estilo profesional de software técnico para Windows, layout 1448x1086, barra superior con acciones de conexión, menú lateral izquierdo con secciones Dispositivos, Sesiones, Pruebas, Registros y Tráfico Modbus, tarjetas con bordes sutiles, acentos cian, estados verde/amarillo/rojo, tablas técnicas legibles, gráficas pequeñas de monitoreo, iconografía Modbus/industrial, consistente entre pantallas del mismo modo.

### Sencillo / Dispositivos — prompt vigente

Generar una pantalla `Sencillo / Dispositivos` de `JW Modbus Tool`. La PC actúa como `PC Master`. `Conectar` abre el bus RTU/TCP. `Escanear` busca slaves disponibles. `Recargar` dentro de `Dispositivos detectados` refresca el último escaneo.

Mantener el diseño aprobado de:

- `1. Conectar`.
- `2. Dispositivos detectados`.

En `2. Dispositivos detectados`, mostrar:

- `PLC_Principal — ID 1` como seleccionado y marcado como `SLAVE ACTIVO`.
- `HMI_Panel — ID 2`.
- `Variador_01 — ID 10`.

El panel `Resumen` debe parecer un verdadero resumen general de comunicación. Debe incluir cuatro indicadores grandes:

- `Solicitudes: 128`.
- `Respuestas: 126`.
- `Errores: 2`.
- `Timeouts: 0`.

Debajo del resumen, incluir:

- `Dispositivos encontrados: 3`.
- `Rango de escaneo: 1–10`.
- `Último escaneo: OK · 09/07/2026 01:02:15`.
- `Rol: PC Master`.

El panel `3. Lectura rápida de registros` debe usar el formato original, con tabla de registros leídos. Debe mostrar:

- `Slave activo: PLC_Principal — ID 1`.
- La función aplicada en un **selector desplegable**, por ejemplo `FC03 Read Holding Registers`.
- `Dirección inicial: 40000`.
- `Cantidad: 6`.
- Botón `Leer`.
- Tabla con columnas `Dirección`, `Nombre`, `Valor`, `Estado`.

La tabla debe incluir registros leídos, por ejemplo:

- `40000`, `Velocidad_Ref (RPM)`, `1250`, `OK`.
- `40001`, `Estado_Variador`, `0x006F`, `OK`.
- `40002`, `Corriente_Salida (A)`, `12.1`, `OK`.
- `40003`, `Tensión_DC (V)`, `540`, `OK`.
- `40004`, `Temp_Disipador (°C)`, `42.3`, `OK`.
- `40005`, `Horas_Marcha (h)`, `1523`, `OK`.

`Actividad reciente` debe ser compacta y mostrar solo:

- Fecha/hora.
- Duración.
- Slave ID.
- Función.
- Dirección / cantidad.
- Resultado.

No usar columnas separadas de inicio y fin en esta vista. No reemplazar la tabla de registros leídos por un simple mensaje de “leído correctamente”.

### Sencillo / Sesiones — prompt vigente

Generar pantalla `Sencillo / Sesiones` de `JW Modbus Tool`, con el mismo tema oscuro azul petróleo, acentos cian y estilo de tarjetas de la vista `Sencillo / Dispositivos` aprobada. El menú lateral debe tener `Sesiones` activo. La barra inferior debe mantener `Conectado · COM3 · 115200 · 8N1 · Slave activo ID 1 · Sesión activa`.

La vista final debe replicar la versión dashboard aprobada:

- En la parte superior del contenido, mostrar acciones grandes: `Nueva sesión`, `Abrir sesión`, `Guardar sesión`.
- Tarjeta principal izquierda `Sesión actual`:
  - Nombre: `Comisionamiento_Lavadora_S200`.
  - Estado: `Activa`.
  - `Rol: PC Master`.
  - `Protocolo: RTU`.
  - `Slave activo: PLC_Principal — ID 1`.
  - `Conexión: COM3 · 115200 · 8N1`.
  - `Última actividad: Hace 4 min`.
  - Botón principal ancho `Continuar sesión`.
- Tarjeta superior derecha `¿Qué guarda una sesión?` con bullets sobre conexiones, registros leídos, pruebas, tráfico capturado y notas.
- Panel derecho/medio `Resumen de la sesión actual` con tarjetas con ícono:
  - `Dispositivos 3 Detectados`.
  - `Registros leídos 120 En total`.
  - `Pruebas 4/4 Aprobadas`.
  - `Tráfico capturado 3.2 MB En total`.
  - `Notas 2 Guardadas`.
  - `Errores 0 Detectados`.
- Panel central/inferior `Sesiones recientes` con filas para `Lavadora_S200_Prueba_RTU`, `Variador_01_Lectura_RPM`, `HMI_Panel_Pruebas`, `Banco_Modbus_Taller`. Cada fila debe mostrar dispositivos, pruebas, errores y acciones `Continuar`, `Ver resumen`, `Exportar`.
- Panel inferior derecho `Actividad reciente` con eventos de conexión, selección de slave activo, escaneo y lectura correcta de registros.
- Bloques laterales opcionales: `¿Nuevo aquí?`, `Licencia: Profesional`, `Versión 1.3.0 (64-bit)`.

Mantener la pantalla limpia, amigable y claramente de modo sencillo. No hacerla tan densa como una herramienta de laboratorio.

### Sencillo / Pruebas

Pantalla `Sencillo / Pruebas` rediseñada. Foco principal: `Plan de pruebas al slave` con `PC como Master`. Mostrar una tabla de secuencia de tramas con columnas: habilitado, paso, slave, dispositivo, función, dirección, cantidad/valor, esperado, timeout, resultado. Incluir `PLC_Principal ID 1`, `HMI_Panel ID 2` y `Variador_01 ID 10`. Botones: `Iniciar prueba`, `Detener`, `Agregar paso`, `Guardar plan`. Añadir tarjeta secundaria `Simulador slave`.

### Sencillo / Registros

Pantalla `Sencillo / Registros`. Mostrar cuatro pestañas: `Coils (01)`, `Discrete Inputs (02)`, `Input Registers (04)`, `Holding Registers (03)`. Mostrar `Slave activo: PLC_Principal — ID 1`. Controles: dirección inicial, cantidad, `Leer`, `Autolectura`, `Intervalo 1 s`, `Detener`. Solo lectura en Discrete Inputs e Input Registers. Escritura solo en Coils y Holding Registers.

### Sencillo / Tráfico Modbus

Pantalla `Sencillo / Tráfico Modbus`. Mantener estilo aprobado y agregar columnas `Origen`, `Destino` e `ID esclavo`. Mostrar mensajes como `PC Master → PLC_Principal`, `PLC_Principal → PC Master`, `PC Master → Variador_01`. Filtros: protocolo, dispositivo, slave ID y resultado. Panel `¿Qué pasó?` con explicación simple.

---

## 11. Regla narrativa

Las 15 imágenes deben contar esta historia:

1. Conecto o descubro equipos.
2. Guardo o recupero mi contexto de trabajo.
3. Ejecuto pruebas para validar comunicación.
4. Leo/escribo registros para operar o diagnosticar.
5. Analizo el tráfico para entender qué ocurrió realmente.
