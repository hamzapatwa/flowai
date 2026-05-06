'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

const DEMO_PROMPT =
  'Search the web for the top 3 AI announcements today, summarize each in two sentences, and email the digest to me@example.com.';

export function NewWorkflowDialog() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.push('error', 'Please describe your workflow');
      return;
    }
    setLoading(true);
    try {
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({}));
        throw new Error(err.error ?? 'Generation failed');
      }
      const data = await genRes.json();

      const createRes = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!createRes.ok) throw new Error('Failed to save workflow');
      const { workflow } = await createRes.json();

      toast.push('success', 'Workflow generated');
      setOpen(false);
      setPrompt('');
      router.push(`/workflows/${workflow.id}`);
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New Workflow
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#6366f1]" />
            Describe what you want
          </DialogTitle>
          <DialogDescription>
            The orchestrator agent will plan a DAG of sub-agents using Claude
            Sonnet 4.5.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Search for the latest AI news, summarize the top 3, and email me a digest..."
          className="min-h-[140px]"
          disabled={loading}
        />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setPrompt(DEMO_PROMPT)}
            className="text-xs text-[#737373] hover:text-[#6366f1] underline"
            disabled={loading}
          >
            Load demo
          </button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
