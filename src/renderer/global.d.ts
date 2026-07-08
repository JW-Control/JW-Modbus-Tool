export {};

declare global {
  interface Window {
    jwModbus?: {
      appName: string;
      versions: {
        chrome?: string;
        electron?: string;
        node?: string;
      };
      serial: {
        listPorts: () => Promise<unknown>;
      };
    };
  }
}
