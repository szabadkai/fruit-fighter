// `npm run host`: serves the built game on the LAN and runs the relay.
// Friends on the same Wi-Fi open the printed URL (or scan the QR code).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode-terminal';
import { attachRelay, lanUrls } from './relay.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number(process.env.PORT ?? 8080);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/lan-info') {
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ urls: lanUrls(port) }));
  }
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  res.setHeader('content-type', types[path.extname(file)] ?? 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

attachRelay(server);
server.listen(port, '0.0.0.0', () => {
  const urls = lanUrls(port);
  console.log('\n  FRUIT PUNCH! LAN party is up.\n');
  console.log(`  On this machine:  http://localhost:${port}/`);
  for (const u of urls) console.log(`  On the network:   ${u}`);
  if (urls[0]) {
    console.log('\n  Scan to join:\n');
    qrcode.generate(urls[0], { small: true });
  }
});
