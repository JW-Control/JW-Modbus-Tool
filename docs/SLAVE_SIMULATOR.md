# Simulador slave

La vista Simulador permite que el PC actúe como uno o varios slaves Modbus RTU
(dispositivos virtuales) en su propio puerto COM. Así se pueden probar masters,
HMIs y PLCs sin tener el equipo físico.

## Funcionamiento actual (Fase 1)

- Abre un puerto COM propio, independiente de la conexión del master. El master
  y el simulador no pueden usar el mismo puerto a la vez; la app lo rechaza en
  ambos sentidos con un mensaje claro.
- Aloja varios dispositivos virtuales en un mismo puerto. Cada uno tiene su
  Unit ID (1 a 247) y sus propias coils, entradas discretas, holding registers
  e input registers: 64 posiciones de cada tipo por defecto, hasta 9999.
- Responde FC1, FC2, FC3, FC4, FC5, FC6, FC15 y FC16 con el motor slave
  compartido, incluidas las respuestas de excepción por dirección o valor
  inválidos.
- Aplica las escrituras broadcast (Unit ID 0) a todos los dispositivos virtuales
  sin responder.
- No responde a Unit IDs que no tienen dispositivo virtual ni a tramas con CRC
  incorrecto.
- Muestra y permite editar todos los valores en vivo; las escrituras del master
  actualizan la tabla abierta.
- Registra cada trama recibida con su respuesta y su resultado, y mantiene
  contadores en vivo de peticiones, respuestas, excepciones, tramas ignoradas y
  errores de CRC.
- Recuerda la última configuración serial del simulador en el perfil del
  renderer.

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
| Dispositivos virtuales y enrutamiento por Unit ID | `src/shared/modbus/virtualSlaveBus.ts` |
| Motor de respuestas (FC1 a FC16) | `src/shared/modbus/slaveResponses.ts` |
| Puerto serial, contadores y eventos | `src/main/modbus/rtuSlaveSimulator.ts` |
| Canales IPC `slave:*` y `slave:event` | `src/main/ipc.ts`, `src/preload/preload.ts`, `src/preload/preload.cjs` |
| Vista Simulador | `src/renderer/SimulatorView.tsx`, `src/renderer/simulator.css` |

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

- Plantilla del JWPLC Basic (Fase 2).
- Inyección de fallas por dispositivo: retardo, no responder, CRC corrupto y
  excepción forzada (Fase 2).
- Guardar los dispositivos virtuales junto con la sesión (Fase 2).
- Modo interno master a slave en memoria, sin puerto COM (Fase 3).
- Supresión del eco en adaptadores RS-485 que devuelven su propia transmisión.
