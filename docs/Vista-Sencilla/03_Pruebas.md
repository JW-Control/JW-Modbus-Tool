# Vista Sencilla - 03 Pruebas

Estado: **MVP funcional integrado en React**  
Fecha: 2026-07-10  
Rama base: `feature/simple-mode-mvp`  
Rama de estabilizacion: `codex/stabilize-tests-view`

---

## Objetivo

La vista **Pruebas** permite validar un slave Modbus desde la PC actuando como
**Master**.

La pantalla permite construir y ejecutar un plan de pasos Modbus contra uno o
varios slaves, revisar KPIs de ejecucion, ver un registro de resultados y
seleccionar/editar escenarios de prueba.

---

## Integracion actual

La vista esta implementada como componente React nativo en:

```text
src/renderer/simple-tests-consolidated.tsx
```

Se renderiza desde:

```text
src/renderer/SimpleModeApp.tsx
```

Ya no se usa overlay, segundo root de React, `document.querySelector`,
`setTimeout` para imports diferidos, `setInterval`, `localStorage` ni variables
globales `window.__jw...` para coordinar el estado visual.

---

## Funciones Modbus cubiertas

| FC | Nombre | Tipo | Uso |
|---|---|---|---|
| FC01 | Read Coils | Lectura | Leer coils/salidas logicas |
| FC02 | Read Discrete Inputs | Lectura | Leer entradas discretas |
| FC03 | Read Holding Registers | Lectura | Leer registros holding |
| FC04 | Read Input Registers | Lectura | Leer registros de entrada |
| FC05 | Write Single Coil | Escritura | Escribir una coil ON/OFF |
| FC06 | Write Single Register | Escritura | Escribir un registro |
| FC15 | Write Multiple Coils | Escritura | Escribir varias coils |
| FC16 | Write Multiple Registers | Escritura | Escribir varios registros |

El desplegable de funcion debe mantenerse ordenado por codigo:
FC01, FC02, FC03, FC04, FC05, FC06, FC15, FC16.

---

## Tabla del plan

Columnas esperadas:

- Activo
- Paso
- Slave
- Funcion
- Direccion
- Cantidad
- Valor
- Validacion
- Esperado
- Timeout
- Resultado
- Accion eliminar

Decisiones vigentes:

- `Slave` es un input de texto numerico validado, no spinbox.
- `Cantidad` y `Valor` estan separados para evitar ambiguedad.
- En lecturas, `Cantidad` esta activo y `Valor` queda inactivo.
- En FC05/FC06, `Valor` esta activo y la cantidad es implicita.
- En FC15/FC16, la cantidad se calcula desde la lista de valores.
- La columna `Validacion` define el criterio principal.
- `Esperado` solo queda editable cuando el modo de validacion lo requiere.

---

## Modos de validacion

- `Respuesta OK`: valida respuesta Modbus correcta.
- `Cantidad solicitada`: valida que llegue la cantidad pedida.
- `Valores exactos`: compara una secuencia de valores.
- `Por direccion`: compara pares explicitos `direccion=valor`.

Ejemplos validos:

```text
4096,4097,4098
ON,OFF,ON
1,0,1
40000=4096,40001=4097
0=ON,1=OFF
```

Un paso aprueba solo si la comunicacion fue OK, no hubo timeout/excepcion/CRC
error y el criterio de validacion se cumple.

---

## Persistencia

La configuracion durable de Pruebas se guarda dentro del archivo
`.jwmodbus-session` como `testsRuntime`.

Se guarda:

- plan de pasos;
- escenarios;
- escenario seleccionado;
- estado del panel de simulador;
- slave, funcion, direccion, cantidad, valor, validacion, esperado y timeout.

No se guardan resultados como estado de arranque. Al abrir una sesion o crear
una nueva, los pasos se muestran en `Pendiente` hasta que el usuario presiona
**Iniciar prueba**.

---

## Registro de ejecucion

Columnas:

```text
Hora | Paso | Slave | Funcion | Direccion | Cantidad/Valor | Resultado | Tiempo | Detalle
```

Resultados posibles:

- `Pendiente`
- `Aprobado`
- `Error`
- `Timeout`
- `CRC Error`
- `Excepcion`
- `Validacion fallida`

La accion de detalle debe abrirse dentro de la misma zona inferior de la vista,
sin modal flotante.

---

## Escenarios

Escenarios iniciales:

- Operacion normal.
- Timeout detectado.
- Error CRC detectado.
- Excepcion Modbus.

Los escenarios personalizados se guardan dentro de `testsRuntime.scenarios`.

---

## Simulador slave

El panel `Simulador slave (PC como slave)` queda preparado a nivel UI.

La emulacion real del slave queda pendiente para una etapa posterior.

---

## Pendiente funcional

1. Confirmar escrituras por lectura posterior opcional.
2. Conectar el simulador slave a un motor real.
3. Integrar trazas completas con `Trafico Modbus`.
4. Importar/exportar escenarios reutilizables.
5. Agregar plantillas por modelo de equipo cuando exista mapa de registros.
