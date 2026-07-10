# Vista Sencilla — 03 Pruebas

Estado: **MVP funcional aplicado**  
Fecha: 2026-07-09  
Rama: `feature/simple-mode-mvp`

---

## Objetivo

La vista **Pruebas** permite validar un slave Modbus desde la PC actuando como **Master**.

La pantalla permite construir y ejecutar un plan de pasos Modbus contra uno o varios slaves, revisar KPIs de ejecución, ver un registro de resultados y seleccionar/editar escenarios de prueba.

---

## Funciones Modbus cubiertas en el MVP

El plan de pruebas ya contempla lectura y escritura básica:

| FC | Nombre | Tipo | Uso |
|---|---|---|---|
| FC01 | Read Coils | Lectura | Leer coils/salidas lógicas |
| FC02 | Read Discrete Inputs | Lectura | Leer entradas discretas |
| FC03 | Read Holding Registers | Lectura | Leer registros holding |
| FC04 | Read Input Registers | Lectura | Leer registros de entrada |
| FC05 | Write Single Coil | Escritura | Escribir una coil ON/OFF |
| FC06 | Write Single Register | Escritura | Escribir un registro |
| FC15 | Write Multiple Coils | Escritura | Escribir varias coils |
| FC16 | Write Multiple Registers | Escritura | Escribir varios registros |

---

## Comportamiento de la columna `Cantidad/Valor`

La columna cambia de significado según la función seleccionada:

| Función | Interpretación |
|---|---|
| FC01 / FC02 / FC03 / FC04 | Cantidad a leer |
| FC05 | Valor lógico: `ON` / `OFF`, `1` / `0`, `true` / `false` |
| FC06 | Valor numérico único |
| FC15 | Lista de bits, por ejemplo `1,0,1,0` |
| FC16 | Lista de registros, por ejemplo `100,200,300` |

---

## Decisiones UI aprobadas

### Encabezado del plan

- El título `Plan de pruebas al slave`, subtítulo `PC como Master` y acciones quedan compactados en una sola zona superior.
- Los botones visibles son:
  - `Iniciar prueba`
  - `Detener`
  - menú `...`
  - `Agregar paso`
  - `Guardar plan`
- Esto libera espacio vertical para la tabla de pasos.

### Tabla del plan

- El campo `Slave` queda como input plano editable, no como spinbox.
- Motivo: evitar cambios accidentales por rueda del mouse.
- `Función` queda como desplegable.
- `Dirección`, `Cantidad/Valor`, `Esperado` y `Timeout` son editables.
- Las filas de lectura y escritura tienen borde lateral diferenciado para lectura/escritura.

### KPIs

La sección central de resumen queda menos alta, más balanceada y con los indicadores circulares centrados.

KPIs actuales:

- `Tasa de éxito` con indicador circular.
- `Latencia promedio`.
- `Errores`.
- `Pasos completados` con indicador circular.

Los textos dentro del aro se renderizan como bloque centrado (`valor + etiqueta`) para evitar el descuadre visual observado en la primera prueba.

Los textos secundarios deben ser explícitos; por ejemplo:

- `Última ejecución: 6/8 aprobados`.
- `Última ejecución: 8 paso(s)`.
- `Última ejecución`.

### Escenarios

Se mantiene la altura actual aproximada de la sección de escenarios.

- La lista de escenarios tiene scroll interno.
- `Gestionar escenarios` ya abre un panel interno dentro de la misma tarjeta de escenarios.
- El panel permite editar en memoria:
  - nombre del escenario,
  - descripción,
  - color,
  - ícono,
  - pasos asociados al escenario usando el plan actual,
  - duplicar el escenario actual.

Esta edición todavía no persiste en archivo; queda activa durante la sesión runtime del MVP.

### Simulador slave

El panel `Simulador slave (PC como slave)` se mantiene en la columna derecha, debajo de escenarios.

Estado actual:

- UI preparada.
- Emulación real del slave queda pendiente para una etapa posterior.

---

## Escenarios iniciales

### Operación normal

Plan completo de lectura/escritura:

1. FC03 Read Holding Registers.
2. FC06 Write Single Register.
3. FC05 Write Single Coil.
4. FC15 Write Multiple Coils.
5. FC16 Write Multiple Registers.
6. FC04 Read Input Registers.
7. FC01 Read Coils.
8. FC02 Read Discrete Inputs.

### Timeout detectado

Usa un slave improbable o no disponible para validar timeout.

### Error CRC detectado

Por ahora queda como escenario reservado/preparado a nivel UI. La inyección real de CRC inválido depende de una capa más baja del motor Modbus.

### Excepción Modbus

Usa direcciones inválidas para forzar excepciones cuando el slave las implemente correctamente.

---

## Registro de ejecución

Columnas:

```text
Hora | Paso | Slave | Función | Dirección | Cantidad/Valor | Resultado | Tiempo | Detalle
```

Resultados posibles:

- `Pendiente`
- `Aprobado`
- `Error`
- `Timeout`
- `CRC Error`
- `Excepción`

---

## Pendiente técnico

1. Migrar este MVP runtime a componente React nativo.
2. Persistir el plan dentro del archivo `.jwmodbus-session`.
3. Persistir escenarios personalizados dentro de `.jwmodbus-session`.
4. Crear gestor definitivo de escenarios como componente React.
5. Permitir importar/exportar escenarios como plantillas reutilizables.
6. Integrar resultados de prueba con la vista `Sesiones`.
7. Integrar trazas completas con la vista `Tráfico Modbus`.
8. Conectar `Simulador slave` a un motor real de emulación.
9. Definir cómo se inyectarán errores CRC reales desde el motor Modbus.

---

## Nota de implementación actual

Esta vista está implementada como MVP acelerado en:

```text
src/renderer/simple-tests-runtime.ts
```

Se carga desde:

```text
src/renderer/main.tsx
```

La intención es validar flujo, ergonomía y pruebas reales antes de formalizarlo como componente React definitivo.
