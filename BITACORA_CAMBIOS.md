# Bitácora de cambios

Registro de cómo se ha ido desarrollando JW Modbus Tool: qué se cambió, por
qué y cómo se verificó. Las entradas más recientes van primero.

El `CHANGELOG.md` resume las funciones de cada versión; esta bitácora cuenta el
proceso.

**Plantilla para nuevas entradas**

```
## AAAA-MM-DD · Título corto
Rama: `nombre-de-rama`

**Qué se hizo**
- ...

**Por qué**
- ...

**Verificación**
- ...

**Pendiente**
- ...
```

---

## 2026-10-07 · Fase 1 del simulador slave

Rama: `feature/slave-simulator`, creada desde `Revision-29/08` (commit `8ddc8a1`).

**Qué se hizo**

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

**Por qué**

- Pedido de jefatura: emular slaves (dispositivos virtuales) para probar
  masters, HMIs y PLCs sin el equipo físico. El plan completo en 3 fases está en
  `guia pasos.md`.
- El motor de respuestas slave ya existía con tests, pero no estaba conectado
  al puerto serie ni a la interfaz; el panel "Simulador slave" de la vista
  Pruebas era solo una maqueta.

**Problemas encontrados al probar la app y corregidos**

- Los contadores del simulador no se actualizaban mientras llegaba tráfico:
  el estado solo se emitía al iniciar o detener. Ahora se emite como máximo
  cada 200 ms mientras hay tráfico.
- El mensaje de puerto ocupado no llegaba a la interfaz: el error se lanzaba
  antes de crear la promesa y `toSerialResult` no lo atrapaba. Se corrigió
  haciendo async esos callbacks.
- Ajustes visuales: el contador "Excepciones" heredaba el fondo morado de la
  clase global `.purple`, y las columnas ID y Función del tráfico se cortaban.

**Verificación**

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

**Documentación**

- `docs/SLAVE_SIMULATOR.md`: funcionamiento y arquitectura del simulador.
- `docs/PLAN_PRUEBAS_SIMULADOR.md`: pruebas A (solo software), B (JWPLC por
  USB) y C (con conversor USB-RS485).
- Actualizados `README.md`, `CHANGELOG.md` y `docs/SERIAL_LAYER.md`.

**Pendiente**

- Ejecutar las pruebas del plan y anotar los resultados. El criterio de cierre
  de la Fase 1 son 1.000 peticiones sin errores contra 2 slaves virtuales.
- Preparar `Simulador_Master_RS485.ino` para la prueba C2.
- Fase 2: plantilla JWPLC, inyección de fallas, conectar la tarjeta
  "Escenarios" de Pruebas y guardar los dispositivos virtuales en la sesión.
- Commit de la Fase 1 (los cambios aún no están confirmados en git).

## 2026-10-07 · Arranque de la app en desarrollo

Rama: `Revision-29/08` (el cambio pasó sin commit a `feature/slave-simulator`).

**Qué se hizo**

- Se descargó el binario de Electron, que faltaba en `node_modules`. No cambia
  ningún archivo del repo; si vuelve a pasar, ejecutar
  `node node_modules/electron/install.js`.
- `scripts/dev-runner.mjs` elimina la variable `ELECTRON_RUN_AS_NODE` antes de
  lanzar Electron.

**Por qué**

- `npm run dev:electron` fallaba con `spawn ... electron.exe ENOENT`, porque la
  descarga del binario en la instalación no se completó.
- Las terminales dentro de VS Code pueden tener `ELECTRON_RUN_AS_NODE=1`. Con
  esa variable, Electron arranca como Node y se cierra sin abrir ventana ni
  mostrar error.

**Verificación**

- `npm run dev:electron` abre la ventana "JW Modbus Tool".
