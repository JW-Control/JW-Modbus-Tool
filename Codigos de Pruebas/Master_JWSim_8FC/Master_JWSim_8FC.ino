/*
  Master_JWSim_8FC

  Master Modbus RTU que recorre las 8 funciones contra el slave ID 2 de
  JW Modbus Tool (vista Simulador). Sirve para el JWPLC Basic real o para
  JWPLC Sim (node cli/jwsim-bus.mjs <esta carpeta> --tcp|--com).

  - 115200 8N1, una petición cada 20 ms.
  - Escribe y relee: FC5/FC15 -> FC1, FC6/FC16 -> FC3. Lee FC2 y FC4.
  - Cada 2 s imprime: "RESUMEN ok=<n> fail=<n> mismatch=<n>".
*/

#include <JWPLC_ModbusRTU.h>

static constexpr uint8_t SLAVE = 2;

static uint8_t coilsOut[1] = {0};
static uint8_t coilsIn[1] = {0};
static uint8_t inputs[1] = {0};
static uint16_t regsOut[3] = {0, 0, 0};
static uint16_t regsIn[4] = {0, 0, 0, 0};
static uint16_t inputRegs[2] = {0, 0};

static uint8_t stepIndex = 0;
static uint16_t cycle = 0;
static uint32_t ok = 0, fail = 0, mismatch = 0;
static uint32_t nextMs = 1000, reportMs = 3000;

static bool startStep()
{
    switch (stepIndex)
    {
    case 0:
        coilsOut[0] = (uint8_t)(cycle * 37);
        return JWPLC_ModbusRTU.requestWriteMultipleCoils(SLAVE, 0, 8, coilsOut);
    case 1:
        return JWPLC_ModbusRTU.requestWriteSingleCoil(SLAVE, 7, (cycle & 1) != 0);
    case 2:
        return JWPLC_ModbusRTU.requestReadCoils(SLAVE, 0, 8, coilsIn);
    case 3:
        return JWPLC_ModbusRTU.requestReadDiscreteInputs(SLAVE, 0, 8, inputs);
    case 4:
        return JWPLC_ModbusRTU.requestWriteSingleRegister(SLAVE, 1, (uint16_t)(4242 + cycle));
    case 5:
        regsOut[0] = cycle;
        regsOut[1] = (uint16_t)(1000 + cycle);
        regsOut[2] = (uint16_t)(65535 - cycle);
        return JWPLC_ModbusRTU.requestWriteMultipleRegisters(SLAVE, 2, 3, regsOut);
    case 6:
        return JWPLC_ModbusRTU.requestReadHoldingRegisters(SLAVE, 1, 4, regsIn);
    default:
        return JWPLC_ModbusRTU.requestReadInputRegisters(SLAVE, 0, 2, inputRegs);
    }
}

static bool checkStep()
{
    if (stepIndex == 2)
    {
        const uint8_t expected = (uint8_t)((coilsOut[0] & 0x7F) | ((cycle & 1) ? 0x80 : 0));
        return coilsIn[0] == expected;
    }
    if (stepIndex == 6)
    {
        return regsIn[0] == (uint16_t)(4242 + cycle) && regsIn[1] == regsOut[0] &&
               regsIn[2] == regsOut[1] && regsIn[3] == regsOut[2];
    }
    return true;
}

void setup()
{
    Serial.begin(115200);

    if (!JWPLC_ModbusRTU.begin(247, 115200, SERIAL_8N1))
    {
        Serial.print("Modbus begin failed: ");
        Serial.println(JWPLC_ModbusRTU.lastErrorString());
        return;
    }

    Serial.println("Master_JWSim_8FC listo: slave ID=2 | 115200 8N1");
}

void loop()
{
    JWPLC_ModbusRTU.task();
    const uint32_t now = millis();

    if (JWPLC_ModbusRTU.masterDone())
    {
        if (!JWPLC_ModbusRTU.masterSucceeded())
        {
            fail++;
        }
        else if (checkStep())
        {
            ok++;
        }
        else
        {
            mismatch++;
        }

        JWPLC_ModbusRTU.clearMasterResult();
        stepIndex = (uint8_t)((stepIndex + 1) % 8);
        if (stepIndex == 0) cycle++;
        nextMs = now + 20;
    }

    if (!JWPLC_ModbusRTU.masterBusy() && !JWPLC_ModbusRTU.masterDone() && (int32_t)(now - nextMs) >= 0)
    {
        if (!startStep())
        {
            fail++;
            nextMs = now + 20;
        }
    }

    if ((int32_t)(now - reportMs) >= 0)
    {
        reportMs = now + 2000;
        Serial.print("RESUMEN ok=");
        Serial.print(ok);
        Serial.print(" fail=");
        Serial.print(fail);
        Serial.print(" mismatch=");
        Serial.println(mismatch);
    }
}
