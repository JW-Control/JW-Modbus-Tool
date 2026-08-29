/*
  ModbusRTU_Tool_Test

  Este ejemplo configura el JWPLC como un Esclavo Modbus RTU, 
  ideal para pruebas con "JW Modbus Tool".

  Demuestra cmo leer y escribir bloques enteros de I/O (I0_X y Q0_X)
  de forma ptima usando timers para no saturar el bus I2C.
*/

#include <JWPLC_ModbusRTU.h>
#include <JWPLC_Display.h> // REQUERIDO para compilar y encender la pantalla en la nueva version
#include <Arduino.h>

// Creamos un arreglo de 2 registros Modbus (Holding Registers)
// Registro 0 (Direccin 0): Guardar el estado de las Entradas I0_X
// Registro 1 (Direccin 1): Recibir el estado para las Salidas Q0_X
uint16_t modbusRegisters[2] = {0, 0};

// Variable para controlar la velocidad de actualizacin fsica
unsigned long ultimoTiempoIO = 0;

void setup() {
  Serial.begin(115200);
  
  // El nuevo Core de JWPLC inicializa automticamente el bus I2C, el chip TCA6424A
  // y configura los pines I0_X como entrada y Q0_X como salida en segundo plano!
  // NUNCA debes llamar a Wire.begin() ni pinMode para estos pines industriales aqu,
  // porque chocar con el RTOS y congelar la pantalla y el equipo.

  Serial.println("Iniciando PLC como Esclavo Modbus...");

  // 1. Iniciar el Modbus RTU (Slave ID 1, 9600 Baudios, 8N1)
  if (!JWPLC_ModbusRTU.begin(1, 9600, SERIAL_8N1)) {
    Serial.println("Error al iniciar Modbus RTU.");
    return;
  }

  // 2. Vincular nuestro arreglo para que el Modbus pueda leerlo y escribirlo
  JWPLC_ModbusRTU.setHoldingRegisters(modbusRegisters, 2);

  Serial.println("Esclavo Modbus ID 1 listo en 9600 baudios.");
}

void loop() {
  // 1. Procesar peticiones del bus RS-485 (NO BLOQUEANTE)
  JWPLC_ModbusRTU.task();
  
  // 2. Actualizar Entradas y Salidas fsicas (SOLO cada 50ms)
  if (millis() - ultimoTiempoIO >= 50) {
    ultimoTiempoIO = millis();

    // Leer las entradas fsicas reales (bloque completo) y guardarlas en Registro 0
    modbusRegisters[0] = digitalReadBlock(I0_X);
      
    // Escribir el valor recibido por Modbus (Registro 1) a las salidas reales
    digitalWriteBlock(Q0_X, modbusRegisters[1]);
  }
}
