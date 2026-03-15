import { defineMiddleware } from 'astro:middleware';
import { verifySession } from './lib/session';

export const onRequest = defineMiddleware(async (context, next) => {
  const token = context.cookies.get('session')?.value;

  if (token) {
    const user = await verifySession(token);
    if (user) {
      context.locals.user = user;
    } else {
      context.cookies.delete('session', { path: '/' });
      context.locals.user = null;
    }
  } else {
    context.locals.user = null;
  }

  return next();
});
