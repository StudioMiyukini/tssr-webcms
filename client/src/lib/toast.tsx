import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type ToastType = 'info' | 'success' | 'error';
interface Toast { id: number; message: string; type: ToastType; }
interface ToastContextValue { push: (message: string, type?: ToastType) => void; }

const ToastContext = createContext<ToastContextValue>({ push: () => {} });

/*
 * @id     tssr.webToastProvider
 * @do     fournir_toasts
 * @role   ui
 * @layer  ui
 * @human  Fournisseur de notifications éphémères (toasts) pour l'application.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map(t => <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>)}
      </div>
    </ToastContext.Provider>
  );
}

/*
 * @id     tssr.webUseToast
 * @do     consommer_toasts
 * @role   ui
 * @layer  ui
 * @human  Hook d'émission de notifications éphémères.
 */
export const useToast = () => useContext(ToastContext);
