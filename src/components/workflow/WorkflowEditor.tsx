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
import { ActionNode } from './nodes/ActionNode';
import { ConditionNode } from './nodes/ConditionNode';
import { NodeConfigPanel } from './NodeConfigPanel';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';
import { Save, Play, Plus, Copy, Power } from 'lucide-react';
import { nanoid } from 'nanoid';
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  IntegrationProvider,
} from '@/types/workflow';
import type { Integration } from '@/types/integrations';

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
};

interface Props {
  workflowId: string;
  initialName: string;
  initialDefinition: WorkflowDefinition;
  initialActive: boolean;
  initialTriggerType: string;
  webhookUrl?: string;
  integrations: Pick<
    Integration,
    'id' | 'name' | 'description' | 'actions' | 'triggers'
  >[];
}

function definitionToFlow(def: WorkflowDefinition): {
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

function flowToDefinition(nodes: Node[], edges: Edge[]): WorkflowDefinition {
  return {
    nodes: nodes.map((n) => {
      const d = n.data as unknown as WorkflowNode;
      return {
        id: n.id,
        type: d.type,
        name: d.name,
        integration: d.integration,
        action: d.action,
        config: d.config ?? {},
        position: n.position,
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })) as WorkflowEdge[],
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
  integrations,
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
  const toast = useToast();
  const router = useRouter();

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
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId]
  );

  function updateNodeData(id: string, patch: Partial<WorkflowNode>) {
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

  function addActionNode(integration: IntegrationProvider) {
    const integ = integrations.find((i) => i.id === integration);
    if (!integ || integ.actions.length === 0) return;
    const action = integ.actions[0];
    const id = `action-${integration}-${nanoid(4)}`;
    const lastY = Math.max(0, ...nodes.map((n) => n.position.y)) + 150;
    const newNode: Node = {
      id,
      type: 'action',
      position: { x: 250, y: lastY },
      data: {
        id,
        type: 'action',
        name: action.name,
        integration,
        action: action.id,
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
      toast.push('success', `Run enqueued (${runId.slice(0, 8)}…)`);
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
        <aside className="w-64 border-r border-[#1f1f1f] flex flex-col bg-[#0a0a0a]">
          <div className="p-4 border-b border-[#1f1f1f]">
            <h3 className="text-xs uppercase tracking-wide text-[#737373] mb-2">
              Add Action
            </h3>
            <div className="flex flex-col gap-1">
              {integrations
                .filter((i) => i.actions.length > 0)
                .map((i) => (
                  <button
                    key={i.id}
                    onClick={() => addActionNode(i.id as IntegrationProvider)}
                    className="text-left px-3 py-2 rounded-md hover:bg-[#1f1f1f] text-sm flex items-center gap-2 transition"
                  >
                    <Plus className="h-3 w-3 text-[#6366f1]" />
                    {i.name}
                  </button>
                ))}
            </div>
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

          <div className="flex-1 p-4 overflow-auto">
            {selectedNode ? (
              <NodeConfigPanel
                node={selectedNode.data as unknown as WorkflowNode}
                integrations={integrations}
                onUpdate={(patch) => updateNodeData(selectedNode.id, patch)}
                onDelete={() => deleteNode(selectedNode.id)}
              />
            ) : (
              <div className="text-xs text-[#525252] text-center py-8">
                Select a node to configure it
              </div>
            )}
          </div>
        </aside>

        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
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
