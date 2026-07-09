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
- Morado para funciones secundarias de simulación slave o excepciones.
- Tarjetas con bordes sutiles.
- Tablas legibles.
- Gráficas pequeñas y útiles.
- Iconos de estado circulares en paneles de resumen y explicación.
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

Ejemplo:

```text
Slave activo: PLC_Principal — ID 1
```

#### Resumen

Debe representar el estado general de la comunicación.

Indicadores grandes:

- `Solicitudes`.
- `Respuestas`.
- `Errores`.
- `Timeouts`.

Resumen operativo:

- `Dispositivos encontrados`.
- `Rango de escaneo`.
- `Último escaneo`.
- `Rol: PC Master`.

#### 3. Lectura rápida de registros

Debe mostrar **lo leído**, no solo los parámetros de lectura.

Debe incluir:

- `Slave activo: PLC_Principal — ID 1`.
- Tipo de función aplicada en un **selector desplegable**, por ejemplo `FC03 Read Holding Registers`.
- `Dirección inicial`.
- `Cantidad`.
- Botón `Leer`.
- Tabla con `Dirección`, `Nombre`, `Valor`, `Estado`.

Ejemplo de registros:

| Dirección | Nombre | Valor | Estado |
|---:|---|---:|---|
| 40000 | Velocidad_Ref (RPM) | 1250 | OK |
| 40001 | Estado_Variador | 0x006F | OK |
| 40002 | Corriente_Salida (A) | 12.1 | OK |
| 40003 | Tensión_DC (V) | 540 | OK |
| 40004 | Temp_Disipador (°C) | 42.3 | OK |
| 40005 | Horas_Marcha (h) | 1523 | OK |

#### Actividad reciente

Debe ser compacta. Basta con indicar:

- Fecha/hora de lectura.
- Duración.
- Slave ID.
- Función ejecutada.
- Dirección y cantidad de registros.
- Resultado.

No es necesario separar inicio y fin para esta vista.

---

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
3. Acciones superiores visibles: `Nueva sesión`, `Abrir sesión`, `Guardar sesión`.
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
7. Panel **Sesiones recientes** con lista compacta.
8. Panel **Actividad reciente**.
9. Bloques laterales opcionales: `¿Nuevo aquí?`, licencia y versión.

Por nivel:

- **Sencillo:** historial amigable, acciones `Nueva`, `Abrir`, `Guardar`, `Continuar`, sesiones recientes y resumen con tarjetas.
- **Intermedio:** filtros por cliente/proyecto/máquina, topología guardada, últimos errores, timeline.
- **Avanzado:** versionado, snapshots, comparación A/B, replay, exportación de evidencia.

---

### 6.3 Pruebas

**Corrección clave:** la vista no debe centrarse primero en “dispositivo virtual”.

Flujo principal:

```text
Plan de pruebas al slave
PC como Master
Secuencia de tramas
```

#### Diseño final aprobado — Sencillo / Pruebas

La versión aprobada es el layout tipo dashboard de pruebas con:

1. **Barra superior** estándar de JW Modbus Tool.
2. **Menú lateral** con `Pruebas` activo.
3. Panel principal **Plan de pruebas al slave**:
   - Subtítulo: `PC como Master`.
   - Botones: `Iniciar prueba`, `Detener`, `Agregar paso`, `Guardar plan`.
   - Menú de opciones con tres puntos.
4. Tabla editable de pasos:
   - Columnas: `Activo`, `Paso`, `Slave`, `Dispositivo`, `Función`, `Dirección`, `Cantidad/Valor`, `Esperado`, `Timeout`, `Resultado`.
   - `Slave` debe verse como selector desplegable.
   - `Función` debe verse como selector desplegable.
   - `Dirección`, `Cantidad/Valor`, `Esperado` y `Timeout` son campos editables/manuales.
   - Se debe poder agregar y eliminar pasos.
   - La columna `Resultado` debe actualizarse durante o después de la ejecución.
5. La columna **Resultado** del plan muestra el estado resumido del último intento de cada paso.
6. El **Registro de ejecución** inferior guarda el detalle histórico.
7. Panel lateral **Escenarios** con acción `Gestionar escenarios`.
8. Panel lateral **Simulador slave (PC como slave)** secundario con engranaje para ajustes futuros.
9. KPIs inferiores atractivos.
10. Panel **Registro de ejecución** debajo de los KPIs.

Relación entre tablas:

- La tabla superior **Plan de pruebas** muestra la definición editable y el estado resumido actual por paso.
- La tabla inferior **Registro de ejecución** muestra el historial detallado de cada ejecución.

---

### 6.4 Registros

**Objetivo:** leer y escribir datos Modbus en vivo para el `Slave activo`.

#### Diseño final aprobado — Sencillo / Registros

La versión aprobada es la segunda propuesta, con distribución tipo tablero técnico limpio:

1. **Barra superior** estándar de JW Modbus Tool.
2. **Menú lateral** con `Registros` activo.
3. Encabezado superior:
   - `Slave activo: PLC_Principal — ID 1`.
   - Nota informativa: `Los registros se muestran en formato decimal`.
4. Pestañas de áreas Modbus:
   - `Coils (01)` — `Lectura/Escritura`.
   - `Discrete Inputs (02)` — `Solo lectura`.
   - `Input Registers (04)` — `Solo lectura`.
   - `Holding Registers (03)` — `Lectura/Escritura`.
5. Controles de lectura/polling:
   - `Dirección inicial`.
   - `Cantidad`.
   - Botón `Leer`.
   - `Autolectura`.
   - `Intervalo`.
   - Botón `Detener`.
6. Tabla principal de registros:
   - Columnas: `Dirección`, `Nombre`, `Valor`, `Tipo`, `Acceso`, `Estado`.
   - Debe mostrar dirección decimal y, cuando ayude, equivalente hexadecimal entre paréntesis.
   - El acceso debe resumirse como `R`, `W` o `R/W`.
7. Panel lateral **Registro seleccionado**:
   - Dirección seleccionada.
   - Nombre asignado.
   - Valor actual.
   - Tipo asignado.
   - Acceso.
   - Tendencia de los últimos 60 s.
   - Estadísticos mínimos: `Min`, `Máx`, `Prom`.
8. Panel inferior **Actividad reciente**:
   - `Inicio`.
   - `Fin`.
   - `Duración`.
   - `Slave ID`.
   - `Dispositivo`.
   - `Función`.
   - `Rango`.
   - `Cantidad`.
   - `Resultado`.
   - `Tiempo de respuesta`.
   - Enlace `Ver todo el historial`.

#### Asignación de nombre, tipo y metadatos

El nombre de cada dirección, el tipo de dato y metadatos asociados no salen automáticamente de Modbus. Deben venir de un **Mapa de registros** asociado al `Slave activo` y guardado dentro de la sesión.

La vista debe aclarar visualmente dónde se edita ese mapa:

- Incluir una acción discreta `Editar mapa` o `Asignar nombre/tipo` cerca de la tabla principal o en el panel `Registro seleccionado`.
- Al seleccionar una fila, el panel `Registro seleccionado` debe permitir editar o abrir edición de:
  - `Nombre`.
  - `Tipo`.
  - `Unidad`.
  - `Acceso` cuando aplique.
  - `Escala / factor` si se requiere más adelante.
  - `Descripción` opcional.
- Si una dirección todavía no tiene metadatos, se puede mostrar un nombre genérico como `Reg_40000` y tipo por defecto `uint16`.
- Al guardar, esos nombres/tipos quedan ligados al mapa del slave dentro de la sesión.

Tipos sugeridos para el mapa:

- `bool` para coils/discrete inputs.
- `uint16`.
- `int16`.
- `uint32`.
- `int32`.
- `float32`.
- `bitfield`.
- `string`, si más adelante aplica.

Acceso por defecto según área:

| Área | Acceso por defecto |
|---|---|
| Coils | R/W |
| Discrete Inputs | R |
| Input Registers | R |
| Holding Registers | R/W |

---

### 6.5 Tráfico Modbus

**Objetivo:** explicar el intercambio real de mensajes Modbus de forma clara.

#### Diseño final aprobado — Sencillo / Tráfico Modbus

La versión aprobada es la tercera propuesta, manteniendo la distribución de la segunda propuesta y aplicando estos ajustes visuales:

1. **Barra superior** estándar de JW Modbus Tool.
2. **Menú lateral** con `Tráfico Modbus` activo.
3. Encabezado:
   - Título: `Tráfico Modbus`.
   - Subtítulo: `Visualice el historial de mensajes Modbus en tiempo real.`
4. Filtros superiores:
   - `Protocolo`.
   - `Dispositivo`.
   - `Slave ID`.
   - `Resultado`.
   - Botón `Limpiar filtros`.
5. Tabla principal de tráfico:
   - Primera columna angosta con flechas direccionales.
   - `Hora`.
   - `Origen → Destino` como **una sola columna combinada**.
   - `ID esclavo`.
   - `Tipo`.
   - `Función`.
   - `Resultado`.
   - `Resumen`.
6. Las flechas de la primera columna deben ser delgadas y claras:
   - Flecha azul/cian hacia arriba para **petición / salida desde PC Master**.
   - Flecha verde hacia abajo para **respuesta / entrada hacia PC Master**.
   - Se pueden usar colores de advertencia para filas con error si aporta claridad, pero no deben reemplazar el resultado principal.
7. La columna combinada `Origen → Destino` debe mostrar rutas como:
   - `PC Master → PLC_Principal`.
   - `PLC_Principal → PC Master`.
   - `PC Master → HMI_Panel`.
   - `PC Master → Variador_01`.
8. Evitar mostrar títulos separados `Origen` y `Destino` si la fila usa una ruta combinada, para no dar la impresión de columnas vacías o duplicadas.
9. La tabla debe incluir estados:
   - `OK`.
   - `Timeout`.
   - `CRC Error`.
   - `Excepción`.
10. Debe incluir paginación: `Mostrando 1 a 10 de 25 tramas` y páginas `1`, `2`, `3`.
11. Panel inferior **Detalles del mensaje seleccionado**:
   - Dirección / ID.
   - Función.
   - Tipo.
   - Fecha / hora.
   - Origen.
   - Destino.
   - Resumen.
   - Parámetros de petición.
   - Respuesta.
   - Tiempo de respuesta.
12. Panel inferior **¿Qué pasó?**:
   - Debe usar icono circular grande de estado, por ejemplo check verde.
   - Debe conservar explicación simple y humana.
   - Debe incluir una caja de consejo con icono de estrella.
13. Panel inferior **Actividad de la sesión**:
   - Debe usar iconos circulares de estado.
   - Debe mostrar `Mensajes OK`, `Timeouts`, `Errores CRC`, `Excepciones`.
   - Debe mostrar cantidades y porcentajes.
   - Puede incluir barras de progreso.
   - Debe incluir resumen temporal: sesión activa desde, tiempo total, trama más rápida/lenta o equivalente.

La vista debe mantenerse clara y sencilla. No debe convertirse en analizador hexadecimal avanzado.

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

### Estado de validación

La primera versión **Sencilla** queda validada visual y funcionalmente con estas vistas aprobadas:

- `Sencillo / Dispositivos`.
- `Sencillo / Sesiones`.
- `Sencillo / Pruebas`.
- `Sencillo / Registros`.
- `Sencillo / Tráfico Modbus`.

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

- Mantener como final la propuesta de `Plan de pruebas al slave` con la tabla editable y KPIs atractivos.
- Poner a la PC como Master en el flujo principal.
- La tabla superior define los pasos y muestra el estado resumido en la columna `Resultado`.
- La columna `Resultado` debe actualizarse durante o al finalizar la ejecución de cada paso.
- El `Registro de ejecución` inferior muestra el detalle histórico de cada paso ejecutado.
- `Slave` y `Función` deben ser desplegables.
- `Dirección`, `Cantidad/Valor`, `Esperado` y `Timeout` se escriben manualmente.
- Incluir `Escenarios` con `Gestionar escenarios` para añadir o administrar más escenarios.
- Dejar `Simulador slave` como opción secundaria con engranaje para ajustes futuros.

### Registros

- Mantener como final la segunda propuesta visual de `Sencillo / Registros`.
- Mantener las cuatro pestañas de áreas Modbus con acceso visible.
- Mantener `Slave activo: PLC_Principal — ID 1`.
- Mantener `Leer`, `Autolectura`, `Intervalo` y `Detener`.
- Mantener la tabla principal con `Dirección`, `Nombre`, `Valor`, `Tipo`, `Acceso`, `Estado`.
- Mantener el panel `Registro seleccionado` con valor actual, tipo, acceso, tendencia y estadísticos.
- Mantener `Actividad reciente` con inicio/fin/duración y tiempo de respuesta.
- Aclarar que `Nombre`, `Tipo`, `Unidad`, `Acceso` y otros metadatos se asignan desde un **Mapa de registros** del slave activo.
- Incluir acción `Editar mapa` o `Asignar nombre/tipo` para editar esos metadatos.

### Tráfico Modbus

- Mantener como final la tercera propuesta visual generada para `Sencillo / Tráfico Modbus`.
- Mantener filtros: protocolo, dispositivo, Slave ID, resultado y `Limpiar filtros`.
- Usar columna inicial de flechas delgadas para dirección del mensaje.
- Usar una sola columna combinada `Origen → Destino`, no columnas separadas, para que coincida con las rutas mostradas en cada fila.
- Mantener `ID esclavo`, `Tipo`, `Función`, `Resultado` y `Resumen`.
- Mantener el panel `Detalles del mensaje seleccionado`.
- Mantener el panel `¿Qué pasó?` con explicación simple e iconos circulares.
- Mantener `Actividad de la sesión` con iconos circulares, cantidades, porcentajes y resumen temporal.
- No convertir esta vista en un analizador hexadecimal avanzado.

---

## 10. Prompts base para generación de imágenes

### Prompt maestro común

Interfaz desktop realista de una herramienta industrial llamada `JW Modbus Tool` / `Modbus Debug Suite`, tema oscuro azul petróleo, estilo profesional de software técnico para Windows, layout 1448x1086, barra superior con acciones de conexión, menú lateral izquierdo con secciones Dispositivos, Sesiones, Pruebas, Registros y Tráfico Modbus, tarjetas con bordes sutiles, acentos cian, estados verde/amarillo/rojo, tablas técnicas legibles, gráficas pequeñas de monitoreo, iconografía Modbus/industrial, consistente entre pantallas del mismo modo.

### Sencillo / Dispositivos — prompt vigente

Generar una pantalla `Sencillo / Dispositivos` de `JW Modbus Tool`. La PC actúa como `PC Master`. `Conectar` abre el bus RTU/TCP. `Escanear` busca slaves disponibles. `Recargar` dentro de `Dispositivos detectados` refresca el último escaneo.

Mantener el diseño aprobado de `1. Conectar` y `2. Dispositivos detectados`. En `2. Dispositivos detectados`, mostrar `PLC_Principal — ID 1` como seleccionado y marcado como `SLAVE ACTIVO`, además de `HMI_Panel — ID 2` y `Variador_01 — ID 10`.

El panel `Resumen` debe parecer un verdadero resumen general de comunicación. Debe incluir `Solicitudes: 128`, `Respuestas: 126`, `Errores: 2`, `Timeouts: 0`, `Dispositivos encontrados: 3`, `Rango de escaneo: 1–10`, `Último escaneo: OK · 09/07/2026 01:02:15` y `Rol: PC Master`.

El panel `3. Lectura rápida de registros` debe usar el formato original, con tabla de registros leídos. Debe mostrar `Slave activo: PLC_Principal — ID 1`, función aplicada en un **selector desplegable** (`FC03 Read Holding Registers`), `Dirección inicial: 40000`, `Cantidad: 6`, botón `Leer` y tabla con `Dirección`, `Nombre`, `Valor`, `Estado`.

`Actividad reciente` debe ser compacta y mostrar solo fecha/hora, duración, Slave ID, función, dirección/cantidad y resultado.

### Sencillo / Sesiones — prompt vigente

Generar pantalla `Sencillo / Sesiones` de `JW Modbus Tool`, con el mismo tema oscuro azul petróleo, acentos cian y estilo de tarjetas de la vista `Sencillo / Dispositivos` aprobada. El menú lateral debe tener `Sesiones` activo. La barra inferior debe mantener `Conectado · COM3 · 115200 · 8N1 · Slave activo ID 1 · Sesión activa`.

La vista final debe replicar la versión dashboard aprobada:

- En la parte superior del contenido, mostrar acciones grandes: `Nueva sesión`, `Abrir sesión`, `Guardar sesión`.
- Tarjeta principal izquierda `Sesión actual` con `Comisionamiento_Lavadora_S200`, estado `Activa`, `Rol: PC Master`, `Protocolo: RTU`, `Slave activo: PLC_Principal — ID 1`, conexión `COM3 · 115200 · 8N1`, última actividad `Hace 4 min` y botón ancho `Continuar sesión`.
- Tarjeta superior derecha `¿Qué guarda una sesión?` con bullets sobre conexiones, registros leídos, pruebas, tráfico capturado y notas.
- Panel derecho/medio `Resumen de la sesión actual` con tarjetas con ícono para dispositivos, registros leídos, pruebas, tráfico capturado, notas y errores.
- Panel central/inferior `Sesiones recientes` con filas para `Lavadora_S200_Prueba_RTU`, `Variador_01_Lectura_RPM`, `HMI_Panel_Pruebas`, `Banco_Modbus_Taller`; cada fila debe mostrar dispositivos, pruebas, errores y acciones `Continuar`, `Ver resumen`, `Exportar`.
- Panel inferior derecho `Actividad reciente` con eventos de conexión, selección de slave activo, escaneo y lectura correcta de registros.
- Bloques laterales opcionales: `¿Nuevo aquí?`, `Licencia: Profesional`, `Versión 1.3.0 (64-bit)`.

Mantener la pantalla limpia, amigable y claramente de modo sencillo. No hacerla tan densa como una herramienta de laboratorio.

### Sencillo / Pruebas — prompt vigente

Generar pantalla `Sencillo / Pruebas` de `JW Modbus Tool`, con el mismo tema oscuro azul petróleo, acentos cian y estilo de tarjetas de las vistas aprobadas. El menú lateral debe tener `Pruebas` activo. La barra inferior debe mantener `Conectado · COM3 · 115200 · 8N1 · Slave activo ID 1 · Sesión activa`.

La vista final debe replicar la propuesta aprobada:

- Panel principal `Plan de pruebas al slave` con subtítulo `PC como Master`.
- Botones visibles: `Iniciar prueba`, `Detener`, `Agregar paso`, `Guardar plan` y menú de tres puntos.
- Tabla editable de pasos con columnas `Activo`, `Paso`, `Slave`, `Dispositivo`, `Función`, `Dirección`, `Cantidad/Valor`, `Esperado`, `Timeout`, `Resultado`.
- `Slave` y `Función` deben verse como desplegables.
- `Dirección`, `Cantidad/Valor`, `Esperado` y `Timeout` deben parecer campos editables/manuales.
- Debe entenderse que se pueden agregar y eliminar pasos.
- La columna `Resultado` de la tabla superior debe actualizarse durante o al finalizar la ejecución de cada paso: `Pendiente`, `En ejecución`, `Aprobado`, `Error`, `Timeout`, `Excepción` o `CRC error`.
- Panel lateral `Escenarios` con `Operación normal`, `Timeout detectado`, `Error CRC detectado`, `Excepción Modbus` y acción `Gestionar escenarios` para añadir o administrar escenarios.
- Panel lateral secundario `Simulador slave (PC como slave)` con `Estado`, `Dirección slave`, `Puerto`, `Baud Rate`, botón `Iniciar simulador slave` y engranaje para ajustes futuros.
- Fila de KPIs atractivos: `Tasa de éxito`, `Latencia promedio`, `Errores`, `Pasos completados`, con indicadores circulares cuando aplique.
- Panel inferior `Registro de ejecución` con columnas `Hora`, `Paso`, `Slave`, `Función`, `Dirección`, `Cantidad/Valor`, `Resultado`, `Tiempo`, `Detalle`.
- El `Registro de ejecución` debe mostrar el detalle histórico de cada ejecución, mientras la tabla superior solo muestra el estado resumido actual por paso.
- Incluir acciones `Limpiar registro` y `Exportar`.

Mantener la pantalla clara y amigable para modo sencillo, aunque con suficiente potencia técnica para validar slaves reales.

### Sencillo / Registros — prompt vigente

Generar pantalla `Sencillo / Registros` de `JW Modbus Tool`, con el mismo tema oscuro azul petróleo, acentos cian y estilo de tarjetas de las vistas aprobadas. El menú lateral debe tener `Registros` activo. La barra inferior debe mantener `Conectado · COM3 · 115200 · 8N1 · Slave activo ID 1 · Sesión activa`.

La vista final debe replicar la segunda propuesta aprobada:

- Encabezado superior con `Slave activo: PLC_Principal — ID 1` y una nota `Los registros se muestran en formato decimal`.
- Cuatro pestañas visibles: `Coils (01)`, `Discrete Inputs (02)`, `Input Registers (04)`, `Holding Registers (03)`. Mostrar debajo de cada pestaña si es `Lectura/Escritura` o `Solo lectura`.
- `Holding Registers (03)` puede estar activa.
- Controles superiores: `Dirección inicial 40000`, `Cantidad 10`, botón `Leer`, toggle `Autolectura`, selector `Intervalo 1 s`, botón `Detener`.
- Tabla principal con columnas `Dirección`, `Nombre`, `Valor`, `Tipo`, `Acceso`, `Estado`. Usar ejemplos como `40000 Velocidad_Ref`, `40001 Estado_Variador`, `40002 Corriente_Salida`, `40003 Tension_DC`, `40004 Temp_Disipador`, `40008 Frecuencia_Salida`, `40009 Estado_Alarma`.
- Panel lateral `Registro seleccionado` con dirección, nombre, valor actual, tipo, acceso, tendencia de últimos 60 s y estadísticos `Min`, `Máx`, `Prom`.
- Incluir una acción visible pero discreta `Editar mapa` o `Asignar nombre/tipo`, idealmente cerca de la tabla o dentro del panel `Registro seleccionado`.
- Aclarar visualmente que `Nombre`, `Tipo`, `Unidad`, `Acceso` y metadatos vienen del **Mapa de registros** del slave activo y se guardan en la sesión.
- Si una dirección no tiene metadatos, sugerir que puede aparecer como `Reg_40000` con tipo por defecto `uint16`.
- Panel inferior `Actividad reciente` con columnas `Inicio`, `Fin`, `Duración`, `Slave ID`, `Dispositivo`, `Función`, `Rango`, `Cantidad`, `Resultado`, `Tiempo de respuesta`, y enlace `Ver todo el historial`.

Mantener la distribución exacta y limpia de la segunda propuesta aprobada. No sobrecargar la pantalla; la aclaración del mapa debe sentirse como una acción natural de edición, no como un bloque grande adicional.

### Sencillo / Tráfico Modbus — prompt vigente

Generar pantalla `Sencillo / Tráfico Modbus` de `JW Modbus Tool`, con el mismo tema oscuro azul petróleo, acentos cian y estilo de tarjetas de las vistas aprobadas. El menú lateral debe tener `Tráfico Modbus` activo. La barra inferior debe mantener `Conectado · COM3 · 115200 · 8N1 · Slave activo ID 1 · Sesión activa`.

La vista final debe replicar la tercera propuesta aprobada:

- Título `Tráfico Modbus` y subtítulo `Visualice el historial de mensajes Modbus en tiempo real`.
- Fila de filtros: `Protocolo RTU`, `Dispositivo Todos`, `Slave ID Todos`, `Resultado Todos`, botón `Limpiar filtros`.
- Tabla principal con columnas: flecha direccional, `Hora`, `Origen → Destino`, `ID esclavo`, `Tipo`, `Función`, `Resultado`, `Resumen`.
- La columna `Origen → Destino` debe ser una sola columna combinada, no dos columnas separadas.
- La primera columna debe usar flechas delgadas: azul/cian hacia arriba para peticiones salientes del PC Master y verde hacia abajo para respuestas entrantes hacia el PC Master.
- Filas de ejemplo con rutas como `PC Master → PLC_Principal`, `PLC_Principal → PC Master`, `PC Master → HMI_Panel`, `HMI_Panel → PC Master`, `PC Master → Variador_01`.
- Estados visibles: `OK`, `Timeout`, `CRC Error`, `Excepción`.
- Incluir paginación: `Mostrando 1 a 10 de 25 tramas`, páginas `1`, `2`, `3`.
- Panel inferior izquierdo `Detalles del mensaje seleccionado` con información técnica de la trama seleccionada: dirección, función, tipo, fecha/hora, origen, destino, resumen, parámetros de petición, respuesta y tiempo de respuesta.
- Panel inferior central `¿Qué pasó?` con icono circular de estado, explicación simple en lenguaje humano y caja de consejo con icono de estrella.
- Panel inferior derecho `Actividad de la sesión` con iconos circulares y métricas: `Mensajes OK`, `Timeouts`, `Errores CRC`, `Excepciones`, cantidades, porcentajes, barras de progreso y resumen temporal.

Mantener la pantalla clara y simple. No incluir vista hex, bytes crudos, CRC detallado ni análisis avanzado en esta versión sencilla.

---

## 11. Regla narrativa

Las 15 imágenes deben contar esta historia:

1. Conecto o descubro equipos.
2. Guardo o recupero mi contexto de trabajo.
3. Ejecuto pruebas para validar comunicación.
4. Leo/escribo registros para operar o diagnosticar.
5. Analizo el tráfico para entender qué ocurrió realmente.
