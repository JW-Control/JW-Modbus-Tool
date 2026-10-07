# Bitácora de cambios

Registro de cómo se ha ido desarrollando JW Modbus Tool: qué se cambió, por
qué y cómo se verificó. Las entradas más recientes van primero.

El `CHANGELOG.md` resume las funciones de cada versión; esta bitácora cuenta el
proceso.

### Plantilla para nuevas entradas

```
## AAAA-MM-DD · Título corto
Rama: `nombre-de-rama`

### Qué se hizo
- ...

### Por qué
- ...

### Verificación
- ...

### Pendiente
- ...
```

---

## 2026-10-07 · Prueba con el JWPLC real: dos masters y varios slaves

Rama: `feature/slave-simulator`.

### Qué se hizo

- Se cargó `Codigos de Pruebas/Simulador_Master_USB/Simulador_Master_USB.ino`
  al JWPLC por COM3 (placa JWPLC Basic, paquete 2.1.0-alpha.12), a pedido del
  usuario.
- Prueba en vivo con 5 slaves virtuales (ID 1, 2, 4 y 5 Genéricos, e ID 3 con
  la plantilla JWPLC), con dos masters a la vez: el JWPLC por COM3 y el master
  de la app por el canal interno.
- La etiqueta del simulador, con los dos canales activos, pasó de "Escuchando
  en COM3 + interno" a "COM3 + interno", porque empujaba el título a dos líneas.
- Guía de uso: nueva sección "Ejemplo: red con varios slaves y dos masters".
- Plan de pruebas: Prueba B anotada como aprobada.

### Hallazgos

- Antes de cargar el sketch, el JWPLC no tenía `Simulador_Master_USB.ino`.
  Tenía un programa de OpenPLC con el HAL del JWPLC Basic, que imprime
  diagnósticos `[RTU-TIMING]` por el USB a 115200 y consulta al ID 2 por RS-485.
  Por eso, en la prueba de la Fase 1, el simulador solo veía tramas ilegibles en
  COM3. Ese texto aparece en los proyectos `PruebaMultibit` y
  `PruebasBlackplane`; para volver a ese firmware hay que cargarlo desde el
  editor de OpenPLC.

### Verificación

- JWPLC por COM3: 106 peticiones en unos 10 s, todas respondidas, 0 errores de
  CRC. En el ID 1, el registro de ciclos subió (de 15 a 21 en 5 s) y el de
  errores no cambió.
- Master de la app por INTERNO, al mismo tiempo: el escaneo detectó los 5
  slaves y leyó 1750 en el ID 4 (holding) y 2304 en el ID 5 (input).
- Las coils 0 y 2 del ID 2, escritas desde la app, llegaron al JWPLC por FC01
  (respuesta `02 01 01 05`), así que sus salidas Q0_0 y Q0_2 debían encenderse.
  Falta que el usuario lo confirme mirando el equipo.

### Pendiente

- Confirmar en el JWPLC que Q0_0 y Q0_2 se encendieron.
- Masters virtuales dentro de la app: se propusieron, pero el usuario prefirió
  por ahora solo más slaves.

## 2026-10-07 · Fase 3 del simulador slave: canal interno

Rama: `feature/slave-simulator`, sobre `672b4e4` (Fases 1 y 2 probadas por el
usuario).

### Qué se hizo

- **Canal interno:** la lista de puertos de la vista Dispositivos termina con
  "Simulador interno (sin COM)" (ruta `INTERNO`). Al conectar el master ahí,
  `SerialManager` no abre ningún puerto: entrega cada petición al simulador en
  memoria, que responde con el mismo motor, fallas, contadores y tráfico que
  por un COM.
- **Simulador con dos canales:** cada respuesta va a su canal (COM o interno),
  y cada uno tiene sus propias respuestas con retardo pendientes. El simulador
  no necesita estar iniciado para el canal interno y puede atender los dos a la
  vez. Rechaza iniciarse con `INTERNO` como puerto COM.
- **Historial de tráfico en el proceso principal** (últimas 500 tramas), con
  los canales IPC `slave:getTraffic` y `slave:clearTraffic`. Cada trama indica
  su canal.
- **Interfaz:** la vista Simulador muestra "Canal interno activo" y explica
  cuándo hace falta iniciar el simulador. La tarjeta de Pruebas muestra "Canal
  interno" y ya no pide iniciar el simulador en ese caso.
- **Tests de extremo a extremo** (`tests/e2e/masterSimulatorInternal.test.ts`):
  el código real del master contra el simulador real, sin mocks. Cubren 1.000
  peticiones con las 8 funciones y 2 slaves, la secuencia de validación JWPLC,
  las cuatro fallas, IDs inexistentes, el registro del tráfico, la desconexión y
  el rechazo de `INTERNO` como COM.

### Por qué

- Es la Fase 3 de `guia pasos.md`: hacer demos y pruebas en cualquier PC, sin
  adaptadores ni drivers, y tener tests de punta a punta en `npm test`.

### Problemas encontrados y corregidos

- Al probar el canal interno, la tabla de tráfico del Simulador aparecía vacía:
  solo guardaba lo que llegaba con esa vista abierta, y con el canal interno se
  trabaja desde Dispositivos o Pruebas. Ahora el historial vive en el proceso
  principal y la vista lo carga al abrirse.
- En la Fase 2 la sección "Fixed" del `CHANGELOG.md` quedó insertada en medio
  de la lista "Added", así que funciones antiguas aparecían como arreglos. Se
  movió al final.

### Verificación

- `npm test`: 82 tests pasan (8 de extremo a extremo y 1 del historial de
  tráfico, nuevos).
- `npm run typecheck` y build sin errores.
- Demo en la app sin hardware ni drivers: master en "Simulador interno",
  escaneo con 3 slaves virtuales detectados, lectura de registros y plan de
  Pruebas con los cuatro escenarios: 8 aprobados, 8 "CRC Error", 6 "Excepcion"
  y 8 "Timeout". El tráfico se conserva al volver a la vista Simulador.
- Con esto se cumple el criterio de cierre de la Fase 3.

### Documentación

- `docs/GUIA_USO_SIMULADOR.md`: el canal interno pasa a ser la forma
  recomendada y el inicio rápido.
- `docs/SLAVE_SIMULATOR.md`: sección "Canal interno".
- `docs/PLAN_PRUEBAS_SIMULADOR.md`: nueva Prueba 0 (canal interno) con el
  criterio de cierre de la Fase 3.
- `CHANGELOG.md` y `README.md` actualizados.

### Pendiente

- Preparar `Simulador_Master_RS485.ino` para el montaje con conversor
  USB-RS485.
- Supresión del eco de conversores RS-485 y fail-safe de la plantilla JWPLC.

## 2026-10-07 · Guía de uso del simulador

Rama: `feature/slave-simulator`.

### Qué se hizo

- Nueva guía `docs/GUIA_USO_SIMULADOR.md`: qué hace el simulador, si hace falta
  hardware, inicio rápido con un par COM virtual, cada parte de la vista
  Simulador, plantilla JWPLC, fallas, escenarios de Pruebas, guardado en la
  sesión y problemas comunes.
- La guía incluye, como paso para más adelante, cómo usar un conversor
  USB-RS485: driver, cableado A/B, configuración, bus mixto y el problema del
  eco de algunos conversores.
- Enlaces a la guía desde `README.md` y `docs/SLAVE_SIMULATOR.md`.

### Por qué

- Hacía falta una guía para usar el simulador, no solo la documentación técnica
  y el plan de pruebas.
- Queda claro que las Fases 1 y 2 no necesitan hardware: basta un par COM
  virtual. El conversor USB-RS485 solo hace falta para probar un bus real.

### Pendiente

- Probar la guía siguiendo el inicio rápido con un par COM virtual.
- Preparar `Simulador_Master_RS485.ino` para el montaje con conversor.

## 2026-10-07 · Fase 2 del simulador slave

Rama: `feature/slave-simulator`, sobre la Fase 1 publicada (`af342ea`).

### Qué se hizo

- **Plantilla "JWPLC Basic Remote I/O"** (`src/shared/slave/templates.ts`):
  ID 2, 115200 8N1, 8 coils (Q0_0 a Q0_7) y 8 entradas (I0_0 a I0_7), sin
  registros. Copia el mapa del firmware `JWPLC_RemoteIO_Slave_RTU` y sale del
  preset que ya usa el master. Para imitar al equipo, las tablas ahora pueden
  tener tamaño 0 y responden con la excepción 02.
- **Fallas por dispositivo**: sin respuesta, CRC corrupto, excepción forzada
  (01 a 04) y retardo de 0 a 60000 ms. Se configuran en la vista Simulador, se
  muestran en la lista de dispositivos y en la columna "Falla" del tráfico, y
  tienen su propio contador.
- **Escenarios de la vista Pruebas**: el panel maqueta "Simulador slave" se
  reemplazó por `src/renderer/ScenarioSimulatorLink.tsx`. Muestra el estado
  real del simulador y, con la casilla activada, aplica la falla del escenario
  (Normal: ninguna, Timeout: sin respuesta, CRC: CRC corrupto, Excepción:
  excepción 02) a los slaves virtuales que usa el plan.
- **Sesión**: los dispositivos virtuales (nombres, plantilla, señales, fallas y
  valores) y el formato serial del simulador se guardan en la sección
  `simulator` del archivo `.jwmodbus-session` y se restauran al abrirlo. Los
  cambios de dispositivos y fallas marcan la sesión como "Modificada".
- Nuevos canales IPC: `slave:setFaults`, `slave:exportDevices` y
  `slave:importDevices`.
- La configuración serial del simulador pasó a
  `src/renderer/simulatorSettings.ts`, para compartirla con la sesión.
- 15 tests nuevos (73 en total).

### Por qué

- Es la Fase 2 de `guia pasos.md`: probar el manejo de errores del master
  (timeouts, CRC, excepciones) sin depender de un equipo que falle de verdad.

### Problemas encontrados y corregidos

- Las lecturas del master (FC01 a FC04) que recibían una respuesta con CRC
  incorrecto fallaban con "Frame is not a valid ... response", y la vista
  Pruebas las marcaba como "Error". Ahora devuelven `crcOk: false` y se ven como
  "CRC Error" (`src/main/modbus/rtuMasterActions.ts`).
- El código de excepción 04 (Slave Device Failure) no existía en el enum del
  proyecto; se agregó (`src/shared/modbus/exceptions.ts`).
- Una sesión con solo slaves virtuales aparecía como "Limpia"; ahora cuenta
  como sesión con contenido.

### Decisiones

- "Nuevo" no borra los slaves virtuales, y una sesión sin sección `simulator`
  tampoco los toca: el simulador es una herramienta en vivo y borrarlo sin
  aviso sería destructivo.
- Con la casilla de escenarios activada, el escenario manda sobre las fallas
  configuradas a mano para los dispositivos del plan. Al dejar de estar en el
  plan, un dispositivo vuelve a "Ninguna", no a su falla manual anterior.
- Los cambios de valores no marcan la sesión como modificada, igual que antes
  pasaba con las lecturas; sí se guardan al guardar.

### Verificación

- `npm test`: 73 tests pasan. Entre ellos, `tests/main/jwplcVirtualValidation.test.ts`
  ejecuta la secuencia de validación JWPLC real del master contra el JWPLC
  virtual y da PASS (primera parte del criterio de cierre de la Fase 2).
- `npm run typecheck` y build sin errores.
- En la app: plantilla JWPLC (ID 2 propuesto, nombres de señales, aviso de
  115200 8N1, pestañas sin registros); panel de fallas; los cuatro escenarios
  aplican y retiran la falla correcta; una sesión guardada restaura
  dispositivos, valores, fallas y formato serial, y el estado pasa por
  "Guardada", "Modificada" y "Guardada".
- Falta verificar las fallas contra un master real por puerto: necesita el par
  COM virtual (Prueba A2 de `docs/PLAN_PRUEBAS_SIMULADOR.md`).

### Documentación

- `docs/SLAVE_SIMULATOR.md`: plantillas, fallas, escenarios y sesión.
- `docs/PLAN_PRUEBAS_SIMULADOR.md`: nueva Prueba A2 para la Fase 2.
- `CHANGELOG.md` actualizado.

### Pendiente

- Ejecutar las Pruebas A y A2 con un par COM virtual.
- Preparar `Simulador_Master_RS485.ino` para la prueba C2.
- Fase 3: modo interno sin hardware.

## 2026-10-07 · Fase 1 del simulador slave

Rama: `feature/slave-simulator`, creada desde `Revision-29/08` (commit `8ddc8a1`).

### Qué se hizo

- Nueva vista **Simulador** en el menú lateral. El PC responde como uno o varios
  slaves Modbus RTU virtuales en su propio puerto COM. Permite editar coils y
  registros en vivo, y muestra un log de tráfico y contadores.
- Separador de tramas de petición: `src/shared/modbus/rtuRequestFramer.ts`.
- Bus de dispositivos virtuales con enrutamiento por Unit ID:
  `src/shared/modbus/virtualSlaveBus.ts`.
- Simulador en el proceso principal (puerto, contadores, eventos):
  `src/main/modbus/rtuSlaveSimulator.ts`. Reemplaza a `rtuSlaveSession.ts`, que
  no se usaba y se eliminó.
- Canales IPC `slave:*` en `src/main/ipc.ts` y en los dos preload (`preload.ts`
  y `preload.cjs`; este último es el que se carga y se mantiene a mano).
- Bloqueo de puerto: el master y el simulador no pueden abrir el mismo COM.
- Interfaz: `src/renderer/SimulatorView.tsx` y `src/renderer/simulator.css`.
- 19 tests nuevos, incluida una prueba de carga de 1.000 peticiones contra 2
  slaves.
- Sketch `Codigos de Pruebas/Simulador_Master_USB/Simulador_Master_USB.ino`: el
  JWPLC actúa como master Modbus usando el USB como bus, para probar el
  simulador sin conversor RS-485.

### Por qué

- Pedido de jefatura: emular slaves (dispositivos virtuales) para probar
  masters, HMIs y PLCs sin el equipo físico. El plan completo en 3 fases está en
  `guia pasos.md`.
- El motor de respuestas slave ya existía con tests, pero no estaba conectado
  al puerto serie ni a la interfaz; el panel "Simulador slave" de la vista
  Pruebas era solo una maqueta.

### Problemas encontrados al probar la app y corregidos

- Los contadores del simulador no se actualizaban mientras llegaba tráfico:
  el estado solo se emitía al iniciar o detener. Ahora se emite como máximo
  cada 200 ms mientras hay tráfico.
- El mensaje de puerto ocupado no llegaba a la interfaz: el error se lanzaba
  antes de crear la promesa y `toSerialResult` no lo atrapaba. Se corrigió
  haciendo async esos callbacks.
- Ajustes visuales: el contador "Excepciones" heredaba el fondo morado de la
  clase global `.purple`, y las columnas ID y Función del tráfico se cortaban.

### Verificación

- `npm test`: 58 tests pasan (39 anteriores y 19 nuevos).
- `npm run typecheck` y build del proceso principal y del renderer sin errores.
- Prueba en la app real con COM3 (el USB del JWPLC): el simulador abre el
  puerto y recibe datos. Descartó sin responder las tramas ilegibles que
  enviaba el firmware de ese momento. El bloqueo de puerto se probó en los dos
  sentidos.
- El sketch compila para la placa JWPLC Basic (`jwplc:esp32:jwplcbasic`,
  paquete 2.1.0-alpha.12).
- Aún no se probó contra un master real: no había par COM virtual ni conversor
  RS-485 disponibles.

### Documentación

- `docs/SLAVE_SIMULATOR.md`: funcionamiento y arquitectura del simulador.
- `docs/PLAN_PRUEBAS_SIMULADOR.md`: pruebas A (solo software), B (JWPLC por
  USB) y C (con conversor USB-RS485).
- Actualizados `README.md`, `CHANGELOG.md` y `docs/SERIAL_LAYER.md`.

### Pendiente

- Ejecutar las pruebas del plan y anotar los resultados. El criterio de cierre
  de la Fase 1 son 1.000 peticiones sin errores contra 2 slaves virtuales.
- Preparar `Simulador_Master_RS485.ino` para la prueba C2.
- Fase 2: plantilla JWPLC, inyección de fallas, conectar la tarjeta
  "Escenarios" de Pruebas y guardar los dispositivos virtuales en la sesión.

Publicado en `origin/feature/slave-simulator` (commits `f7886e8` y `af342ea`).

## 2026-10-07 · Arranque de la app en desarrollo

Rama: `Revision-29/08` (el cambio pasó sin commit a `feature/slave-simulator`).

### Qué se hizo

- Se descargó el binario de Electron, que faltaba en `node_modules`. No cambia
  ningún archivo del repo; si vuelve a pasar, ejecutar
  `node node_modules/electron/install.js`.
- `scripts/dev-runner.mjs` elimina la variable `ELECTRON_RUN_AS_NODE` antes de
  lanzar Electron.

### Por qué

- `npm run dev:electron` fallaba con `spawn ... electron.exe ENOENT`, porque la
  descarga del binario en la instalación no se completó.
- Las terminales dentro de VS Code pueden tener `ELECTRON_RUN_AS_NODE=1`. Con
  esa variable, Electron arranca como Node y se cierra sin abrir ventana ni
  mostrar error.

### Verificación

- `npm run dev:electron` abre la ventana "JW Modbus Tool".
