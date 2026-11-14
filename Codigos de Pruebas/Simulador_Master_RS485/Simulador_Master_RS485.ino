/*
  Simulador_Master_RS485

  Hace lo mismo que Simulador_Master_USB, pero por el RS-485 del JWPLC con la
  librería JWPLC_ModbusRTU (prueba C2 de docs/PLAN_PRUEBAS_SIMULADOR.md).
  El USB queda libre: el Monitor serie muestra el resumen.

  En JW Modbus Tool, vista Simulador:
  - Puerto: el COM del conversor USB-RS485. 9600 baudios, 8 bits, sin
    paridad, 1 stop.
  - Agregar dos dispositivos virtuales: ID 1 e ID 2 (plantilla Genérico).
  - Iniciar simulador.

  En JWPLC Sim: node cli/jwsim-bus.mjs <esta carpeta> --com <puerto> (o --tcp).

  Ciclo de 9 pasos, uno cada 100 ms (prueba las 8 funciones y 2 slaves):
    1. FC01 lee coils 0..7 del ID 2 y las copia a las salidas Q0_0..Q0_7.
    2. FC02 lee entradas discretas 0..7 del ID 2.
    3. FC03 lee holding registers 0..3 del ID 2.
    4. FC04 lee input registers 0..3 del ID 2.
    5. FC05 alterna la coil 8 del ID 2 (parpadea en el simulador).
    6. FC06 escribe en el HR 0 del ID 2 el estado de las entradas I0_0..I0_7.
    7. FC15 escribe en las coils 16..23 del ID 2 un contador binario.
    8. FC16 escribe en los HR 10..12 del ID 1: ciclos, respuestas OK, errores.
    9. FC03 lee holding registers 0..1 del ID 1.

  Cómo verificar:
  - Activar coils 0..7 del ID 2 en el simulador enciende Q0_0..Q0_7.
  - Activar entradas I0_X cambia el HR 0 (40000) del ID 2.
  - En el ID 1, HR 10 (40010) cuenta ciclos y HR 12 (40012) cuenta errores.
    Con el simulador corriendo, HR 12 debe quedarse quieto.
  - Cada 5 s el Monitor serie imprime "RESUMEN ciclos=… ok=… errores=… salidas=0x…".
*/

#include <JWPLC_ModbusRTU.h>

static constexpr uint32_t MODBUS_BAUD = 9600;
static constexpr uint32_t STEP_PERIOD_MS = 100;
static constexpr uint32_t RESPONSE_TIMEOUT_MS = 300;
static constexpr uint8_t SLAVE_A = 1;
static constexpr uint8_t SLAVE_B = 2;
static constexpr uint8_t STEP_COUNT = 9;

static uint8_t coilsIn[1] = {0};
static uint8_t inputsIn[1] = {0};
static uint16_t registersIn[4] = {0, 0, 0, 0};
static uint8_t counterBits[1] = {0};
static uint16_t statusRegisters[3] = {0, 0, 0};

static uint16_t cycles = 0;
static uint16_t okCount = 0;
static uint16_t errorCount = 0;
static uint8_t step = 0;
static bool blinkCoil = false;
static uint32_t nextStepMs = 1000;
static uint32_t nextReportMs = 5000;

static bool startStep(uint8_t index)
{
    switch (index)
    {
    case 0:
        return JWPLC_ModbusRTU.requestReadCoils(SLAVE_B, 0, 8, coilsIn, RESPONSE_TIMEOUT_MS);
    case 1:
        return JWPLC_ModbusRTU.requestReadDiscreteInputs(SLAVE_B, 0, 8, inputsIn, RESPONSE_TIMEOUT_MS);
    case 2:
        return JWPLC_ModbusRTU.requestReadHoldingRegisters(SLAVE_B, 0, 4, registersIn, RESPONSE_TIMEOUT_MS);
    case 3:
        return JWPLC_ModbusRTU.requestReadInputRegisters(SLAVE_B, 0, 4, registersIn, RESPONSE_TIMEOUT_MS);
    case 4:
        blinkCoil = !blinkCoil;
        return JWPLC_ModbusRTU.requestWriteSingleCoil(SLAVE_B, 8, blinkCoil, RESPONSE_TIMEOUT_MS);
    case 5:
        return JWPLC_ModbusRTU.requestWriteSingleRegister(SLAVE_B, 0, (uint16_t)digitalReadBlock(I0_X), RESPONSE_TIMEOUT_MS);
    case 6:
        counterBits[0] = (uint8_t)(cycles & 0xFF);
        return JWPLC_ModbusRTU.requestWriteMultipleCoils(SLAVE_B, 16, 8, counterBits, RESPONSE_TIMEOUT_MS);
    case 7:
        statusRegisters[0] = cycles;
        statusRegisters[1] = okCount;
        statusRegisters[2] = errorCount;
        return JWPLC_ModbusRTU.requestWriteMultipleRegisters(SLAVE_A, 10, 3, statusRegisters, RESPONSE_TIMEOUT_MS);
    default:
        return JWPLC_ModbusRTU.requestReadHoldingRegisters(SLAVE_A, 0, 2, registersIn, RESPONSE_TIMEOUT_MS);
    }
}

static void finishStep(uint8_t index, bool succeeded)
{
    if (succeeded)
    {
        okCount++;
    }
    else
    {
        errorCount++;
    }

    if (index == 0 && succeeded)
    {
        digitalWriteBlock(Q0_X, coilsIn[0]);
    }

    if (index == STEP_COUNT - 1)
    {
        cycles++;
    }
}

void setup()
{
    Serial.begin(115200);

    if (!JWPLC_ModbusRTU.begin(247, MODBUS_BAUD, SERIAL_8N1))
    {
        Serial.print("Modbus begin failed: ");
        Serial.println(JWPLC_ModbusRTU.lastErrorString());
        return;
    }

    Serial.println("Simulador_Master_RS485 listo: IDs 1 y 2 | 9600 8N1");
}

void loop()
{
    JWPLC_ModbusRTU.task();
    const uint32_t now = millis();

    if (JWPLC_ModbusRTU.masterDone())
    {
        finishStep(step, JWPLC_ModbusRTU.masterSucceeded());
        JWPLC_ModbusRTU.clearMasterResult();
        step = (uint8_t)((step + 1) % STEP_COUNT);
    }

    if (!JWPLC_ModbusRTU.masterBusy() && !JWPLC_ModbusRTU.masterDone() && (int32_t)(now - nextStepMs) >= 0)
    {
        nextStepMs = now + STEP_PERIOD_MS;

        if (!startStep(step))
        {
            finishStep(step, false);
            step = (uint8_t)((step + 1) % STEP_COUNT);
        }
    }

    if ((int32_t)(now - nextReportMs) >= 0)
    {
        nextReportMs = now + 5000;
        Serial.print("RESUMEN ciclos=");
        Serial.print(cycles);
        Serial.print(" ok=");
        Serial.print(okCount);
        Serial.print(" errores=");
        Serial.print(errorCount);
        Serial.print(" salidas=0x");
        Serial.println(coilsIn[0], HEX);
    }
}
