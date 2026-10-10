import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface Request {
  method: string;
  path: string;
  /** The path with its query. */
  url: string;
  headers: IncomingMessage['headers'];
  body: string;
}

type Handler = (request: Request, response: ServerResponse) => void | Promise<void>;

/** A file the server has, with the validators a real server would send. */
export interface ServedFile {
  content: string | Buffer;
  etag?: string | null;
  lastModified?: string | null;
  type?: string;
}

/**
 * A web server for the tests that stands in for the sources: its routes answer as the sources do,
 * and it records every request.
 */
export class TestServer {
  readonly requests: Request[] = [];
  private readonly routes = new Map<string, Handler>();
  private readonly server = createServer((incoming, response) => void this.handle(incoming, response));
  url = '';

  static async start(): Promise<TestServer> {
    const server = new TestServer();
    await new Promise<void>((resolve) => server.server.listen(0, '127.0.0.1', resolve));
    server.url = `http://127.0.0.1:${(server.server.address() as AddressInfo).port}`;
    return server;
  }

  /** Answers `METHOD /path` with a handler. */
  on(route: string, handler: Handler): void {
    this.routes.set(route, handler);
  }

  /** Serves a file on GET (and HEAD), with 304 when the request's validators match. */
  file(path: string, file: ServedFile | (() => ServedFile)): void {
    const serve = (request: Request, response: ServerResponse) => {
      const { content, etag = `"${createHash('md5').update(content).digest('hex')}"`, lastModified = null, type = 'application/octet-stream' } =
        typeof file === 'function' ? file() : file;
      const headers: Record<string, string> = { 'content-type': type, 'content-length': String(Buffer.byteLength(content)), 'accept-ranges': 'bytes' };
      if (etag) headers['etag'] = etag;
      if (lastModified) headers['last-modified'] = lastModified;
      if ((etag && request.headers['if-none-match'] === etag) || (!etag && lastModified && request.headers['if-modified-since'] === lastModified)) {
        response.writeHead(304, headers).end();
        return;
      }
      response.writeHead(200, headers).end(request.method === 'HEAD' ? undefined : content);
    };
    this.on(`GET ${path}`, serve);
    this.on(`HEAD ${path}`, serve);
  }

  /** The requests for a path. */
  to(path: string): Request[] {
    return this.requests.filter((r) => r.path === path);
  }

  private async handle(incoming: IncomingMessage, response: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(chunk as Buffer);
    const url = incoming.url ?? '/';
    const request = { method: incoming.method ?? 'GET', path: url.split('?')[0], url, headers: incoming.headers, body: Buffer.concat(chunks).toString('utf8') };
    this.requests.push(request);
    const handler = this.routes.get(`${request.method} ${request.path}`);
    if (!handler) {
      response.writeHead(404).end('Not found');
      return;
    }
    await handler(request, response);
  }

  close(): Promise<void> {
    this.server.closeAllConnections();
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
}
