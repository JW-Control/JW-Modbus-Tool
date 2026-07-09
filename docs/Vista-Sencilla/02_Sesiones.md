# Vista Sencilla — 02 Sesiones

Estado: **siguiente vista a depurar**  
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

La vista real ya existe, pero está simplificada respecto a la referencia:

- Usa sesión limpia.
- Muestra `Nueva_sesion_Modbus`.
- Muestra datos básicos de rol, protocolo, slave activo, conexión y última actividad.
- El resumen ya refleja parte del estado real.
- `Sesiones recientes` todavía no muestra historial persistente real.
- `Actividad reciente` existe, pero está más simple que la propuesta visual aprobada.

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

Si no hay sesiones guardadas, debe mostrar mensaje vacío.

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

## Próximo trabajo sugerido

1. Ajustar layout para acercarlo a la referencia visual aprobada.
2. Mantener los datos reales que vienen desde Dispositivos.
3. Preparar estructura para persistencia de sesiones.
4. Evitar mocks fijos salvo datos de ejemplo explícitos en documentación o storybook futuro.
