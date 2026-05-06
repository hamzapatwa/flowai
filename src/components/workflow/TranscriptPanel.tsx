'use client';
import {
  ChevronRight,
  Wrench,
  CheckCircle2,
  XCircle,
  Sparkles,
  Brain,
  Target,
} from 'lucide-react';
import type { TranscriptEntry, StepStatus } from '@/types/workflow';

export interface StepView {
  stepId: string;
  status: StepStatus;
  goal: string;
  toolkit: string[];
  transcript: TranscriptEntry[];
  output?: Record<string, unknown>;
  error?: string;
}

export function TranscriptPanel({
  step,
}: {
  step: StepView | null;
}) {
  if (!step) {
    return (
      <div className="text-xs text-[#525252] text-center py-8">
        Run the workflow, then click a node to see its live transcript.
      </div>
    );
  }
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2 text-[#a3a3a3] mb-2">
        <Target className="h-3 w-3" />
        <span className="font-medium uppercase tracking-wide text-[10px]">
          Live transcript
        </span>
      </div>
      {step.transcript.length === 0 && (
        <div className="text-[#525252] italic">Waiting for sub-agent…</div>
      )}
      {step.transcript.map((entry, idx) => (
        <Entry key={`${step.stepId}-${idx}`} entry={entry} />
      ))}
      {step.error && (
        <div className="border border-[#ef4444]/30 bg-[#ef4444]/10 rounded p-2 text-[#ef4444] font-mono">
          {step.error}
        </div>
      )}
    </div>
  );
}

function Entry({ entry }: { entry: TranscriptEntry }) {
  switch (entry.kind) {
    case 'goal':
      return (
        <Row icon={Target} tone="text-[#6366f1]">
          <div className="text-[#a3a3a3] text-[10px] uppercase tracking-wide">
            Goal
          </div>
          <div className="whitespace-pre-wrap">{entry.text}</div>
        </Row>
      );
    case 'thought':
      return (
        <Row icon={Brain} tone="text-[#737373]">
          <div className="whitespace-pre-wrap text-[#a3a3a3]">{entry.text}</div>
        </Row>
      );
    case 'tool_call':
      return (
        <Row icon={Wrench} tone="text-[#eab308]">
          <div className="font-mono text-[10px] uppercase tracking-wide text-[#a3a3a3]">
            {entry.tool}
          </div>
          <details>
            <summary className="cursor-pointer text-[#737373] hover:text-[#fafafa]">
              input
            </summary>
            <pre className="mt-1 p-2 bg-[#0a0a0a] rounded font-mono overflow-auto max-h-40 text-[10px]">
              {JSON.stringify(entry.input, null, 2)}
            </pre>
          </details>
        </Row>
      );
    case 'tool_result':
      return (
        <Row
          icon={entry.isError ? XCircle : ChevronRight}
          tone={entry.isError ? 'text-[#ef4444]' : 'text-[#22c55e]'}
        >
          <div className="font-mono text-[10px] uppercase tracking-wide text-[#a3a3a3]">
            {entry.tool} → {entry.isError ? 'error' : 'result'}
          </div>
          <details>
            <summary className="cursor-pointer text-[#737373] hover:text-[#fafafa]">
              output
            </summary>
            <pre className="mt-1 p-2 bg-[#0a0a0a] rounded font-mono overflow-auto max-h-40 text-[10px]">
              {typeof entry.output === 'string'
                ? entry.output
                : JSON.stringify(entry.output, null, 2)}
            </pre>
          </details>
        </Row>
      );
    case 'final':
      return (
        <Row icon={CheckCircle2} tone="text-[#22c55e]">
          <div className="text-[#a3a3a3] text-[10px] uppercase tracking-wide">
            Final
          </div>
          <div className="whitespace-pre-wrap text-[#fafafa]">{entry.text}</div>
        </Row>
      );
    default:
      return null;
  }
}

function Row({
  icon: Icon,
  tone,
  children,
}: {
  icon: React.ElementType;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 items-start border-l border-[#1f1f1f] pl-2 py-1">
      <Icon className={`h-3 w-3 mt-0.5 shrink-0 ${tone}`} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export function StepHeader({ step }: { step: StepView }) {
  const Status =
    step.status === 'success'
      ? CheckCircle2
      : step.status === 'failed'
      ? XCircle
      : Sparkles;
  const tone =
    step.status === 'success'
      ? 'text-[#22c55e]'
      : step.status === 'failed'
      ? 'text-[#ef4444]'
      : 'text-[#6366f1]';
  return (
    <div className="flex items-center gap-2 mb-2">
      <Status className={`h-4 w-4 ${tone}`} />
      <span className="text-xs font-medium capitalize">{step.status}</span>
      <span className="ml-auto text-[10px] font-mono text-[#525252]">
        {step.stepId.slice(0, 8)}
      </span>
    </div>
  );
}
