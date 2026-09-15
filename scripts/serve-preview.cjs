// Serve the exported SPA locally for browser checks without Metro rebuilds.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '../dist');
const types = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.ttf':'font/ttf', '.ico':'image/x-icon', '.svg':'image/svg+xml' };
const compressed = new Map();
http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) && file !== root) { response.writeHead(403).end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    const type = types[path.extname(file)] ?? 'application/octet-stream';
    const compress = /javascript|json|html|svg/.test(type) && request.headers['accept-encoding']?.includes('gzip');
    response.setHeader('Content-Type', type);
    response.setHeader('Cache-Control', 'no-cache');
    if (compress) {
      const stamp = fs.statSync(file).mtimeMs;
      if (compressed.get(file)?.stamp !== stamp) compressed.set(file, { stamp, body: zlib.gzipSync(fs.readFileSync(file)) });
      response.setHeader('Content-Encoding', 'gzip');
      response.end(compressed.get(file).body);
    } else fs.createReadStream(file).pipe(response);
  } catch { response.writeHead(500).end('Preview unavailable'); }
}).listen(8082, '127.0.0.1', () => console.log('Export preview: http://127.0.0.1:8082'));
