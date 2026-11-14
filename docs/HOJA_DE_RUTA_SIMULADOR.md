# Hoja de ruta: Simulador de Slaves Modbus RTU

Oct 7, 2026 · @Kenyi Reyes

JW Modbus Tool ya tiene la lógica que responde como slave Modbus RTU, probada con tests, pero todavía no está conectada al puerto serie ni a la interfaz. Proponemos completarla en 3 fases para emular dispositivos virtuales (por ejemplo, un JWPLC Basic) y así probar masters, HMIs y PLCs sin tener el equipo físico.

## Hoja de ruta

&#91;embedded content: hoja de ruta · 3 fases con criterio de cierre\]

Las fases van en orden y cada una empieza cuando la anterior cumple su criterio de cierre. En total se estiman entre 6 y 10 días de desarrollo.

## Estado actual

La base ya está hecha: el motor que arma las respuestas Modbus existe y lo cubren los tests. Falta todo lo que lo conecta con el mundo real. El panel "Simulador slave (PC como slave)" que hoy aparece en la vista Pruebas es solo una maqueta: cambia un texto, pero no abre ningún puerto.

| Pieza | Estado | Detalle |
| --- | --- | --- |
| Motor de respuestas slave | Hecho | FC1, FC2, FC3, FC4, FC5, FC6, FC15 y FC16, excepciones, broadcast y validación de CRC. Con tests. |
| Memoria del slave | Hecho | 64 coils, 64 entradas discretas, 64 holding registers y 64 input registers por slave. |
| Sesión de slave | Parcial | La clase existe, pero ninguna parte de la app la usa. Acepta un solo Unit ID. |
| Escucha del puerto COM en modo slave | Falta | El gestor serial actual solo trabaja como master (envía y espera respuesta) y maneja un único puerto. |
| Comunicación entre la interfaz y el proceso principal (IPC) | Falta | No hay comandos para iniciar o detener el simulador ni para editar sus valores. |
| Interfaz de dispositivos virtuales | Maqueta | El panel existe, pero sin funcionalidad. |
| Inyección de fallas (timeout, CRC, excepción) | Maqueta | La tarjeta "Escenarios" existe, pero sin funcionalidad. |

## Alcance

Un dispositivo virtual es un slave Modbus RTU que vive en el PC: escucha en un puerto COM y responde como lo haría un equipo real. Un solo puerto puede alojar varios dispositivos virtuales, cada uno con su propio Unit ID (1 a 247).

**Incluido**

- Escuchar un puerto COM con la configuración serial actual de la app: 9600 a 115200 baudios, 7 u 8 bits de datos, paridad y bits de parada.
- Responder FC1, FC2, FC3, FC4, FC5, FC6, FC15 y FC16, igual que el JWPLC Basic.
- Ver y editar en vivo los coils, las entradas discretas y los registros de cada dispositivo.
- Registrar cada petición recibida y cada respuesta enviada en el monitor de tráfico.
- Plantilla "JWPLC Basic Remote I/O": Unit ID 2, 115200 8N1, entradas I0\_0 a I0\_7 (FC2) y salidas Q0\_0 a Q0\_7 (FC1, FC5, FC15).
- Fallas configurables por dispositivo: retardo, no responder, CRC corrupto o excepción forzada.

**Fuera de alcance por ahora**

- Modbus TCP: está planificado para la versión 0.2 de la herramienta.
- Funciones fuera de las 8 listadas (por ejemplo FC23 o FC43).
- Usar el mismo puerto COM como master y como slave a la vez. Cada rol necesita su propio puerto.

## Fases y entregables

Cada fase deja algo usable y se cierra solo cuando cumple su criterio de cierre. El esfuerzo indicado es una estimación inicial de desarrollo y se confirmará al terminar la Fase 1.

### Fase 1: Slave virtual en un puerto COM (estimado: 3 a 5 días)

- [ ] Gestor serial en modo slave, independiente del master: abre su propio COM y escucha.
- [ ] Separación de tramas: por longitud según la función y, como respaldo, por el silencio de 3,5 caracteres que define RTU.
- [ ] Varios dispositivos en el mismo puerto: un mapa Unit ID → memoria.
- [ ] Comandos IPC: iniciar, detener, estado, leer y escribir valores, y eventos de tráfico.
- [ ] Vista "Simulador": crear y quitar dispositivos, tablas editables de coils y registros, log de peticiones.
- [ ] Tests automáticos del separador de tramas y del enrutamiento por Unit ID.

**Criterio de cierre:** un master externo lee y escribe las 8 funciones en 2 slaves virtuales (ID 1 y 2) sobre un par COM virtual, sin errores de CRC ni timeouts en 1.000 peticiones seguidas.

### Fase 2: Plantilla JWPLC y fallas (estimado: 2 a 3 días)

- [ ] Plantilla "JWPLC Basic Remote I/O" basada en el preset que ya usa el master.
- [ ] Fallas por dispositivo: retardo configurable, no responder, CRC corrupto y excepción forzada (01, 02, 03, 04).
- [ ] Conectar la tarjeta "Escenarios" de la vista Pruebas a estas fallas.
- [ ] Guardar y cargar la configuración de dispositivos virtuales junto con la sesión.

**Criterio de cierre:** la secuencia de validación JWPLC de la propia app da PASS contra el JWPLC virtual, y cada falla produce el resultado esperado (timeout, error de CRC o excepción).

### Fase 3: Modo interno sin hardware (estimado: 1 a 2 días)

- [ ] El master de la app habla con los slaves virtuales en memoria, sin puerto COM.
- [ ] Tests de extremo a extremo master ↔ slave que corren en `npm test`.

**Criterio de cierre:** demo completa en un PC sin adaptadores ni drivers adicionales, y los tests de extremo a extremo pasan.

## Arquitectura

&#91;embedded content: arquitectura del simulador · del puerto COM a la interfaz\]

Una petición entra por el COM, se separa en tramas, se envía al slave virtual con ese Unit ID y el motor que ya existe arma la respuesta. La interfaz controla todo por IPC, igual que hoy hace con el master.

## Pruebas

El simulador se puede validar sin comprar nada usando puertos COM virtuales. Los adaptadores RS-485 solo hacen falta para probar con el cableado real.

| Montaje | Qué se necesita | Para qué sirve |
| --- | --- | --- |
| Par COM virtual | Driver com0com instalado en el PC (por ejemplo COM10 ↔ COM11) | Desarrollo diario: el simulador escucha en un puerto y un master (otra instancia de la app u otra herramienta) usa el otro. |
| Dos adaptadores USB-RS485 | 2 adaptadores y un par trenzado A/B | Validar tiempos y comportamiento en un bus RS-485 real. |
| Bus mixto | Adaptador USB-RS485, un JWPLC real y el simulador | Probar un master con equipos reales y virtuales en el mismo bus, con Unit IDs distintos. |
| Modo interno (Fase 3) | Nada adicional | Demos y tests automáticos en cualquier PC. |

com0com tiene licencia GPL, pero se usa como driver externo y no se copia su código, así que no afecta la licencia MIT de JW Modbus Tool.

## Riesgos y decisiones pendientes

**Riesgos**

- **Tiempos a 115200 baudios en Windows:** los adaptadores USB entregan los datos en bloques, así que separar tramas solo por silencio puede fallar. Se mitiga separando primero por longitud según la función.
- **Puerto ocupado:** si el master y el simulador intentan abrir el mismo COM, el segundo falla. La interfaz debe avisarlo con claridad.
- **Mapa de direcciones:** la app muestra direcciones tipo 40000 y 30000, pero el protocolo usa direcciones desde 0. El simulador tiene que usar la misma conversión que el master para que los valores coincidan.

**Decisiones pendientes**

- [ ] ¿Qué equipos, además del JWPLC Basic, necesitan plantilla?
- [ ] ¿Alcanzan 64 posiciones por tipo de dato, o algún equipo necesita mapas más grandes?
- [ ] ¿Se aprueba instalar com0com en los PCs de prueba?
- [ ] ¿La Fase 3 (modo sin hardware) es necesaria ahora o puede esperar?
