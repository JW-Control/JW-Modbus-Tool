# JW Modbus Tool — Observaciones y propuestas de mejora para la sección **Pruebas**

## 1. Contexto

La sección **Pruebas** de JW Modbus Tool está orientada a ejecutar secuencias de comandos Modbus desde la PC hacia uno o varios esclavos para validar su comportamiento.

Actualmente la pantalla ya tiene una base sólida:

- Plan de pruebas secuencial.
- Soporte para múltiples esclavos.
- Diferentes funciones Modbus.
- Pasos de retardo.
- Validaciones.
- Timeout por paso.
- Ejecución única o en bucle.
- Métricas de ejecución.
- Registro detallado.
- Escenarios de prueba.
- Simulador slave.
- Preparación para pruebas de comunicaciones más avanzadas.

El principal problema detectado es la **edición de bobinas/salidas digitales** cuando se trabaja con múltiples bits.

Para un técnico resulta poco práctico tener que recordar o calcular manualmente la equivalencia entre una secuencia binaria de salidas y su representación decimal.

Ejemplo:

```text
DO1 = ON
DO2 = OFF
DO3 = ON
DO4 = ON
...
```

No debería obligar al usuario a convertir mentalmente esa secuencia a:

```text
13
```

La interfaz debe permitir trabajar directamente con el concepto industrial que el usuario está manipulando: **bobinas, entradas digitales, bits y canales**.

---

# 2. Criterio general de diseño

La recomendación principal es:

> **No colocar los 16 LEDs/bits permanentemente dentro de la tabla.**

Aunque 8 o 16 bits podrían entrar visualmente, esto haría que la tabla:

- Crezca demasiado horizontalmente.
- Se vea saturada.
- Pierda legibilidad en pantallas 1080p.
- Sea difícil de utilizar con ventanas reducidas.
- Termine heredando el principal problema visual de herramientas Modbus antiguas.

La tabla debe continuar siendo el **centro compacto del plan de pruebas**.

Los editores especializados deben aparecer de manera contextual.

---

# 3. Editor visual de bobinas

## 3.1 Concepto

Para funciones que trabajan con múltiples coils se recomienda implementar un **Coil/Bit Editor** desplegable.

Este editor puede abrirse mediante:

- Un botón dentro de la celda.
- Un icono tipo cuadrícula.
- Click sobre la previsualización binaria.

Ejemplo conceptual dentro de la tabla:

```text
Valor
┌──────────────────────────┐
│ 13   ●○●●○○○○   [▦]     │
└──────────────────────────┘
```

Donde:

- `13` = valor decimal resultante.
- `●○●●○○○○` = previsualización del patrón.
- `[▦]` = abrir editor visual completo.

En el caso de 16 bits se puede mostrar:

```text
●○●●○○○○ +8
```

o una mini representación de los 16 puntos si el ancho lo permite.

---

# 4. Diseño recomendado del editor visual

La distribución sugerida es:

- Hasta 8 bits: `8 × 1`.
- Hasta 16 bits: `8 × 2`.

Ejemplo:

```text
┌────────────────────────────────────────────────────┐
│ Patrón de bobinas                              ×   │
│                                                    │
│ Inicio 00001        16 bobinas        Ascendente → │
│                                                    │
│  00001 00002 00003 00004 00005 00006 00007 00008 │
│    ●     ○     ●     ●     ○     ○     ○     ○    │
│    1     0     1     1     0     0     0     0    │
│                                                    │
│  00009 00010 00011 00012 00013 00014 00015 00016 │
│    ○     ○     ●     ○     ○     ○     ○     ○    │
│    0     0     1     0     0     0     0     0    │
│                                                    │
│ [Todo ON] [Todo OFF] [Invertir]                    │
│                                                    │
│ DEC  523                  HEX 0x020B                │
│ BIN  0000 0010 0000 1011                           │
│                                                    │
│                             Cancelar   Aplicar      │
└────────────────────────────────────────────────────┘
```

---

# 5. Motivo para usar 8 × 2

Frente a una disposición horizontal de 16 bits:

```text
1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16
```

la disposición:

```text
1  2  3  4  5  6  7  8
9 10 11 12 13 14 15 16
```

tiene varias ventajas:

- Mejor uso del espacio.
- Compatible con 1080p.
- Targets de click más grandes.
- Más fácil de leer.
- Permite mostrar dirección y/o canal.
- Coincide visualmente con módulos de 8 y 16 E/S.
- Se adapta bien a futuros módulos JW de expansión.

---

# 6. Representación visual de los bits

No se recomienda imitar LEDs tridimensionales antiguos.

El estilo debería mantener el lenguaje visual actual de JW Modbus Tool.

Ejemplo:

```text
OFF → ○
ON  → ●
```

Características:

- Diseño plano.
- Hover sutil.
- Halo ligero en selección.
- Animación mínima.
- Área clickeable superior al diámetro visible.

Semántica de colores recomendada:

- **Cian/Azul:** interacción y selección.
- **Verde:** estado activo / correcto.
- **Amarillo:** advertencia.
- **Rojo:** error.
- **Gris:** deshabilitado / no aplicable.

---

# 7. No mostrar solamente `Bit 0 ... Bit 15`

Este punto es especialmente importante.

El usuario industrial normalmente piensa en:

```text
DO1
DO2
DO3
...
```

o:

```text
00001
00002
00003
...
```

y no en:

```text
Bit 0
Bit 1
Bit 2
...
```

Por ello el editor debería priorizar:

## Modo genérico Modbus

```text
00001
00002
00003
00004
...
```

## Modo dispositivo/perfil conocido

```text
DO1
DO2
DO3
DO4
...
```

La equivalencia binaria puede mantenerse visible como información secundaria.

---

# 8. Alias de canales en el futuro

Si JW Modbus Tool incorpora perfiles de dispositivos, podría permitirse asociar alias:

```text
DO1 — Motor
DO2 — Válvula
DO3 — Piloto verde
DO4 — Buzzer
```

Visualmente:

```text
DO1        DO2        DO3        DO4
Motor      Válvula    Piloto     Buzzer
 ●           ○          ●          ○
```

Esto convertiría la herramienta en algo mucho más útil que un Modbus Master genérico.

---

# 9. Comportamiento por función Modbus

La interfaz debe adaptarse según la función seleccionada.

---

## 9.1 FC05 — Write Single Coil

No debería pedirse un valor decimal.

La interfaz recomendada es:

```text
Estado
[ OFF | ON ]
```

o un switch.

Internamente puede traducirse a:

```text
0x0000
0xFF00
```

pero el usuario no necesita verlo salvo en una vista técnica.

---

## 9.2 FC15 — Write Multiple Coils

La celda `Valor` debería convertirse en:

```text
[ patrón binario ] [abrir editor]
```

Ejemplo:

```text
●○●●○○○○  [▦]
```

El editor visual permite modificar los bits.

---

## 9.3 FC01 — Read Coils

Si la validación es:

```text
Valor exacto
```

la columna `Esperado` debería utilizar el mismo Bit Editor.

Ejemplo:

```text
Esperado
●○●●○○○○ [▦]
```

---

## 9.4 FC02 — Read Discrete Inputs

Debe reutilizar exactamente el mismo componente de bits.

Esto reduce:

- Código duplicado.
- Inconsistencias visuales.
- Errores.
- Curva de aprendizaje.

---

# 10. Validaciones avanzadas para bits

La sección `Validación` podría evolucionar hacia:

```text
Respuesta OK
Valor exacto
Todos ON
Todos OFF
Contiene ON
Contiene OFF
Máscara
Cambió respecto a ejecución anterior
Sin cambio
```

---

# 11. Validación mediante máscara

Una futura función especialmente útil para pruebas automatizadas sería la validación por máscara.

Ejemplo:

```text
Valor esperado:
0 1 1 0 1 1 0 0

Máscara:
1 1 1 1 1 1 0 0
```

Visualmente podría representarse:

```text
○ ● ● ○ ● ● X X
```

Donde:

```text
X = no importa
```

Esto permitiría validar únicamente los bits relevantes.

---

# 12. DEC / HEX / BIN

El editor debería mostrar siempre la equivalencia entre representaciones:

```text
DEC  523
HEX  0x020B
BIN  0000 0010 0000 1011
```

Esto también debe reutilizarse para registros Modbus.

---

# 13. Editor de registros

Para FC03, FC04, FC06 y FC16 se recomienda permitir visualizar/escribir valores en:

```text
DEC
HEX
BIN
```

Ejemplo:

```text
DEC 4660
HEX 0x1234
BIN 0001 0010 0011 0100
```

Esto es especialmente útil para:

- Status words.
- Alarm words.
- Flags.
- Máscaras.
- Registros de configuración.
- Diagnóstico industrial.

---

# 14. Tabla contextual

Actualmente la tabla contiene aproximadamente:

```text
Slave
Función
Dirección
Cantidad
Valor
Validación
Esperado
Timeout
Resultado
```

La recomendación es conservar la estructura general, pero hacer que el contenido sea **contextual**.

---

## FC05

```text
Slave
Función
Dirección
Estado
Validación
Timeout
Resultado
```

---

## FC15

```text
Slave
Función
Dirección inicial
Cantidad
Patrón
Validación
Timeout
Resultado
```

---

## FC03

```text
Slave
Función
Dirección
Cantidad
Validación
Esperado
Timeout
Resultado
```

No es necesario eliminar físicamente columnas dinámicamente si eso complica demasiado la implementación.

Se puede simplemente modificar:

- Editor.
- Placeholder.
- Etiqueta.
- Estado habilitado/deshabilitado.

---

# 15. Tratamiento de campos no aplicables

La lógica actual donde un `Retardo` muestra `-` en campos irrelevantes es correcta.

Se recomienda extender este comportamiento.

Ejemplos:

- Dirección deshabilitada cuando no aplica.
- Cantidad deshabilitada en FC05.
- Valor deshabilitado en lecturas.
- Esperado deshabilitado si `Validación = Respuesta OK`.
- Timeout mantenido únicamente cuando tiene sentido.

Esto evita confusión.

---

# 16. Clasificación de funciones Modbus

Dentro del selector `Función`, se recomienda dividir visualmente las opciones.

Ejemplo:

```text
LECTURA
↓ FC01 Read Coils
↓ FC02 Read Discrete Inputs
↓ FC03 Read Holding Registers
↓ FC04 Read Input Registers

ESCRITURA
↑ FC05 Write Single Coil
↑ FC06 Write Single Register
↑ FC15 Write Multiple Coils
↑ FC16 Write Multiple Registers

CONTROL
◷ Retardo
```

Beneficios:

- Localización más rápida.
- Menos errores.
- Mejor jerarquía visual.
- Escalable a futuras funciones.

---

# 17. Ejecutar un solo paso

Cada fila debería permitir:

```text
▶ Ejecutar este paso
```

Puede aparecer:

- Al hacer hover.
- En un menú contextual.
- En una columna de acciones.

Esto es especialmente importante durante:

- Desarrollo.
- Debug.
- Puesta en marcha.
- Ajuste de parámetros.
- Validación de un único comando.

---

# 18. Acciones por fila

Se recomienda incorporar un menú contextual:

```text
▶ Ejecutar paso
⧉ Duplicar paso
↑ Insertar antes
↓ Insertar después
▶ Ejecutar desde aquí
✕ Eliminar
```

Estas acciones serían muy útiles en planes largos.

---

# 19. Duplicar paso

Esta función debería tener prioridad alta.

En Modbus es frecuente repetir:

- FC05 con distinta dirección.
- FC06 con distinto valor.
- Lectura + validación.
- Secuencias similares entre esclavos.

Duplicar permite modificar únicamente el campo necesario.

---

# 20. Reordenamiento mediante Drag & Drop

Añadir un grip:

```text
⠿
```

Ejemplo:

```text
☑ ⠿ 1
☑ ⠿ 2
☑ ⠿ 3
```

Permitir arrastrar las filas para cambiar el orden de ejecución.

Esto se vuelve esencial cuando existan planes de:

- 20 pasos.
- 50 pasos.
- 100 pasos o más.

---

# 21. Separar acciones de edición y ejecución

Actualmente acciones como:

```text
Iniciar prueba
Iniciar en bucle
Detener
Agregar paso
Guardar plan
```

están visualmente próximas.

Se recomienda separar conceptualmente:

## Edición

```text
+ Agregar paso
Guardar plan
Importar
```

## Ejecución

```text
▶ Iniciar prueba
↻ Iniciar en bucle
■ Detener
```

Una posible distribución:

```text
[+ Agregar paso] [Guardar plan]        [▶ Iniciar] [↻ Bucle] [■ Detener]
```

Esto mejora la jerarquía de acciones.

---

# 22. Opciones de ejecución

Se recomienda incorporar parámetros generales:

```text
Detener ante error       Sí / No
Repeticiones             1 / N / ∞
Intervalo entre ciclos   X ms
Iniciar desde paso       N
```

Especialmente importante:

```text
☑ Detener ante error
```

---

# 23. Dirección Modbus: referencias vs offset

Este es uno de los puntos más importantes de UX.

En Modbus existe frecuentemente la confusión:

```text
40001
```

versus:

```text
offset = 0
```

La herramienta debería soportar explícitamente ambos.

Ejemplo:

```text
Dirección
40001

Holding Register
Offset PDU: 0
```

o:

```text
40001 ⇄ 0
```

---

# 24. Preferencia de formato de dirección

Agregar una preferencia global:

```text
Formato de dirección:

● Referencia Modbus
  00001 / 10001 / 30001 / 40001

○ Offset PDU
  0-based
```

Idealmente el campo debería aceptar ambos formatos.

Esto puede evitar una gran cantidad de falsos errores durante pruebas.

---

# 25. Validación automática de rango

JW Modbus Tool debería validar:

- Dirección mínima.
- Dirección máxima.
- Cantidad máxima permitida.
- Overflow de rango.

Ejemplo:

```text
Dirección inicial: 00010
Cantidad: 16
Rango resultante: 00010–00025
```

En caso inválido:

```text
⚠ El rango excede el espacio permitido
```

---

# 26. Resumen de rango

Cuando el usuario trabaje con múltiples coils/registers sería útil mostrar:

```text
00001 → 00016
```

o:

```text
40001 → 40008
```

Esto reduce errores visuales.

---

# 27. Métricas de ejecución

Actualmente se muestran:

- Tasa de éxito.
- Latencia promedio.
- Errores.
- Pasos completados.

La estructura es buena.

---

# 28. Mejorar métrica de latencia

Mostrar solamente:

```text
Latencia promedio
```

puede ocultar problemas intermitentes.

Se recomienda mostrar:

```text
Promedio
Máximo
```

Ejemplo:

```text
LATENCIA

Prom. 12 ms
Máx. 48 ms
```

En futuras versiones:

```text
Prom. 12 ms
P95 21 ms
Máx. 48 ms
```

---

# 29. Tarjeta de errores interactiva

La tarjeta:

```text
ERRORES
0
```

podría ser clickeable.

Al hacer click:

- Filtrar únicamente errores.
- Llevar al registro de ejecución.
- Resaltar filas fallidas.

---

# 30. Pasos completados

El indicador:

```text
0 / 8
```

es correcto.

Podría evolucionar a:

```text
7 / 8
Paso actual: 5
```

durante ejecución.

---

# 31. Registro de ejecución

La tabla inferior ya es una buena base.

Columnas actuales:

```text
Hora
Paso
Slave
Función
Dirección
Cantidad/Valor
Resultado
Tiempo
Detalle
Info
```

Se recomienda convertirla en una herramienta de diagnóstico interactiva.

---

# 32. Click en una ejecución

Al seleccionar una entrada del registro:

1. Seleccionar el paso correspondiente arriba.
2. Mostrar TX.
3. Mostrar RX.
4. Decodificar la trama.
5. Mostrar CRC.
6. Mostrar tiempo.
7. Mostrar error/exception si existe.

---

# 33. Visualización TX/RX

Ejemplo:

```text
TX
01 0F 00 00 00 08 01 0D XX XX

RX
01 0F 00 00 00 08 XX XX
```

---

# 34. Decodificación humana

Debajo:

```text
Slave:      1
Función:    FC15 Write Multiple Coils
Inicio:     00001
Cantidad:   8
Valor:      ● ○ ● ● ○ ○ ○ ○
CRC:        OK
Tiempo:     8.4 ms
```

Esto puede integrarse muy bien con la sección existente:

```text
Tráfico Modbus
```

---

# 35. Relación con "Tráfico Modbus"

La sección **Pruebas** y la sección **Tráfico Modbus** deberían estar conectadas.

Idealmente:

- Una ejecución en Pruebas genera una entrada en Tráfico.
- Click desde Pruebas abre la trama correspondiente.
- Click desde Tráfico puede indicar qué paso originó la trama.

Esto genera continuidad entre:

```text
PLAN DE PRUEBA
↓
TRAMA
↓
RESPUESTA
↓
RESULTADO
```

---

# 36. Panel derecho

Actualmente el panel derecho contiene:

- Escenarios.
- Simulador slave.

El contenido es útil, pero consume bastante ancho.

Se recomienda convertirlo en:

> **Panel lateral colapsable**

Ejemplo:

```text
[◀]
Escenarios
...
Simulador slave
...
```

Colapsado:

```text
[▶]
```

---

# 37. Comportamiento responsive del panel derecho

En pantallas grandes:

```text
Panel abierto
```

En 1080p:

```text
Panel colapsado por defecto
```

o reducido a tabs/iconos.

La tabla de pruebas debe conservar prioridad visual.

---

# 38. Responsive general

La interfaz debería adaptarse a:

- 4K.
- 1440p.
- 1080p.
- Ventana parcialmente reducida.

Prioridad:

1. Tabla de pruebas.
2. Controles de ejecución.
3. Métricas.
4. Registro.
5. Paneles secundarios.

---

# 39. Posible comportamiento según ancho

## Pantalla amplia

```text
Sidebar | Tabla | Panel derecho
```

## Pantalla media

```text
Sidebar compacta | Tabla | Panel derecho colapsado
```

## Pantalla estrecha

```text
Sidebar colapsable
Tabla
Panel derecho mediante drawer
```

---

# 40. Escenarios

La idea de escenarios:

- Operación normal.
- Timeout.
- CRC.
- Exception Modbus.

es muy buena.

Se recomienda mantenerla.

Podría evolucionar a presets como:

```text
Operación normal
Timeout aleatorio
Timeout permanente
CRC inválido
Exception 01
Exception 02
Exception 03
Retardo artificial
Respuesta intermitente
Slave offline
```

---

# 41. Escenarios configurables

El botón:

```text
Gestionar escenarios
```

puede permitir:

```text
Nombre
Tipo
Probabilidad
Parámetros
Activo
```

Ejemplo:

```text
Timeout aleatorio
Probabilidad: 20 %
```

Esto sería útil para pruebas de robustez.

---

# 42. Simulador Slave

La presencia del simulador directamente en JW Modbus Tool es una ventaja fuerte.

A futuro puede permitir:

```text
Mapa de coils
Mapa de discrete inputs
Mapa de holding registers
Mapa de input registers
```

con el mismo editor de bits.

---

# 43. Reutilización del Bit Editor

El componente visual de bits debe diseñarse como un control reusable.

Podría usarse en:

- FC01.
- FC02.
- FC05.
- FC15.
- Simulador slave.
- Tráfico Modbus.
- Registro de ejecución.
- Vista de variables.
- Perfiles de dispositivos.
- Diagnóstico.

Esto justifica construirlo correctamente desde el inicio.

---

# 44. Perfil de dispositivos JW

Una evolución especialmente interesante es incorporar perfiles.

Ejemplo:

```text
Dispositivo:
JW 16DO Relay
```

Entonces la herramienta ya conoce:

```text
Slave ID
Mapa Modbus
Cantidad de canales
Tipo de registros
Alias
Rangos válidos
```

y puede reemplazar:

```text
00001
00002
...
```

por:

```text
DO1
DO2
...
DO16
```

---

# 45. Vista genérica vs vista por dispositivo

Se recomienda permitir:

```text
Vista:
[ Modbus ] [ Dispositivo ]
```

## Vista Modbus

```text
00001
00002
00003
```

## Vista Dispositivo

```text
DO1
DO2
DO3
```

Esto mantiene compatibilidad con cualquier equipo y mejora muchísimo la experiencia con productos JW.

---

# 46. Estados y feedback de ejecución

Cada fila debería utilizar estados claros:

```text
Pendiente
Ejecutando
OK
Error
Timeout
Omitido
Detenido
```

Visualmente:

- Spinner pequeño durante ejecución.
- Check verde al pasar.
- Advertencia amarilla en timeout.
- Error rojo en fallo.
- Gris si está deshabilitado.

---

# 47. Resaltar paso actual

Durante la ejecución:

```text
→ Paso 4
```

la fila activa debería tener una iluminación sutil.

No un fondo muy brillante.

Una línea lateral cian o borde activo sería suficiente.

---

# 48. Scroll automático

Durante una prueba larga:

- La tabla debería mantener visible el paso activo.
- El registro podría hacer autoscroll opcional.

Agregar:

```text
☑ Seguir ejecución
```

para permitir que el usuario desactive el autoscroll si quiere inspeccionar resultados anteriores.

---

# 49. Tooltips técnicos

Campos como:

```text
Cantidad
Timeout
Dirección
Validación
```

podrían incluir tooltip.

Ejemplo:

```text
Timeout
Tiempo máximo esperado para recibir respuesta antes de considerar el paso fallido.
```

Especialmente útil para usuarios nuevos.

---

# 50. Evitar sobrecargar la pantalla

No deben estar visibles permanentemente:

- DEC + HEX + BIN.
- Los 16 bits.
- TX/RX completos.
- Configuración avanzada.
- Máscaras.
- Interpretación PDU.

Toda esa información debe existir, pero aparecer bajo demanda mediante:

- Popover.
- Drawer.
- Tooltip.
- Panel de detalle.
- Expand/collapse.

Principio:

> **Vista simple por defecto; detalle técnico disponible inmediatamente.**

---

# 51. Jerarquía visual recomendada

La pantalla debería leerse así:

```text
1. Plan de pruebas
2. Controles de ejecución
3. Estado/métricas
4. Registro
5. Herramientas auxiliares
```

La tabla siempre debe conservar el protagonismo.

---

# 52. Mejoras de nomenclatura

Revisar consistencia entre términos:

```text
Slave
Esclavo
Dirección slave
ID
```

Recomendación:

Elegir una convención principal.

Ejemplo:

```text
Slave ID
```

porque es el término técnico común de Modbus.

O:

```text
ID de esclavo
```

si se busca español completo.

Evitar alternar ambos dentro de una misma pantalla.

---

# 53. Consistencia de funciones

También conviene definir una convención:

```text
FC06 — Write Single Register
```

o:

```text
FC06 — Escribir registro
```

No mezclar traducciones distintas entre paneles.

Una opción muy buena para software técnico:

```text
FC06 · Write Single Register
```

manteniendo el nombre oficial Modbus.

---

# 54. Mostrar códigos de excepción

Cuando exista una exception Modbus:

```text
Exception 02
```

debería mostrarse además:

```text
Illegal Data Address
```

Ejemplo:

```text
EX02 · Illegal Data Address
```

Esto evita que el usuario tenga que memorizar códigos.

---

# 55. Timeout y errores diferenciados

No mostrar todos simplemente como:

```text
Error
```

Diferenciar:

```text
Timeout
CRC Error
Exception
Port Error
Disconnected
Invalid Response
Mismatch
```

Esto mejora muchísimo el diagnóstico.

---

# 56. Guardado del plan

El plan debería conservar:

- Pasos.
- Orden.
- Estado activo/inactivo.
- Funciones.
- Direcciones.
- Valores.
- Bits.
- Validaciones.
- Timeout.
- Configuración de ejecución.
- Escenarios vinculados.

Idealmente como formato propio versionado.

---

# 57. Compatibilidad futura

Preparar el modelo de datos para que soporte:

```text
RTU
TCP
RTU over TCP
```

sin que la lógica del plan dependa directamente del transporte.

La secuencia de prueba debería ser independiente de:

```text
COMx
IP:Puerto
```

---

# 58. Preparación para Modbus TCP

Cuando se incorpore TCP:

- El plan no debería cambiar.
- Solo cambia la conexión.
- Slave ID puede seguir existiendo como Unit ID.
- El registro de ejecución debe mostrar transporte.

Ejemplo:

```text
RTU · COM5 · 115200
TCP · 192.168.1.40:502
```

---

# 59. Posible inspector lateral de paso

Para no llenar demasiado la tabla, una alternativa futura es:

```text
Click en fila
→ inspector lateral
```

El inspector puede mostrar:

```text
Función
Dirección
Cantidad
Valor
DEC/HEX/BIN
Bits
Validación
Timeout
Notas
```

La tabla se mantiene compacta y el editor avanzado aparece al seleccionar.

No es obligatorio para la primera implementación.

---

# 60. Prioridad de implementación

## Prioridad alta — próxima iteración

1. Bit/Coil Editor.
2. FC05 con ON/OFF.
3. FC15 con patrón visual.
4. Reutilizar editor en FC01/FC02.
5. DEC / HEX / BIN.
6. Ejecutar paso individual.
7. Duplicar paso.
8. Reordenamiento.
9. Detener ante error.
10. Panel derecho colapsable.
11. Soporte explícito 40001 ↔ offset.
12. Estados de resultado más claros.

---

## Prioridad media

1. Máscaras.
2. Modo exacto / todos ON / todos OFF.
3. TX/RX desde registro.
4. Decodificación de trama.
5. Métricas Prom/Max/P95.
6. Click en errores.
7. Autoscroll configurable.
8. Menú contextual por fila.
9. Filtro del registro.
10. Alias de canales.

---

## Prioridad futura

1. Perfiles de dispositivos JW.
2. Vista Modbus / Dispositivo.
3. Escenarios con probabilidad.
4. Inspector avanzado.
5. Modbus TCP.
6. Diagnóstico estadístico.
7. Plantillas de test por dispositivo.
8. Reporte automático de validación.
9. Exportación de resultados.
10. Integración con producción / QA.

---

# 61. Objetivo de UX final

JW Modbus Tool debería permitir que un usuario piense:

```text
"Quiero activar DO1, DO3 y DO4."
```

y no:

```text
"¿Qué decimal corresponde a 00001101?"
```

También debería permitir pensar:

```text
"Quiero comprobar que DO1, DO3 y DO4 estén activos."
```

sin obligarlo a interpretar manualmente un número.

La herramienta debe encargarse de la conversión:

```text
Canales
↓
Bits
↓
Bytes
↓
PDU Modbus
↓
Trama
```

mientras que la interfaz presenta la información en la forma más útil para una persona.

---

# 62. Dirección visual general

JW Modbus Tool ya tiene una base moderna y consistente.

La evolución recomendada no es agregar más información permanentemente, sino:

> **hacer la interfaz más contextual, más inteligente y más especializada en diagnóstico industrial.**

Principios recomendados:

- Tabla compacta.
- Editores contextuales.
- Información avanzada bajo demanda.
- Estados claros.
- Acciones rápidas.
- Buena compatibilidad 1080p / 4K.
- Terminología Modbus correcta.
- Integración progresiva con dispositivos JW.
- Reutilización de componentes.
- Separación entre edición, ejecución y diagnóstico.

---

# 63. Resultado esperado

Con estas mejoras, la sección **Pruebas** dejaría de comportarse como un simple editor de comandos Modbus y evolucionaría hacia una herramienta de:

- Validación funcional.
- Debug.
- Puesta en marcha.
- QA.
- Producción.
- Pruebas de robustez.
- Diagnóstico de comunicaciones.
- Automatización de test.

Ese enfoque puede diferenciar claramente a **JW Modbus Tool** frente a herramientas Modbus tradicionales que se limitan principalmente a leer y escribir registros manualmente.
