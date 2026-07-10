# Modo sencillo — notas de runtime

## Estado actual

El MVP de Modo sencillo usa React como base principal y un overlay puntual para la vista **Pruebas**.

Archivos activos:

- `src/renderer/simple-tests-runtime-safe.ts`
- `src/renderer/simple-tests-persistence-bridge.ts`

Carga activa:

- `src/renderer/main.tsx` importa primero `./simple-tests-persistence-bridge.js`.
- Luego importa `./simple-tests-runtime-safe.js`.

El orden importa: el puente de persistencia debe cargarse antes del runtime de Pruebas para poder restaurar el último plan guardado antes de que se pinte el overlay.

## Limpieza realizada

Se eliminó el runtime anterior:

- `src/renderer/simple-tests-runtime.ts`

Ese archivo quedó obsoleto porque intentaba montar la vista de Pruebas y además parcheaba el backend de sesiones de forma agresiva. Ese enfoque provocó pantallas azules/fondo vacío cuando el runtime fallaba antes de renderizar.

## Persistencia de Pruebas

La vista **Pruebas** mantiene su estado en `simple-tests-runtime-safe.ts`, separado temporalmente del estado React principal.

Para no perder cambios al cerrar/abrir la app o al guardar una sesión, se agregó `simple-tests-persistence-bridge.ts`:

- Escucha el evento `jw-simple-tests-plan-updated`.
- Guarda el plan en `localStorage` bajo `jw-modbus-tool.simple.tests-runtime.v1`.
- Inyecta `testsRuntime` dentro del documento `.jwmodbus-session` cuando se usa `Guardar` o `Guardar como`.
- Lee `testsRuntime` al usar `Abrir sesión` y lo vuelve a importar al runtime.
- Deja el estado en `window.__jwPendingTestsRuntimeState` antes de cargar el overlay, para restaurar el plan al iniciar.

## Gestionar escenarios

El botón **Gestionar escenarios** queda implementado dentro del mismo panel derecho de **Pruebas**.

Funciones incluidas en el MVP:

- Editar nombre, descripción, ícono y color del escenario seleccionado.
- Crear un escenario nuevo a partir del plan visible.
- Duplicar el escenario seleccionado.
- Asignar el plan actual como pasos del escenario.
- Restaurar escenarios base a sus valores predeterminados.
- Eliminar escenarios personalizados.
- Scroll interno en la lista/gestor para evitar desplazar la vista completa.
- Persistencia dentro de `testsRuntime.scenarios`, por lo que se guarda en `.jwmodbus-session` junto con el plan.

Regla de uso: después de editar escenarios o pasos, usar **Guardar plan** o cerrar el gestor con **Guardar y volver**; luego usar **Guardar sesión** para persistirlo en archivo.

## Regla para próximos cambios

Para evitar repetir el bloqueo:

1. No crear otro runtime paralelo para la misma vista.
2. No importar de nuevo `simple-tests-runtime.js`.
3. Mantener `simple-tests-runtime-safe.ts` como único overlay temporal de **Pruebas** mientras la vista se integra de forma nativa en React.
4. Mantener `simple-tests-persistence-bridge.ts` como único puente de persistencia para ese overlay.
5. Cualquier integración con sesiones debe ser tolerante a fallos: si el guardado del plan no se puede inyectar, la vista debe seguir cargando.
6. El overlay debe estar envuelto en `try/catch` o funciones seguras para no bloquear el resto de la aplicación.
7. Antes de tocar el runtime de Pruebas, verificar que **Dispositivos** y **Sesiones** siguen cargando sin pantalla azul.

## Pendiente técnico

La solución correcta a mediano plazo es migrar la vista **Pruebas** desde overlay hacia un componente React nativo, con persistencia formal dentro del documento `.jwmodbus-session`.

Hasta cerrar esa migración, el overlay seguro + puente de persistencia quedan como implementación canónica del MVP.
