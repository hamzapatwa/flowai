'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Globe,
  MessageCircle,
  Mail,
  Search,
  AlignLeft,
  CalendarDays,
  GitBranch,
  BookOpen,
  Sparkles,
  Box,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  requiresOAuth: boolean;
  oauthProvider?: string;
}

interface Provider {
  provider: string;
  toolIds: string[];
  name: string;
  description: string;
  icon: string;
}

interface Connection {
  provider: string;
  metadata: Record<string, unknown>;
}

const ICONS: Record<string, React.ElementType> = {
  Globe,
  MessageCircle,
  Mail,
  Search,
  AlignLeft,
  CalendarDays,
  Github: GitBranch,
  BookOpen,
  Sparkles,
};

function pickIcon(name: string): React.ElementType {
  return ICONS[name] ?? Box;
}

export function IntegrationsGrid({
  providers,
  tools,
  connections,
}: {
  providers: Provider[];
  tools: Tool[];
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

  const builtIn = tools.filter((t) => !t.requiresOAuth);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xs uppercase tracking-wider text-[#737373] mb-3">
          Connect
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((p) => {
            const Icon = pickIcon(p.icon);
            const isConnected = connected.has(p.provider);
            return (
              <div
                key={p.provider}
                className="border border-[#1f1f1f] rounded-lg p-5 bg-[#111111]"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 rounded-md bg-[#1f1f1f]">
                    <Icon className="h-5 w-5 text-[#6366f1]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{p.name}</h3>
                      {isConnected && <Badge variant="success">Connected</Badge>}
                    </div>
                    <p className="text-sm text-[#a3a3a3] mt-1">{p.description}</p>
                    <div className="text-xs text-[#525252] mt-2">
                      Powers: {p.toolIds.join(', ')}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  {isConnected ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => disconnect(p.provider)}
                      disabled={busyId === p.provider}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <a
                      href={`/api/oauth/${p.provider}`}
                      className="bg-[#6366f1] hover:bg-[#5158d4] transition px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Connect
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-[#737373] mb-3">
          Built-in tools (no auth needed)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {builtIn.map((t) => {
            const Icon = pickIcon(t.icon);
            return (
              <div
                key={t.id}
                className="border border-[#1f1f1f] rounded-lg p-5 bg-[#111111]"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-[#1f1f1f]">
                    <Icon className="h-5 w-5 text-[#6366f1]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{t.name}</h3>
                      <Badge variant="info">Always on</Badge>
                    </div>
                    <p className="text-sm text-[#a3a3a3] mt-1">{t.description}</p>
                    <div className="text-xs text-[#525252] mt-2 font-mono">
                      tool id: {t.id}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
