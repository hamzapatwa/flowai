import type { ToolDescriptor } from '@/types/tools';
import type { ToolId } from '@/types/workflow';
import { SlackTool } from './slack';
import { GmailTool } from './gmail';
import { HttpTool } from './http';
import { WebSearchTool } from './web_search';
import { SummarizeTool } from './summarize';
import { CalendarTool } from './calendar';
import { GitHubTool } from './github';
import { NotionTool } from './notion';
import { SpawnSubAgentTool } from './spawn';

export const TOOLS: Record<ToolId, ToolDescriptor> = {
  slack: SlackTool,
  gmail: GmailTool,
  http: HttpTool,
  web_search: WebSearchTool,
  summarize: SummarizeTool,
  calendar: CalendarTool,
  github: GitHubTool,
  notion: NotionTool,
  spawn_subagent: SpawnSubAgentTool,
};

export function getTool(id: string): ToolDescriptor | undefined {
  return TOOLS[id as ToolId];
}

export function listTools(): ToolDescriptor[] {
  return Object.values(TOOLS);
}

export interface OAuthProviderInfo {
  provider: string;
  toolIds: ToolId[];
  name: string;
  description: string;
  icon: string;
}

/**
 * Distinct OAuth providers the user can connect — used by the Integrations
 * page and the OAuth route. Multiple tools may share a provider (e.g. Gmail +
 * Calendar both use the `gmail` provider, which actually grants combined
 * Google scopes).
 */
export function listOAuthProviders(): OAuthProviderInfo[] {
  return [
    {
      provider: 'slack',
      toolIds: ['slack'],
      name: 'Slack',
      description: 'Send messages and DMs to your Slack workspace.',
      icon: 'MessageCircle',
    },
    {
      provider: 'gmail',
      toolIds: ['gmail', 'calendar'],
      name: 'Google',
      description:
        'Gmail (send + read) and Google Calendar (read + create events). One sign-in covers both tools.',
      icon: 'Mail',
    },
    {
      provider: 'github',
      toolIds: ['github'],
      name: 'GitHub',
      description: 'Read repos and issues, create issues, search code.',
      icon: 'Github',
    },
    {
      provider: 'notion',
      toolIds: ['notion'],
      name: 'Notion',
      description: 'Search the workspace, create pages, append text.',
      icon: 'BookOpen',
    },
  ];
}
