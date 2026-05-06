'use client';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Bot,
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
} from 'lucide-react';
import type { ToolId, StepStatus } from '@/types/workflow';

interface Data {
  name: string;
  goal: string;
  toolkit: ToolId[];
  status?: StepStatus;
  isSpawned?: boolean;
}

const STATUS_ICON: Record<StepStatus, React.ElementType> = {
  pending: Circle,
  running: Loader2,
  success: CheckCircle2,
  failed: XCircle,
  spawned: Bot,
};

const STATUS_COLOR: Record<StepStatus, string> = {
  pending: 'text-[#737373]',
  running: 'text-[#6366f1] animate-spin',
  success: 'text-[#22c55e]',
  failed: 'text-[#ef4444]',
  spawned: 'text-[#a855f7]',
};

const BORDER: Record<StepStatus, string> = {
  pending: 'border-[#1f1f1f]',
  running: 'border-[#6366f1] shadow-[0_0_20px_rgba(99,102,241,0.4)]',
  success: 'border-[#22c55e]/60',
  failed: 'border-[#ef4444]/60',
  spawned: 'border-[#a855f7]/60',
};

export function AgentNode({ data, selected }: NodeProps) {
  const d = data as unknown as Data;
  const status: StepStatus = d.status ?? 'pending';
  const StatusIcon = STATUS_ICON[status];

  return (
    <div
      className={`min-w-[240px] max-w-[280px] rounded-lg border-2 px-4 py-3 bg-[#111111] shadow-lg transition ${
        selected ? 'ring-2 ring-[#6366f1]' : ''
      } ${BORDER[status]}`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 mb-1">
        <Bot className="h-3.5 w-3.5 text-[#6366f1]" />
        <span className="text-[10px] uppercase tracking-wide text-[#737373]">
          {d.isSpawned ? 'spawned agent' : 'agent'}
        </span>
        <StatusIcon className={`h-3.5 w-3.5 ml-auto ${STATUS_COLOR[status]}`} />
      </div>
      <div className="font-medium text-sm text-[#fafafa] mb-1">{d.name}</div>
      <div className="text-xs text-[#a3a3a3] line-clamp-3 mb-2">{d.goal}</div>
      {d.toolkit.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {d.toolkit.map((t) => (
            <span
              key={t}
              className="text-[10px] font-mono px-1.5 py-0.5 bg-[#1f1f1f] rounded text-[#a3a3a3]"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
