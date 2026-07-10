// @ts-nocheck
export {};

const installKey = "__jwSimpleModbusResultCompatInstalled";
const patchedKey = "__jwSimpleModbusResultCompatPatched";

function mirrorSerialResult(result) {
  if (result?.ok === true && result.value && typeof result.value === "object") {
    // Mantiene { ok, value } para la UI React, pero expone values/registerValues/crcOk
    // en el nivel superior para el runtime overlay de Pruebas.
    return Object.assign(result, result.value);
  }

  if (result?.ok === false) {
    // Evita que el overlay interprete una falla de comunicación como Respuesta OK.
    return Object.assign(result, {
      exception: { exceptionName: result.error || "Error de comunicación Modbus" }
    });
  }

  return result;
}

function patchModbusApi() {
  const modbus = window.jwModbus?.modbus;
  if (!modbus || modbus[patchedKey]) return Boolean(modbus?.[patchedKey]);

  const names = [
    "readCoils",
    "readDiscreteInputs",
    "readHoldingRegisters",
    "readInputRegisters",
    "writeSingleCoil",
    "writeMultipleCoils",
    "writeSingleRegister",
    "writeMultipleRegisters",
    "runJwplcValidation"
  ];

  for (const name of names) {
    const original = modbus[name];
    if (typeof original !== "function") continue;
    modbus[name] = async (...args) => mirrorSerialResult(await original(...args));
  }

  modbus[patchedKey] = true;
  return true;
}

if (!window[installKey]) {
  window[installKey] = true;
  if (!patchModbusApi()) {
    const timer = window.setInterval(() => {
      if (patchModbusApi()) window.clearInterval(timer);
    }, 100);
    window.setTimeout(() => window.clearInterval(timer), 5000);
  }
}
