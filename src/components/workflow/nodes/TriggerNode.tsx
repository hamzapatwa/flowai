'use client';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Webhook, Zap, Clock } from 'lucide-react';

interface Data {
  name: string;
  triggerType?: string;
  config?: Record<string, unknown>;
}

export function TriggerNode({ data, selected }: NodeProps) {
  const d = data as unknown as Data;
  const tt = d.triggerType ?? 'manual';
  const Icon = tt === 'webhook' ? Webhook : tt === 'schedule' ? Clock : Zap;
  return (
    <div
      className={`min-w-[220px] rounded-lg border-2 px-4 py-3 bg-gradient-to-br from-[#6366f1] to-[#4f46e5] text-white shadow-lg ${
        selected
          ? 'border-white shadow-[0_0_20px_rgba(99,102,241,0.6)]'
          : 'border-[#4f46e5]'
      }`}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-80 mb-1">
        <Icon className="h-3 w-3" />
        Trigger · {tt}
      </div>
      <div className="font-medium text-sm">{d.name}</div>
      {tt === 'schedule' && d.config && typeof d.config.cron === 'string' && (
        <div className="text-xs opacity-80 mt-0.5 font-mono">{d.config.cron}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
