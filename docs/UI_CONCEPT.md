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

Etapa posterior:

- escaneo de unidades;
- perfiles de dispositivo;
- Modbus TCP;
- calidad de enlace y reintentos.

### Sesiones

Centralizará lo que hoy está repartido entre ajustes y presets:

- perfiles de conexión;
- solicitudes guardadas;
- mapa de registros;
- última unidad y vista utilizadas;
- importación y exportación de sesión.

No es necesario implementarla para la primera transformación visual, pero la
navegación debe reservarle un lugar estable.

### Pruebas

La primera versión de esta área será el diagnóstico JWPLC existente:

- lectura de entradas y salidas;
- control individual y patrones;
- validación guiada;
- resultado por pasos;
- exportación del reporte.

Su composición seguirá el lenguaje de la cuarta referencia: configuración a la
izquierda, secuencia o pasos en el centro, resultado a la derecha y registro de
ejecución abajo.

Evolución posterior:

- editor de secuencias;
- escenarios reutilizables;
- simulador de esclavo;
- inyección de timeout, CRC y excepciones;
- métricas de cobertura y latencia.

### Registros

El Maestro RTU actual evolucionará a un explorador de registros.

Estructura:

- franja superior con unidad, función, dirección, cantidad y sondeo;
- pestañas para coils, discrete inputs, holding e input registers;
- tabla principal de direcciones y valores;
- inspector contextual a la derecha;
- actividad de lectura/escritura en la parte inferior.

Primera etapa:

- las ocho funciones RTU ya soportadas;
- ejecución manual;
- valores decimal y hexadecimal;
- solicitudes guardadas;
- trama TX/RX;
- confirmación de escrituras.

Etapa posterior:

- nombres y tipos de datos;
- escala y unidad de ingeniería;
- polling;
- watch list;
- historial breve;
- edición desde la tabla.

### Tráfico Modbus

El monitor actual evolucionará hacia el analizador de la tercera referencia.

Primera etapa:

- tabla de transacciones;
- filtros por unidad, función y resultado;
- pausa, limpieza y exportación;
- detalle TX/RX;
- CRC, excepción y duración interpretados.

Etapa posterior:

- separación solicitud/respuesta;
- desglose byte a byte;
- representación hex y binaria;
- cronología de sesión;
- distribución de latencia;
- estadísticas y búsqueda avanzada.

## Patrones de interacción

- Las lecturas se ejecutan directamente.
- Toda escritura Modbus requiere confirmación explícita.
- Una operación activa deshabilita controles incompatibles.
- Una fila seleccionada abre detalle sin navegar a otra pantalla.
- Los paneles secundarios pueden plegarse para recuperar espacio.
- `Esc` cierra diálogos; `Enter` ejecuta la acción primaria cuando sea seguro.
- Los errores se explican en lenguaje operativo y conservan el código Modbus.
- TX/RX siempre permanece disponible para auditoría.
- Los tamaños de tablas, matrices y barras no cambian durante una operación.

## Qué se adopta de cada familia

### Primeras cuatro propuestas

Se adopta como destino final:

- tema oscuro;
- navegación lateral;
- barra global de comandos;
- barra inferior de estado;
- áreas multipanel;
- tablas densas;
- inspector contextual;
- análisis técnico y visualizaciones útiles.

### Propuestas intermedias

Se adopta:

- menor cantidad de paneles simultáneos;
- jerarquía más clara;
- formularios de conexión más respirables;
- tabla principal dominante;
- detalle lateral enfocado.

### Propuestas sencillas

Se adopta:

- lenguaje comprensible;
- recorridos numerados cuando la tarea lo requiere;
- explicaciones de errores;
- estados vacíos que indican el siguiente paso;
- resúmenes de actividad para usuarios nuevos.

No se adopta su reducción funcional como límite del producto.

## Plan de transformación

### Fase 1: shell profesional

- tema oscuro y tokens visuales;
- barra de comandos;
- navegación lateral;
- barra de estado;
- migración de las funciones actuales sin alterar el motor RTU.

### Fase 2: superficies operativas

- Dispositivos con conexión y resumen;
- Pruebas con el preset JWPLC;
- Registros basado en el Maestro RTU;
- Tráfico basado en el monitor actual.

### Fase 3: profundidad técnica

- tablas con selección e inspector;
- filtros y polling;
- perfiles y sesiones;
- desglose de tramas;
- métricas de sesión.

### Fase 4: expansión

- escaneo;
- Modbus TCP;
- simulador;
- inyección de fallos;
- secuencias de prueba editables;
- gráficas e historial.

La Fase 1 y la Fase 2 son el siguiente objetivo. Las fases posteriores quedan
previstas por la arquitectura, pero no deben retrasar una versión RTU sólida.
