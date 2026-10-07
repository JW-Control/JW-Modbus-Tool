# Guía de uso: Simulador slave Modbus RTU

El simulador convierte el PC en uno o varios slaves Modbus RTU (dispositivos
virtuales). Sirve para probar un master (la propia JW Modbus Tool, un PLC, un
HMI o un JWPLC) sin tener el equipo slave físico, y para provocar fallas a
propósito: timeouts, errores de CRC y excepciones.

Esta guía cubre lo que hacen las Fases 1 y 2. El detalle técnico está en
`SLAVE_SIMULATOR.md` y las pruebas paso a paso, en `PLAN_PRUEBAS_SIMULADOR.md`.

## ¿Necesito hardware?

No. El simulador solo necesita un puerto COM con un master al otro lado, y ese
puerto puede ser virtual.

| Forma de conectar | Qué necesitas | Cuándo usarla |
| --- | --- | --- |
| **Par COM virtual** (recomendada) | Un driver gratuito como com0com. Nada físico | Para trabajar en el día a día: el master de la app y el simulador se hablan dentro del mismo PC |
| JWPLC por USB | El JWPLC con el sketch `Simulador_Master_USB.ino` | Para ver un equipo real actuando como master, sin conversor |
| **Conversor USB-RS485** | Conversor, cable de par trenzado y un master real | Para probar en un bus RS-485 real. Ver [Más adelante: conversor USB-RS485](#más-adelante-conversor-usb-rs485) |

La Fase 3 agregará un modo interno que no necesitará ni siquiera el par COM
virtual.

## Inicio rápido (par COM virtual)

Instala el par COM virtual una sola vez (ver
[Instalar el par COM virtual](#instalar-el-par-com-virtual)). En este ejemplo,
el par es `COM10 <-> COM11`.

1. Abre la app con `npm run dev:electron`.
2. Vista **Simulador**:
   - Puerto `COM10`, 9600 baudios, 8 bits, paridad Ninguna, 1 bit de parada.
   - En "Dispositivos virtuales", deja la plantilla **Genérico**, Unit ID `1`, y
     pulsa **Agregar**.
   - Pulsa **Iniciar simulador**. La etiqueta de arriba cambia a "Escuchando en
     COM10".
3. Vista **Dispositivos**: puerto `COM11`, el mismo formato (9600 8N1), y pulsa
   **Conectar** y luego **Escanear**. Debe aparecer el ID 1.
4. Vista **Registros**: lee FC03 desde 40000. Cambia un valor en el Simulador y
   vuelve a leer: el master ve el valor nuevo.

Listo: el master y el simulador funcionan en la misma ventana, cada uno en su
puerto.

## La vista Simulador

La pantalla tiene cuatro tarjetas.

### Simulador slave (arriba a la izquierda)

- **Puerto y formato serial:** deben coincidir con los del master. Solo se
  pueden cambiar con el simulador detenido.
- **Iniciar / Detener simulador.** El simulador no puede usar el puerto que el
  master tiene abierto, ni al revés; la app avisa si lo intentas.
- **Contadores:**

| Contador | Qué cuenta |
| --- | --- |
| Peticiones | Todas las tramas recibidas |
| Respondidas | Respuestas normales enviadas |
| Excepciones | Respuestas de excepción (por dirección inválida o forzadas) |
| Ignoradas | Tramas para un ID que no existe en el simulador, o incompletas |
| Err. CRC | Tramas recibidas con CRC incorrecto |
| Fallas | Respuestas alteradas a propósito (ver [Simular fallas](#simular-fallas)) |

### Dispositivos virtuales (abajo a la izquierda)

- La **lista** muestra cada dispositivo con su ID, nombre, peticiones recibidas
  y la falla activa, si tiene. Haz clic en uno para ver su memoria; el ícono de
  papelera lo elimina.
- **Fallas de ID n:** panel del dispositivo seleccionado.
- **Agregar:** plantilla, Unit ID (1 a 247), nombre y tamaño de cada tabla (0 a
  9999 posiciones; 64 por defecto). Varios dispositivos pueden compartir el
  mismo puerto, cada uno con su ID.

### Memoria (arriba a la derecha)

Cuatro pestañas, una por tipo de dato:

| Pestaña | Funciones del master | Dirección que muestra la app |
| --- | --- | --- |
| Coils | FC01, FC05, FC15 | 0, 1, 2… |
| Entradas discretas | FC02 | 10000, 10001… |
| Holding registers | FC03, FC06, FC16 | 40000, 40001… |
| Input registers | FC04 | 30000, 30001… |

La columna **Offset** es la dirección real del protocolo (desde 0). Las
direcciones siguen la misma convención que las vistas del master.

- En coils y entradas, haz clic en **ON/OFF** para cambiar el valor.
- En registros, escribe un número de 0 a 65535 y pulsa Enter (Esc cancela).
- Los cambios se aplican al instante, y lo que escribe el master aparece solo.
- Las entradas discretas y los input registers solo los puede cambiar quien usa
  el simulador; para el master son de solo lectura.

### Tráfico del simulador (abajo a la derecha)

Cada fila es una trama recibida: hora, ID, función, petición y respuesta en
hexadecimal, resultado y falla aplicada. Guarda las últimas 500; **Limpiar** la
vacía.

| Resultado | Significado |
| --- | --- |
| Respondida | Respuesta normal |
| Excepción | Respuesta de excepción |
| Broadcast | Petición al ID 0: se aplica a todos, sin responder |
| Ignorada | No hay dispositivo con ese ID |
| Sin respuesta | El dispositivo tiene la falla "Sin respuesta" |
| Error CRC | La trama llegó con CRC incorrecto (ruido o formato serial distinto) |
| Trama inválida | Bytes que no forman una trama |

## Usar la plantilla JWPLC

La plantilla **JWPLC Basic Remote I/O** crea un dispositivo igual al JWPLC con
el firmware Remote I/O:

- Unit ID 2 y formato 115200 8N1.
- Coils Q0_0 a Q0_7 (salidas: FC01, FC05, FC15) y entradas I0_0 a I0_7 (FC02).
- Sin registros: si el master pide FC03, FC04, FC06 o FC16, recibe la excepción
  02, igual que con el equipo real.

Pasos:

1. En "Agregar", elige la plantilla **JWPLC Basic Remote I/O**. El Unit ID
   cambia solo a 2.
2. Si el simulador no está en 115200 8N1, aparece un aviso: pulsa **Usar ese
   formato** (con el simulador detenido).
3. Pulsa **Agregar**. Las tablas muestran los nombres Q0_x e I0_x.
4. Pon el master también en 115200 8N1.

Para probar planes que usan registros (como el plan por defecto de Pruebas),
usa un dispositivo **Genérico**.

## Simular fallas

En el panel **Fallas de ID n** del dispositivo seleccionado:

| Modo | Qué hace el simulador | Qué ve el master |
| --- | --- | --- |
| Ninguna | Responde normalmente | Respuesta correcta |
| Sin respuesta (timeout) | No contesta ni aplica escrituras | Timeout |
| CRC corrupto | Aplica la petición, pero altera el CRC de la respuesta | CRC Error |
| Excepción forzada | Responde la excepción elegida sin tocar la memoria | Excepción |

Códigos de excepción disponibles: 01 (función ilegal), 02 (dirección ilegal), 03
(valor ilegal) y 04 (falla del dispositivo).

El **retardo** (en ms) se suma antes de cada respuesta, con cualquier modo salvo
"Sin respuesta". Si es mayor que el timeout del master, este verá un timeout.
Sirve para probar cómo se comporta el master con un equipo lento.

## Escenarios en la vista Pruebas

La tarjeta **Simulador slave** de la vista Pruebas muestra el estado del
simulador y qué IDs del plan son virtuales. Con la casilla **Aplicar el
escenario a los slaves virtuales** activada, cada escenario aplica una falla a
los dispositivos virtuales que usa el plan:

| Escenario | Falla aplicada | Resultado esperado de los pasos |
| --- | --- | --- |
| Operación normal | Ninguna | Aprobado |
| Timeout detectado | Sin respuesta | Timeout |
| Error CRC detectado | CRC corrupto | CRC Error |
| Excepción Modbus | Excepción 02 | Excepcion |

Así puedes ejecutar el mismo plan y comprobar que el master detecta cada tipo de
error. Ten en cuenta:

- El escenario "Timeout detectado" apunta a otro ID del plan. Si ese ID no existe
  en el simulador, el master tampoco recibe respuesta: también es un timeout.
- Mientras la casilla está activada, el escenario manda sobre las fallas que
  pongas a mano en esos dispositivos. Al desactivarla, quedan en "Ninguna".
- Los escenarios personalizados no aplican ninguna falla.

## Guardar el simulador en la sesión

Al pulsar **Guardar** (barra superior), la sesión guarda también los
dispositivos virtuales (nombres, plantilla, valores y fallas) y el formato
serial del simulador. Al **Abrir** esa sesión se restauran, aunque el simulador
esté en marcha.

- Agregar, quitar o cambiar fallas de un dispositivo marca la sesión como
  "Modificada". Los cambios de valores no la marcan, pero sí se guardan.
- **Nuevo** no borra los dispositivos virtuales. Para empezar de cero,
  elimínalos desde la lista.
- En modo desarrollo (`npm run dev:electron`) la app no recuerda la
  configuración del simulador entre un arranque y otro. Guarda la sesión para
  conservarla.

## Instalar el par COM virtual

1. Descarga com0com e instala una **versión firmada** del driver; Windows 11
   puede bloquear drivers sin firma. Si Windows lo bloquea, cualquier otro
   emulador de par COM virtual sirve.
2. Crea un par de puertos, por ejemplo `COM10` y `COM11`, desde el programa de
   configuración de com0com. Lo que se escribe en uno se lee en el otro.
3. Comprueba en el Administrador de dispositivos que aparecen los dos.

com0com tiene licencia GPL, pero se usa como programa externo y no se copia su
código, así que no afecta la licencia de JW Modbus Tool.

## Más adelante: conversor USB-RS485

Esta parte queda para cuando tengas el conversor. Permite que el simulador
responda en un bus RS-485 real, como si fuera un equipo más.

### Montaje: un master real lee al simulador

```
[Master: JWPLC, PLC o HMI] --- A/B (par trenzado) --- [Conversor USB-RS485] --- USB --- [Laptop: vista Simulador]
```

1. **Driver:** conecta el conversor e instala su driver si Windows no lo
   reconoce (los más comunes usan chips CH340, FTDI o CP210x). Anota el COM que
   aparece en el Administrador de dispositivos.
2. **Cableado:** A del conversor con A del master, B con B y, si el conversor
   tiene GND, únelo a la masa del master. En un banco con cable corto no hace
   falta la resistencia de terminación de 120 Ω. Si no hay comunicación, prueba
   intercambiar A y B, porque algunos fabricantes los rotulan al revés.
3. **Simulador:** elige el COM del conversor y el mismo formato serial que el
   master (por ejemplo 115200 8N1 para el JWPLC Remote I/O). Agrega los
   dispositivos con los IDs que el master consulta e inicia el simulador.
4. **Master:** para el JWPLC hace falta un sketch master que use su RS-485.
   Está pendiente preparar `Simulador_Master_RS485.ino`, que hará lo mismo que
   `Simulador_Master_USB.ino` pero por el bus. Un PLC o HMI solo necesita
   apuntar a los IDs y direcciones del simulador.
5. **Comprobar:** el tráfico del simulador debe mostrar las peticiones como
   "Respondida" y el master debe leer los valores que pongas en la tabla.

**Bus mixto (equipos reales y virtuales juntos):** el simulador puede compartir
el bus con slaves reales. Usa IDs distintos para cada uno: si un ID existe en el
bus y en el simulador, los dos responden a la vez y las respuestas chocan. Las
respuestas de los slaves reales aparecen en el tráfico como "Ignorada".

**Eco del conversor:** algunos conversores devuelven por USB lo mismo que
transmiten. Si en el tráfico ves cada petición duplicada o respuestas que
aparecen como peticiones, el conversor tiene eco. Usa uno con control de
dirección automático sin eco. La supresión del eco en el simulador está
pendiente.

**El caso inverso (la app como master del JWPLC real)** ya funciona sin el
simulador: vista Dispositivos, COM del conversor, Conectar y Escanear (ver la
prueba C1 de `PLAN_PRUEBAS_SIMULADOR.md`).

## Problemas comunes

| Síntoma | Causa probable | Qué hacer |
| --- | --- | --- |
| "El puerto está ocupado por el simulador" o "abierto como master" | Master y simulador en el mismo COM | Usa un puerto distinto para cada uno (los dos extremos del par virtual) |
| El master da timeout y el tráfico del simulador está vacío | Simulador detenido, puertos que no son pareja o puertos cruzados | Comprueba "Escuchando en COMx" y que el master use el otro puerto del par |
| El tráfico muestra la petición como "Ignorada" | No hay dispositivo con ese ID | Agrega el ID o corrige el slave del master |
| Muchas filas "Error CRC" con funciones raras | Formato serial distinto entre master y simulador, o ruido | Iguala baud rate, bits, paridad y bits de parada |
| El master recibe excepción 02 | La dirección o cantidad pide más posiciones de las que tiene el dispositivo (o la plantilla JWPLC no tiene registros) | Aumenta el tamaño o usa un dispositivo Genérico |
| El COM virtual no aparece en la vista Dispositivos | La lista del master oculta puertos sin datos de fabricante | Pulsa recargar puertos; si sigue sin aparecer, anótalo para ajustar la lista |
| El dispositivo responde con un error que no configuraste | La casilla de escenarios de Pruebas le aplicó una falla | Revisa la tarjeta "Simulador slave" en Pruebas o desactiva la casilla |
| La app no abre ventana con `npm run dev:electron` | Falta el binario de Electron | Ejecuta `node node_modules/electron/install.js` |

## Limitaciones actuales

- Solo Modbus RTU y las funciones FC01 a FC06, FC15 y FC16.
- No emula el fail-safe del JWPLC (apagar salidas si pasa 1 s sin escrituras).
- No suprime el eco de conversores RS-485 que lo tienen.
- Aún no hay modo interno sin puerto COM (Fase 3).
