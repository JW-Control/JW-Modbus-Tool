# Concepto final de interfaz

## Decisión

JW Modbus Tool evolucionará hacia una suite profesional de diagnóstico Modbus
para escritorio. La referencia visual y estructural principal son las primeras
cuatro propuestas oscuras:

1. centro de dispositivos y conexión;
2. explorador de registros;
3. analizador de tráfico;
4. pruebas y simulación.

El producto tendrá una interfaz oscura, técnica y de alta densidad, diseñada
para ocupar el área completa de la ventana. No se conservará la composición
clara dentro de una tarjeta central como identidad final.

Las propuestas intermedias y sencillas aportan criterios de usabilidad, no una
arquitectura alternativa. Se usarán para crear recorridos guiados, mensajes
claros y detalle progresivo dentro de la misma aplicación profesional.

## Principio de complejidad progresiva

No habrá selectores globales de `Modo sencillo`, `Modo intermedio` o
`Modo avanzado`.

La complejidad se revelará según la tarea:

- sin conexión, la vista orienta al usuario y destaca el siguiente paso;
- con una conexión activa, aparecen datos y acciones operativas;
- al seleccionar una trama o registro, se abre su inspector técnico;
- estadísticas, hex, binario y gráficas viven en paneles secundarios;
- las acciones peligrosas requieren confirmación y contexto.

Así, un usuario nuevo puede completar una lectura sin comprender toda la suite,
mientras un técnico conserva acceso a la información profunda.

## Identidad visual

- Tema oscuro como apariencia principal.
- Fondos azul petróleo casi negros, evitando un lienzo negro puro.
- Cian o azul eléctrico para selección, navegación y acciones primarias.
- Verde únicamente para comunicación correcta y estados aprobados.
- Ámbar para advertencias, latencia y timeout.
- Rojo para CRC inválido, fallos y acciones destructivas.
- Texto principal blanco suave y texto secundario gris azulado.
- Bordes finos, radios contenidos y sombras discretas.
- Tipografía compacta; monoespaciada para tramas, direcciones y valores hex.
- Tablas y paneles alineados a una cuadrícula estable.

El color nunca será el único indicador: cada estado incluirá texto o icono.

## Shell global

### Barra de título

- Identidad `JW Modbus Tool`.
- Estado o nombre de la sesión activa.
- Controles estándar de ventana.

### Barra de comandos

Acciones globales con icono y texto:

- nuevo;
- abrir;
- guardar;
- conectar;
- desconectar;
- escanear;
- opciones;
- ayuda.

Solo se mostrarán acciones funcionales. Las capacidades futuras no aparecerán
como botones decorativos o deshabilitados permanentemente.

### Navegación lateral

La arquitectura final tendrá estas áreas:

- `Dispositivos`;
- `Sesiones`;
- `Pruebas`;
- `Registros`;
- `Tráfico Modbus`.

`Ajustes` y `Ayuda` permanecerán en la barra superior porque no son áreas de
trabajo frecuentes.

### Barra de estado

Permanecerá visible en el borde inferior y mostrará:

- puerto y formato serial;
- ID de unidad activo;
- solicitudes y respuestas;
- CRC, excepciones y timeouts;
- estado de captura o transacción.

## Áreas de trabajo

### Dispositivos

Es la pantalla inicial y reemplaza al resumen actual.

Distribución objetivo:

- izquierda: configuración y conexión RTU;
- centro: dispositivos encontrados o unidades conocidas;
- derecha: resumen en tiempo real;
- zona central inferior: lectura rápida de registros;
- parte inferior: actividad reciente.

Primera etapa:

- conexión RTU manual;
- último puerto recordado;
- JWPLC conocido por ID;
- métricas de la sesión actual.

### Pruebas

La vista **Pruebas** ejecuta un plan de pasos Modbus y debe separar claramente
lo que se envía de lo que se valida.

Decisiones actuales:

- `Slave`, `Dirección` y `Timeout` son columnas compactas.
- `Función` es un desplegable ordenado por código: FC01, FC02, FC03, FC04,
  FC05, FC06, FC15 y FC16.
- `Cantidad` se usa en lecturas: FC01, FC02, FC03 y FC04.
- `Valor` se usa en escrituras: FC05, FC06, FC15 y FC16.
- `Validación` reemplaza el uso libre de `Esperado` como criterio principal.
- `Esperado` solo queda editable cuando la validación requiere valores exactos.

Modos de validación:

- `Respuesta OK`: basta comunicación Modbus correcta. Es el modo natural para
  escrituras simples cuando aún no se hace una lectura posterior de confirmación.
- `Cantidad solicitada`: para lecturas; compara que llegue la cantidad pedida,
  evitando repetir manualmente `8 regs`, `8 bits` o `8 coils`.
- `Valores exactos`: compara una secuencia, por ejemplo `4096,4097,4098` o
  `ON,OFF,ON,OFF`.
- `Por dirección`: compara pares explícitos, por ejemplo
  `40000=4096,40001=4097` o `0=ON,1=OFF`.

Para coils e inputs discretos, los valores booleanos deben aceptar formatos
cómodos como `ON/OFF`, `1/0`, `true/false`, `HIGH/LOW` como mejora progresiva.
El MVP actual ya trabaja con los formatos principales `ON/OFF`, `1/0` y
`true/false`.

La columna **Info** del registro de ejecución abre el detalle del paso en la
misma zona inferior. Ese detalle muestra función, slave, dirección, cantidad o
valor, modo de validación, resultado y una tabla por dirección con esperado vs
leído/escrito.

Implementación actual: la vista **Pruebas** ya debe permanecer como componente
React nativo dentro de `SimpleModeApp`. No se deben reintroducir overlays,
imports diferidos, roots React adicionales ni persistencia temporal por
`localStorage`.

Pendiente futuro: para escrituras, agregar una opción de **confirmar por lectura
posterior**. Es decir, escribir con FC05/FC06/FC15/FC16 y luego leer con
FC01/FC03 para comprobar que el slave conservó el valor.
