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
