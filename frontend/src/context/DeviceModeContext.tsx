import React, { createContext, useContext } from "react";

export type DeviceMode = "desktop" | "mobile";

const DeviceModeContext = createContext<DeviceMode>("desktop");

export const DeviceModeProvider: React.FC<{
  mode: DeviceMode;
  children: React.ReactNode;
}> = ({ mode, children }) => (
  <DeviceModeContext.Provider value={mode}>
    {children}
  </DeviceModeContext.Provider>
);

export const useDeviceMode = (): DeviceMode => useContext(DeviceModeContext);
