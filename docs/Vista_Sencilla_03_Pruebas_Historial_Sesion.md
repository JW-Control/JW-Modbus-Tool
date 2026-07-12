# Vista Sencilla / Pruebas — Historial de sesión

## Objetivo

Conectar la ejecución real de la vista **Pruebas** con el historial persistente de la sesión, sin volver a tocar el layout ya estabilizado.

La vista **Pruebas** ya guarda su definición de plan y escenarios en `testsRuntime`. Este puente adicional guarda la evidencia de ejecución generada por las llamadas Modbus reales.

## Archivo agregado

```text
src/renderer/simple-tests-session-history-bridge.ts
```

Se carga desde:

```text
src/renderer/main.tsx
```

## Qué registra

Cuando la vista `.testsNative` está activa, el bridge intercepta llamadas Modbus del backend renderer:

- `readCoils`
- `readDiscreteInputs`
- `readHoldingRegisters`
- `readInputRegisters`
- `writeSingleCoil`
- `writeSingleRegister`
- `writeMultipleCoils`
- `writeMultipleRegisters`

Por cada llamada registra:

- fecha/hora de inicio;
- fecha/hora de finalización;
- duración;
- fuente: `Pruebas`;
- rol: `PC Master`;
- función Modbus;
- Slave ID;
- dirección;
- cantidad o valores;
- estado (`OK`, `Timeout`, `CRC Error`, `Excepción`, `Error`);
- resumen de respuesta;
- payload de respuesta cuando existe.

## Persistencia

El historial se mantiene en `localStorage` bajo:

```text
jw-modbus-tool.simple.tests-execution-history.v1
```

Al guardar una sesión `.jwmodbus-session`, el bridge inyecta dos campos extra en el documento:

```ts
testsExecutionHistory: [...]
testsExecutionHistoryUpdatedAt: string
```

Al abrir una sesión, si el archivo contiene `testsExecutionHistory`, el bridge lo restaura en `localStorage`.

## Decisión de arquitectura

Este bridge evita modificar el layout de Pruebas y evita reabrir el problema anterior de overlays/guards.

La vista React de Pruebas sigue siendo la fuente de verdad para:

- plan visible;
- escenarios;
- validaciones;
- KPIs;
- detalle por paso.

El bridge solo captura evidencia de comunicación real y la adjunta al archivo de sesión.

## Pendiente para una siguiente etapa

Cuando se quiera mostrar este historial en la UI, no crear otro overlay. Se debe leer el historial desde:

```ts
window.__jwSimpleTestsExecutionHistory.get()
```

o desde el campo `testsExecutionHistory` restaurado desde sesión, y mostrarlo dentro de:

- `Sesiones / Actividad reciente`, o
- `Tráfico Modbus`, filtrado por fuente `Pruebas`.

## Reglas

- No usar este bridge para alterar el diseño visual.
- No duplicar lógica de validación de `simple-tests-consolidated.tsx`.
- No guardar datos falsos o precargados: solo se registra si hay una llamada Modbus real mientras `.testsNative` está activa.
- No registrar tráfico de Dispositivos/Registros desde este bridge; esas vistas ya tienen su propio historial.
