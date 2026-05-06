'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit, Activity, Trash2, MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { formatRelative } from '@/lib/utils';

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  triggerType: string;
  updatedAt: string;
}

export function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${workflow.name}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/workflows/${workflow.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      toast.push('success', 'Workflow deleted');
      router.refresh();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-[#1f1f1f] rounded-lg p-5 bg-[#111111] hover:border-[#262626] transition group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link
          href={`/workflows/${workflow.id}`}
          className="font-medium text-[#fafafa] hover:text-[#6366f1] transition"
        >
          {workflow.name}
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant={workflow.isActive ? 'success' : 'default'}>
            {workflow.isActive ? 'active' : 'inactive'}
          </Badge>
        </div>
      </div>
      {workflow.description && (
        <p className="text-sm text-[#a3a3a3] mb-4 line-clamp-2">
          {workflow.description}
        </p>
      )}
      <div className="flex items-center gap-2 text-xs text-[#737373] mb-4">
        <Badge variant="info">{workflow.triggerType}</Badge>
        <span>· updated {formatRelative(workflow.updatedAt)}</span>
      </div>
      <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100 transition">
        <Link
          href={`/workflows/${workflow.id}`}
          className="text-xs px-2 py-1 rounded hover:bg-[#1f1f1f] flex items-center gap-1"
        >
          <Edit className="h-3 w-3" /> Edit
        </Link>
        <Link
          href={`/workflows/${workflow.id}/runs`}
          className="text-xs px-2 py-1 rounded hover:bg-[#1f1f1f] flex items-center gap-1"
        >
          <Activity className="h-3 w-3" /> Runs
        </Link>
        <button
          onClick={handleDelete}
          disabled={busy}
          className="text-xs px-2 py-1 rounded hover:bg-[#ef4444]/20 hover:text-[#ef4444] flex items-center gap-1 ml-auto"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
