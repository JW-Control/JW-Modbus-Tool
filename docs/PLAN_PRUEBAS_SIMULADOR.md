# Plan de pruebas: Simulador slave Modbus RTU

Fecha: 2026-10-07 · Rama: `feature/slave-simulator`

**Recomendación:** empezar hoy con la **Prueba A**, que es solo software. Simula
el entorno Modbus RTU completo dentro de JW Modbus Tool, con varios slaves
virtuales, sin hardware y sin depender del USB del JWPLC. La **Prueba B** es
opcional. La **Prueba C** valida el cableado RS-485 real y se hace cuando llegue
el conversor USB-RS485.

## Prueba 0: canal interno (sin nada instalado)

Desde la Fase 3, el master de la app puede hablar con el simulador en memoria.
Es la prueba más rápida y no necesita par COM virtual.

1. Vista **Simulador**: agrega un dispositivo Genérico con ID 1 y pon `1234` en
   40001. No inicies el simulador.
2. Vista **Dispositivos**: Puerto **Simulador interno (sin COM)**, **Conectar** y
   **Escanear**.
3. Vista **Pruebas**: con el ID 1 como slave activo, ejecuta "Operación normal",
   "Error CRC detectado", "Excepción Modbus" y "Timeout detectado".

- [ ] La barra de estado muestra "Conectado INTERNO" y la vista Simulador, "Canal interno activo".
- [ ] El escaneo detecta el ID 1 y Registros lee `1234` en 40001.
- [ ] Los escenarios dan: 8 pasos aprobados, 8 "CRC Error", 6 "Excepcion" y 8 "Timeout".
- [ ] Al volver a la vista Simulador, el tráfico muestra las peticiones.

**Criterio de cierre de la Fase 3:** esta demo funciona en un PC sin
adaptadores ni drivers, y los tests de extremo a extremo
(`tests/e2e/masterSimulatorInternal.test.ts`, dentro de `npm test`) pasan.

## Montajes

```
A. Solo software (hoy)
   [Master de la app: vista Dispositivos] -- COM11 <== par virtual ==> COM10 -- [Simulador: vista Simulador]
                                     (los dos en la misma ventana de JW Modbus Tool)

B. JWPLC por USB (hoy, opcional)
   [JWPLC master: Simulador_Master_USB.ino] -- USB (COM3) --> [Simulador en la laptop]

C. Con conversor USB-RS485 (cuando llegue)
   C1: [Master de la app] -- conversor USB-RS485 -- A/B --> [JWPLC slave: Pruebas_MODBUS.ino]
   C2: [JWPLC master por RS-485] -- A/B --> conversor USB-RS485 -- [Simulador en la laptop]
```

## Cuál conviene

| Prueba | Qué necesitas | Cuándo | Qué valida | Qué no valida |
| --- | --- | --- | --- | --- |
| A. Solo software | Driver de par COM virtual (por ejemplo com0com) | Hoy | Master y simulador de la app de punta a punta: escaneo, lecturas, escrituras, plan de pruebas, varios slaves | Equipos reales y cableado RS-485 |
| B. JWPLC por USB | JWPLC con `Simulador_Master_USB.ino` | Hoy, opcional | Un master real (el JWPLC) contra el simulador, con las 8 funciones | El bus RS-485 (el USB no es RS-485) |
| C. Conversor USB-RS485 | Conversor, par trenzado A/B, JWPLC | Cuando llegue el conversor | Cableado y tiempos reales del bus, en los dos sentidos | — |

Si la Prueba B falla por el USB, no bloquea nada: la Prueba A cubre lo mismo
del lado de la app.

## Prueba A: solo software (hoy)

**Preparación (una sola vez)**

1. Instala un emulador de par COM virtual. com0com es gratuito; usa una versión
   firmada del driver, porque Windows 11 puede bloquear drivers sin firma. Si
   Windows lo bloquea, cualquier otro emulador de par COM virtual sirve.
2. Crea un par, por ejemplo `COM10 <-> COM11`. Lo que se escribe en uno se lee
   en el otro.
3. Comprueba en el Administrador de dispositivos que aparecen los dos puertos.

**Pasos**

1. Abre la app con `npm run dev:electron`.
2. Vista **Simulador**:
   - Puerto `COM10`, 9600 baudios, 8 bits, sin paridad, 1 bit de parada.
   - Agrega dos dispositivos: ID 1 e ID 2, con tamaño 64.
   - En el ID 2, pestaña Holding registers, pon `1234` en la dirección 40001.
   - Pulsa **Iniciar simulador**.
3. Vista **Dispositivos**:
   - Puerto `COM11`, 9600 8N1. Si `COM11` no aparece, pulsa recargar puertos.
   - Pulsa **Conectar** y luego **Escanear**.
4. Vista **Registros**: selecciona el ID 2, lee FC03 desde 40000 con cantidad
   10 y activa la lectura automática.
5. Vista **Pruebas**: con el ID 2 como slave activo, ejecuta el plan por
   defecto (8 pasos: FC06, FC03, FC05, FC15, FC16, FC04, FC01, FC02).
6. Vuelve a **Simulador** y revisa la tabla de tráfico y los contadores.

**Resultados esperados**

- [ ] El escaneo detecta 2 dispositivos (ID 1 e ID 2).
- [ ] Registros muestra `1234` en 40001.
- [ ] Al cambiar un valor en el Simulador, Registros lo muestra en la siguiente lectura.
- [ ] El plan de Pruebas termina con los 8 pasos aprobados.
- [ ] Las escrituras del plan (por ejemplo 40000 = 1234 y las coils 0 a 3) aparecen en la memoria del ID 2 del Simulador.
- [ ] En el Simulador, "Err. CRC" queda en 0. "Ignoradas" solo sube durante el escaneo, por los IDs 3 a 10, que no existen.
- [ ] Al intentar conectar el master a `COM10` mientras el simulador lo usa, la app avisa que el puerto está ocupado.

**Criterio de cierre de la Fase 1:** con la lectura automática de Registros a
250 ms, deja correr unos 5 minutos hasta superar 1.000 peticiones. En el
Simulador, "Respondidas" debe ser igual a las peticiones del ID 2, con 0 errores
de CRC. En Dispositivos, ninguna lectura debe terminar en timeout.

## Prueba A2: Fase 2 (plantilla, fallas, escenarios y sesión)

Usa el mismo montaje de la Prueba A (par COM virtual, master en `COM11`,
simulador en `COM10`).

### Plantilla JWPLC

1. Vista **Simulador**: elimina los dispositivos, elige la plantilla
   "JWPLC Basic Remote I/O" y pulsa **Agregar**. Debe proponer el ID 2 y avisar
   que el equipo real usa 115200 8N1; pulsa **Usar ese formato**.
2. Con el simulador detenido, ajusta también el master (vista Dispositivos) a
   115200 8N1. Inicia el simulador, conecta el master y escanea.

- [ ] El escaneo detecta el ID 2 (responde con excepción 02, porque no tiene registros, igual que el equipo real).
- [ ] La tabla de coils muestra los nombres Q0_0 a Q0_7, y la de entradas, I0_0 a I0_7.
- [ ] En Registros, FC01 desde 0 con cantidad 8 lee las coils; al encender Q0_3 en el Simulador se ve en la siguiente lectura.
- [ ] Las pestañas Holding e Input registers avisan que el dispositivo no tiene registros.

### Fallas (vista Simulador)

Agrega un dispositivo Genérico con ID 1 y, desde Registros, lee FC03 en 40000
del ID 1 tras cada cambio:

- [ ] Modo "Sin respuesta": la lectura termina en timeout y el tráfico del simulador muestra "Sin respuesta".
- [ ] Modo "CRC corrupto": la lectura termina en "CRC Error".
- [ ] Modo "Excepción forzada" con código 04: la lectura muestra la excepción "Slave Device Failure".
- [ ] Retardo de 500 ms con modo "Ninguna": la lectura responde con unos 500 ms más de tiempo.
- [ ] Retardo de 1500 ms con timeout del master de 1000 ms: la lectura termina en timeout.
- [ ] El contador "Fallas" sube con cada respuesta alterada.

### Escenarios (vista Pruebas)

Usa el ID 1 Genérico como slave activo, para que el plan por defecto tenga
registros disponibles. Con la casilla "Aplicar el escenario a los slaves
virtuales" activada:

- [ ] "Operación normal": los 8 pasos quedan aprobados.
- [ ] "Error CRC detectado": la tarjeta indica "CRC corrupto" y los pasos terminan en "CRC Error".
- [ ] "Excepción Modbus": la tarjeta indica "Excepción 02 forzada" y los pasos terminan en "Excepcion".
- [ ] "Timeout detectado": el plan apunta a otro ID; si no existe en el simulador, o si existe y queda "Sin respuesta", los pasos terminan en "Timeout".
- [ ] Al volver a "Operación normal" o desactivar la casilla, los dispositivos quedan sin falla.

### Sesión

1. Con dispositivos, valores y alguna falla configurados, guarda la sesión.
2. Cambia algo (por ejemplo, borra un dispositivo): la barra de estado debe
   pasar a "Modificada".
3. Abre otra vez la sesión guardada.

- [ ] Vuelven los mismos dispositivos, con sus nombres, plantilla, valores y fallas.
- [ ] El formato serial del simulador vuelve al que tenía al guardar.

**Criterio de cierre de la Fase 2:** la secuencia de validación JWPLC de la app
da PASS contra el JWPLC virtual (verificado por test automático:
`tests/main/jwplcVirtualValidation.test.ts`), y cada falla produce el resultado
esperado en las comprobaciones de arriba.

## Prueba B: JWPLC como master por USB (hoy, opcional)

El sketch convierte al JWPLC en master Modbus y usa el USB (COM3) como bus. No
imprime nada por `Serial`, porque `Serial` es el bus.

**Pasos**

1. Carga `Codigos de Pruebas/Simulador_Master_USB/Simulador_Master_USB.ino` al
   JWPLC (placa JWPLC Basic).
2. Cierra el Monitor Serie del IDE de Arduino, porque bloquea el COM3.
3. En la app, si **Dispositivos** está conectado a COM3, desconéctalo.
4. Vista **Simulador**: puerto `COM3`, 9600 8N1, agrega ID 1 e ID 2 con la
   plantilla Genérico y pulsa **Iniciar simulador**. No uses la plantilla
   JWPLC aquí: el sketch también lee y escribe registros.

**Resultados esperados**

- [ ] El tráfico muestra unas 10 peticiones por segundo, alternando las 8 funciones.
- [ ] Al activar las coils 0 a 7 del ID 2 en el Simulador, se encienden las salidas Q0_0 a Q0_7 del JWPLC.
- [ ] Al activar entradas físicas I0_X, cambia el registro 40000 del ID 2.
- [ ] La coil 8 del ID 2 parpadea y las coils 16 a 23 cuentan en binario.
- [ ] En el ID 1, el registro 40010 (ciclos) sube y el 40012 (errores) se queda quieto.
- [ ] Al arrancar puede haber algunos "Error CRC" por los mensajes de inicio del ESP32; después no deben aparecer más.

**Si no responde**

- Si el tráfico muestra tramas con "Error CRC" de forma constante, el JWPLC
  sigue con otro firmware o con otro baud rate. Vuelve a cargar el sketch.
- Si al abrir el puerto el JWPLC se reinicia en bucle, el circuito de reset
  automático del USB está interfiriendo. En ese caso usa la Prueba A y deja esta
  para después.
- Al terminar, vuelve a cargar `Pruebas_MODBUS.ino` si lo necesitas.

## Prueba C: con el conversor USB-RS485 (cuando llegue)

**Cableado:** A del conversor con A del JWPLC, B con B y, si el conversor tiene
GND, únelo a la masa del JWPLC. En un banco con cable corto no hace falta la
resistencia de terminación de 120 Ω. Si no hay comunicación, prueba
intercambiar A y B: algunos fabricantes los rotulan al revés.

### C1: la app lee al JWPLC (prueba de cableado)

Esta prueba usa funciones que la app ya tenía; sirve para confirmar que el
cableado funciona antes de probar el simulador.

1. Carga `Pruebas_MODBUS.ino` al JWPLC: slave ID 2, 9600 8N1, holding
   registers 0 y 1.
2. Vista **Dispositivos**: puerto del conversor, 9600 8N1, **Conectar** y
   **Escanear**.

- [ ] El escaneo detecta el ID 2.
- [ ] FC03 en 40000 muestra las entradas I0_X; escribir 40001 con FC06 enciende las salidas Q0_X.

### C2: el JWPLC (master por RS-485) lee al simulador

Es el montaje que reemplaza a la Prueba B con cableado real.

1. Carga un sketch master que use el RS-485 del JWPLC. Pendiente: preparar
   `Simulador_Master_RS485.ino`, que hace lo mismo que el sketch USB pero con la
   librería `JWPLC_ModbusRTU`.
2. Vista **Simulador**: puerto del conversor, mismo formato serial que el
   sketch, con ID 1 e ID 2.

- [ ] Se cumplen los mismos resultados que en la Prueba B.
- [ ] 1.000 peticiones seguidas con 0 errores de CRC y 0 timeouts del lado del JWPLC (registro 40012 del ID 1 en 0).

## Registro de resultados

| Prueba | Fecha | Peticiones | Errores CRC | Timeouts | Resultado | Notas |
| --- | --- | --- | --- | --- | --- | --- |
| 0. Canal interno | | | | | Pendiente | |
| A. Solo software | | | | | Pendiente | |
| A2. Fase 2 | | | | | Pendiente | |
| B. JWPLC por USB | 2026-10-07 | 106 en ~10 s por COM3 | 0 | 0 | Aprobado | JWPLC por COM3 y master de la app por INTERNO a la vez, con 5 slaves virtuales |
| C1. App lee al JWPLC | | | | | Pendiente | |
| C2. JWPLC lee al simulador | | | | | Pendiente | |

## Pendientes

- Preparar `Simulador_Master_RS485.ino` para la Prueba C2.
- Si en la Prueba A `COM11` no aparece en la lista de Dispositivos, anotarlo:
  la lista del master oculta puertos sin datos de fabricante, y habría que
  ajustarla.
