import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { feedback, forms, rsvps } from '../../lib/schema';
import { eq, and } from 'drizzle-orm';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!locals.user) {
    return redirect('/auth/login');
  }

  const data = await request.formData();
  const formId = data.get('formId') as string;
  const content = (data.get('content') as string)?.trim();

  if (!formId || !content) {
    return new Response('Missing required fields', { status: 400 });
  }

  const form = await db.select().from(forms).where(eq(forms.id, formId)).get();
  if (!form || !form.feedbackEnabled) {
    return new Response('Feedback not enabled', { status: 400 });
  }

  const rsvp = await db
    .select()
    .from(rsvps)
    .where(and(eq(rsvps.formId, formId), eq(rsvps.userId, locals.user.id)))
    .get();

  if (!rsvp) {
    return new Response('You must RSVP before leaving feedback', { status: 403 });
  }

  const existing = await db
    .select()
    .from(feedback)
    .where(and(eq(feedback.formId, formId), eq(feedback.userId, locals.user.id)))
    .get();

  if (existing) {
    return redirect(`/${form.slug}`);
  }

  await db.insert(feedback).values({
    id: crypto.randomUUID(),
    formId,
    userId: locals.user.id,
    content,
  });

  return redirect(`/${form.slug}`);
};
