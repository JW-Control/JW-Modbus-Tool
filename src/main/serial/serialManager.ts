export interface SerialPortDescriptor {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

export async function listSerialPorts(): Promise<SerialPortDescriptor[]> {
  // Serial integration is intentionally deferred until the RTU core is stable.
  return [];
}
