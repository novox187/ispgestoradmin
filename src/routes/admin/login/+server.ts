import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return json({ message: 'Body inválido' }, { status: 400 });
  }
  const email = String(body?.email || '').trim();
  const password = String(body?.password || '').trim();
  if (!email || !password) return json({ message: 'Faltan credenciales' }, { status: 400 });
  const token = crypto.randomUUID();
  const name = email.split('@')[0] || 'admin';
  return json({ token, role: 'admin', user: { name } }, { status: 200 });
};
