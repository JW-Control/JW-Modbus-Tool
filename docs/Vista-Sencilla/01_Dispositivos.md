# Vista Sencilla — 01 Dispositivos

Estado: **cerrada como primera versión real del MVP**  
Fecha: 2026-07-09  
Rama: `feature/simple-mode-mvp`

---

## Objetivo

La vista **Dispositivos** permite conectar la PC al bus Modbus, detectar slaves reales, seleccionar un slave activo y ejecutar lecturas rápidas para validar comunicación.

La PC actúa principalmente como **PC Master**.

---

## Layout validado

La vista queda organizada en dos filas:

1. Fila superior, sin scroll en las secciones fijas:
   - `1. Conectar`.
   - `2. Dispositivos detectados`.
   - `Resumen`.

2. Fila inferior, con scroll interno en las tablas:
   - `3. Lectura rápida de registros`.
   - `Actividad reciente`.

La vista general no debe tener scroll global por crecimiento de tablas. El scroll debe vivir dentro de las tablas que pueden crecer.

---

## 1. Conectar

Contenido final:

- Selector RTU/TCP.
- Puerto.
- Botón de recargar puertos.
- Baud Rate.
- Bits de datos.
- Paridad.
- Bits de parada.
- `Timeout (ms)`.
- Estado de conexión.

Reglas visuales:

- `Conectado` en verde.
- `Desconectado` en rojo.
- No debe tener scroll interno.
- Debe entrar completo en la altura de la fila superior.

---

## 2. Dispositivos detectados

Contenido final:

- Lista de slaves detectados.
- Cada slave aparece inicialmente como `Slave ID X`.
- Si no tiene nombre definido, mostrar `NOMBRE PEND.`.
- El slave activo muestra etiqueta `SLAVE ACTIVO`.
- Botón `Recargar`.

Reglas:

- No debe haber dispositivos mock en sesión limpia.
- Los nombres personalizados se asignarán desde la sesión o desde el mapa/template del dispositivo.
- Este panel sí puede tener scroll interno si se detectan muchos slaves.

---

## Resumen

Contenido final:

- Solicitudes.
- Respuestas.
- Errores.
- Timeouts.
- Dispositivos encontrados.
- Rango de escaneo.
- Último escaneo.
- Rol: PC Master.

Reglas:

- Empieza en cero en sesión limpia.
- No debe tener scroll interno.
- No debe cortarse.
- El escaneo no debe contar como error cada ID inexistente.

---

## 3. Lectura rápida de registros

Contenido final:

- Slave activo.
- Función como desplegable.
- Dirección inicial.
- Cantidad.
- Botón `Leer`.
- Ayuda breve: el rango real depende del mapa del dispositivo o template aplicado.
- Tabla con columnas:
  - Dirección.
  - Nombre.
  - Valor.
  - Estado.

Reglas:

- No hay datos precargados.
- La tabla aparece solo después de leer.
- La tabla tiene scroll interno.
- Para `FC01` y `FC02`, los valores booleanos se muestran como chips:
  - `ON` verde.
  - `OFF` gris.

---

## Actividad reciente

Contenido final:

- Fecha/hora.
- Duración.
- Slave ID.
- Función.
- Dirección / cantidad.
- Valor leído.
- Resultado.
- Info.

Reglas:

- La columna `Fecha/hora` debe procurar mostrarse sin corte.
- La tabla tiene scroll interno si hay muchas actividades.
- El botón `Info` abre un detalle dentro de la misma área.
- El detalle tiene `X` para cerrar.
- El detalle replica la tabla de valores leídos, con campos no editables.

---

## Cierre

Con esto, **Dispositivos** queda lista como base para continuar con **Sesiones**. Las mejoras pendientes de Dispositivos quedan como proyección, no como bloqueo del MVP sencillo.
