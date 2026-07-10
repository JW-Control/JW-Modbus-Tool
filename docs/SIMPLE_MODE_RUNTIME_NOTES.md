# Modo sencillo — notas de runtime

## Estado actual

El MVP de Modo sencillo usa React como base principal y un overlay puntual para la vista **Pruebas**.

Archivo activo:

- `src/renderer/simple-tests-runtime-safe.ts`

Carga activa:

- `src/renderer/main.tsx` importa dinámicamente `./simple-tests-runtime-safe.js` después de montar React.

## Limpieza realizada

Se eliminó el runtime anterior:

- `src/renderer/simple-tests-runtime.ts`

Ese archivo quedó obsoleto porque intentaba montar la vista de Pruebas y además parcheaba el backend de sesiones de forma agresiva. Ese enfoque provocó pantallas azules/fondo vacío cuando el runtime fallaba antes de renderizar.

## Regla para próximos cambios

Para evitar repetir el bloqueo:

1. No crear otro runtime paralelo para la misma vista.
2. No importar de nuevo `simple-tests-runtime.js`.
3. Mantener `simple-tests-runtime-safe.ts` como único overlay temporal de **Pruebas** mientras la vista se integra de forma nativa en React.
4. Cualquier integración con sesiones debe ser tolerante a fallos: si el guardado del plan no se puede inyectar, la vista debe seguir cargando.
5. El overlay debe estar envuelto en `try/catch` o funciones seguras para no bloquear el resto de la aplicación.
6. Antes de tocar el runtime de Pruebas, verificar que **Dispositivos** y **Sesiones** siguen cargando sin pantalla azul.

## Pendiente técnico

La solución correcta a mediano plazo es migrar la vista **Pruebas** desde overlay hacia un componente React nativo, con persistencia formal dentro del documento `.jwmodbus-session`.

Hasta cerrar esa migración, el overlay seguro queda como implementación canónica del MVP.
