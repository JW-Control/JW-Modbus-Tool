export interface AppConfig {
  theme: "light" | "dark" | "system";
  lastSerialPort?: string;
  monitorEnabled: boolean;
}

export const defaultAppConfig: AppConfig = {
  theme: "system",
  monitorEnabled: true
};
