# Vista Sencilla / Pruebas — Cierre MVP

Este documento cierra el bloque funcional de la vista **Pruebas** antes de pasar a `Registros` y `Tráfico Modbus`.

## Estado validado

La vista `Pruebas` ya queda consolidada sobre el componente nativo estable `simple-tests-consolidated.tsx`.

Validado hasta este punto:

- La vista carga sin parpadeo de la versión anterior.
- Los desplegables ya no se cierran solos.
- La tabla de plan de pruebas se mantiene editable.
- El `Slave` es campo manual, sin control tipo spinner.
- El plan guarda y restaura el `Slave ID` desde la sesión.
- La vista no debe auto-ejecutar resultados al abrir.
- Los resultados vuelven a `Pendiente` cuando se modifica un paso.
- El guardado del plan queda dentro de `testsRuntime` y se persiste con la sesión `.jwmodbus-session`.

## Estructura funcional aprobada

### Plan de pruebas

Columnas actuales aprobadas:

- `Activo`
- `Paso`
- `Slave`
- `Función`
- `Dirección`
- `Cantidad`
- `Valor`
- `Validación`
- `Esperado`
- `Timeout`
- `Resultado`
- Acción de eliminar

Reglas:

- `Cantidad` se usa en funciones de lectura.
- `Valor` se usa en funciones de escritura.
- `Validación` define si basta respuesta/cantidad o si se comparan valores.
- `Esperado` queda deshabilitado cuando el modo de validación lo puede inferir automáticamente.

### Funciones soportadas en MVP

Lectura:

- `FC01 Read Coils`
- `FC02 Read Discrete Inputs`
- `FC03 Read Holding Registers`
- `FC04 Read Input Registers`

Escritura:

- `FC05 Write Single Coil`
- `FC06 Write Single Register`
- `FC15 Write Multiple Coils`
- `FC16 Write Multiple Registers`

### Modos de validación

- `Respuesta OK`: aprueba si el backend Modbus responde sin excepción/error.
- `Cantidad solicitada`: aprueba si la lectura devuelve la cantidad solicitada.
- `Valores exactos`: compara secuencia de valores esperados.
- `Por dirección`: reservado para validar pares tipo `40000=1234,40001=4097`.

## Pendiente inmediato antes de salir de Pruebas

### 1. Exportar registro de ejecución

Debe conservarse como CSV desde el botón `Exportar CSV`.

Contenido mínimo:

- Hora
- Paso
- Slave
- Función
- Dirección
- Cantidad
- Valor
- Validación
- Esperado
- Resultado
- Tiempo ms
- Detalle
- Valores leídos/escritos

### 2. Puente hacia historial de sesión

La ejecución de pruebas debe reflejarse en la vista `Sesiones` mediante:

- Conteo de pruebas aprobadas/totales.
- Conteo de errores.
- Actividad reciente tipo tabla.
- `testsRuntime.lastRun` como fuente principal.

No mezclar con la actividad de lectura rápida; deben convivir, pero la actividad de pruebas debe identificarse como evento de prueba.

### 3. Registro detallado por paso

La columna `Info` del registro de ejecución debe abrir el detalle del paso, equivalente al detalle de lectura de `Dispositivos`.

Debe mostrar:

- Función.
- Slave ID.
- Dirección inicial.
- Cantidad o valor.
- Duración.
- Resultado.
- Tabla con dirección, nombre, esperado, leído/escrito, tipo y validación.

### 4. Estado visual final de KPIs

Mantener la versión bonita validada:

- Anillo para `Tasa de éxito`.
- Texto grande para `Latencia promedio`.
- Texto rojo para `Errores`.
- Anillo para `Pasos completados`.

Evitar volver a la versión compacta/fea donde el anillo queda demasiado pequeño y el texto se pega.

## Dependencias para vistas siguientes

### Registros

La vista `Registros` deberá reutilizar:

- Mapa de nombres de registros.
- Tipos de dato.
- Acceso `R/W`, `R`, `W`.
- Edición de metadatos del slave.

### Tráfico Modbus

La vista `Tráfico Modbus` deberá consumir eventos reales generados por:

- Lectura rápida.
- Vista Registros.
- Ejecución de pruebas.
- Escaneo de slaves.

## No reintroducir

Evitar volver a traer:

- Layout antiguo de `Pruebas`.
- Mockups residuales con datos precargados.
- Estados aprobados/fallidos al abrir sin presionar `Iniciar prueba`.
- Guards visuales que oculten errores de layout sin corregir la causa.

## Siguiente paso recomendado

Antes de pasar a `Registros`, hacer un commit funcional que conecte la ejecución de pruebas al historial general de sesión, sin tocar nuevamente la distribución visual principal.
