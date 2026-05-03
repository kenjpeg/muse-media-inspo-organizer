import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { useAppStore } from './stores/app-store';
import { api } from './lib/ipc';

export function App() {
  const { refreshAll, setTheme } = useAppStore();

  useEffect(() => {
    refreshAll();
    api.getTheme().then((theme: string) => setTheme(theme as 'light' | 'dark'));
    const unsubscribe = api.onThemeChange((theme: string) => setTheme(theme as 'light' | 'dark'));

    const handleImport = () => refreshAll();
    window.addEventListener('files-imported', handleImport);

    return () => {
      unsubscribe();
      window.removeEventListener('files-imported', handleImport);
    };
  }, [refreshAll, setTheme]);

  return <AppShell />;
}
