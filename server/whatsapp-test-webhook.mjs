import { createServer } from 'node:http';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const { META_APP_SECRET, WHATSAPP_VERIFY_TOKEN } = process.env;
if (!META_APP_SECRET || !WHATSAPP_VERIFY_TOKEN) {
  throw new Error('Configure META_APP_SECRET and WHATSAPP_VERIFY_TOKEN in the service environment');
}
const hash = value => createHash('sha256').update(value).digest();

async function receive(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const reply = (status, body = '') => {
    res.writeHead(status, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end(body);
  };
  if (url.pathname !== '/webhooks/whatsapp') return reply(404);
  if (req.method === 'GET') {
    const q = url.searchParams;
    const valid = q.get('hub.mode') === 'subscribe' && q.has('hub.challenge')
      && timingSafeEqual(hash(q.get('hub.verify_token') ?? ''), hash(WHATSAPP_VERIFY_TOKEN));
    return valid ? reply(200, q.get('hub.challenge')) : reply(403);
  }
  if (req.method !== 'POST') return reply(405);
  const signature = req.headers['x-hub-signature-256'];
  if (typeof signature !== 'string' || !/^sha256=[0-9a-f]{64}$/.test(signature)) return reply(403);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 2_000_000) return reply(413);
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  const digest = createHmac('sha256', META_APP_SECRET).update(body).digest();
  if (!timingSafeEqual(digest, Buffer.from(signature.slice(7), 'hex'))) return reply(403);
  let event;
  try { event = JSON.parse(body); } catch { return reply(400); }
  if (event?.object !== 'whatsapp_business_account' || !Array.isArray(event.entry)) return reply(400);
  console.info('WhatsApp test webhook received', { entries: event.entry.length });
  return reply(200);
}

createServer((req, res) => receive(req, res).catch(() => {
  if (!res.headersSent) res.writeHead(500);
  res.end();
})).listen(Number(process.env.WEBHOOK_PORT || 8788), '127.0.0.1');
