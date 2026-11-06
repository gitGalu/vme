import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export function collectionDownloads() {
  return {
    name: 'collection-builder-downloads',
    configureServer(server) {
      server.middlewares.use('/api/download', async (request, response) => {
        const controller = new AbortController();
        const closed = () => { if (!response.writableEnded) controller.abort(); };
        response.once('close', closed);
        try {
          if (request.method !== 'POST') { response.writeHead(405, { Allow: 'POST' }); response.end(); return; }
          const origin = request.headers.origin;
          if (origin && new URL(origin).host !== request.headers.host) throw new Error('Request must come from the collection builder.');
          if (!request.headers['content-type']?.startsWith('application/json')) throw new Error('Expected JSON request.');
          let body = '';
          for await (const chunk of request) {
            body += chunk.toString();
            if (body.length > 16384) throw new Error('Download URL is too long.');
          }
          const { url } = JSON.parse(body);
          const parsed = new URL(url);
          if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Use an HTTP(S) URL without embedded credentials.');
          const result = await fetch(url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(180000)]), redirect: 'follow' });
          if (!result.ok) throw new Error(`Download failed: HTTP ${result.status}`);
          if (!result.body) throw new Error('Download returned no data.');
          const type = result.headers.get('content-type') || '';
          if (/text\/html/i.test(type)) throw new Error('The URL returned an HTML page instead of a game file.');
          response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
          await pipeline(Readable.fromWeb(result.body), response);
        } catch (error) {
          if (response.headersSent) response.destroy(error);
          else if (!response.destroyed) {
            response.writeHead(400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            response.end(JSON.stringify({ error: error.message }));
          }
        } finally { response.removeListener('close', closed); }
      });
    }
  };
}
