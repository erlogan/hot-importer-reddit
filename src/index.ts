import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import type { TaskResponse } from '@devvit/web/server';
import type { UiResponse } from '@devvit/web/shared';
import { updateSidebar } from './core/sidebar';

const app = new Hono();

app.post('/internal/scheduler/update-sidebar', async (c) => {
  try {
    await updateSidebar();
    return c.json<TaskResponse>({ status: 'ok' }, 200);
  } catch (error) {
    console.error('Scheduled sidebar update failed:', error);
    return c.json<TaskResponse>({ status: 'error' }, 500);
  }
});

app.post('/internal/menu/update-sidebar', async (c) => {
  try {
    await updateSidebar();
    return c.json<UiResponse>(
      { showToast: { text: 'Sidebar updated.', appearance: 'success' } },
      200
    );
  } catch (error) {
    console.error('Manual sidebar update failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    return c.json<UiResponse>({ showToast: `Sidebar update failed: ${message}` }, 200);
  }
});

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
