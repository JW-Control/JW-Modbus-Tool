# JW Modbus Tool — Diseño detallado del editor de valores numéricos
## FC03 / FC04 / FC06 / FC16 — Enteros, Hexadecimal, Binario y Float

**Documento de diseño UX/UI + comportamiento funcional**

---

## 1. Objetivo

Extender la experiencia ya implementada para edición visual de bobinas hacia los datos basados en registros Modbus.

Actualmente el editor de bobinas resuelve correctamente el problema de representar estados binarios mediante una interfaz visual compacta. La siguiente evolución debe resolver de forma equivalente los valores numéricos utilizados por:

- `FC03 — Read Holding Registers`
- `FC04 — Read Input Registers`
- `FC06 — Write Single Register`
- `FC16 — Write Multiple Registers`

La interfaz debe permitir trabajar cómodamente con enteros sin signo, enteros con signo, hexadecimal, binario, Float32, valores múltiples y diferentes órdenes de palabras/bytes cuando aplique.

El objetivo principal es que el usuario no tenga que realizar conversiones manuales entre representaciones ni calcular cómo se distribuye un valor compuesto entre registros Modbus.

---

## 2. Principio UX general

Se mantiene el mismo patrón adoptado para el editor de bobinas:

> **Tabla compacta + editor contextual especializado.**

La tabla principal debe seguir siendo fácil de leer. La información avanzada debe aparecer al hacer click sobre el valor, el indicador de tipo o el botón de edición.

La tabla **no** debe mostrar permanentemente decimal, hexadecimal, binario, float, word order, byte order ni registros internos. Todo ello debe estar disponible en el editor desplegable.

---

## 3. Arquitectura conceptual de editores

Se recomienda separar los editores en dos componentes principales.

### 3.1 `BitPatternEditor`

Ya implementado/contemplado para:

- FC01.
- FC02.
- FC05.
- FC15.
- Validaciones digitales.
- Simulador de coils/discrete inputs.

### 3.2 `RegisterValueEditor`

Nuevo componente reusable para:

- FC03 — valores esperados.
- FC04 — valores esperados.
- FC06 — valor de escritura.
- FC16 — valores de escritura.
- Simulador de Holding Registers.
- Simulador de Input Registers.
- Vista de registros.
- Inspectores de trama.

---

## 4. Regla técnica fundamental: FC06 vs FC16

### FC06 — Write Single Register

FC06 solamente escribe:

```text
1 registro = 16 bits
```

Por lo tanto se debe permitir de forma nativa:

```text
UInt16
Int16
Hex16
Bin16
```

No se debe permitir `Float32` directamente porque:

```text
Float32 = 32 bits = 2 registros Modbus
```

Si el usuario intenta seleccionar Float32 en FC06, la interfaz debe explicar:

```text
⚠ Float32 requiere 2 registros.
Use FC16 (Write Multiple Registers).
```

### FC16 — Write Multiple Registers

FC16 permite trabajar con múltiples registros de 16 bits.

Esto habilita:

```text
UInt16[]
Int16[]
Hex16[]
Bin16[]
Float32
UInt32
Int32
```

Para primera versión se recomienda implementar:

```text
UInt16
Int16
Hex16
Bin16
Float32
```

Los tipos de 32 bits adicionales pueden incorporarse después.

---

## 5. Diseño del editor para FC06

### 5.1 Vista general

Popover recomendado:

```text
┌──────────────────────────────────────────────┐
│ Editar valor                            [×] │
│ FC06 · Write Single Register                 │
│                                              │
│ Dirección: 40001 (offset 0)                  │
│                                              │
│ Tipo de dato                                 │
│ [ UInt16 ▼ ]                                 │
│                                              │
│ Valor                                        │
│ [ 1234                                 ]     │
│                                              │
│ Representaciones equivalentes                │
│                                              │
│ DEC uint16      1234                         │
│ DEC int16       1234                         │
│ HEX             0x04D2                       │
│ BIN             0000 0100 1101 0010          │
│                                              │
│ [Cancelar]                         [Aplicar] │
└──────────────────────────────────────────────┘
```

### 5.2 Tipos permitidos

```text
UInt16
Int16
Hex16
Bin16
```

Tooltips sugeridos:

```text
UInt16 — Entero sin signo de 16 bits
Int16  — Entero con signo de 16 bits
Hex16  — Hexadecimal de 16 bits
Bin16  — Binario de 16 bits
```

### 5.3 Rangos válidos

**UInt16**

```text
0 ... 65535
```

**Int16**

```text
-32768 ... 32767
```

**Hex16**

```text
0x0000 ... 0xFFFF
```

**Bin16**

```text
0000 0000 0000 0000
...
1111 1111 1111 1111
```

La interfaz debe validar el rango en tiempo real.

---

## 6. Conversión automática FC06

Todas las representaciones deben sincronizarse.

Ejemplo:

```text
Entrada:
-100
```

Debe mostrar:

```text
Int16   -100
UInt16  65436
HEX     0xFF9C
BIN     1111 1111 1001 1100
```

Solo una representación debe ser considerada la fuente editable activa.

Ejemplo:

```text
Tipo seleccionado: HEX
```

Entonces:

```text
Campo editable:
0x04D2
```

y el resto se calcula automáticamente.

Esto evita inconsistencias.

---

## 7. Representación compacta en la tabla

FC06 debería mostrar un resumen compacto.

Ejemplos:

```text
1234      [UINT16] ✎
-100      [INT16]  ✎
0xFF9C    [HEX]    ✎
1111111110011100 [BIN] ✎
```

El tipo puede aparecer como badge pequeño.

Al hacer hover sobre el valor:

```text
UInt16: 65436
Int16:  -100
HEX:    0xFF9C
BIN:    1111 1111 1001 1100
```

Esto evita abrir el popover para consultas rápidas.

---

## 8. Acciones rápidas FC06

Opciones útiles:

```text
Cero
Máximo
Mínimo
```

Comportamiento según tipo:

**UInt16**

```text
Cero    = 0
Máximo  = 65535
Mínimo  = 0
```

**Int16**

```text
Cero    = 0
Máximo  = 32767
Mínimo  = -32768
```

---

## 9. Editor FC16 — filosofía

FC16 requiere soportar dos formas de trabajo:

1. **Por registros físicos.**
2. **Por valores lógicos.**

### 9.1 Modo por registros

Aplicable a:

```text
UInt16
Int16
Hex16
Bin16
```

Ejemplo:

```text
Inicio: 40020
Cantidad: 3 registros

40020   10
40021   20
40022   30
```

### 9.2 Modo por valores lógicos

Aplicable a tipos que ocupan más de un registro, inicialmente:

```text
Float32
```

---

## 10. Popover FC16 — modo registros

```text
┌──────────────────────────────────────────────────────────┐
│ Editar registros                                     [×] │
│ FC16 · Write Multiple Registers                          │
│                                                          │
│ Inicio: 40020 (offset 19)     Cantidad: 3 registros     │
│                                                          │
│ Tipo de dato                                             │
│ [ UInt16 ▼ ]                                             │
│                                                          │
│ Dirección        Valor                                   │
│ 40020            [ 10 ]                                  │
│ 40021            [ 20 ]                                  │
│ 40022            [ 30 ]                                  │
│                                                          │
│ Acciones rápidas                                         │
│ [Todo 0] [Incrementar] [Copiar abajo] [Pegar lista]     │
│                                                          │
│ Registro seleccionado                                    │
│ DEC uint16     10                                        │
│ DEC int16      10                                        │
│ HEX            0x000A                                    │
│ BIN            0000 0000 0000 1010                       │
│                                                          │
│ [Cancelar]                                  [Aplicar]   │
└──────────────────────────────────────────────────────────┘
```

Al hacer click sobre una fila, la sección inferior debe mostrar las representaciones equivalentes de ese registro.

---

## 11. Navegación con teclado

Recomendado:

```text
Enter       → siguiente registro
Shift+Enter → registro anterior
↑ / ↓       → mover selección
Ctrl+C      → copiar
Ctrl+V      → pegar
```

Esto vuelve el editor útil para trabajo rápido.

---

## 12. Pegar listas

Función altamente recomendable.

El usuario debería poder copiar:

```text
10
20
30
40
```

o:

```text
10,20,30,40
```

desde Excel/CSV y pegarlo.

El sistema debe detectar automáticamente:

- saltos de línea,
- comas,
- punto y coma,
- tabs.

Si se reciben demasiados valores:

```text
⚠ Se recibieron 10 valores para 8 registros.
```

Preferiblemente mostrar una previsualización antes de aplicar.

---

## 13. Acciones rápidas FC16

### Todo 0

Asigna:

```text
0
```

a todos los registros.

### Copiar abajo

Si el registro seleccionado contiene:

```text
1234
```

todos los siguientes pueden rellenarse con el mismo valor.

### Incrementar

Ejemplo:

```text
Valor inicial: 10
Paso: 1
```

Resultado:

```text
10
11
12
13
14
...
```

### Pegar lista

Acepta datos provenientes de:

- Excel.
- CSV.
- bloc de notas.
- otras herramientas Modbus.

---

## 14. Float32 y Modbus

Un `Float32` IEEE754 utiliza:

```text
32 bits
```

equivalentes a:

```text
2 registros Modbus de 16 bits
```

Ejemplo:

```text
25.5
```

puede convertirse internamente en:

```text
0x41CC 0x0000
```

dependiendo del orden configurado.

---

## 15. Cantidad válida con Float32

Si se selecciona `Float32`, la cantidad de registros debe ser par.

Válido:

```text
2
4
6
8
```

Inválido:

```text
3
5
7
```

Mensaje recomendado:

```text
⚠ Float32 utiliza 2 registros por valor.
La cantidad de registros debe ser múltiplo de 2.
```

---

## 16. FC16 Float32 — diseño recomendado

```text
┌─────────────────────────────────────────────────────────────┐
│ Editar valores                                          [×] │
│ FC16 · Write Multiple Registers                             │
│                                                             │
│ Inicio: 40020 (offset 19)                                  │
│ Registros: 4             Valores Float32: 2                │
│                                                             │
│ Tipo de dato                                                │
│ [ Float32 ▼ ]                                               │
│                                                             │
│ Orden                                                       │
│ [ ABCD ▼ ]                                                  │
│                                                             │
│ Valor         Registros          Vista HEX                  │
│ [ 25.50 ]     40020–40021        41CC 0000                 │
│ [ 10.25 ]     40022–40023        4124 0000                 │
│                                                             │
│ Valor seleccionado                                          │
│ Float32      25.50                                          │
│ IEEE754 HEX  0x41CC0000                                     │
│ BIN          01000001110011000000000000000000               │
│                                                             │
│ [Cancelar]                                    [Aplicar]    │
└─────────────────────────────────────────────────────────────┘
```

---

## 17. Orden de bytes y palabras

Este punto es obligatorio para compatibilidad industrial.

Los dispositivos Modbus pueden almacenar valores de 32 bits usando distintos órdenes.

Se recomienda soportar:

```text
ABCD
CDAB
BADC
DCBA
```

Donde cada letra representa un byte.

### ABCD

```text
Register 1: A B
Register 2: C D
```

### CDAB

```text
Register 1: C D
Register 2: A B
```

### BADC

```text
Register 1: B A
Register 2: D C
```

### DCBA

```text
Register 1: D C
Register 2: B A
```

---

## 18. UI recomendada para endianness

En lugar de usar solamente términos como:

```text
Big endian
Little endian
```

se recomienda mostrar explícitamente:

```text
Orden de bytes/palabras:
[ ABCD ▼ ]
```

Opciones:

```text
ABCD — Normal
CDAB — Word swap
BADC — Byte swap
DCBA — Word + byte swap
```

Esto elimina ambigüedad.

El orden seleccionado debe guardarse **por paso**, no como preferencia global obligatoria, porque diferentes esclavos pueden utilizar órdenes distintos.

---

## 19. Diagnóstico de Float32

Para diagnóstico debe mostrarse:

```text
Float32: 25.5
IEEE754: 0x41CC0000
```

y después los registros reales:

```text
40020 = 0x41CC
40021 = 0x0000
```

según el orden seleccionado.

La representación binaria puede mostrarse como:

```text
0100 0001 1100 1100 0000 0000 0000 0000
```

No es necesario separar signo/exponente/mantisa en V1.

---

## 20. Representación compacta FC16 en tabla

### UInt16

```text
10, 20, 30    [3 regs] [UINT16] ✎
```

### HEX

```text
0x000A, 0x0014, 0x001E    [3 regs] [HEX] ✎
```

### Float32

```text
25.50, 10.25    [2 Float32 / 4 regs] ✎
```

### Lista larga

```text
10, 20, 30, 40, …    [8 regs] ✎
```

El tooltip puede mostrar la lista completa.

---

## 21. FC03 / FC04 — lectura de registros

FC03 y FC04 no escriben valores.

La edición numérica debe aparecer en:

```text
Esperado
```

cuando la validación requiera comparar datos.

Validaciones recomendadas:

```text
Respuesta OK
Cantidad solicitada
Valor exacto
Rango
Tolerancia
Máscara
Cambio respecto a anterior
```

---

## 22. Valor exacto

Ejemplo:

```text
FC03
Cantidad: 2
Validación: Valor exacto
Esperado: 100, 200
```

El botón de edición abre el mismo `RegisterValueEditor`.

Si el tipo es Float32:

```text
Tipo: Float32
Esperado: 25.5
```

se consumen 2 registros.

---

## 23. Validación con tolerancia

Especialmente útil para floats.

Ejemplo:

```text
Esperado: 25.50
Tolerancia: ±0.10
```

Resultado válido:

```text
25.40 ... 25.60
```

UI:

```text
Validación
[ Valor ± tolerancia ▼ ]

Valor esperado
[ 25.50 ]

Tolerancia
[ 0.10 ]
```

---

## 24. Validación por rango

Ejemplo:

```text
Mínimo: 20.0
Máximo: 30.0
```

Útil para:

- temperatura,
- presión,
- nivel,
- corriente,
- voltaje.

---

## 25. Validación por máscara

Especialmente útil para status words.

Ejemplo:

```text
Valor esperado: 0x0040
Máscara:         0x00F0
```

Comparación:

```text
(actual & mask) == (expected & mask)
```

Representación visual futura:

```text
Valor: 0000 0000 0100 0000
Mask:  0000 0000 1111 0000
```

---

## 26. Separar tipo de dato y validación

Debe evitarse mezclar:

```text
UInt16
Float32
```

con:

```text
Valor exacto
Rango
Tolerancia
```

Conceptualmente:

```text
Tipo de dato → cómo interpretar registros
Validación   → cómo comparar resultados
```

Ejemplo completo:

```text
Función:
FC03 Read Holding Registers

Inicio:
40001

Cantidad:
2

Tipo:
Float32

Orden:
ABCD

Validación:
Valor ± tolerancia

Esperado:
25.50

Tolerancia:
0.10
```

---

## 27. Reutilización para simulador slave

El mismo `RegisterValueEditor` debe utilizarse en:

```text
Holding Registers
Input Registers
```

del simulador.

Esto evita crear múltiples editores diferentes y mantiene consistencia visual.

---

## 28. Formatos recomendados por versión

### V1

16 bits:

```text
UInt16
Int16
Hex16
Bin16
```

32 bits:

```text
Float32
```

### V2

```text
UInt32
Int32
Float32
```

con:

```text
ABCD
CDAB
BADC
DCBA
```

### V3

```text
Float64
UInt64
Int64
ASCII
UTF-8 blocks
```

No son prioritarios para la primera implementación.

---

## 29. Comportamiento del input según tipo

### UInt16

Permitir:

```text
0–9
```

### Int16

Permitir:

```text
-
0–9
```

### Hex

Permitir:

```text
0–9
A–F
a–f
x
```

### Binario

Permitir:

```text
0
1
espacios opcionales
```

### Float32

Permitir:

```text
-
0–9
.
e
E
+
```

---

## 30. Normalización automática

### HEX

Usuario escribe:

```text
ff9c
```

Mostrar:

```text
0xFF9C
```

### Binario

Usuario escribe:

```text
1010
```

Mostrar:

```text
0000 0000 0000 1010
```

---

## 31. Validación mientras escribe

Evitar alertas intrusivas.

Usar estados inline:

```text
⚠ Valor fuera del rango UInt16.
```

```text
⚠ Hexadecimal inválido.
```

```text
⚠ Se requieren como máximo 16 bits.
```

```text
⚠ Float32 requiere una cantidad par de registros.
```

El botón:

```text
Aplicar
```

debe quedar deshabilitado mientras exista un error.

---

## 32. Cambio de tipo y preservación de bits

Cuando sea posible, cambiar de:

```text
UInt16 → Int16
```

debe conservar el mismo patrón binario.

Ejemplo:

```text
UInt16: 65535
HEX:    FFFF
```

al cambiar a Int16:

```text
Int16: -1
```

sin modificar los bits.

---

## 33. Convertir vs reinterpretar

Distinguir conceptualmente:

### Convertir

```text
25 → Float32 25.0
```

cambia la representación binaria.

### Reinterpretar

```text
0x41CC0000 → Float32 25.5
```

mantiene los bits.

Para V1:

- al cambiar tipo sobre datos existentes, **reinterpretar** los registros;
- al modificar el valor lógico, **convertir** al tipo seleccionado.

---

## 34. Modelo de datos recomendado por paso

Ejemplo conceptual:

```json
{
  "function": "FC16",
  "startAddress": 19,
  "quantityRegisters": 4,
  "valueType": "float32",
  "byteOrder": "ABCD",
  "logicalValues": [25.5, 10.25],
  "rawRegisters": [16844, 0, 16676, 0]
}
```

No se recomienda guardar únicamente el texto mostrado en UI.

---

## 35. Fuente de verdad

Para tipos de 16 bits:

```text
rawRegisters
```

puede ser la fuente de verdad.

Para Float32 conviene conservar:

- valor lógico,
- orden de bytes/palabras,
- registros generados.

Esto facilita:

- edición posterior,
- debugging,
- serialización del plan,
- inspección TX/RX.

---

## 36. Dirección y offset

Mantener la claridad entre:

```text
40020
(offset 19)
```

El editor debe respetar la configuración global de formato de dirección.

Para FC16 también mostrar el rango:

```text
Inicio: 40020
Cantidad: 4
Rango: 40020–40023
```

---

## 37. Relación valores ↔ registros

Para Float32:

```text
Valor 1 → 40020–40021
Valor 2 → 40022–40023
```

Debe ser visible en el popover.

---

## 38. Cambio de cantidad

Si aumenta:

```text
3 → 5 registros
```

mantener los valores existentes y crear los nuevos en cero.

Si disminuye, advertir antes de descartar.

Para Float32, una cantidad impar debe impedir aplicar.

---

## 39. Importación desde portapapeles

Formatos aceptados:

```text
10
20
30
```

```text
10,20,30
```

```text
10;20;30
```

```text
10<TAB>20<TAB>30
```

Esto facilita copiar datos desde Excel y otras herramientas.

---

## 40. Exportación/copiar

Opciones futuras:

```text
Copiar valores
Copiar HEX
Copiar BIN
Copiar registros
```

Especialmente útil para diagnóstico.

---

## 41. Consistencia visual con el Bit Editor

Mantener:

- mismo ancho aproximado,
- mismo borde,
- mismo header,
- mismo botón cerrar,
- misma jerarquía visual,
- mismos botones Cancelar / Aplicar,
- mismos colores,
- misma lógica de representación.

De esta forma `BitPatternEditor` y `RegisterValueEditor` se sienten parte del mismo sistema.

---

## 42. Diferenciación visual por tipo

No crear una paleta distinta para cada formato.

Usar badges discretos:

```text
UINT16
INT16
HEX
BIN
FLOAT32
```

El color principal debe seguir siendo cian/azul.

---

## 43. Responsive del popover

En pantallas grandes:

```text
popover centrado
```

En 1080p:

- ancho aproximado máximo de 600–700 px;
- scroll interno para listas largas;
- header y footer siempre visibles.

---

## 44. FC16 con muchos registros

No hacer crecer indefinidamente el modal.

Usar:

```text
área scroll interna
```

manteniendo visibles:

- cabecera,
- tipo,
- cantidad,
- Cancelar,
- Aplicar.

---

## 45. Integración con Registro de ejecución

Cuando se ejecute FC16 Float32, el detalle del log debería poder mostrar:

```text
Valores lógicos:
25.5, 10.25

Registros enviados:
0x41CC 0x0000 0x4124 0x0000

Orden:
ABCD
```

---

## 46. Integración con Tráfico Modbus

En el inspector de trama:

```text
PDU raw
```

y debajo:

```text
Interpretación:
Float32 ABCD
25.5
10.25
```

Esto hace que la misma configuración del paso sirva para interpretar la trama.

---

## 47. Lectura FC03 / FC04

Si llegan:

```text
0x41CC
0x0000
```

y el tipo configurado es:

```text
Float32 ABCD
```

mostrar automáticamente:

```text
25.5
```

---

## 48. Persistencia en el plan

Guardar por paso:

```text
tipo de dato
endianness
valores
validación
tolerancia
máscara
```

---

## 49. Compatibilidad con planes antiguos

Si un plan antiguo contiene únicamente:

```text
valor = 1234
```

interpretarlo automáticamente como:

```text
UInt16
```

Si FC16 contiene:

```text
"10,20,30"
```

migrar internamente a:

```text
type = UInt16
values = [10, 20, 30]
```

sin romper compatibilidad.

---

## 50. No agregar una columna fija “Tipo”

No se recomienda añadir otra columna a la tabla.

En su lugar:

```text
1234 [UINT16] ✎
```

o:

```text
25.5, 10.25 [FLOAT32] ✎
```

dentro de la propia celda `Valor` o `Esperado`.

---

## 51. Ejemplos de tabla

### FC06

```text
FC06 | 40000 | 1 | 1234 [UINT16] ✎ | Respuesta OK
```

### FC16 UInt16

```text
FC16 | 40020 | 3 | 10, 20, 30 [UINT16] ✎ | Respuesta OK
```

### FC16 Float32

```text
FC16 | 40020 | 4 | 25.5, 10.25 [FLOAT32] ✎ | Respuesta OK
```

### FC03 Float32

```text
FC03 | 40000 | 2 | — | Valor exacto | 25.5 [FLOAT32] ✎
```

---

## 52. NaN e infinito

Para Float32, en primera versión se recomienda **no permitir**:

```text
NaN
+Inf
-Inf
```

salvo que más adelante exista un modo avanzado explícito.

---

## 53. Precisión visual

No mostrar decimales innecesarios.

Preferir:

```text
25.5
```

frente a:

```text
25.500000
```

Pero conservar internamente el valor Float32 real.

Tooltip:

```text
Almacenado como IEEE754 Float32.
Puede existir redondeo binario.
```

---

## 54. Tooltips técnicos

### UInt16

```text
Entero sin signo de 16 bits.
Rango: 0 a 65535.
```

### Int16

```text
Entero con signo de 16 bits.
Rango: -32768 a 32767.
```

### Float32

```text
Número IEEE754 de 32 bits.
Utiliza 2 registros Modbus.
```

### ABCD

```text
Register 1 = AB
Register 2 = CD
```

---

## 55. Mensajes de error específicos

Evitar:

```text
Valor inválido
```

Preferir:

```text
Valor fuera del rango UInt16.
```

```text
Float32 requiere una cantidad par de registros.
```

```text
Hexadecimal inválido.
```

```text
El valor binario excede 16 bits.
```

---

## 56. Jerarquía del popover

Orden recomendado:

```text
Título
Contexto Modbus
Tipo de dato
Valores
Acciones rápidas
Representación / diagnóstico
Cancelar / Aplicar
```

---

## 57. Prioridad de implementación

### Prioridad alta

1. `RegisterValueEditor`.
2. UInt16.
3. Int16.
4. Hex16.
5. Bin16.
6. Integración con FC06.
7. FC16 lista de registros.
8. Pegar listas.
9. Float32.
10. ABCD/CDAB/BADC/DCBA.
11. Reutilización en FC03/FC04.
12. Validación de rangos.
13. Persistencia en plan.

### Prioridad media

1. Tolerancia para Float32.
2. Validación por rango.
3. Máscara.
4. UInt32.
5. Int32.
6. Copiar/exportar valores.
7. Incrementar secuencia.
8. Integración con inspector de tráfico.
9. Resumen avanzado en logs.

### Prioridad futura

1. Float64.
2. UInt64.
3. Int64.
4. ASCII.
5. Strings.
6. Estructuras personalizadas.
7. Plantillas por dispositivo.
8. Escalado de ingeniería.

---

## 58. Escalado de ingeniería futuro

Una evolución útil sería soportar:

```text
raw register → engineering units
```

Ejemplo:

```text
0 ... 10000
↓
0.0 ... 100.0 °C
```

No es necesario en esta etapa, pero conviene no cerrar el modelo de datos a esta futura capacidad.

---

## 59. Perfiles de dispositivo

Si JW Modbus Tool conoce el dispositivo:

```text
Registro 40001
Temperatura
Float32
ABCD
°C
```

el editor podría seleccionar automáticamente:

```text
Float32
ABCD
```

En productos JW:

```text
AO1 Setpoint
UInt16
```

o:

```text
AI1 Value
Float32
ABCD
```

Esto vuelve al editor todavía más útil dentro del ecosistema JW.

---

## 60. Flujo UX ideal FC06

1. Usuario agrega FC06.
2. Escribe dirección.
3. Hace click en Valor.
4. Abre `RegisterValueEditor`.
5. Selecciona UInt16 / Int16 / HEX / BIN.
6. Escribe valor.
7. Ve equivalencias.
8. Aplica.
9. La tabla muestra un resumen compacto.

---

## 61. Flujo UX ideal FC16 Float32

1. Usuario agrega FC16.
2. Inicio = 40020.
3. Cantidad = 4.
4. Abre editor.
5. Selecciona Float32.
6. El sistema indica `2 valores`.
7. Selecciona orden ABCD.
8. Escribe:
   - 25.5
   - 10.25
9. Ve HEX y registros generados.
10. Aplica.
11. La tabla muestra:

```text
25.5, 10.25 [2 Float32 / 4 regs]
```

---

## 62. Flujo UX ideal FC03 esperado

1. Usuario agrega FC03.
2. Cantidad = 2.
3. Validación = Valor ± tolerancia.
4. Abre editor de `Esperado`.
5. Selecciona Float32.
6. Orden ABCD.
7. Valor = 25.5.
8. Tolerancia = 0.1.
9. Aplicar.
10. La ejecución valida automáticamente.

---

## 63. Criterios de aceptación FC06

Debe ser posible:

- editar UInt16;
- editar Int16;
- editar HEX;
- editar BIN;
- convertir entre representaciones;
- validar rango;
- aplicar;
- cancelar;
- persistir el tipo seleccionado;
- visualizar equivalencias.

---

## 64. Criterios de aceptación FC16

Debe ser posible:

- editar varios registros;
- navegar eficientemente;
- pegar listas;
- cambiar representación;
- editar Float32;
- seleccionar orden de bytes/palabras;
- ver registros resultantes;
- aplicar sin perder información;
- rechazar cantidades incompatibles.

---

## 65. Criterios de aceptación FC03 / FC04

Debe ser posible:

- definir valores esperados;
- seleccionar tipo de dato;
- reutilizar Float32;
- usar orden configurado;
- comparar valor exacto;
- extender después a tolerancia/rango/máscara.

---

## 66. Resumen técnico

```text
FC06
1 registro
16 bits
UInt16 / Int16 / HEX / BIN
```

```text
FC16
N registros
16 bits por registro
UInt16[] / Int16[] / HEX[] / BIN[]
Float32 = 2 registros por valor
```

```text
FC03 / FC04
Usan el mismo sistema para interpretar
y validar los registros recibidos.
```

---

## 67. Objetivo final de UX

El usuario debería poder pensar:

```text
"Quiero escribir 25.5."
```

y no:

```text
"¿Cuáles son los dos uint16 del IEEE754 de 25.5?"
```

Asimismo:

```text
"Quiero escribir -100."
```

y no:

```text
"¿Cuál es el complemento a dos de -100?"
```

JW Modbus Tool debe encargarse de:

```text
Valor lógico
↓
Tipo de dato
↓
Representación binaria
↓
Registros de 16 bits
↓
Orden de bytes/palabras
↓
PDU Modbus
↓
Trama
```

El usuario debe poder acceder a todas esas capas para diagnóstico, pero no tener que calcularlas manualmente.

---

## 68. Dirección recomendada del producto

Con este sistema, JW Modbus Tool puede diferenciarse claramente de herramientas Modbus antiguas.

La experiencia debe combinar:

- simplicidad para pruebas rápidas;
- detalle técnico cuando se necesita;
- conversiones automáticas;
- visualización coherente;
- compatibilidad industrial real;
- edición eficiente de múltiples registros;
- consistencia con el editor de coils;
- capacidad futura para perfiles de dispositivos JW.

El objetivo no es esconder Modbus, sino:

> **hacer Modbus legible, editable y verificable sin obligar al usuario a realizar conversiones manuales.**
