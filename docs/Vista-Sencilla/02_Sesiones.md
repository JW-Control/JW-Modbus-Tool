# Vista Sencilla — 02 Sesiones

Estado: **primera pasada visual aplicada**  
Fecha: 2026-07-09  
Rama: `feature/simple-mode-mvp`

---

## Objetivo

La vista **Sesiones** debe permitir crear, abrir, guardar y continuar diagnósticos Modbus sin perder contexto.

Una sesión debe guardar:

- Conexión activa o última conexión usada.
- Protocolo RTU/TCP.
- Parámetros de puerto o TCP.
- Dispositivos detectados.
- Slave activo.
- Registros leídos.
- Actividad reciente.
- Pruebas ejecutadas.
- Tráfico capturado.
- Notas y observaciones.

---

## Referencia visual aprobada

La referencia aprobada es la imagen dashboard de `Sencillo / Sesiones` generada previamente, con:

- Acciones superiores grandes: `Nueva sesión`, `Abrir sesión`, `Guardar sesión`.
- Tarjeta principal `Sesión actual`.
- Panel `¿Qué guarda una sesión?`.
- Panel `Resumen de la sesión actual` con tarjetas e íconos.
- Panel `Sesiones recientes` con filas compactas y acciones.
- Panel `Actividad reciente`.

---

## Estado actual real

La vista real ya existe y trabaja sobre sesión limpia:

- Muestra `Nueva_sesion_Modbus`.
- Muestra datos básicos de rol, protocolo, slave activo, conexión y última actividad.
- El resumen ya refleja parte del estado real generado desde Dispositivos.
- `Sesiones recientes` todavía no muestra historial persistente real.
- `Actividad reciente` toma los eventos reales generados por escaneos y lecturas.

---

## Primera pasada aplicada

Se aplicó una primera corrección visual de layout para acercar la vista real a la referencia aprobada sin alterar todavía la lógica de persistencia.

Cambios de layout:

- `Nueva sesión`, `Abrir sesión` y `Guardar sesión` quedan como acciones superiores alineadas en la columna principal.
- `Sesión actual` queda debajo de las acciones superiores.
- `¿Qué guarda una sesión?` queda en la columna derecha, alineado con `Sesión actual`.
- `Sesiones recientes` queda como panel grande en la columna izquierda.
- `Resumen de la sesión actual` queda en la columna derecha.
- `Actividad reciente` queda debajo del resumen, también en la columna derecha.
- La vista queda contenida dentro de la altura disponible, sin scroll global innecesario.
- Los paneles que puedan crecer deberán usar scroll interno.

---

## Criterio de avance

Para depurar esta vista, no se deben introducir datos mock fijos que oculten el estado real.

Reglas:

- Si no hay sesión abierta, mostrar sesión limpia.
- Si hay datos generados desde Dispositivos, mostrarlos en el resumen.
- Si no hay sesiones guardadas, mostrar mensaje vacío claro.
- El diseño debe acercarse a la referencia aprobada, pero respetando datos reales.

---

## Layout objetivo para el MVP sencillo

### Acciones superiores

- `Nueva sesión`.
- `Abrir sesión`.
- `Guardar sesión`.

### Sesión actual

Debe mostrar:

- Nombre editable de sesión.
- Estado: `Limpia`, `Activa` o `Guardada`.
- Rol: `PC Master`.
- Protocolo: `RTU` o `TCP`.
- Slave activo.
- Conexión.
- Última actividad.
- Botón ancho `Continuar sesión`.

### ¿Qué guarda una sesión?

Debe mantener bullets claros:

- Conexiones y dispositivos detectados.
- Registros leídos y valores configurados.
- Pruebas ejecutadas y resultados.
- Tráfico Modbus capturado.
- Notas y observaciones del diagnóstico.

### Sesiones recientes

Debe mostrar, cuando exista persistencia:

- Nombre.
- Fecha/hora.
- Dispositivos.
- Pruebas.
- Errores.
- Acciones: `Continuar`, `Ver resumen`, `Exportar`.

Si no hay sesiones guardadas, debe mostrar mensaje vacío claro, sin inventar sesiones.

### Resumen de la sesión actual

Debe usar tarjetas con íconos:

- Dispositivos detectados.
- Registros leídos.
- Pruebas.
- Tráfico capturado.
- Notas.
- Errores.

### Actividad reciente

Debe listar eventos reales de la sesión:

- Conexión establecida.
- Slave seleccionado.
- Escaneo iniciado/finalizado.
- Lecturas ejecutadas.
- Errores o timeouts.

---

## Pendiente inmediato para cerrar Sesiones

1. Revisar visualmente la primera pasada de layout.
2. Ajustar alturas si algún panel se corta o queda demasiado vacío.
3. Decidir si `Sesión actual` debe mostrar `Activa` cuando ya exista puerto conectado o actividad real, y `Limpia` solo cuando no haya actividad.
4. Conectar `Conexión` al puerto real en vez de texto genérico `Según puerto activo`.
5. Definir persistencia mínima para `Guardar sesión` / `Abrir sesión`.

---

## Próximo trabajo sugerido

1. Validar visualmente esta primera pasada.
2. Mantener los datos reales que vienen desde Dispositivos.
3. Preparar estructura para persistencia de sesiones.
4. Evitar mocks fijos salvo datos de ejemplo explícitos en documentación o storybook futuro.
