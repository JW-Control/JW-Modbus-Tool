# Vista Sencilla — 02 Sesiones

Estado: **MVP funcional inicial aplicado**  
Fecha: 2026-07-09  
Rama: `feature/simple-mode-mvp`

---

## Objetivo

La vista **Sesiones** permite crear, guardar, abrir y continuar diagnósticos Modbus sin perder contexto.

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

## Estado real aplicado

La vista real trabaja sobre sesión limpia y ahora tiene una persistencia mínima en frontend.

Implementado:

- Nombre editable de sesión.
- `Nueva sesión` limpia el diagnóstico actual.
- `Guardar sesión` guarda el estado actual en `localStorage`.
- `Abrir sesión` abre la última sesión guardada.
- `Sesiones recientes` muestra siempre la sesión actual como primera fila.
- Las sesiones guardadas se muestran debajo de la sesión actual.
- Las filas guardadas pueden abrirse desde la lista.
- La conexión de `Sesión actual` muestra el puerto/parámetros reales cuando existe conexión.
- El estado cambia entre `Limpia` y `Activa` según haya datos reales.
- El resumen refleja dispositivos, registros leídos, pruebas, tráfico, notas y errores.
- Actividad reciente usa los eventos reales generados desde Dispositivos.

---

## Layout aplicado

Cambios de layout:

- `Nueva sesión`, `Abrir sesión` y `Guardar sesión` quedan como acciones superiores alineadas en la columna principal.
- `Sesión actual` queda debajo de las acciones superiores.
- `¿Qué guarda una sesión?` queda en la columna derecha, alineado con `Sesión actual`.
- `Sesiones recientes` queda como panel grande en la columna izquierda.
- `Resumen de la sesión actual` queda en la columna derecha.
- `Actividad reciente` queda inmediatamente debajo del resumen, no pegada al borde inferior de la pantalla.
- La vista queda contenida dentro de la altura disponible, sin scroll global innecesario.
- Los paneles que puedan crecer usan scroll interno.

---

## Criterio de avance

Para esta vista no se deben introducir datos mock fijos que oculten el estado real.

Reglas:

- Si no hay sesión abierta, mostrar sesión limpia.
- Si hay datos generados desde Dispositivos, mostrarlos en el resumen.
- Si no hay sesiones guardadas, mostrar mensaje vacío claro.
- La sesión actual debe aparecer en `Sesiones recientes` aunque todavía no esté guardada.
- El diseño debe acercarse a la referencia aprobada, pero respetando datos reales.

---

## Acciones superiores

### Nueva sesión

Acción actual:

- Limpia dispositivos detectados.
- Limpia slave activo.
- Limpia lecturas rápidas.
- Limpia mapa de registros leído.
- Limpia actividad reciente.
- Limpia tráfico.
- Reinicia contadores.
- Reinicia pruebas a estado pendiente.
- Mantiene la configuración de puerto visible para no obligar al usuario a reconfigurar todo.

### Guardar sesión

Acción actual:

- Guarda una instantánea de la sesión actual en `localStorage`.
- Si la sesión ya fue guardada, la actualiza.
- Si es nueva, crea un ID interno.
- La sesión guardada pasa a aparecer en recientes.

Datos guardados ahora:

- Nombre de sesión.
- Fecha de guardado.
- Puerto y parámetros seriales.
- Dispositivos detectados.
- Slave activo.
- Estadísticas.
- Actividad reciente con valores leídos.
- Cantidad de tráfico capturado.
- Notas: reservado en `0` para futura implementación.

### Abrir sesión

Acción actual:

- Abre la última sesión guardada.
- También se puede abrir una sesión específica desde la fila de `Sesiones recientes`.

Pendiente posterior:

- Abrir desde archivo `.jwmodbus-session`.
- Exportar/importar sesiones.
- Guardado en carpeta de usuario usando backend Electron.

---

## Sesión actual

Muestra:

- Nombre editable.
- Estado: `Limpia` o `Activa`.
- Rol: `PC Master`.
- Protocolo: `RTU`.
- Slave activo.
- Conexión real: `COMx · baud · 8N1`, o `Sin puerto activo`.
- Última actividad.
- Botón ancho `Continuar sesión`.

---

## Sesiones recientes

Muestra:

- La sesión actual como primera fila.
- Sesiones guardadas debajo.
- Nombre.
- Fecha/hora.
- Dispositivos.
- Registros.
- Pruebas.
- Errores.
- Acción: `En curso` o `Abrir`.
- Estado: `Limpia`, `Activa` o `Guardada`.

---

## Resumen de la sesión actual

Usa tarjetas con íconos:

- Dispositivos detectados.
- Registros leídos.
- Pruebas.
- Tráfico capturado.
- Notas.
- Errores.

---

## Actividad reciente

Lista eventos reales de la sesión:

- Escaneo iniciado/finalizado.
- Lecturas ejecutadas.
- Errores o timeouts.

El panel inicia justo debajo del resumen de la sesión actual y usa scroll interno si la lista crece.

---

## Pendiente inmediato para cerrar Sesiones

1. Validar visualmente la nueva distribución.
2. Confirmar si el nombre editable debe persistir automáticamente o solo al guardar.
3. Decidir si `Abrir sesión` debe abrir un selector/modal en vez de cargar la última guardada.
4. Implementar exportar/importar archivo de sesión desde backend Electron.
5. Añadir notas reales de diagnóstico.

---

## Próximo trabajo sugerido

1. Probar `Nueva sesión`, `Guardar sesión` y `Abrir sesión` en local.
2. Revisar que la sesión actual aparezca correctamente en `Sesiones recientes`.
3. Validar que la columna derecha ya no tenga el hueco entre resumen y actividad.
4. Continuar con la vista `Pruebas` cuando Sesiones quede aceptada.
