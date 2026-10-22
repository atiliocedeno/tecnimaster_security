// Development only. The production entrypoint does not import this module.
export function developmentOrigins(value) {
  let publicOrigin;
  if (value) {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
        parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('DEV_PUBLIC_ORIGIN must be an HTTPS origin without a path, credentials or query.');
    }
    publicOrigin = parsed.origin;
  }
  return {local: ['http://127.0.0.1:8787', 'http://localhost:8787'], publicOrigin};
}

export function developmentRequestURL(req, origins) {
  // Cloudflared connects to the loopback listener. Only the configured Host
  // maps to HTTPS; neither Origin nor any forwarding header selects a host.
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) {
    throw new Error('non-loopback peer');
  }
  const allowed = [...origins.local, ...(origins.publicOrigin ? [origins.publicOrigin] : [])];
  const origin = allowed.find(o => new URL(o).host === req.headers.host);
  if (!origin) throw new Error('unconfigured Host');
  if (!req.url.startsWith('/') || req.url.startsWith('//')) throw new Error('invalid request target');
  const url = new URL(req.url, origin);
  if (url.origin !== origin) throw new Error('invalid request target');
  if (req.method === 'POST') {
    if (req.headers['x-cobranza-request'] !== '1') throw new Error('missing X-Cobranza-Request');
    if (req.headers.origin !== origin) throw new Error('missing or unauthorized Origin');
  }
  return url;
}

export function developmentResponseHeaders(response, url) {
  const headers = Object.fromEntries(response.headers);
  // Keep local HTTP working, but make session and logout cookies Secure when
  // the explicitly configured external URL is HTTPS.
  if (url.protocol === 'https:' && headers['set-cookie'] && !/;\s*Secure(?:;|$)/i.test(headers['set-cookie'])) {
    headers['set-cookie'] += '; Secure';
  }
  return headers;
}
