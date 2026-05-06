'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { Webhook, Globe, MessageCircle, Mail, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  requiresOAuth: boolean;
  oauthProvider?: string;
  triggerCount: number;
  actionCount: number;
}

interface Connection {
  provider: string;
  metadata: Record<string, unknown>;
}

const ICONS: Record<string, React.ElementType> = {
  webhook: Webhook,
  http: Globe,
  slack: MessageCircle,
  gmail: Mail,
};

export function IntegrationsGrid({
  integrations,
  connections,
}: {
  integrations: Integration[];
  connections: Connection[];
}) {
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const connected = new Set(connections.map((c) => c.provider));

  useEffect(() => {
    const c = search.get('connected');
    if (c) {
      toast.push('success', `${c} connected`);
      const url = new URL(window.location.href);
      url.searchParams.delete('connected');
      window.history.replaceState({}, '', url.toString());
    }
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function disconnect(provider: string) {
    setBusyId(provider);
    try {
      await fetch('/api/integrations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      toast.push('success', `${provider} disconnected`);
      router.refresh();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Disconnect failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {integrations.map((i) => {
        const Icon = ICONS[i.id] ?? Box;
        const isConnected = connected.has(i.oauthProvider ?? i.id);
        return (
          <div
            key={i.id}
            className="border border-[#1f1f1f] rounded-lg p-5 bg-[#111111]"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 rounded-md bg-[#1f1f1f]">
                <Icon className="h-5 w-5 text-[#6366f1]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{i.name}</h3>
                  {!i.requiresOAuth && (
                    <Badge variant="info">No auth required</Badge>
                  )}
                  {i.requiresOAuth && isConnected && (
                    <Badge variant="success">Connected</Badge>
                  )}
                </div>
                <p className="text-sm text-[#a3a3a3] mt-1">{i.description}</p>
                <div className="text-xs text-[#525252] mt-2">
                  {i.triggerCount} trigger{i.triggerCount !== 1 ? 's' : ''} ·{' '}
                  {i.actionCount} action{i.actionCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            {i.requiresOAuth && (
              <div className="flex justify-end">
                {isConnected ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      disconnect(i.oauthProvider ?? i.id)
                    }
                    disabled={busyId === i.oauthProvider}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <a
                    href={`/api/oauth/${i.oauthProvider}`}
                    className="bg-[#6366f1] hover:bg-[#5158d4] transition px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Connect
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
