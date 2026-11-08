import { defineConfig, type Plugin } from 'vite';
// plain JS module shared with the standalone host server (server/host.mjs)
import { attachRelay, lanUrls } from './server/relay.mjs';

// The dev server doubles as the LAN relay, so `npm run dev` works for LAN parties too.
function lanRelay(): Plugin {
  return {
    name: 'fruit-punch-lan',
    configureServer(server) {
      if (server.httpServer) attachRelay(server.httpServer);
      server.middlewares.use('/lan-info', (_req, res) => {
        const addr = server.httpServer?.address();
        const port = typeof addr === 'object' && addr ? addr.port : 5173;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ urls: lanUrls(port) }));
      });
    },
  };
}

export default defineConfig({
  plugins: [lanRelay()],
  server: { host: true },
});
