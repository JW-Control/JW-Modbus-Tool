/*
  Slave_JWSim_8FC

  Slave Modbus RTU para probar JW Modbus Tool contra el JWPLC Basic real o
  contra JWPLC Sim (node cli/jwsim-bus.mjs <esta carpeta> --tcp|--com).
  Cubre las 8 funciones que soporta el Tool: FC1, FC2, FC3, FC4, FC5, FC6,
  FC15 y FC16.

  - Slave ID 2, 115200 8N1 (como la plantilla JWPLC Basic Remote I/O).
  - Coils 0..7        -> salidas Q0_0..Q0_7 (FC1, FC5, FC15).
  - Entradas 0..7     <- entradas I0_0..I0_7 (FC2).
  - Holding HR0..HR7  -> HR0 = segundos desde el arranque; HR1..HR7 libres
                         para escribir (FC3, FC6, FC16).
  - Input IR0..IR3    -> valores fijos 1750, 2304, 4242 y 65535 (FC4).
*/

#include <JWPLC_ModbusRTU.h>

static constexpr uint8_t SLAVE_ID = 2;

static uint8_t coils[1] = {0};
static uint8_t inputs[1] = {0};
static uint16_t holding[8] = {0, 100, 200, 300, 400, 500, 600, 700};
static const uint16_t inputRegisters[4] = {1750, 2304, 4242, 65535};

static uint32_t lastIoMs = 0;

void setup()
{
    Serial.begin(115200);

    JWPLC_ModbusRTU.setCoils(coils, 8);
    JWPLC_ModbusRTU.setDiscreteInputs(inputs, 8);
    JWPLC_ModbusRTU.setHoldingRegisters(holding, 8);
    JWPLC_ModbusRTU.setInputRegisters(inputRegisters, 4);

    if (!JWPLC_ModbusRTU.begin(SLAVE_ID, 115200, SERIAL_8N1))
    {
        Serial.print("Modbus begin failed: ");
        Serial.println(JWPLC_ModbusRTU.lastErrorString());
        return;
    }

    Serial.println("Slave_JWSim_8FC listo: ID=2 | 115200 8N1");
}

void loop()
{
    JWPLC_ModbusRTU.task();

    if (millis() - lastIoMs >= 20)
    {
        lastIoMs = millis();
        holding[0] = (uint16_t)(millis() / 1000UL);
        inputs[0] = (uint8_t)digitalReadBlock(I0_X);
        digitalWriteBlock(Q0_X, coils[0]);
    }
}
