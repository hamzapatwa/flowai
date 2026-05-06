'use client';
import * as React from 'react';
import { createContext, useContext, useCallback, useState } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastCtx {
  push: (kind: ToastKind, message: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-start gap-3 px-4 py-3 rounded-md border bg-[#111111] border-[#1f1f1f] shadow-lg animate-in slide-in-from-right"
          >
            {t.kind === 'success' && (
              <CheckCircle2 className="h-5 w-5 text-[#22c55e] shrink-0 mt-0.5" />
            )}
            {t.kind === 'error' && (
              <XCircle className="h-5 w-5 text-[#ef4444] shrink-0 mt-0.5" />
            )}
            {t.kind === 'info' && (
              <Info className="h-5 w-5 text-[#6366f1] shrink-0 mt-0.5" />
            )}
            <span className="text-sm">{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      push: (_kind: ToastKind, message: string) => {
        if (typeof window !== 'undefined') console.log(`[toast]`, message);
      },
    };
  }
  return ctx;
}
