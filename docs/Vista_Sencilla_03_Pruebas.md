# Vista Sencilla — 03. Pruebas

Estado: MVP estabilizado en la rama `codex/stabilize-tests-view`.

## Objetivo

La vista **Pruebas** permite ejecutar un plan de validación Modbus desde la PC actuando como **Master** contra uno o varios slaves reales. El flujo se apoya en el contexto de conexión y slave activo definido en la vista **Dispositivos**, y puede persistirse dentro de una sesión `.jwmodbus-session` desde la vista **Sesiones**.

## Layout aprobado

La distribución actual se considera base estable para el MVP:

1. **Plan de pruebas al slave** en la zona superior izquierda.
2. **Escenarios** en el lateral derecho superior.
3. **Simulador slave (PC como slave)** en el lateral derecho inferior, aún como bloque secundario.
4. **KPIs de ejecución** debajo del plan.
5. **Registro de ejecución** en la zona inferior izquierda.
6. Todo el contenido debe quedar dentro del viewport principal; los scrolls deben vivir dentro de sus áreas delimitadas.

## Plan de pruebas

La tabla superior es editable y define la secuencia que se ejecutará al presionar **Iniciar prueba**.

Columnas definitivas del MVP:

| Columna | Uso |
|---|---|
| Activo | Habilita o deshabilita el paso. |
| Paso | Número de orden visual. |
| Slave | ID de slave editable manualmente. No usar input numérico con rueda para evitar cambios accidentales por scroll. |
| Función | Selector ordenado de funciones Modbus. |
| Dirección | Dirección inicial visible para el usuario. Admite direcciones tipo 0, 10000, 30000, 40000. |
| Cantidad | Solo aplica a lecturas FC01/FC02/FC03/FC04. En escrituras se muestra deshabilitado y deriva del valor. |
| Valor | Solo aplica a escrituras FC05/FC06/FC15/FC16. En lecturas se muestra deshabilitado. |
| Validación | Define cómo evaluar si el paso realmente aprobó. |
| Esperado | Se habilita solo cuando la validación requiere valores explícitos. |
| Timeout | Timeout por paso en milisegundos. |
| Resultado | Estado resumido del último intento. |
| Acción | Eliminar paso. |

Funciones incluidas en el MVP:

- FC01 Read Coils.
- FC02 Read Discrete Inputs.
- FC03 Read Holding Registers.
- FC04 Read Input Registers.
- FC05 Write Single Coil.
- FC06 Write Single Register.
- FC15 Write Multiple Coils.
- FC16 Write Multiple Registers.

## Modos de validación

La columna **Validación** evita que el usuario tenga que escribir textos ambiguos en **Esperado**.

| Modo | Cuándo usarlo | Campo Esperado |
|---|---|---|
| Respuesta OK | Escrituras o pasos donde basta que el slave responda sin excepción. | Deshabilitado, muestra `OK`. |
| Cantidad solicitada | Lecturas donde basta recibir la cantidad pedida. | Deshabilitado, muestra automático `N regs`, `N coils` o `N bits`. |
| Valores exactos | Lecturas o escrituras donde se espera una secuencia exacta. | Editable. Ej.: `1234`, `ON`, `ON,OFF,ON`, `10,20,30`. |
| Por dirección | Validación puntual por dirección. | Editable. Ej.: `40000=1234;40001=0`. |

Regla importante: un paso solo queda **Aprobado** cuando la comunicación es correcta y la validación configurada también es correcta.

## Registro de ejecución

La tabla inferior debe comportarse como la tabla detallada de lectura de registros de **Dispositivos**, pero orientada a pasos de prueba.

Columnas actuales:

- Hora.
- Paso.
- Slave.
- Función.
- Dirección.
- Cantidad/Valor.
- Resultado.
- Tiempo.
- Detalle.
- Info.

El botón **Info** abre un detalle del paso con:

- Función.
- Slave ID.
- Dirección inicial.
- Cantidad o valor.
- Validación.
- Resultado.
- Tabla de direcciones con nombre, esperado, leído/escrito, tipo y validación.

## KPIs

Los KPIs deben conservar el estilo visual aprobado:

1. **Tasa de éxito** con anillo verde.
2. **Latencia promedio** con valor grande cian.
3. **Errores** con valor rojo cuando corresponda.
4. **Pasos completados** con anillo cian.

Los KPIs se calculan sobre la última ejecución visible del plan. Al cargar una sesión o cambiar un plan, los pasos deben volver a estado **Pendiente** para evitar mostrar resultados viejos antes de ejecutar.

## Escenarios

Escenarios base:

- Operación normal.
- Timeout detectado.
- Error CRC detectado.
- Excepción Modbus.

La vista **Gestionar escenarios** permite:

- Elegir escenario activo.
- Editar nombre.
- Editar descripción.
- Editar icono textual corto.
- Editar color.
- Usar el plan actual como pasos del escenario.
- Duplicar escenario.
- Restaurar base solo en escenarios por defecto.
- Eliminar solo escenarios personalizados.

Los pasos del escenario no deben mostrarse como lista larga dentro de gestionar escenarios, porque generan ruido visual. La edición detallada de pasos se hace desde el plan principal.

## Persistencia

- **Guardar plan** guarda el plan visible dentro del escenario activo en memoria de la vista.
- Para persistirlo en archivo, luego se debe usar **Sesiones → Guardar** o **Guardar como**.
- El runtime de pruebas se guarda dentro de la sesión bajo formato `jwmodbus-tests-runtime`.
- Al reabrir sesión, deben recuperarse slave, función, dirección, cantidad, valor, validación, esperado, timeout, escenarios y simulador.
- Los resultados de ejecución no deben dispararse ni recalcularse automáticamente al abrir; deben iniciar como **Pendiente** hasta presionar **Iniciar prueba**.

## Correcciones estabilizadas

- Se eliminó el parpadeo por doble montaje de React en modo desarrollo.
- Se consolidó la vista de pruebas en un solo componente operativo.
- Se evitó que los desplegables se cierren solos por repintados o sincronizaciones agresivas.
- Se separó `Cantidad` de `Valor`.
- Se separó el modo de `Validación` del campo `Esperado`.
- Se mejoró la extracción de valores para FC01/FC02/FC03/FC04 al validar cantidad y valores leídos.
- Se evita mostrar resultados aprobados/fallidos al abrir la vista antes de ejecutar.

## Pendientes después del MVP

1. Exportar el registro de ejecución a CSV/MD/PDF.
2. Integrar nombres reales de slaves y mapas de registros desde la sesión.
3. Mejorar editor de escenarios con iconos predefinidos en vez de solo texto.
4. Implementar simulador slave real y su configuración avanzada.
5. Enviar el tráfico generado a la vista **Tráfico Modbus**.
6. Asociar pruebas ejecutadas al historial de sesión y a futuros reportes.
