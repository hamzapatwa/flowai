import { google } from 'googleapis';
import type { ToolDescriptor } from '@/types/tools';
import { getGoogleClient } from './google';

export const CalendarTool: ToolDescriptor = {
  id: 'calendar',
  name: 'Google Calendar',
  description:
    'List events from the connected Google Calendar or create new events.',
  icon: 'CalendarDays',
  requiresOAuth: true,
  oauthProvider: 'gmail',
  toolDefinition: {
    name: 'calendar',
    description:
      'Read or create Google Calendar events. The user must have connected their Google account; calendar scope is included alongside Gmail.',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list_events', 'create_event'],
          description:
            'list_events fetches events in a time range; create_event books a new event on the primary calendar.',
        },
        calendar_id: {
          type: 'string',
          description: 'Calendar id. Defaults to "primary".',
        },
        time_min: {
          type: 'string',
          description:
            'RFC3339 lower bound for list_events. Defaults to now.',
        },
        time_max: {
          type: 'string',
          description: 'RFC3339 upper bound for list_events.',
        },
        max_results: {
          type: 'number',
          description: 'Max events to return for list_events. Defaults to 10.',
        },
        summary: {
          type: 'string',
          description: 'Event title (create_event only).',
        },
        description: {
          type: 'string',
          description: 'Event description (create_event only).',
        },
        start: {
          type: 'string',
          description:
            'RFC3339 start datetime for create_event, e.g. "2026-05-08T14:00:00-04:00".',
        },
        end: {
          type: 'string',
          description: 'RFC3339 end datetime for create_event.',
        },
        attendees: {
          type: 'array',
          description: 'Optional attendee emails for create_event.',
          items: { type: 'string' },
        },
      },
      required: ['action'],
    },
  },
  async execute(input, ctx) {
    const oauth2 = await getGoogleClient(ctx.userId);
    const cal = google.calendar({ version: 'v3', auth: oauth2 });
    const calendarId = String(input.calendar_id || 'primary');
    const action = String(input.action || '');

    if (action === 'list_events') {
      const list = await cal.events.list({
        calendarId,
        timeMin: String(input.time_min || new Date().toISOString()),
        timeMax: input.time_max ? String(input.time_max) : undefined,
        maxResults: Number(input.max_results || 10),
        singleEvents: true,
        orderBy: 'startTime',
      });
      const events = (list.data.items ?? []).map((e) => ({
        id: e.id,
        summary: e.summary,
        description: e.description,
        start: e.start?.dateTime ?? e.start?.date,
        end: e.end?.dateTime ?? e.end?.date,
        attendees: (e.attendees ?? []).map((a) => a.email).filter(Boolean),
        htmlLink: e.htmlLink,
      }));
      return { events, count: events.length };
    }

    if (action === 'create_event') {
      const summary = String(input.summary || '');
      const start = String(input.start || '');
      const end = String(input.end || '');
      if (!summary || !start || !end) {
        throw new Error(
          'calendar.create_event requires `summary`, `start`, and `end`'
        );
      }
      const attendees = Array.isArray(input.attendees)
        ? (input.attendees as unknown[])
            .filter((v): v is string => typeof v === 'string')
            .map((email) => ({ email }))
        : undefined;
      const res = await cal.events.insert({
        calendarId,
        requestBody: {
          summary,
          description: String(input.description || ''),
          start: { dateTime: start },
          end: { dateTime: end },
          attendees,
        },
      });
      return {
        id: res.data.id,
        htmlLink: res.data.htmlLink,
        status: res.data.status,
      };
    }

    throw new Error(`Unknown calendar action: ${action}`);
  },
};
