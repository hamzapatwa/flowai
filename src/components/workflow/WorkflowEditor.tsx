'use client';
import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TriggerNode } from './nodes/TriggerNode';
import { AgentNode } from './nodes/AgentNode';
import { NodeConfigPanel, type ToolOption } from './NodeConfigPanel';
import { TranscriptPanel, StepHeader } from './TranscriptPanel';
import { useRunStream } from './useRunStream';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';
import { Save, Play, Plus, Copy, Power } from 'lucide-react';
import { nanoid } from 'nanoid';
import type {
  AgentEdge,
  AgentNode as AgentNodeData,
  AgentWorkflowDefinition,
  ToolId,
} from '@/types/workflow';

const nodeTypes = {
  trigger: TriggerNode,
  agent: AgentNode,
};

interface Props {
  workflowId: string;
  initialName: string;
  initialDefinition: AgentWorkflowDefinition;
  initialActive: boolean;
  initialTriggerType: string;
  webhookUrl?: string;
  tools: ToolOption[];
  connectedProviders: string[];
  initialRunId: string | null;
}

function definitionToFlow(def: AgentWorkflowDefinition): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = def.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { ...n },
  }));
  const edges: Edge[] = def.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'default',
    markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
  }));
  return { nodes, edges };
}

function flowToDefinition(nodes: Node[], edges: Edge[]): AgentWorkflowDefinition {
  return {
    nodes: nodes.map((n) => {
      const d = n.data as unknown as AgentNodeData;
      return {
        id: n.id,
        type: d.type,
        name: d.name,
        goal: d.goal ?? '',
        toolkit: d.toolkit ?? [],
        config: d.config ?? {},
        position: n.position,
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })) as AgentEdge[],
  };
}

export function WorkflowEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}

function Inner({
  workflowId,
  initialName,
  initialDefinition,
  initialActive,
  webhookUrl,
  tools,
  connectedProviders,
  initialRunId,
}: Props) {
  const initial = useMemo(
    () => definitionToFlow(initialDefinition),
    [initialDefinition]
  );
  const [nodes, setNodes] = useState<Node[]>(initial.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.edges);
  const [name, setName] = useState(initialName);
  const [isActive, setIsActive] = useState(initialActive);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(initialRunId);
  const toast = useToast();
  const router = useRouter();

  const runState = useRunStream(activeRunId);
  const connectedSet = useMemo(
    () => new Set(connectedProviders),
    [connectedProviders]
  );

  // Project live run status onto each top-level node during render — keeps
  // `nodes` itself as the canonical workflow definition and avoids a setState
  // cascade in an effect.
  const nodesWithStatus = useMemo<Node[]>(() => {
    return nodes.map((n) => {
      const stepId = runState.byNodeId[n.id];
      const step = stepId ? runState.steps[stepId] : null;
      const status = step?.status ?? (runState.runId ? 'pending' : undefined);
      return { ...n, data: { ...n.data, status } };
    });
  }, [nodes, runState]);

  // Render dynamically spawned children as floating ghost nodes around their parent.
  const spawnedNodes = useMemo<Node[]>(() => {
    const list: Node[] = [];
    const parentPositions = new Map<string, { x: number; y: number }>();
    nodes.forEach((n) => parentPositions.set(n.id, n.position));

    Object.values(runState.steps).forEach((step) => {
      if (!step.isSpawned || !step.parentStepId) return;
      const parentStep = runState.steps[step.parentStepId];
      if (!parentStep) return;
      const parentNodePos = parentPositions.get(parentStep.nodeId) ?? {
        x: 250,
        y: 100,
      };
      const offsetIndex = list.filter((n) =>
        n.id.startsWith(`spawn:${parentStep.nodeId}:`)
      ).length;
      list.push({
        id: `spawn:${parentStep.nodeId}:${step.stepId}`,
        type: 'agent',
        position: {
          x: parentNodePos.x + 320,
          y: parentNodePos.y + offsetIndex * 140,
        },
        data: {
          name: step.nodeName,
          goal: step.goal,
          toolkit: step.toolkit as ToolId[],
          status: step.status,
          isSpawned: true,
        },
        draggable: false,
      });
    });
    return list;
  }, [runState, nodes]);

  const allNodes = useMemo(
    () => [...nodesWithStatus, ...spawnedNodes],
    [nodesWithStatus, spawnedNodes]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (conn: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...conn,
            id: `edge-${conn.source}-${conn.target}-${nanoid(4)}`,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
          },
          eds
        )
      ),
    []
  );

  const selectedNode = useMemo(
    () => allNodes.find((n) => n.id === selectedId) ?? null,
    [allNodes, selectedId]
  );

  // Determine which step is selected — either the spawned step id directly, or the top-level node's step.
  const selectedStep = useMemo(() => {
    if (!selectedNode) return null;
    if (selectedNode.id.startsWith('spawn:')) {
      const stepId = selectedNode.id.split(':').pop();
      return stepId ? runState.steps[stepId] : null;
    }
    const stepId = runState.byNodeId[selectedNode.id];
    return stepId ? runState.steps[stepId] : null;
  }, [selectedNode, runState]);

  function updateNodeData(id: string, patch: Partial<AgentNodeData>) {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== id) return n;
        return { ...n, data: { ...n.data, ...patch } };
      })
    );
  }

  function deleteNode(id: string) {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedId(null);
  }

  function addAgentNode() {
    const id = `agent-${nanoid(4)}`;
    const lastY = Math.max(0, ...nodes.map((n) => n.position.y)) + 160;
    const newNode: Node = {
      id,
      type: 'agent',
      position: { x: 250, y: lastY },
      data: {
        id,
        type: 'agent',
        name: 'New sub-agent',
        goal: '',
        toolkit: [],
        config: {},
        position: { x: 250, y: lastY },
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedId(id);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const definition = flowToDefinition(nodes, edges);
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, definition, isActive }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.push('success', 'Workflow saved');
      router.refresh();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleRun() {
    setRunning(true);
    try {
      await handleSave();
      const res = await fetch(`/api/workflows/${workflowId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) throw new Error('Failed to enqueue run');
      const { runId } = await res.json();
      setActiveRunId(runId);
      toast.push('success', `Run started (${runId.slice(0, 8)}…)`);
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }

  async function toggleActive() {
    const next = !isActive;
    setIsActive(next);
    try {
      await fetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      });
      toast.push('success', next ? 'Workflow activated' : 'Workflow paused');
    } catch {
      setIsActive(!next);
      toast.push('error', 'Failed to toggle');
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b border-[#1f1f1f] px-6 py-3 flex items-center justify-between bg-[#0a0a0a]">
        <div className="flex items-center gap-3 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-transparent text-lg font-semibold focus:outline-none focus:bg-[#111111] px-2 py-1 rounded"
          />
          {runState.runId && (
            <span className="text-xs text-[#737373] font-mono">
              run {runState.runId.slice(0, 8)} · {runState.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isActive ? 'secondary' : 'ghost'}
            size="sm"
            onClick={toggleActive}
          >
            <Power className="h-4 w-4" />
            {isActive ? 'Active' : 'Paused'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" onClick={handleRun} disabled={running}>
            <Play className="h-4 w-4" />
            {running ? 'Running…' : 'Run'}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r border-[#1f1f1f] flex flex-col bg-[#0a0a0a]">
          <div className="p-4 border-b border-[#1f1f1f]">
            <h3 className="text-xs uppercase tracking-wide text-[#737373] mb-2">
              Build
            </h3>
            <button
              onClick={addAgentNode}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-[#1f1f1f] text-sm flex items-center gap-2 transition border border-[#1f1f1f]"
            >
              <Plus className="h-3 w-3 text-[#6366f1]" />
              Add sub-agent
            </button>
          </div>

          {webhookUrl && (
            <div className="p-4 border-b border-[#1f1f1f]">
              <h3 className="text-xs uppercase tracking-wide text-[#737373] mb-2">
                Webhook URL
              </h3>
              <div className="text-xs font-mono text-[#a3a3a3] break-all bg-[#111111] p-2 rounded border border-[#1f1f1f]">
                {webhookUrl}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  toast.push('success', 'Copied');
                }}
                className="mt-2 text-xs text-[#6366f1] hover:underline flex items-center gap-1"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
          )}

          <div className="flex-1 overflow-auto">
            {selectedNode ? (
              <div className="p-4">
                {!selectedNode.id.startsWith('spawn:') ? (
                  <NodeConfigPanel
                    node={selectedNode.data as unknown as AgentNodeData}
                    tools={tools}
                    connectedProviders={connectedSet}
                    onUpdate={(patch) => updateNodeData(selectedNode.id, patch)}
                    onDelete={() => deleteNode(selectedNode.id)}
                  />
                ) : (
                  <div className="text-xs text-[#737373] p-3 border border-dashed border-[#1f1f1f] rounded">
                    Spawned sub-agent (read-only). Created at runtime by the
                    parent agent.
                  </div>
                )}
                {selectedStep && (
                  <div className="mt-4 pt-4 border-t border-[#1f1f1f]">
                    <StepHeader
                      step={{
                        stepId: selectedStep.stepId,
                        status: selectedStep.status,
                        goal: selectedStep.goal,
                        toolkit: selectedStep.toolkit,
                        transcript: selectedStep.transcript,
                        output: selectedStep.output,
                        error: selectedStep.error,
                      }}
                    />
                    <TranscriptPanel
                      step={{
                        stepId: selectedStep.stepId,
                        status: selectedStep.status,
                        goal: selectedStep.goal,
                        toolkit: selectedStep.toolkit,
                        transcript: selectedStep.transcript,
                        output: selectedStep.output,
                        error: selectedStep.error,
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-xs text-[#525252] text-center py-8">
                Select a node to configure it or watch its live transcript.
              </div>
            )}
          </div>
        </aside>

        <div className="flex-1">
          <ReactFlow
            nodes={allNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            fitView
            colorMode="dark"
          >
            <Background gap={16} color="#1f1f1f" />
            <Controls />
            <MiniMap
              nodeColor="#6366f1"
              maskColor="rgba(0,0,0,0.6)"
              pannable
              zoomable
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
