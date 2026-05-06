'use client';
import { useEffect, useState } from 'react';
import type { TranscriptEntry, StepStatus } from '@/types/workflow';

export interface NodeStepState {
  stepId: string;
  nodeId: string;
  nodeName: string;
  goal: string;
  toolkit: string[];
  status: StepStatus;
  parentStepId?: string | null;
  transcript: TranscriptEntry[];
  output?: Record<string, unknown>;
  error?: string;
  isSpawned: boolean;
}

export interface RunState {
  runId: string | null;
  status: StepStatus;
  steps: Record<string, NodeStepState>;
  /** Steps keyed by their node id (top-level DAG nodes). */
  byNodeId: Record<string, string>;
  error?: string;
}

const initialState: RunState = {
  runId: null,
  status: 'pending',
  steps: {},
  byNodeId: {},
};

type EventPayload =
  | { type: 'connected'; runId: string; at: string }
  | { type: 'run_started'; runId: string; at: string }
  | {
      type: 'step_started';
      runId: string;
      stepId: string;
      nodeId: string;
      nodeName: string;
      goal: string;
      toolkit: string[];
      parentStepId?: string | null;
      at: string;
    }
  | {
      type: 'node_spawned';
      runId: string;
      stepId: string;
      parentStepId: string;
      nodeId: string;
      nodeName: string;
      goal: string;
      toolkit: string[];
      at: string;
    }
  | {
      type: 'step_message';
      runId: string;
      stepId: string;
      entry: TranscriptEntry;
      at: string;
    }
  | {
      type: 'step_finished';
      runId: string;
      stepId: string;
      status: 'success' | 'failed';
      output?: Record<string, unknown>;
      error?: string;
      at: string;
    }
  | {
      type: 'run_finished';
      runId: string;
      status: 'success' | 'failed';
      error?: string;
      at: string;
    };

export function useRunStream(runId: string | null) {
  const [state, setState] = useState<RunState>(() =>
    runId
      ? { ...initialState, runId, status: 'pending' as const }
      : initialState
  );

  // Reset state when the runId prop changes — using the official "store
  // information from previous renders" pattern from
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [trackedRunId, setTrackedRunId] = useState(runId);
  if (trackedRunId !== runId) {
    setTrackedRunId(runId);
    setState(
      runId
        ? { ...initialState, runId, status: 'pending' as const }
        : initialState
    );
  }

  useEffect(() => {
    if (!runId) return;
    const source = new EventSource(`/api/runs/${runId}/stream`);

    source.onmessage = (msg) => {
      let event: EventPayload;
      try {
        event = JSON.parse(msg.data) as EventPayload;
      } catch {
        return;
      }
      setState((prev) => reducer(prev, event));
    };

    source.onerror = () => {
      // Connection drops once the run finishes; the server closes the stream.
    };

    return () => {
      source.close();
    };
  }, [runId]);

  return state;
}

function reducer(state: RunState, event: EventPayload): RunState {
  switch (event.type) {
    case 'connected':
      return { ...state, runId: event.runId };
    case 'run_started':
      return { ...state, runId: event.runId, status: 'running' };
    case 'step_started':
    case 'node_spawned': {
      const isSpawned = event.type === 'node_spawned';
      const next: NodeStepState = {
        stepId: event.stepId,
        nodeId: event.nodeId,
        nodeName: event.nodeName,
        goal: event.goal,
        toolkit: event.toolkit,
        status: 'running',
        parentStepId: isSpawned ? event.parentStepId : null,
        transcript: [],
        isSpawned,
      };
      return {
        ...state,
        steps: { ...state.steps, [event.stepId]: next },
        byNodeId: isSpawned
          ? state.byNodeId
          : { ...state.byNodeId, [event.nodeId]: event.stepId },
      };
    }
    case 'step_message': {
      const existing = state.steps[event.stepId];
      if (!existing) return state;
      return {
        ...state,
        steps: {
          ...state.steps,
          [event.stepId]: {
            ...existing,
            transcript: [...existing.transcript, event.entry],
          },
        },
      };
    }
    case 'step_finished': {
      const existing = state.steps[event.stepId];
      if (!existing) return state;
      return {
        ...state,
        steps: {
          ...state.steps,
          [event.stepId]: {
            ...existing,
            status: event.status,
            output: event.output,
            error: event.error,
          },
        },
      };
    }
    case 'run_finished':
      return { ...state, status: event.status, error: event.error };
    default:
      return state;
  }
}
