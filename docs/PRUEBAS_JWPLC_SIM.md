# Pruebas con JWPLC Sim y eco del conversor

JW Modbus Tool se puede probar contra un JWPLC Basic simulado en
[JWPLC Sim](https://github.com/JW-Control/jwplc-sim), sin placa ni conversor.
El Sim pone el bus RS-485 del PLC simulado en un puerto TCP
(`node cli/jwsim-bus.mjs <sketch> --tcp <puerto>`) o en un COM virtual
(`--com`, en Windows el par com0com COM20 ↔ COM21 que trae su instalador).

## Eco del conversor USB-RS485

RS-485 envía y recibe por el mismo par A/B. Muchos conversores dejan su
receptor encendido mientras transmiten, así que la PC vuelve a leer lo que
acaba de escribir antes de la respuesta del equipo:

```text
TX  02 01 00 00 00 08 3D FF          lectura de 8 coils al ID 2
RX  02 01 00 00 00 08 3D FF          eco (la propia petición)
RX  02 01 01 05 91 8F                respuesta del JWPLC
```

Sin tratarlo, el master toma el eco como respuesta (error de CRC en las
lecturas, y FC5/FC6 "aprobadas" sin que el equipo haya respondido) y el
simulador slave lee su propia respuesta como una petición nueva y la contesta,
lo que llena el bus.

El ajuste **Eco del conversor** (Dispositivos y Simulador) tiene tres modos:

| Modo | Qué hace |
| --- | --- |
| Automático (por defecto) | Descarta el eco cuando aparece. FC5 y FC6 responden igual que la petición: para ellas usa lo aprendido de las demás funciones; si aún no se sabe, espera 120 ms de silencio antes de tomar la trama como respuesta. |
| Sin eco | No filtra nada (el comportamiento anterior). |
| Con eco | Siempre descarta primero lo que se escribió. |

El código está en `src/shared/serial/echoFilter.ts` (master) y en
`RtuSlaveSimulator.discardEcho` (simulador slave). El simulador también
espera hasta 150 ms a que llegue el resto de una petición que quedó a medias
(función conocida y bytes faltantes): los puertos USB y virtuales a veces
pausan en mitad de una trama.

## Montaje en la nube o en Linux

`scripts/sim/pty-tcp-bridge.py` hace de conversor: crea un puerto serie
virtual (pty) unido al bus del Sim y, con `--echo`, imita un conversor con eco.

```bash
npm run build:main
# Master del Tool contra un slave simulado
node <jwplc-sim>/cli/jwsim-bus.mjs "Codigos de Pruebas/Slave_JWSim_8FC" --tcp 15020 &
python3 scripts/sim/pty-tcp-bridge.py --tcp 15020 [--echo] --link /tmp/jwsim-com &
node scripts/sim/sim-integration.mjs --port /tmp/jwsim-com --rounds 50 [--echo auto|off|on]

# Simulador slave del Tool contra un master simulado
node <jwplc-sim>/cli/jwsim-bus.mjs "Codigos de Pruebas/Master_JWSim_8FC" --tcp 15021 &
python3 scripts/sim/pty-tcp-bridge.py --tcp 15021 [--echo] --link /tmp/jwsim-slave &
node scripts/sim/sim-slave.mjs --port /tmp/jwsim-slave --seconds 30 [--echo auto|off|on]
```

`Slave_JWSim_8FC` y `Master_JWSim_8FC` cubren las 8 funciones (FC1 a FC6,
FC15 y FC16) a 115200 8N1 con el ID 2, y sirven igual en un JWPLC real.

En Windows, con la app: arrancar el Sim con `--com \\.\COM20` (o el equipo
«Conversor USB a RS-485 (PC)» de la escena, con su opción de eco) y conectar el
Tool a COM21.

## Resultados (2026-11-12, JWPLC Sim 0.4 · package 2.1.0-alpha.17)

| Prueba | Conversor | Modo | Resultado |
| --- | --- | --- | --- |
| Master del Tool → Slave_JWSim_8FC, 50 vueltas × 8 funciones | sin eco | Automático | 400/400 |
| Ídem | con eco | Automático | 400/400 |
| Ídem | con eco | Con eco | 400/400 |
| Ídem | sin eco | Sin eco | 400/400 |
| Ídem | con eco | Sin eco (antes) | 100/400: lecturas con CRC inválido, FC5/FC6 falsamente aprobadas |
| Master_JWSim_8FC → simulador slave del Tool, 30 s | sin eco | Automático | 803 peticiones, 803 respuestas, 0 errores |
| Ídem | con eco | Automático | 815 respuestas, 815 ecos descartados, 0 errores |
| Ídem | con eco | Sin eco (antes) | el simulador se responde a sí mismo: 12.023 "peticiones" en 20 s |

Lo que el Sim no cubre: los tiempos reales de los adaptadores USB en Windows,
el cableado y la terminación de 120 Ω. Antes de publicar, una prueba corta en
el taller con el conversor real (por ejemplo ZK-U485: CH340G + MAX485).
