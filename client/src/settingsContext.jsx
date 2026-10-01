import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSettings } from './api';

const defaultSettings = { currencySymbol: '₹', lowStockAlertEnabled: true, phone: '' };

const SettingsContext = createContext({ ...defaultSettings, refreshSettings: () => {}, setSettings: () => {} });

function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultSettings);

  const refreshSettings = useCallback(async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch {
      // Keep defaults if settings can't be loaded yet (e.g. before login completes).
    }
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  return (
    <SettingsContext.Provider value={{ ...settings, refreshSettings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

function useSettings() {
  return useContext(SettingsContext);
}

export { SettingsProvider, useSettings };
