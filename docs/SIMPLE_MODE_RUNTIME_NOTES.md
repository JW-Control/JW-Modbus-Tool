# Modo sencillo - notas de runtime

## Estado actual

El Modo sencillo usa React como runtime unico del renderer. La vista **Pruebas**
ya esta integrada como componente nativo y se monta desde `SimpleModeApp.tsx`
igual que Dispositivos, Sesiones, Registros y Trafico Modbus.

Archivos activos:

- `src/renderer/App.tsx`
- `src/renderer/main.tsx`
- `src/renderer/SimpleModeApp.tsx`
- `src/renderer/simple-tests-consolidated.tsx`
- `src/renderer/simple-mode-overrides.css`

La carga activa es directa:

1. `main.tsx` crea un unico root de React.
2. `App.tsx` renderiza `SimpleModeApp`.
3. `SimpleModeApp` muestra `TestsView` cuando la navegacion selecciona
   **Pruebas**.

## Limpieza realizada

Se retiro el enfoque de runtime paralelo para Pruebas:

- no hay `setTimeout(() => import(...))` desde `main.tsx`;
- no hay segundo `ReactDOM.createRoot`;
- no hay montaje por `document.querySelector`;
- no hay overlay sobre la aplicacion principal;
- no hay `simple-tests-persistence-bridge.ts`;
- no hay estado de Pruebas en `localStorage`;
- no hay variables globales `window.__jw...` para coordinar UI.

Esto corrige el parpadeo donde aparecia una vista anterior de Pruebas y luego
otra capa la reemplazaba.

## Persistencia de Pruebas

El plan, escenarios y estado de simulador se guardan dentro del documento de
sesion como `testsRuntime`.

`testsRuntime` conserva solo configuracion durable:

- pasos del plan;
- slave por paso;
- funcion Modbus;
- direccion;
- cantidad;
- valor;
- modo de validacion;
- esperado;
- timeout;
- escenario seleccionado;
- escenarios personalizados;
- estado preparado/detenido del panel de simulador.

Los resultados de ejecucion no se restauran como resultados vivos. Al abrir una
sesion o crear una nueva sesion, los pasos vuelven a `Pendiente`. Esto evita que
aparezcan pasos aprobados sin que el usuario presione **Iniciar prueba**.

## Vista Pruebas

La vista soporta el plan Modbus basico completo:

- FC01 Read Coils
- FC02 Read Discrete Inputs
- FC03 Read Holding Registers
- FC04 Read Input Registers
- FC05 Write Single Coil
- FC06 Write Single Register
- FC15 Write Multiple Coils
- FC16 Write Multiple Registers

La tabla separa `Cantidad` y `Valor`:

- lecturas usan `Cantidad`;
- escrituras usan `Valor`;
- FC15/FC16 calculan cantidad desde la lista escrita;
- FC05/FC06 trabajan como escritura de valor unico.

La validacion se define con modos explicitos:

- `Respuesta OK`
- `Cantidad solicitada`
- `Valores exactos`
- `Por direccion`

El registro de ejecucion y el detalle del paso se mantienen dentro de la misma
vista, sin modales flotantes.

## Reglas para proximos cambios

1. Mantener Pruebas como componente React nativo.
2. No reintroducir overlays, imports diferidos ni roots React adicionales.
3. No parchear el backend de sesiones desde el renderer.
4. Guardar estado durable de Pruebas solo mediante `testsRuntime`.
5. No guardar resultados temporales como estado de arranque.
6. Cualquier nueva accion de prueba debe pasar por el bridge `window.jwModbus`.
7. Antes de tocar Pruebas, verificar `typecheck`, tests y build.

## Pendiente funcional

- Confirmar escrituras por lectura posterior opcional: FC05/FC15 contra FC01 y
  FC06/FC16 contra FC03.
- Conectar el panel de simulador slave a un motor real de emulacion.
- Integrar trazas completas de Pruebas con la vista Trafico Modbus.
- Permitir importar/exportar escenarios como plantillas reutilizables.
