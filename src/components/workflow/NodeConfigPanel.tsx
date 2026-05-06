'use client';
import type { AgentNode, ToolId } from '@/types/workflow';
import { Input, Textarea } from '@/components/ui/input';

export interface ToolOption {
  id: ToolId;
  name: string;
  description: string;
  requiresOAuth: boolean;
  oauthProvider?: string;
}

interface Props {
  node: AgentNode;
  tools: ToolOption[];
  connectedProviders: Set<string>;
  onUpdate: (patch: Partial<AgentNode>) => void;
  onDelete: () => void;
}

export function NodeConfigPanel({
  node,
  tools,
  connectedProviders,
  onUpdate,
  onDelete,
}: Props) {
  function toggleTool(id: ToolId) {
    const set = new Set(node.toolkit);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onUpdate({ toolkit: Array.from(set) });
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto">
      <div>
        <label className="block text-xs uppercase tracking-wide text-[#737373] mb-1.5">
          Name
        </label>
        <Input
          value={node.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
      </div>

      {node.type === 'trigger' ? (
        <div className="text-xs text-[#737373] p-3 border border-dashed border-[#1f1f1f] rounded">
          Trigger nodes are configured by the workflow trigger type. Edit it
          from the editor toolbar.
        </div>
      ) : (
        <>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#737373] mb-1.5">
              Goal (plain English)
            </label>
            <Textarea
              value={node.goal ?? ''}
              onChange={(e) => onUpdate({ goal: e.target.value })}
              placeholder="What this sub-agent should accomplish..."
              className="min-h-[120px]"
            />
            <div className="mt-2 text-xs text-[#525252]">
              The sub-agent will see all upstream node outputs at runtime — you
              can reference them naturally in the goal text.
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-[#737373] mb-2">
              Toolkit
            </label>
            <div className="space-y-1.5">
              {tools.map((t) => {
                const checked = node.toolkit.includes(t.id);
                const missingAuth =
                  t.requiresOAuth &&
                  t.oauthProvider &&
                  !connectedProviders.has(t.oauthProvider);
                return (
                  <label
                    key={t.id}
                    className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition ${
                      checked
                        ? 'border-[#6366f1] bg-[#6366f1]/10'
                        : 'border-[#1f1f1f] hover:border-[#262626]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTool(t.id)}
                      className="mt-0.5 accent-[#6366f1]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{t.name}</span>
                        <span className="text-[10px] font-mono text-[#525252]">
                          {t.id}
                        </span>
                        {missingAuth && (
                          <span className="text-[10px] uppercase text-[#eab308]">
                            connect required
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#737373] mt-0.5 leading-snug">
                        {t.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-[#1f1f1f]">
            <button
              onClick={onDelete}
              className="w-full px-3 py-2 rounded-md bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] text-sm font-medium"
            >
              Delete Node
            </button>
          </div>
        </>
      )}
    </div>
  );
}
