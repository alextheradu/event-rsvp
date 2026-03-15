import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { rsvps, forms, users } from '../../lib/schema';
import { eq, and } from 'drizzle-orm';
import { inviteToChannel } from '../../lib/slack';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!locals.user) {
    return redirect('/auth/login');
  }

  const data = await request.formData();
  const formId = data.get('formId') as string;
  const method = data.get('_method') as string;

  if (!formId) {
    return new Response('Missing formId', { status: 400 });
  }

  const form = await db.select().from(forms).where(eq(forms.id, formId)).get();
  if (!form) {
    return new Response('Form not found', { status: 404 });
  }

  if (method === 'DELETE') {
    await db
      .delete(rsvps)
      .where(and(eq(rsvps.formId, formId), eq(rsvps.userId, locals.user.id)));
  } else {
    if (!import.meta.env.DEV && !locals.user.isAllowed) {
      return new Response('Not eligible for YSWS programs', { status: 403 });
    }
    if (!form.isOpen) {
      return new Response('Submissions closed', { status: 403 });
    }
    try {
      await db.insert(rsvps).values({
        id: crypto.randomUUID(),
        formId,
        userId: locals.user.id,
      });

      if (form.slackChannelId) {
        const user = await db.select().from(users).where(eq(users.id, locals.user.id)).get();
        if (user?.slackId) {
          await inviteToChannel(form.slackChannelId, user.slackId);
        }
      }
    } catch {
      // dupe
    }
  }

  return redirect(`/${form.slug}`);
};
