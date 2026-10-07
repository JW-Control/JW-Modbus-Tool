/*
  Simulador_Master_USB

  Convierte el JWPLC en un master Modbus RTU que usa el puerto USB (Serial)
  como bus, para probar el Simulador slave de JW Modbus Tool sin adaptador
  RS-485.

  IMPORTANTE: Serial es el bus Modbus. Este sketch no usa Serial.print();
  cualquier texto por Serial llegaria al simulador como tramas invalidas.

  En JW Modbus Tool, vista Simulador:
  - Puerto: el COM del JWPLC. 9600 baudios, 8 bits, sin paridad, 1 stop.
  - Agregar dos dispositivos virtuales: ID 1 e ID 2.
  - Iniciar simulador.

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

  Como verificar:
  - Activar coils 0..7 del ID 2 en el simulador enciende Q0_0..Q0_7.
  - Activar entradas fisicas I0_X cambia el HR 0 (40000) del ID 2.
  - En el ID 1, HR 10 (40010) cuenta ciclos y HR 12 (40012) cuenta errores.
    Con el simulador corriendo, HR 12 debe quedarse quieto.
*/

#include <Arduino.h>

static const uint32_t MODBUS_BAUD = 9600;
static const uint32_t STEP_PERIOD_MS = 100;
static const uint32_t RESPONSE_TIMEOUT_MS = 300;

static const uint8_t SLAVE_A = 1;
static const uint8_t SLAVE_B = 2;
static const uint8_t STEP_COUNT = 9;

uint8_t txFrame[64];
uint8_t rxFrame[64];

uint16_t cycles = 0;
uint16_t okCount = 0;
uint16_t errorCount = 0;
uint8_t step = 0;
bool blinkCoil = false;
unsigned long lastStepMs = 0;

uint16_t modbusCRC16(const uint8_t *data, size_t length)
{
  uint16_t crc = 0xFFFF;

  for (size_t i = 0; i < length; i++)
  {
    crc ^= data[i];

    for (uint8_t bit = 0; bit < 8; bit++)
    {
      crc = (crc & 0x0001) ? (crc >> 1) ^ 0xA001 : crc >> 1;
    }
  }

  return crc;
}

void putU16(size_t offset, uint16_t value)
{
  txFrame[offset] = value >> 8;
  txFrame[offset + 1] = value & 0xFF;
}

size_t finishFrame(size_t payloadLength)
{
  const uint16_t crc = modbusCRC16(txFrame, payloadLength);
  txFrame[payloadLength] = crc & 0xFF;
  txFrame[payloadLength + 1] = crc >> 8;
  return payloadLength + 2;
}

// FC01 a FC06: direccion + cantidad (lecturas) o direccion + valor (escrituras).
size_t buildSimpleRequest(uint8_t unitId, uint8_t functionCode, uint16_t address, uint16_t quantityOrValue)
{
  txFrame[0] = unitId;
  txFrame[1] = functionCode;
  putU16(2, address);
  putU16(4, quantityOrValue);
  return finishFrame(6);
}

// Envia txFrame y espera la respuesta de expectedLength bytes.
bool transact(size_t requestLength, size_t expectedLength)
{
  while (Serial.available() > 0)
  {
    Serial.read();
  }

  Serial.write(txFrame, requestLength);
  Serial.flush();

  size_t received = 0;
  const unsigned long startMs = millis();

  while (millis() - startMs < RESPONSE_TIMEOUT_MS)
  {
    while (Serial.available() > 0 && received < sizeof(rxFrame))
    {
      rxFrame[received++] = Serial.read();
    }

    if (received >= expectedLength)
    {
      break;
    }

    // Respuesta de excepcion: unit id, funcion | 0x80, codigo, CRC.
    if (received >= 5 && (rxFrame[1] & 0x80))
    {
      break;
    }

    delay(1);
  }

  const bool ok = received >= expectedLength &&
                  rxFrame[0] == txFrame[0] &&
                  rxFrame[1] == txFrame[1] &&
                  modbusCRC16(rxFrame, expectedLength - 2) ==
                      (uint16_t)(rxFrame[expectedLength - 2] | (rxFrame[expectedLength - 1] << 8));

  if (ok)
  {
    okCount++;
  }
  else
  {
    errorCount++;
  }

  return ok;
}

void runStep(uint8_t index)
{
  switch (index)
  {
  case 0:
    // FC01: 8 coils -> 1 byte de datos -> respuesta de 6 bytes.
    if (transact(buildSimpleRequest(SLAVE_B, 0x01, 0, 8), 6))
    {
      digitalWriteBlock(Q0_X, rxFrame[3]);
    }
    break;

  case 1:
    transact(buildSimpleRequest(SLAVE_B, 0x02, 0, 8), 6);
    break;

  case 2:
    // FC03: 4 registros -> 8 bytes de datos -> respuesta de 13 bytes.
    transact(buildSimpleRequest(SLAVE_B, 0x03, 0, 4), 13);
    break;

  case 3:
    transact(buildSimpleRequest(SLAVE_B, 0x04, 0, 4), 13);
    break;

  case 4:
    blinkCoil = !blinkCoil;
    transact(buildSimpleRequest(SLAVE_B, 0x05, 8, blinkCoil ? 0xFF00 : 0x0000), 8);
    break;

  case 5:
    transact(buildSimpleRequest(SLAVE_B, 0x06, 0, digitalReadBlock(I0_X)), 8);
    break;

  case 6:
    // FC15: 8 coils desde la 16, 1 byte de datos.
    txFrame[0] = SLAVE_B;
    txFrame[1] = 0x0F;
    putU16(2, 16);
    putU16(4, 8);
    txFrame[6] = 1;
    txFrame[7] = cycles & 0xFF;
    transact(finishFrame(8), 8);
    break;

  case 7:
    // FC16: 3 registros desde el 10, 6 bytes de datos.
    txFrame[0] = SLAVE_A;
    txFrame[1] = 0x10;
    putU16(2, 10);
    putU16(4, 3);
    txFrame[6] = 6;
    putU16(7, cycles);
    putU16(9, okCount);
    putU16(11, errorCount);
    transact(finishFrame(13), 8);
    break;

  case 8:
    transact(buildSimpleRequest(SLAVE_A, 0x03, 0, 2), 9);
    cycles++;
    break;
  }
}

void setup()
{
  Serial.begin(MODBUS_BAUD, SERIAL_8N1);
}

void loop()
{
  if (millis() - lastStepMs < STEP_PERIOD_MS)
  {
    return;
  }

  lastStepMs = millis();
  runStep(step);
  step = (step + 1) % STEP_COUNT;
}
