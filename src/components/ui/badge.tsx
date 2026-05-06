import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'success' | 'danger' | 'warning' | 'info';

const styles: Record<Variant, string> = {
  default: 'bg-[#1f1f1f] text-[#a3a3a3] border border-[#262626]',
  success: 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30',
  danger: 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30',
  warning: 'bg-[#eab308]/10 text-[#eab308] border border-[#eab308]/30',
  info: 'bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/30',
};

export function Badge({
  variant = 'default',
  className,
  children,
}: {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, Variant> = {
    success: 'success',
    failed: 'danger',
    running: 'info',
    pending: 'warning',
  };
  return <Badge variant={map[status] ?? 'default'}>{status}</Badge>;
}
