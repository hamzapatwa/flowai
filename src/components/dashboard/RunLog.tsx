'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Bot, Sparkles } from 'lucide-react';
import { StatusBadge } from '@/components/ui/badge';
import { formatDate, formatRelative } from '@/lib/utils';
import type { TranscriptEntry } from '@/types/workflow';

interface Step {
  id: string;
  nodeId: string;
  nodeName: string;
  goal: string;
  toolkit: string[];
  status: string;
  parentStepId: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  transcript: TranscriptEntry[];
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface Run {
  id: string;
  workflowId: string;
  status: string;
  triggerData: Record<string, unknown>;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  createdAt: string;
  steps: Step[];
}

export function RunLog({
  workflowId,
  initialRuns,
}: {
  workflowId: string;
  initialRuns: Run[];
}) {
  const [runs, setRuns] = useState<Run[]>(initialRuns);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const hasActive = runs.some(
      (r) => r.status === 'pending' || r.status === 'running'
    );
    if (!hasActive) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/workflows/${workflowId}/runs`);
        if (res.ok) {
          const data = await res.json();
          setRuns(data.runs);
        }
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => clearInterval(id);
  }, [runs, workflowId]);

  if (runs.length === 0) {
    return (
      <div className="border border-dashed border-[#1f1f1f] rounded-lg p-12 text-center">
        <p className="text-[#737373]">No runs yet. Trigger this workflow from the editor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const isOpen = expanded === run.id;
        const duration =
          run.startedAt && run.completedAt
            ? Math.round(
                (new Date(run.completedAt).getTime() -
                  new Date(run.startedAt).getTime()) /
                  10
              ) / 100
            : null;
        // Group spawned children under their parents.
        const topLevel = run.steps.filter((s) => !s.parentStepId);
        const childrenByParent = new Map<string, Step[]>();
        run.steps
          .filter((s) => s.parentStepId)
          .forEach((s) => {
            const list = childrenByParent.get(s.parentStepId!) ?? [];
            list.push(s);
            childrenByParent.set(s.parentStepId!, list);
          });

        return (
          <div
            key={run.id}
            className="border border-[#1f1f1f] rounded-lg bg-[#111111] overflow-hidden"
          >
            <button
              onClick={() => setExpanded(isOpen ? null : run.id)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#1a1a1a] transition text-left"
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <StatusBadge status={run.status} />
              <span className="font-mono text-xs text-[#a3a3a3]">
                {run.id.slice(0, 8)}
              </span>
              <span className="text-sm text-[#737373] ml-auto">
                {formatRelative(run.startedAt ?? run.createdAt)}
              </span>
              {duration !== null && (
                <span className="text-xs text-[#525252]">{duration}s</span>
              )}
            </button>
            {isOpen && (
              <div className="border-t border-[#1f1f1f] p-4 space-y-3">
                {run.error && (
                  <div className="px-3 py-2 rounded bg-[#ef4444]/10 border border-[#ef4444]/30 text-xs text-[#ef4444] font-mono">
                    {run.error}
                  </div>
                )}
                <div className="text-xs text-[#737373]">
                  Started {formatDate(run.startedAt)} · Completed{' '}
                  {formatDate(run.completedAt)}
                </div>
                {topLevel.map((step) => (
                  <StepView
                    key={step.id}
                    step={step}
                    subSteps={childrenByParent.get(step.id) ?? []}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepView({ step, subSteps }: { step: Step; subSteps: Step[] }) {
  return (
    <div className="border border-[#1f1f1f] rounded p-3 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <Bot className="h-3.5 w-3.5 text-[#6366f1]" />
        <StatusBadge status={step.status} />
        <span className="font-medium">{step.nodeName}</span>
        <span className="font-mono text-xs text-[#525252] ml-auto">
          {step.nodeId}
        </span>
      </div>
      {step.goal && (
        <p className="text-xs text-[#a3a3a3] mb-2 italic">{step.goal}</p>
      )}
      {step.toolkit.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {step.toolkit.map((t) => (
            <span
              key={t}
              className="text-[10px] font-mono px-1.5 py-0.5 bg-[#1f1f1f] rounded text-[#a3a3a3]"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {step.error && (
        <div className="text-xs text-[#ef4444] font-mono mb-2">
          {step.error}
        </div>
      )}
      <details className="mb-2">
        <summary className="text-xs text-[#737373] cursor-pointer hover:text-[#fafafa]">
          Transcript ({step.transcript?.length ?? 0} entries)
        </summary>
        <pre className="mt-1 p-2 bg-[#0a0a0a] rounded text-xs font-mono overflow-auto max-h-80">
          {JSON.stringify(step.transcript ?? [], null, 2)}
        </pre>
      </details>
      <details>
        <summary className="text-xs text-[#737373] cursor-pointer hover:text-[#fafafa]">
          Output
        </summary>
        <pre className="mt-1 p-2 bg-[#0a0a0a] rounded text-xs font-mono overflow-auto max-h-60">
          {JSON.stringify(step.output, null, 2)}
        </pre>
      </details>
      {subSteps.length > 0 && (
        <div className="mt-3 pl-4 border-l-2 border-[#a855f7]/50 space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-[#a855f7] flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Spawned sub-agents
          </div>
          {subSteps.map((child) => (
            <StepView key={child.id} step={child} subSteps={[]} />
          ))}
        </div>
      )}
    </div>
  );
}
