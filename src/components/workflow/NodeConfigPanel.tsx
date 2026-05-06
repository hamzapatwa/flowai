'use client';
import { useMemo } from 'react';
import type { WorkflowNode } from '@/types/workflow';
import type { Integration, FieldDefinition } from '@/types/integrations';
import { Input, Textarea, Select } from '@/components/ui/input';

interface Props {
  node: WorkflowNode;
  integrations: Pick<
    Integration,
    'id' | 'name' | 'actions' | 'triggers'
  >[];
  onUpdate: (patch: Partial<WorkflowNode>) => void;
  onDelete: () => void;
}

export function NodeConfigPanel({
  node,
  integrations,
  onUpdate,
  onDelete,
}: Props) {
  const integration = useMemo(
    () => integrations.find((i) => i.id === node.integration),
    [integrations, node.integration]
  );

  const actionDef = useMemo(() => {
    if (!integration) return null;
    if (node.type === 'trigger') {
      return integration.triggers.find((t) => t.id === node.action);
    }
    return integration.actions.find((a) => a.id === node.action);
  }, [integration, node]);

  const configSchema: Record<string, FieldDefinition> =
    actionDef && 'configSchema' in actionDef
      ? (actionDef as { configSchema: Record<string, FieldDefinition> })
          .configSchema
      : {};

  function updateConfig(key: string, value: unknown) {
    onUpdate({ config: { ...node.config, [key]: value } });
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

      <div>
        <label className="block text-xs uppercase tracking-wide text-[#737373] mb-1.5">
          Integration · Action
        </label>
        <div className="text-sm text-[#fafafa] font-mono p-2 bg-[#0a0a0a] border border-[#1f1f1f] rounded">
          {node.integration} · {node.action}
        </div>
      </div>

      {node.type !== 'trigger' && Object.keys(configSchema).length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-[#737373] mb-3">
            Configuration
          </h3>
          <div className="space-y-3">
            {Object.entries(configSchema).map(([key, field]) => (
              <ConfigField
                key={key}
                fieldKey={key}
                field={field}
                value={node.config[key]}
                onChange={(v) => updateConfig(key, v)}
              />
            ))}
          </div>
          <div className="mt-3 text-xs text-[#525252]">
            Use{' '}
            <code className="text-[#6366f1]">{`{{nodeId.field}}`}</code> to
            reference outputs from previous steps.
          </div>
        </div>
      )}

      {node.type === 'trigger' && (
        <div className="text-xs text-[#737373] p-3 border border-dashed border-[#1f1f1f] rounded">
          Trigger nodes are configured by the workflow trigger type. Edit the
          trigger from the editor toolbar.
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-[#1f1f1f]">
        {node.type !== 'trigger' && (
          <button
            onClick={onDelete}
            className="w-full px-3 py-2 rounded-md bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] text-sm font-medium"
          >
            Delete Node
          </button>
        )}
      </div>
    </div>
  );
}

function ConfigField({
  fieldKey,
  field,
  value,
  onChange,
}: {
  fieldKey: string;
  field: FieldDefinition;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = (
    <label
      htmlFor={fieldKey}
      className="block text-xs uppercase tracking-wide text-[#737373] mb-1.5"
    >
      {field.label}
      {field.required && <span className="text-[#ef4444] ml-1">*</span>}
    </label>
  );

  if (field.type === 'textarea' || field.type === 'json') {
    return (
      <div>
        {label}
        <Textarea
          id={fieldKey}
          value={
            field.type === 'json' && typeof value === 'object' && value !== null
              ? JSON.stringify(value, null, 2)
              : (value as string) ?? ''
          }
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={field.type === 'json' ? 'font-mono text-xs' : ''}
        />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        {label}
        <Select
          id={fieldKey}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      </div>
    );
  }

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <input
          id={fieldKey}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-[#6366f1]"
        />
        <label htmlFor={fieldKey} className="text-sm">
          {field.label}
        </label>
      </div>
    );
  }

  return (
    <div>
      {label}
      <Input
        id={fieldKey}
        type={field.type === 'number' ? 'number' : 'text'}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
    </div>
  );
}
