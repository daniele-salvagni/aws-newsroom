import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../lib/db.js';
import { success, error } from '../../lib/response.js';

interface EventQueryResult {
  event_id: string;
  title: string;
  url: string;
  category: string;
  start_time: string;
  end_time: string;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Get the next upcoming event within 14 days
    const events = await query<EventQueryResult>(`
      SELECT
        event_id,
        title,
        url,
        category,
        start_time,
        end_time
      FROM events
      WHERE start_time > NOW()
        AND start_time <= NOW() + INTERVAL '14 days'
      ORDER BY start_time ASC
      LIMIT 1
    `);

    if (events.length === 0) {
      return success({ event: null });
    }

    const evt = events[0];
    return success({
      event: {
        eventId: evt.event_id,
        title: evt.title,
        url: evt.url,
        category: evt.category,
        startTime: evt.start_time,
        endTime: evt.end_time,
      },
    });
  } catch (err) {
    console.error('Error fetching upcoming event:', err);
    return error('Failed to fetch upcoming event');
  }
}
