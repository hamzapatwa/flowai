'use client';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Globe, MessageCircle, Mail, Box } from 'lucide-react';

const ICONS: Record<string, React.ElementType> = {
  http: Globe,
  slack: MessageCircle,
  gmail: Mail,
};

export function ActionNode({ data, selected }: NodeProps) {
  const d = data as { name: string; integration: string; action: string };
  const Icon = ICONS[d.integration] ?? Box;
  return (
    <div
      className={`min-w-[220px] rounded-lg border-2 px-4 py-3 bg-[#111111] shadow-lg ${
        selected
          ? 'border-[#6366f1] shadow-[0_0_20px_rgba(99,102,241,0.4)]'
          : 'border-[#1f1f1f]'
      }`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[#737373] mb-1">
        <Icon className="h-3 w-3" />
        {d.integration}
      </div>
      <div className="font-medium text-sm text-[#fafafa]">{d.name}</div>
      <div className="text-xs text-[#a3a3a3] mt-0.5 font-mono">{d.action}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
