# Simulador slave

La vista Simulador permite que el PC actúe como uno o varios slaves Modbus RTU
(dispositivos virtuales) en su propio puerto COM. Así se pueden probar masters,
HMIs y PLCs sin tener el equipo físico.

## Funcionamiento actual (Fases 1 y 2)

- Abre un puerto COM propio, independiente de la conexión del master. El master
  y el simulador no pueden usar el mismo puerto a la vez; la app lo rechaza en
  ambos sentidos con un mensaje claro.
- Aloja varios dispositivos virtuales en un mismo puerto. Cada uno tiene su
  Unit ID (1 a 247) y sus propias coils, entradas discretas, holding registers
  e input registers: 64 posiciones de cada tipo por defecto, de 0 a 9999.
- Responde FC1, FC2, FC3, FC4, FC5, FC6, FC15 y FC16 con el motor slave
  compartido, incluidas las respuestas de excepción por dirección o valor
  inválidos. Una tabla de tamaño 0 responde con la excepción 02.
- Aplica las escrituras broadcast (Unit ID 0) a todos los dispositivos virtuales
  sin responder.
- No responde a Unit IDs que no tienen dispositivo virtual ni a tramas con CRC
  incorrecto.
- Muestra y permite editar todos los valores en vivo; las escrituras del master
  actualizan la tabla abierta.
- Registra cada trama recibida con su respuesta, su resultado y la falla
  aplicada, y mantiene contadores en vivo de peticiones, respuestas,
  excepciones, tramas ignoradas, errores de CRC y fallas.
- Recuerda la última configuración serial del simulador.

## Plantillas

| Plantilla | Unit ID | Formato serial | Mapa |
| --- | --- | --- | --- |
| Genérico | El primero libre | El que elijas | 64 posiciones de cada tipo, sin nombres |
| JWPLC Basic Remote I/O | 2 | 115200 8N1 | Coils Q0_0 a Q0_7 (FC01, FC05, FC15) y entradas I0_0 a I0_7 (FC02). Sin registros: FC03, FC04, FC06 y FC16 responden excepción 02 |

La plantilla JWPLC copia el mapa del firmware `JWPLC_RemoteIO_Slave_RTU` y del
preset que ya usa el master (`src/shared/presets/jwplcRemoteIoPreset.ts`). Si el
formato serial del simulador no coincide con el del equipo, la vista lo avisa y
ofrece aplicarlo. No emula el fail-safe del firmware, que apaga las salidas si
pasa 1 s sin escrituras.

## Fallas por dispositivo

Se configuran en el panel "Fallas de ID n", debajo de la lista de dispositivos.

| Modo | Qué hace | Qué ve el master |
| --- | --- | --- |
| Ninguna | Responde normalmente | Respuesta correcta |
| Sin respuesta | No contesta ni aplica escrituras | Timeout |
| CRC corrupto | Aplica la petición y altera el último byte del CRC | Error de CRC |
| Excepción forzada | Responde la excepción elegida (01 a 04) sin tocar la memoria | Excepción Modbus |

El **retardo** (0 a 60000 ms) se suma antes de cada respuesta, con cualquier
modo salvo "Sin respuesta". Si supera el timeout del master, este verá un
timeout. Al detener el simulador se descartan las respuestas que estaban en
espera.

## Escenarios de la vista Pruebas

La tarjeta "Simulador slave" de la vista Pruebas conecta el escenario elegido
con el simulador. Con la casilla "Aplicar el escenario a los slaves virtuales"
activada, cada escenario aplica una falla a los dispositivos virtuales que usa
el plan:

| Escenario | Falla aplicada |
| --- | --- |
| Operación normal | Ninguna |
| Timeout detectado | Sin respuesta |
| Error CRC detectado | CRC corrupto |
| Excepción Modbus | Excepción 02 |

Los escenarios personalizados no aplican falla. Al cambiar de escenario o
desactivar la casilla, los dispositivos que dejan de estar en el plan vuelven a
"Ninguna". Mientras la casilla está activa, el escenario manda sobre lo que se
configure a mano en la vista Simulador para esos dispositivos.

## Sesión

Al guardar una sesión se guardan los dispositivos virtuales (nombre, plantilla,
nombres de señales, fallas y todos los valores) y la configuración serial del
simulador, en la sección `simulator` del archivo `.jwmodbus-session`. Al abrir
una sesión que la tiene, reemplaza los dispositivos actuales; si el simulador
está en marcha, sigue escuchando con los nuevos. Una sesión sin esa sección deja
los dispositivos como están, y "Nuevo" tampoco los borra. Los cambios en
dispositivos, nombres y fallas marcan la sesión como "Modificada"; los cambios
de valores, no.

## Separación de tramas

`RtuRequestFramer` (`src/shared/modbus/rtuRequestFramer.ts`) corta el flujo de
bytes entrante en peticiones:

1. Por longitud, según el código de función: 8 bytes para FC1 a FC6 y
   `9 + byte count` para FC15 y FC16.
2. Si esa longitud no da un CRC válido, por el prefijo más corto con CRC
   válido. Así descarta la respuesta de otro slave en un bus RS-485 compartido
   y se recupera de un flujo desalineado.
3. Los bytes que nunca forman una trama se liberan cuando la línea queda en
   silencio durante `máx(20 ms, 4 × 3,5 caracteres)`. El mínimo de 20 ms absorbe
   la entrega por ráfagas de los adaptadores USB-serial.

## Arquitectura

| Pieza | Archivo |
| --- | --- |
| Separador de tramas | `src/shared/modbus/rtuRequestFramer.ts` |
| Dispositivos virtuales, enrutamiento, fallas, exportar e importar | `src/shared/modbus/virtualSlaveBus.ts` |
| Plantillas | `src/shared/slave/templates.ts` |
| Motor de respuestas (FC1 a FC16) | `src/shared/modbus/slaveResponses.ts` |
| Puerto serial, retardos, contadores y eventos | `src/main/modbus/rtuSlaveSimulator.ts` |
| Canales IPC `slave:*` y `slave:event` | `src/main/ipc.ts`, `src/preload/preload.ts`, `src/preload/preload.cjs` |
| Vista Simulador | `src/renderer/SimulatorView.tsx`, `src/renderer/simulator.css`, `src/renderer/simulatorSettings.ts` |
| Tarjeta de la vista Pruebas | `src/renderer/ScenarioSimulatorLink.tsx` |
| Guardado en la sesión | `src/renderer/SimpleModeApp.tsx` |

## Pruebas sin hardware

Instala un par de puertos COM virtuales, por ejemplo con com0com (`COM10` y
`COM11`). Inicia el simulador en un puerto (vista Simulador) y conecta el
master de la propia app al otro (vista Dispositivos). Los dos roles funcionan
en la misma ventana con puertos distintos, así que Escanear, Registros y
Pruebas trabajan de punta a punta contra los dispositivos virtuales. com0com es
software GPL que se usa como driver externo; nada de su código forma parte de
este proyecto.

Con dos adaptadores USB-RS485, une A con A y B con B, y usa un adaptador para
cada rol.

El paso a paso de todas las pruebas está en `PLAN_PRUEBAS_SIMULADOR.md`.

## Pendiente

- Modo interno master a slave en memoria, sin puerto COM (Fase 3).
- Supresión del eco en adaptadores RS-485 que devuelven su propia transmisión.
- Fail-safe de salidas en la plantilla JWPLC.
