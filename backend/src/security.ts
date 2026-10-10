import type { FastifyInstance } from 'fastify';

/**
 * What a page of the app may load and do: only this server's scripts, styles, fonts, data and
 * workers; nothing from elsewhere. Angular Material sets styles at run time.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * The heat worker compiles the blocks to JavaScript (packages/engine/src/codegen.ts), which takes
 * 'unsafe-eval'. A worker runs under the policy of its own script, so only it gets that; the code
 * it compiles is built from parsed formulas alone, never from text the user wrote.
 */
export const WORKER_CONTENT_SECURITY_POLICY = CONTENT_SECURITY_POLICY.replace("script-src 'self'", "script-src 'self' 'unsafe-eval'");

/** Angular's build names the heat worker's bundle worker-<hash>.js. */
const HEAT_WORKER = /^\/worker-[A-Z0-9]{8}\.js$/;

/**
 * Security headers on every answer. No HSTS: an instance on a LAN is usually plain HTTP, and one
 * behind a proxy with TLS gets HSTS from the proxy.
 */
export function securityHeaders(app: FastifyInstance): void {
  app.addHook('onSend', async (request, reply, payload) => {
    const path = request.url.split('?')[0];
    reply.header('content-security-policy', HEAT_WORKER.test(path) ? WORKER_CONTENT_SECURITY_POLICY : CONTENT_SECURITY_POLICY);
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'same-origin');
    reply.header('x-frame-options', 'DENY');
    reply.header('cross-origin-opener-policy', 'same-origin');
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
    return payload;
  });
}
