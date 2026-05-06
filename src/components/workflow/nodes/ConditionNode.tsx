'use client';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as { name: string };
  return (
    <div
      className={`min-w-[200px] rounded-lg border-2 px-4 py-3 bg-[#1f1f1f] shadow-lg ${
        selected ? 'border-[#eab308]' : 'border-[#262626]'
      }`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[#eab308] mb-1">
        <GitBranch className="h-3 w-3" /> Condition
      </div>
      <div className="font-medium text-sm">{d.name}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
