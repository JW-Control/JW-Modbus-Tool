# JW Modbus Tool — Biblia visual para regeneración de interfaces

## 1. Objetivo del documento

Este documento consolida el análisis de las propuestas visuales recibidas para una herramienta especializada en **simular, probar y depurar comunicaciones Modbus en dispositivos industriales**.

El objetivo es dejar una base consistente antes de generar una nueva secuencia de imágenes para tres niveles de uso:

- **Modo Sencillo**: entrada rápida, guiada, limpia y amigable.
- **Modo Intermedio**: operación técnica real, con más control, pero aún ordenada.
- **Modo Avanzado**: herramienta profesional/laboratorio, con diagnóstico profundo, simulación, tráfico y análisis detallado.

Actualmente cada grupo trae 4 pantallas principales:

1. Dispositivos
2. Pruebas
3. Registros
4. Tráfico Modbus

La sección que quedó pendiente y debe integrarse ahora es:

5. **Sesiones**

Por tanto, la nueva regeneración debe producir **05 imágenes por cada modo**:

1. Dispositivos
2. Sesiones
3. Pruebas
4. Registros
5. Tráfico Modbus

---

## 2. Concepto general de producto

Nombre visual usado en las propuestas: **Modbus Debug Suite**.  
Nombre conceptual alineado a JW Control: **JW Modbus Tool**.

La herramienta debe sentirse como una aplicación de escritorio industrial para Windows, pensada para:

- Configurar conexiones Modbus RTU/TCP.
- Escanear dispositivos esclavos.
- Leer y escribir registros.
- Ejecutar pruebas guiadas o automatizadas.
- Simular dispositivos Modbus.
- Capturar y analizar tráfico.
- Guardar sesiones de trabajo para continuar diagnósticos, comisionamientos o demostraciones.

La interfaz mantiene un estilo oscuro técnico/industrial:

- Fondo azul petróleo / navy oscuro.
- Tarjetas con bordes sutiles.
- Texto claro, de buena legibilidad.
- Acentos cian/azul para acciones principales.
- Verde para estados correctos.
- Amarillo/naranja para advertencias.
- Rojo para errores, CRC, timeout o desconexión.
- Iconografía técnica pero entendible.
- Layout de aplicación real, no mockup decorativo.

Resolución base observada en las imágenes: **1448 × 1086 px**.

---

## 3. Estructura común de navegación

Todas las versiones deben mantener una arquitectura visual común para que se entienda que son niveles del mismo producto.

### Barra superior común

Elementos recomendados:

- Logo o inicial de la app.
- Nombre: `Modbus Debug Suite` o `JW Modbus Tool`.
- Etiqueta del modo activo:
  - `Modo sencillo`
  - `Modo intermedio`
  - `Modo avanzado`
- Acciones rápidas:
  - Nuevo
  - Abrir
  - Guardar
  - Conectar
  - Desconectar
  - Escanear
- En modos intermedio/avanzado pueden aparecer:
  - Opciones
  - Vista
  - Ayuda
  - Tema claro/oscuro
  - Exportar

### Menú lateral común

La secuencia final debe ordenar las secciones así:

1. **Dispositivos**  
   Ver y conectar dispositivos.

2. **Sesiones**  
   Mis conexiones guardadas, historial de trabajo y sesiones recientes.

3. **Pruebas**  
   Simulación y pruebas guiadas.

4. **Registros**  
   Lectura/escritura de coils, discrete inputs, input registers y holding registers.

5. **Tráfico Modbus**  
   Captura, análisis y diagnóstico de tramas.

La vista activa debe resaltarse en el menú lateral con un bloque azul/cian.

### Barra inferior común

Debe mostrar estado resumido de la conexión:

- Estado: Listo / Conectado / Monitorizando / Desconectado.
- Puerto: COM3, COM5 o IP.
- Baudrate: 9600, 19200, 115200.
- Formato: 8N1.
- ID de esclavo activo.
- Contadores breves: paquetes, errores o sesión activa.

---

## 4. Modelo de relación entre pantallas

La herramienta no debe sentirse como cinco pantallas aisladas. Debe sentirse como un flujo de trabajo:

```text
Dispositivos → Sesiones → Pruebas → Registros → Tráfico Modbus
      ↑             ↓          ↓          ↓             ↓
      └──── contexto compartido de conexión, dispositivo, registros, logs y resultados ────┘
```

### 4.1 Dispositivos

Es la puerta de entrada técnica.

Aquí se define o detecta:

- Si se usará Modbus RTU o Modbus TCP.
- Puerto serie, IP o gateway.
- Baudrate, paridad, bits de datos, bits de parada.
- ID de esclavo.
- Lista de dispositivos encontrados.
- Estado de comunicación.

Lo que ocurra aquí alimenta a todo lo demás.

### 4.2 Sesiones

Es la sección pendiente y debe actuar como el centro de continuidad del trabajo.

Una sesión debe guardar:

- Tipo de conexión.
- Dispositivos encontrados.
- Alias de dispositivos.
- Mapa de registros usado.
- Pruebas ejecutadas.
- Tráfico capturado.
- Notas del usuario.
- Resultados y errores relevantes.

La sesión permite continuar un diagnóstico, repetir una prueba o documentar un comisionamiento.

### 4.3 Pruebas

Usa el contexto de la sesión y los dispositivos detectados.

Permite:

- Ejecutar pruebas guiadas.
- Simular dispositivos virtuales.
- Verificar lectura/escritura.
- Validar escenarios normales, timeout, CRC, falla de función o equipo desconectado.
- Generar resultados que luego quedan registrados en la sesión.

### 4.4 Registros

Usa el dispositivo activo y el mapa de registros de la sesión.

Permite:

- Leer coils.
- Leer discrete inputs.
- Leer input registers.
- Leer/escribir holding registers.
- Ver detalle de cada variable.
- Ver valor actual, unidad, tipo, calidad, timestamp, tendencia o alarmas.

### 4.5 Tráfico Modbus

Es la vista de diagnóstico bajo nivel.

Debe recibir eventos generados por:

- Escaneo de dispositivos.
- Lecturas de registros.
- Escrituras de registros.
- Pruebas automáticas.
- Simulación de fallas.

Permite explicar qué pasó realmente en la comunicación: función, dirección, bytes, CRC, latencia, timeout, error o respuesta correcta.

---

## 5. Análisis del grupo: Modo Sencillo

### Intención del modo

El modo sencillo debe ser para usuarios recién entrantes o personal técnico que necesita probar rápido sin perderse en opciones.

Debe responder a estas preguntas:

- ¿Estoy conectado?
- ¿Qué dispositivos encontré?
- ¿Puedo leer registros?
- ¿La comunicación está bien?
- ¿Qué error básico ocurrió?
- ¿Puedo guardar y continuar esta prueba después?

Debe evitar saturación. No debe parecer una herramienta de laboratorio.

### Pantallas existentes observadas

#### 5.1 Sencillo — Dispositivos

La propuesta actual muestra:

- Configuración RTU/TCP simple.
- Puerto serie, baudrate e ID de esclavo.
- Botón Conectar.
- Dispositivos detectados: `PLC_Principal`, `HMI_Panel`, `Variador_01`.
- Estado en línea.
- Resumen con solicitudes, respuestas, errores y timeouts.
- Lectura rápida de registros.
- Actividad reciente.

Es una buena pantalla de entrada. La nueva versión debe conservarla como vista de conexión rápida.

#### 5.2 Sencillo — Pruebas

La propuesta actual muestra:

- Prueba guiada.
- Dispositivo virtual sencillo.
- Pasos: conectar, leer registros, verificar respuesta, desconectar.
- Escenarios: operación normal, timeout, error CRC.
- Métricas grandes: tasa de éxito, latencia, errores, pasos completados.
- Registro de ejecución.

Funciona bien como tutorial/prueba asistida.

#### 5.3 Sencillo — Registros

La propuesta actual muestra:

- Tipo de registro por pestañas.
- ID de esclavo.
- Dirección inicial.
- Cantidad.
- Botón leer.
- Tabla limpia con dirección, nombre, valor y estado.
- Panel de detalle con gráfico simple.
- Actividad reciente.

Debe conservarse como lectura simple y segura.

#### 5.4 Sencillo — Tráfico Modbus

La propuesta actual muestra:

- Tabla de tráfico reciente.
- Filtros básicos por protocolo, dispositivo, dirección y estado.
- Resultado OK, Timeout, Error CRC.
- Panel “Detalles del mensaje seleccionado”.
- Panel “¿Qué pasó?” con explicación entendible.
- Actividad de la sesión.

Esta vista es muy valiosa para principiantes porque traduce tráfico técnico a lenguaje simple.

### Pantalla faltante: Sencillo — Sesiones

Debe ser una vista simple de continuidad. No debe parecer un gestor de proyectos complejo.

Debe incluir:

- Título: `Sesiones`.
- Subtítulo: `Continúa una prueba guardada o crea una nueva sesión de diagnóstico`.
- Botón principal: `Nueva sesión`.
- Botón secundario: `Abrir sesión`.
- Tarjeta de sesión actual:
  - Nombre: `Comisionamiento_Lavadora_S200`
  - Estado: `Activa`
  - Dispositivo principal: `PLC_Principal — ID 1`
  - Puerto: `COM3 · 115200 · 8N1`
  - Última actividad: `Hace 4 min`
- Lista de sesiones recientes:
  - `Lavadora_S200_Prueba_RTU`
  - `Variador_01_Lectura_RPM`
  - `Banco_Modbus_Taller`
- Resumen de cada sesión:
  - Dispositivos encontrados.
  - Pruebas aprobadas.
  - Errores detectados.
  - Fecha/hora.
- Acción rápida por sesión:
  - Continuar
  - Ver resumen
  - Exportar
- Panel lateral de ayuda:
  - “Una sesión guarda tus conexiones, registros leídos, pruebas y tráfico para continuar luego”.

Relación con las demás pantallas:

- Si se crea una nueva sesión, se inicia desde Dispositivos.
- Si se abre una sesión previa, carga puerto, dispositivos y registros.
- Las pruebas y tráfico se guardan dentro de la sesión.

---

## 6. Secuencia propuesta de 05 imágenes — Modo Sencillo

### Imagen 01 — Sencillo / Dispositivos

Objetivo visual: conexión rápida y descubrimiento de dispositivos.

Contenido recomendado:

- Panel izquierdo con navegación.
- Panel central `1. Conectar` con RTU/TCP, COM3, 115200, ID 1.
- Panel `2. Dispositivos detectados` con tres tarjetas simples.
- Panel `Resumen` con cuatro indicadores grandes.
- Parte inferior: `Lectura rápida de registros` y `Actividad reciente`.
- Estado inferior: `Conectado · Puerto COM3 · Baud 115200 · ID 1`.

Debe sentirse como “ya estoy hablando con el equipo”.

### Imagen 02 — Sencillo / Sesiones

Objetivo visual: guardar, abrir y continuar diagnósticos sin complicarse.

Contenido recomendado:

- Tarjeta superior: `Sesión actual`.
- Acciones: Nueva sesión, Abrir sesión, Guardar sesión.
- Lista de sesiones recientes con estados simples.
- Mini resumen de la sesión seleccionada:
  - Dispositivos: 3
  - Pruebas: 4/4
  - Errores: 2
  - Último puerto: COM3
- Panel de explicación “¿Qué guarda una sesión?”.
- Botón visible: `Continuar sesión`.

Debe sentirse como historial de trabajo amigable, no como administrador complejo.

### Imagen 03 — Sencillo / Pruebas

Objetivo visual: prueba guiada paso a paso.

Contenido recomendado:

- Dispositivo virtual básico.
- Pasos de prueba con checks grandes.
- Escenarios simples:
  - Operación normal.
  - Timeout.
  - Error CRC.
- Botones: Iniciar prueba, Detener.
- Métricas grandes: éxito, latencia, errores, pasos completados.
- Registro de ejecución con “Aprobado”.

Debe sentirse como un asistente de prueba.

### Imagen 04 — Sencillo / Registros

Objetivo visual: leer registros Modbus sin intimidar.

Contenido recomendado:

- Pestañas: Coils, Inputs, Holding Registers.
- Parámetros mínimos: ID esclavo, dirección inicial, cantidad.
- Tabla de registros con nombres claros.
- Panel de detalle del registro seleccionado.
- Gráfico pequeño de tendencia.
- Actividad reciente.

Debe sentirse como “selecciona, lee y mira el resultado”.

### Imagen 05 — Sencillo / Tráfico Modbus

Objetivo visual: explicar el tráfico en lenguaje simple.

Contenido recomendado:

- Tabla de tráfico reciente.
- Estados visuales: OK, Timeout, Error CRC.
- Panel de detalles del mensaje.
- Panel “¿Qué pasó?” con explicación humana.
- Panel “Actividad de la sesión”.
- Acción: Pausar / Limpiar.

Debe mostrar el tráfico sin convertir la pantalla en un analizador avanzado.

---

## 7. Análisis del grupo: Modo Intermedio

### Intención del modo

El modo intermedio es para técnicos, integradores o desarrolladores que ya conocen Modbus y necesitan trabajar con varios dispositivos, mapas de registros, pruebas con escenarios y análisis de tráfico más completo.

Debe responder a estas preguntas:

- ¿Qué dispositivos tengo en la red?
- ¿Qué registros estoy observando?
- ¿Cómo se comporta la comunicación en tiempo real?
- ¿Puedo ejecutar escenarios con condiciones?
- ¿Puedo guardar sesiones por cliente, máquina o fecha?
- ¿Puedo exportar resultados?

Debe sentirse potente, pero todavía claro.

### Pantallas existentes observadas

#### 7.1 Intermedio — Dispositivos

La propuesta actual muestra:

- Conexión RTU/TCP con más parámetros visibles.
- Lista tabular de dispositivos detectados.
- Resumen en tiempo real con minigráficos.
- Vista rápida de registros.
- Registro en vivo con función, datos, tiempo y estado.

Es una buena base para operación técnica real.

#### 7.2 Intermedio — Pruebas

La propuesta actual muestra:

- Dispositivo virtual configurable.
- Editor de secuencia de prueba.
- Escenarios con más detalle.
- Métricas de ejecución.
- Cobertura de funciones.
- Registro de ejecución con niveles INFO/WARN/ERROR.

Funciona como banco de pruebas técnico.

#### 7.3 Intermedio — Registros

La propuesta actual muestra:

- Explorador de registros.
- Filtros por tipo, búsqueda y autoactualización.
- Tabla con dirección, nombre, valor, tipo, acceso, timestamp y calidad.
- Panel de detalle con valor interpretado y gráfico.
- Registro en vivo inferior.

Está bien planteada como vista principal de trabajo.

#### 7.4 Intermedio — Tráfico Modbus

La propuesta actual muestra:

- Analizador de tráfico con filtros.
- Tabla detallada de eventos.
- Panel de detalle de trama.
- Vista hexadecimal.
- Interpretación del frame.
- Línea de tiempo de sesión.
- Gráfico de latencia.

Es el puente correcto entre usuario técnico y análisis profundo.

### Pantalla faltante: Intermedio — Sesiones

Debe ser más completa que en modo sencillo. Debe permitir organizar trabajo por cliente, máquina, topología o diagnóstico.

Debe incluir:

- Título: `Sesiones`.
- Subtítulo: `Administra conexiones guardadas, mapas de registros y resultados de pruebas`.
- Filtros:
  - Recientes.
  - Favoritas.
  - Cliente.
  - Máquina.
  - Estado.
- Lista/tabla de sesiones:
  - Nombre.
  - Cliente/proyecto.
  - Protocolo.
  - Puerto/IP.
  - Dispositivos.
  - Última ejecución.
  - Estado.
- Panel de detalle de la sesión seleccionada:
  - Topología detectada.
  - Mapa de registros asociado.
  - Pruebas guardadas.
  - Últimos errores.
  - Notas técnicas.
- Acciones:
  - Abrir.
  - Duplicar.
  - Exportar reporte.
  - Comparar con otra sesión.
  - Guardar como plantilla.
- Timeline breve:
  - Conectó PLC.
  - Leyó registros.
  - Ejecutó prueba.
  - Detectó CRC.
  - Exportó reporte.

Relación con las demás pantallas:

- Dispositivos crea o actualiza la topología de la sesión.
- Registros usa el mapa guardado dentro de la sesión.
- Pruebas usa plantillas y escenarios de la sesión.
- Tráfico Modbus se conserva como evidencia técnica dentro de la sesión.

---

## 8. Secuencia propuesta de 05 imágenes — Modo Intermedio

### Imagen 01 — Intermedio / Dispositivos

Objetivo visual: gestión técnica de conexión y dispositivos detectados.

Contenido recomendado:

- Conexión con RTU/TCP y parámetros completos.
- Tabla de dispositivos detectados.
- Resumen en tiempo real con minigráficos.
- Vista rápida de registros.
- Registro en vivo inferior.
- Botones: Conectar, Desconectar, Escanear, Guardar.

Debe sentirse como una herramienta de campo para comisionamiento.

### Imagen 02 — Intermedio / Sesiones

Objetivo visual: biblioteca técnica de trabajos guardados.

Contenido recomendado:

- Tabla de sesiones con filtros.
- Tarjetas de estado: Activas, con errores, archivadas.
- Panel de detalle de sesión seleccionada.
- Vista de topología guardada.
- Timeline de eventos.
- Acciones: Abrir, Duplicar, Exportar, Comparar.

Debe sentirse como un historial técnico reutilizable.

### Imagen 03 — Intermedio / Pruebas

Objetivo visual: editor de pruebas y escenarios.

Contenido recomendado:

- Dispositivo virtual configurable.
- Secuencia editable de pasos.
- Escenarios predefinidos.
- Métricas: éxito, latencia, errores, cobertura.
- Registro de ejecución con niveles INFO/WARN/ERROR.
- Botón `Exportar reporte`.

Debe sentirse como banco de pruebas ordenado.

### Imagen 04 — Intermedio / Registros

Objetivo visual: explorador de registros para trabajo real.

Contenido recomendado:

- Filtros por tipo de registro.
- Búsqueda por dirección/nombre.
- Watch list.
- Tabla de registros con unidades, tipo, acceso, timestamp y calidad.
- Panel lateral con detalle y gráfico.
- Registro en vivo inferior.

Debe sentirse como la pantalla principal de operación diaria.

### Imagen 05 — Intermedio / Tráfico Modbus

Objetivo visual: analizador técnico claro.

Contenido recomendado:

- Filtros por protocolo, dispositivo, función, estado y ventana de tiempo.
- Tabla detallada de tráfico.
- Panel de trama seleccionada.
- Vista hex/PDU.
- Interpretación automática.
- Línea de tiempo de sesión.
- Gráfico de latencia.

Debe permitir entender una falla sin llegar todavía a nivel forense extremo.

---

## 9. Análisis del grupo: Modo Avanzado

### Intención del modo

El modo avanzado es para ingeniería, laboratorio, depuración profunda, desarrollo de firmware, validación de gateways, simulación de fallas y análisis de rendimiento.

Debe responder a estas preguntas:

- ¿Qué ocurre byte a byte en la comunicación?
- ¿Qué esclavo responde mal y bajo qué condición?
- ¿Cómo se comporta la red con carga?
- ¿Puedo simular múltiples dispositivos y fallas?
- ¿Puedo reproducir una sesión anterior?
- ¿Puedo comparar dos sesiones o ramas de prueba?
- ¿Puedo generar evidencia técnica para soporte/desarrollo?

Debe sentirse denso, profesional y poderoso, pero no caótico.

### Pantallas existentes observadas

#### 9.1 Avanzado — Dispositivos

La propuesta actual muestra:

- Conexión RTU/TCP con parámetros extendidos.
- Timeout, reintentos e ID de esclavo.
- Dispositivos detectados en tabla más completa.
- Resumen con latencia promedio/máxima y calidad de enlace.
- Vista rápida de registros con watch order.
- Registro en vivo con tráfico/eventos.

Ya se siente como herramienta profesional.

#### 9.2 Avanzado — Pruebas

La propuesta actual muestra:

- Pestañas de conexión, simulador, pruebas e inyección de fallas.
- Dispositivo virtual avanzado.
- Secuencia de prueba compleja.
- Escenarios múltiples.
- Métricas de éxito, tasa de operación, latencia, errores y cobertura.
- Registro de ejecución detallado.

Debe conservar ese enfoque de laboratorio.

#### 9.3 Avanzado — Registros

La propuesta actual muestra:

- Explorador de registros con muchas columnas.
- Filtros, watch list y exportación.
- Detalle de registro con tipo, función, escala, unidades y alarmas.
- Gráfico de histórico.
- Tabs inferiores: registro en vivo, tráfico, watch list, eventos.

Es la versión más completa del mapa de datos.

#### 9.4 Avanzado — Tráfico Modbus

La propuesta actual muestra:

- Analizador muy detallado.
- Filtros por protocolo, dispositivo, función, errores y tiempo.
- Tabla con dirección, función, dirección inicial, cantidad, estado, CRC, duración y resumen.
- Detalles de frame.
- Vista hex.
- Interpretación automática.
- Indicadores.
- Cronología y distribución de latencia.

Es la vista más importante para depuración profunda.

### Pantalla faltante: Avanzado — Sesiones

Debe ser una vista de control de experimentos, no solo historial.

Debe incluir:

- Título: `Sesiones`.
- Subtítulo: `Versiona, compara y reproduce sesiones de diagnóstico Modbus`.
- Panel de sesión activa:
  - Nombre.
  - Rama/versión.
  - Protocolo.
  - Red/gateway.
  - Dispositivos.
  - Captura asociada.
  - Perfil de simulación.
- Árbol o lista de sesiones:
  - `KOKETA_V800_RTU_Base`
  - `KOKETA_V800_RTU_CRC_Failures`
  - `JWPLC_Basic_Gateway_TCP_RTU`
  - `Variador_Yaskawa_StressTest`
- Comparador:
  - Sesión A vs Sesión B.
  - Diferencia de latencia.
  - Diferencia de errores CRC.
  - Funciones usadas.
  - Registros modificados.
- Reproducción/replay:
  - Reproducir tráfico capturado.
  - Reinyectar secuencia de solicitudes.
  - Simular esclavo desde captura.
- Evidencia técnica:
  - Exportar JSON/CSV.
  - Exportar reporte PDF.
  - Guardar captura `.mbtrace`.
- Timeline avanzado:
  - Snapshot de conexión.
  - Cambio de mapa.
  - Inyección de falla.
  - Prueba de estrés.
  - Exportación.

Relación con las demás pantallas:

- Dispositivos define topología y parámetros de red.
- Sesiones versiona esa topología y guarda snapshots.
- Pruebas toma perfiles de simulación/fallas desde la sesión.
- Registros guarda mapas, watch lists y cambios.
- Tráfico Modbus puede reproducirse, compararse y exportarse desde una sesión.

---

## 10. Secuencia propuesta de 05 imágenes — Modo Avanzado

### Imagen 01 — Avanzado / Dispositivos

Objetivo visual: control profesional de red Modbus.

Contenido recomendado:

- Parámetros extendidos RTU/TCP:
  - Puerto.
  - Baudrate.
  - Paridad.
  - Bits de datos.
  - Bits de parada.
  - Timeout.
  - Reintentos.
  - Rango de IDs.
- Tabla de dispositivos detectados con tipo, estado, latencia, errores y último acceso.
- Resumen de enlace: solicitudes, respuestas, CRC, timeouts, latencia promedio/máxima, calidad de enlace.
- Vista rápida de registros con columnas de precisión/watch.
- Log inferior con tabs: registro en vivo, tráfico, eventos.

Debe sentirse como consola de ingeniería.

### Imagen 02 — Avanzado / Sesiones

Objetivo visual: gestión avanzada de sesiones, versiones, comparación y replay.

Contenido recomendado:

- Árbol/lista de sesiones con ramas o snapshots.
- Panel de sesión activa con metadatos completos.
- Comparador A/B.
- Acciones:
  - Reproducir captura.
  - Simular desde sesión.
  - Comparar.
  - Exportar evidencia.
  - Crear snapshot.
- Timeline técnico.
- Panel de diferencias:
  - Latencia.
  - Errores CRC.
  - Timeouts.
  - Funciones usadas.
  - Registros modificados.

Debe sentirse como “Git + osciloscopio lógico + banco de pruebas Modbus”.

### Imagen 03 — Avanzado / Pruebas

Objetivo visual: laboratorio de simulación e inyección de fallas.

Contenido recomendado:

- Pestañas: Conexión, Simulador, Pruebas, Inyección de fallas.
- Dispositivo virtual avanzado.
- Secuencia de prueba detallada.
- Escenarios múltiples.
- Métricas avanzadas.
- Registro de ejecución con severidad, duración y resultado.
- Panel de condiciones o triggers.

Debe sentirse como banco de validación de firmware/protocolo.

### Imagen 04 — Avanzado / Registros

Objetivo visual: mapa de datos completo con ingeniería de variables.

Contenido recomendado:

- Explorador con filtros avanzados.
- Columnas:
  - Dirección.
  - Nombre.
  - Valor.
  - Tipo.
  - Acceso.
  - Unidad.
  - Escala.
  - Timestamp.
  - Calidad.
  - Alarma.
- Panel lateral con detalle completo.
- Gráfico histórico.
- Alarmas y límites.
- Tabs inferiores: registro en vivo, tráfico, watch list, eventos.

Debe sentirse como editor/analisador completo del mapa Modbus.

### Imagen 05 — Avanzado / Tráfico Modbus

Objetivo visual: análisis profundo byte a byte.

Contenido recomendado:

- Filtros avanzados.
- Tabla densa de tramas.
- Decodificación MBAP/PDU/CRC.
- Vista hexadecimal con bytes resaltados.
- Interpretación automática.
- Indicadores de enlace.
- Cronología de sesión.
- Distribución de latencia.
- Opciones de replay/exportación.

Debe sentirse como Wireshark especializado para Modbus industrial.

---

## 11. Datos de ejemplo para mantener consistencia visual

Usar los mismos nombres base en las tres versiones ayuda a que se perciban como el mismo producto con distintos niveles de complejidad.

### Dispositivos sugeridos

- `PLC_Principal` — ID 1 — Controlador compacto.
- `HMI_Panel` — ID 2 — Interfaz Modbus.
- `Variador_01` — ID 10 — Variador de frecuencia.
- `Remote_IO` — ID 11 — Módulo de entradas/salidas, solo en intermedio/avanzado.
- `Gateway_TCP_RTU` — ID 20 — Gateway, solo en avanzado.

### Parámetros de conexión sugeridos

- Modo RTU: COM3, 115200, 8N1.
- Modo TCP: 192.168.1.50, puerto 502.
- Timeout sencillo: 1000 ms.
- Timeout intermedio: 500 ms.
- Timeout avanzado: configurable, por ejemplo 80–1000 ms.

### Registros sugeridos

- `40000` — `Velocidad_Ref` — RPM.
- `40001` — `Estado_Variador` — UINT16/Flags.
- `40002` — `Corriente_Salida` — A.
- `40003` — `Tension_DC` — V.
- `40004` — `Temp_Disipador` — °C.
- `40005` — `Horas_Marcha` — h.
- `40006` — `Contador_Energia` — kWh.
- `40007` — `Par_Motor` — %.
- `40008` — `Frecuencia_Salida` — Hz.
- `40009` — `Estado_Alarma` — Flags.

### Funciones Modbus sugeridas

- `01 Read Coils`.
- `02 Read Discrete Inputs`.
- `03 Read Holding Registers`.
- `04 Read Input Registers`.
- `05 Write Single Coil`.
- `06 Write Single Register`.
- `15 Write Multiple Coils`.
- `16 Write Multiple Registers`.

### Estados sugeridos

- `OK` — verde.
- `Timeout` — amarillo/naranja.
- `Error CRC` — rojo.
- `Sin respuesta` — rojo tenue.
- `Advertencia` — naranja.
- `Monitorizando` — verde/cian.

---

## 12. Diferencias clave entre los tres modos

| Aspecto | Sencillo | Intermedio | Avanzado |
|---|---|---|---|
| Usuario objetivo | Nuevo usuario, técnico de campo inicial | Integrador/técnico con experiencia | Desarrollador, laboratorio, soporte avanzado |
| Densidad visual | Baja | Media | Alta |
| Dispositivos | Tarjetas simples | Tabla técnica | Tabla avanzada + topología |
| Sesiones | Continuar/guardar pruebas | Biblioteca técnica con filtros | Versionado, comparación y replay |
| Pruebas | Asistente paso a paso | Secuencia editable | Simulación, fallas, estrés, triggers |
| Registros | Lectura simple | Explorador con filtros | Mapa completo con escala, alarmas, calidad |
| Tráfico | Explicación entendible | Analizador técnico | Decodificación profunda tipo Wireshark |
| Exportación | Básica | Reporte técnico | Evidencia, JSON/CSV/PDF/captura |

---

## 13. Reglas para la regeneración de imágenes

### Mantener

- Misma familia visual.
- Misma resolución aproximada.
- Misma barra superior y lateral.
- Misma paleta oscura industrial.
- Los mismos nombres de dispositivos y registros base.
- Los mismos conceptos de estado.
- La navegación resaltando la pantalla activa.

### Corregir o reforzar

- Incluir la pantalla **Sesiones** en cada modo.
- No hacer que Sencillo parezca demasiado vacío.
- No hacer que Sencillo se convierta en Avanzado con menos columnas.
- No hacer que Intermedio sea solo una “limpieza” del Avanzado: debe ser una versión realmente operativa y balanceada.
- No hacer que Avanzado sea ilegible: puede ser denso, pero organizado.
- Usar “Sesiones” como pieza central de continuidad: lo que se hace en Dispositivos, Pruebas, Registros y Tráfico debe quedar asociado a una sesión.

### Evitar

- Textos demasiado largos dentro de tarjetas.
- Métricas sin relación con la pantalla.
- Iconos decorativos sin función.
- Pantallas aisladas que no compartan contexto.
- Mezclar nombres distintos de dispositivos entre pantallas del mismo grupo.
- Que la vista Sesiones parezca solo un explorador de archivos.

---

## 14. Prompt maestro de estilo para la futura generación

Aplicar este criterio en las 15 imágenes:

> Interfaz desktop realista de una herramienta industrial llamada “Modbus Debug Suite” / “JW Modbus Tool”, tema oscuro azul petróleo, estilo profesional de software técnico para Windows, layout 1448x1086, barra superior con acciones de conexión, menú lateral izquierdo con secciones Dispositivos, Sesiones, Pruebas, Registros y Tráfico Modbus, tarjetas con bordes sutiles, acentos cian, estados verde/amarillo/rojo, tablas técnicas legibles, gráficas pequeñas de monitoreo, iconografía Modbus/industrial, sin saturar innecesariamente, consistente entre pantallas del mismo modo.

---

## 15. Orden final recomendado de generación

Generar primero todo el modo sencillo, luego intermedio y finalmente avanzado.

### Grupo 1 — Sencillo

1. `Sencillo_Dispositivos.png`
2. `Sencillo_Sesiones.png`
3. `Sencillo_Pruebas.png`
4. `Sencillo_Registros.png`
5. `Sencillo_Trafico_Modbus.png`

### Grupo 2 — Intermedio

1. `Intermedio_Dispositivos.png`
2. `Intermedio_Sesiones.png`
3. `Intermedio_Pruebas.png`
4. `Intermedio_Registros.png`
5. `Intermedio_Trafico_Modbus.png`

### Grupo 3 — Avanzado

1. `Avanzado_Dispositivos.png`
2. `Avanzado_Sesiones.png`
3. `Avanzado_Pruebas.png`
4. `Avanzado_Registros.png`
5. `Avanzado_Trafico_Modbus.png`

---

## 16. Lectura narrativa de las 15 imágenes

La secuencia completa debe contar una historia clara:

1. **Conecto o descubro equipos.**
2. **Guardo o recupero mi contexto de trabajo.**
3. **Ejecuto pruebas para validar comunicación.**
4. **Leo/escribo registros para operar o diagnosticar.**
5. **Analizo el tráfico para entender qué ocurrió realmente.**

Esto permite que cada grupo no sea solo una colección de pantallas, sino una demostración coherente del producto.



---

## 17. Aclaraciones funcionales incorporadas tras revisión de modo sencillo

Estas aclaraciones corrigen el sentido funcional de las vistas generadas para que la interfaz no solo se vea bien, sino que represente correctamente cómo debe trabajar JW Modbus Tool en campo.

### 17.1 Rol de la PC: Master, Slave simulado y monitor

JW Modbus Tool debe separar claramente tres roles posibles de la PC:

#### A. PC como Master Modbus

Es el flujo principal de la herramienta.

En este modo, la PC:

- Abre un puerto serie RTU o una conexión TCP.
- Envía solicitudes Modbus hacia uno o varios slaves.
- Escanea IDs.
- Lee coils, discrete inputs, input registers y holding registers.
- Escribe coils y holding registers cuando el usuario lo solicite.
- Ejecuta planes de prueba contra slaves reales.
- Genera tráfico TX/RX y registros de actividad.

Este rol alimenta principalmente las vistas:

- Dispositivos.
- Pruebas.
- Registros.
- Tráfico Modbus.

#### B. PC como Slave simulado / Servidor Modbus

Este modo sirve para probar un master externo, por ejemplo:

- PLC.
- HMI.
- SCADA.
- Otro software master.
- Gateway o equipo en desarrollo.

En este modo, la PC:

- Responde a solicitudes recibidas.
- Tiene un ID slave configurable en RTU.
- En TCP escucha como servidor en un puerto definido.
- Expone un mapa de registros simulado.
- Permite configurar valores, errores, retardos, timeouts o respuestas anómalas.
- Registra qué solicitudes hizo el master externo.

Este rol debe existir, pero no debe confundirse con la prueba principal de slaves reales.

En la interfaz debe llamarse preferentemente:

- `Slave simulado`.
- `Servidor Modbus`.
- `Simular slave`.
- `PC como slave`.

Evitar que el usuario piense que un “Modbus Virtual Master” recibe solicitudes, porque el master normalmente inicia las solicitudes. Cuando la PC automatiza solicitudes hacia slaves, sigue actuando como **Master de prueba**.

#### C. PC como monitor / sniffer lógico

Este modo sería para observar tráfico sin necesariamente originarlo.

En RTU esto depende de la conexión física y del adaptador usado. Puede plantearse como modo avanzado, no como flujo principal del modo sencillo.

En el modo sencillo basta con que `Tráfico Modbus` muestre el tráfico generado por las acciones de la propia herramienta.

---

### 17.2 Vista Dispositivos — interpretación correcta

La vista `Dispositivos` debe entenderse como la pantalla de conexión inicial de la PC hacia la red Modbus.

#### Rol principal en esta vista

Por defecto, la PC actúa como **Master**.

#### Botón Conectar

`Conectar` no debe interpretarse como “conectar a un único slave” en sentido estricto.

Debe significar:

- Abrir puerto serie RTU, por ejemplo `COM3`.
- O abrir contexto TCP hacia una IP/puerto.
- Validar parámetros básicos.
- Dejar lista la PC para enviar solicitudes Modbus.

En RTU, muchos slaves pueden compartir la misma línea. Por eso la conexión real es hacia el **bus**, no solo hacia un equipo.

#### Campo ID esclavo en `1. Conectar`

En modo sencillo, este campo define el **slave activo** para acciones rápidas.

Ejemplo:

- Si `ID esclavo = 1`, la lectura rápida enviará solicitudes al slave ID 1.
- Si se selecciona una tarjeta en `Dispositivos detectados`, ese ID se vuelve el slave activo.
- La vista inferior debe mostrar siempre el contexto activo: `Slave activo: PLC_Principal — ID 1`.

#### Botón Escanear

El botón `Escanear` debe tener una función clara:

- En RTU: recorrer un rango de IDs, por ejemplo 1–247 o un rango definido por el usuario.
- En TCP: revisar una IP/puerto, un rango de IPs o Unit IDs cuando se trabaja con gateway TCP/RTU.
- Enviar solicitudes seguras de detección.
- Construir la lista `Dispositivos detectados`.

La detección debe ser configurable porque no todos los equipos responden al mismo tipo de consulta. Para modo sencillo puede usarse un perfil básico:

- ID inicial.
- ID final.
- Función de prueba.
- Dirección de prueba.
- Timeout.
- Reintentos.

#### Icono de recargar en `2. Dispositivos detectados`

El icono de recargar dentro del panel debe entenderse como:

- Repetir el último escaneo con los mismos parámetros.
- Actualizar estados de los dispositivos ya detectados.
- No abrir un asistente completo.

Por tanto:

- `Escanear` = acción principal/global de búsqueda.
- `Recargar` = refrescar la lista actual.

#### Relación con lectura rápida

La sección `3. Lectura rápida de registros` debe estar ligada al contexto del slave activo.

Debe mostrar explícitamente:

- `Slave activo`.
- `ID`.
- `Función`.
- `Dirección inicial`.
- `Cantidad`.

La dirección no identifica al slave. La dirección identifica un registro **dentro del mapa del slave seleccionado**. Varios slaves pueden tener la misma dirección `40000`, pero cada uno responde según su propio ID.

#### Relación con Actividad reciente

Cada acción de lectura rápida debe generar una fila en `Actividad reciente`.

Campos mínimos recomendados:

- Hora de inicio.
- Hora de fin.
- Duración.
- ID slave.
- Nombre de dispositivo.
- Función Modbus.
- Dirección inicial.
- Cantidad.
- Resultado.
- Tiempo de respuesta.

Ejemplo:

| Inicio | Fin | Slave | Función | Rango | Resultado |
|---|---|---|---|---|---|
| 10:24:38.125 | 10:24:38.153 | ID 1 PLC_Principal | FC03 | 40000–40009 | OK 28 ms |

---

### 17.3 Vista Sesiones — rol dentro del flujo

La vista `Sesiones` está correctamente planteada como centro de continuidad.

Una sesión debe guardar:

- Rol usado: Master, Slave simulado o Monitor.
- Tipo de conexión: RTU/TCP.
- Parámetros de puerto o red.
- Dispositivos detectados.
- Slave activo.
- Perfil de escaneo.
- Mapa de registros.
- Watch lists.
- Planes de prueba.
- Resultados de pruebas.
- Tráfico capturado.
- Notas del usuario.
- Exportaciones asociadas.

La navegación no debe obligar a un flujo rígido, pero la historia recomendada es:

```text
Dispositivos → Sesiones → Pruebas → Registros → Tráfico Modbus
```

Interpretación:

- Desde `Dispositivos` se crea contexto.
- En `Sesiones` se guarda o se recupera contexto.
- En `Pruebas` se valida el comportamiento.
- En `Registros` se trabaja con datos en vivo.
- En `Tráfico Modbus` se explica qué ocurrió a nivel de comunicación.

Una vez creada o abierta una sesión, el usuario puede ir a cualquier vista sin perder el contexto.

---

### 17.4 Vista Pruebas — corrección conceptual

La vista `Pruebas` no debe centrarse únicamente en simular un dispositivo virtual. Eso puede confundir.

Debe dividirse en dos conceptos:

#### A. Probar slaves reales usando la PC como Master

Este debe ser el flujo principal.

La PC envía tramas Modbus reales hacia los slaves y verifica respuestas.

La vista debe permitir definir:

- Slave objetivo.
- Función Modbus.
- Dirección inicial.
- Cantidad.
- Tipo de dato esperado.
- Valor esperado.
- Tolerancia si aplica.
- Acción de escritura si aplica.
- Timeout.
- Reintentos.
- Frecuencia o repetición.
- Criterio de aprobación.

Ejemplos de pruebas:

| Paso | Slave | Función | Dirección | Cantidad/Valor | Criterio |
|---|---:|---|---:|---|---|
| 1 | ID 1 | FC03 Read Holding Registers | 40000 | 10 registros | Respuesta OK |
| 2 | ID 1 | FC06 Write Single Register | 40020 | Valor 1 | Eco correcto |
| 3 | ID 10 | FC04 Read Input Registers | 30000 | 4 registros | Sin timeout |
| 4 | ID 2 | FC01 Read Coils | 00000 | 8 coils | Estados válidos |

Esta sección debe llamarse algo como:

- `Plan de prueba`.
- `Secuencia de tramas`.
- `Pruebas al slave`.
- `Validación de comunicación`.

#### B. Simular un slave para probar masters externos

Debe ser una pestaña o bloque secundario:

- `Simulador slave`.
- `PC como slave`.
- `Servidor Modbus`.

Sirve cuando el equipo a validar es un master externo.

En ese caso la PC responde y registra solicitudes entrantes.

#### Escenarios de prueba

Los escenarios deben ser configurables por el usuario.

Para pruebas contra slaves reales, los escenarios son principalmente criterios de evaluación:

- Operación normal.
- Timeout detectado.
- Error CRC detectado.
- Excepción Modbus recibida.
- Valor fuera de rango.
- Respuesta tardía.
- Registro no soportado.

Para simulación de slave, los escenarios sí pueden inyectar comportamiento:

- Responder OK.
- No responder.
- Responder con CRC inválido.
- Responder excepción.
- Retardar respuesta.
- Cambiar valores dinámicamente.

#### Dónde definir registros de prueba

La vista `Pruebas` debe tener una tabla explícita para definir las tramas o pasos.

Campos mínimos:

- Habilitado.
- Paso.
- Slave ID.
- Nombre de dispositivo.
- Función.
- Dirección.
- Cantidad.
- Valor a escribir, si aplica.
- Tipo de dato.
- Esperado.
- Timeout.
- Reintentos.
- Resultado.

En modo sencillo esta tabla puede ser compacta y asistida. En modo intermedio/avanzado debe ser editable con más detalle.

---

### 17.5 Vista Registros — modelo Modbus correcto

La vista `Registros` debe representar correctamente las áreas de datos Modbus.

#### Áreas de datos principales

Modbus maneja cuatro áreas principales:

| Área | Lectura | Escritura | Descripción |
|---|---|---|---|
| Coils | FC01 | FC05 / FC15 | Bits de salida, leíbles y escribibles |
| Discrete Inputs | FC02 | No | Bits de entrada, solo lectura |
| Input Registers | FC04 | No | Registros de entrada, solo lectura |
| Holding Registers | FC03 | FC06 / FC16 | Registros leíbles y escribibles |

Por tanto, la vista sencilla no debe mostrar solo tres pestañas. Debe mostrar cuatro:

1. `Coils (01)`
2. `Discrete Inputs (02)`
3. `Input Registers (04)`
4. `Holding Registers (03)`

Para escritura:

- En `Coils`: permitir FC05 y FC15.
- En `Holding Registers`: permitir FC06 y FC16.
- En `Discrete Inputs` e `Input Registers`: no mostrar escritura o mostrarla bloqueada como solo lectura.

#### Frecuencia de lectura

Debe existir un parámetro explícito de frecuencia/polling.

En modo sencillo:

- Por defecto: lectura manual.
- Opción: `Autolectura`.
- Parámetro: `Intervalo`, por ejemplo 500 ms, 1 s, 2 s, 5 s.
- Botones: `Leer`, `Iniciar autolectura`, `Detener`.

En modo intermedio/avanzado:

- Permitir watch list.
- Permitir múltiples rangos.
- Permitir múltiples slaves.
- Permitir intervalos por grupo o por variable.

#### Lectura y gráficos de varios IDs

En modo sencillo, lo más sano es asumir:

- Un slave activo a la vez.
- Una lectura o autolectura activa a la vez.
- Gráfico del registro seleccionado para ese slave.

Para varios IDs a la vez, conviene llevarlo a:

- Modo Intermedio: watch list multi-slave.
- Modo Avanzado: scheduler de polling por grupos y captura más densa.

#### Actividad reciente en Registros

La tabla `Actividad reciente` debe incluir:

- Hora de inicio.
- Hora de fin.
- Duración.
- Slave ID.
- Dispositivo.
- Función.
- Rango.
- Cantidad.
- Resultado.
- Tiempo de respuesta.

Esto evita ambigüedad cuando luego se quieran comparar lecturas o diagnosticar retardos.

---

### 17.6 Vista Tráfico Modbus — columnas necesarias

La vista `Tráfico Modbus` debe mostrar claramente a qué slave fue dirigida cada solicitud.

#### Problema detectado

Si solo aparece `Dirección (ID esclavo)` como filtro, pero la tabla no deja claro el destino/origen, puede ser confuso.

#### Solución recomendada

Agregar columnas o etiquetas visibles:

- `ID esclavo`
- `Origen`
- `Destino`
- `Tipo`
- `Función`
- `Resultado`
- `Resumen`

Para RTU:

- Solicitud: `PC Master → ID 1`
- Respuesta: `ID 1 → PC Master`

Para TCP:

- Mostrar `IP:Puerto` y `Unit ID`.
- Si hay gateway TCP/RTU, el `Unit ID` equivale al slave detrás del gateway.

Ejemplo de filas:

| Hora | Origen | Destino | ID | Tipo | Función | Resultado |
|---|---|---|---:|---|---|---|
| 10:24:38.125 | PC Master | PLC_Principal | 1 | Solicitud | FC03 | OK |
| 10:24:38.153 | PLC_Principal | PC Master | 1 | Respuesta | FC03 | OK |
| 10:24:40.021 | PC Master | Variador_01 | 10 | Solicitud | FC04 | Timeout |

#### Relación con filtros

El filtro `Dirección (ID esclavo)` debe afectar la tabla completa.

Si se selecciona `ID 1`, deben mostrarse:

- Solicitudes hacia ID 1.
- Respuestas desde ID 1.
- Timeouts asociados a ID 1.
- Errores CRC asociados a ID 1.

---

## 18. Ajustes visuales pendientes para regenerar modo sencillo

Tras las observaciones, el modo sencillo debe regenerarse con estos cambios:

### 18.1 Sencillo / Dispositivos

Mantener la vista porque fue aprobada visualmente, pero ajustar detalles:

- Cambiar la etiqueta del campo `ID esclavo` a `Slave activo`.
- Al seleccionar una tarjeta, reflejarla en lectura rápida.
- En `Lectura rápida`, mostrar `Slave activo: PLC_Principal — ID 1`.
- En `Actividad reciente`, incluir inicio, fin, duración e ID slave.
- Explicar mejor `Escanear` y `Recargar`.
- El estado inferior debe ser coherente: si abajo dice conectado, el panel no debería seguir mostrando `Desconectado`.

### 18.2 Sencillo / Sesiones

Mantener la vista casi tal cual porque fue aprobada.

Ajustes menores:

- Guardar también `Rol de PC`.
- Mostrar si la sesión es `Master RTU`, `Slave simulado` o `Monitor`.
- En el resumen, incluir `Modo: PC Master`.

### 18.3 Sencillo / Pruebas

Debe rediseñarse conceptualmente.

El foco principal debe pasar de `Dispositivo virtual` a:

- `Plan de pruebas al slave`.
- `Secuencia de tramas`.
- `Slave objetivo`.
- `Función`.
- `Dirección`.
- `Cantidad/valor`.
- `Esperado`.

El `Simulador slave` debe aparecer como opción secundaria, no como flujo central.

Nueva estructura sugerida:

1. `Objetivo de prueba`
   - Slave objetivo.
   - Dispositivo.
   - Modo: PC como Master.
2. `Secuencia de tramas`
   - Tabla simple de pasos.
3. `Escenarios`
   - Normal.
   - Timeout esperado.
   - Excepción Modbus.
   - Valor fuera de rango.
4. `Resultados`
   - Aprobadas.
   - Fallidas.
   - Latencia.
   - Última ejecución.
5. `Registro de ejecución`
   - Inicio/fin, función, respuesta, resultado.

### 18.4 Sencillo / Registros

Ajustar:

- Mostrar cuatro áreas de datos:
  - Coils (01)
  - Discrete Inputs (02)
  - Input Registers (04)
  - Holding Registers (03)
- Agregar `Autolectura`.
- Agregar `Intervalo`.
- Mostrar `Slave activo`.
- En actividad reciente, incluir inicio y fin.
- Escritura solo en Coils y Holding Registers.

### 18.5 Sencillo / Tráfico Modbus

Mantener la vista porque fue aprobada visualmente, pero ajustar:

- Agregar columnas `Origen`, `Destino`, `ID esclavo`.
- Mostrar solicitudes como `PC Master → PLC_Principal`.
- Mostrar respuestas como `PLC_Principal → PC Master`.
- Mantener explicación simple en `¿Qué pasó?`.
- El filtro de ID debe afectar solicitudes y respuestas del slave seleccionado.
