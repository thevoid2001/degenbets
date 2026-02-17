"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface Toast {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

interface ToastContextValue {
  addToast: (type: Toast["type"], message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  addToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[9998] flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-item flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm cursor-pointer ${
              toast.type === "success"
                ? "bg-degen-green/10 border-degen-green/30 text-degen-green"
                : toast.type === "error"
                  ? "bg-degen-red/10 border-degen-red/30 text-degen-red"
                  : "bg-degen-accent/10 border-degen-accent/30 text-degen-accent"
            }`}
            onClick={() => removeToast(toast.id)}
          >
            <span className="text-lg leading-none mt-0.5">
              {toast.type === "success" ? "\u2713" : toast.type === "error" ? "\u2717" : "\u2139"}
            </span>
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
