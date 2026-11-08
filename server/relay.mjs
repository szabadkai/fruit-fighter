// LAN relay: every browser in the party connects here over WebSocket. The server
// keeps the lobby (who's connected, which local players they have) and forwards
// match traffic (inputs, hashes) between machines. It never runs the game itself.
import os from 'node:os';
import { WebSocketServer } from 'ws';

export function lanUrls(port) {
  const urls = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) urls.push(`http://${a.address}:${port}/`);
    }
  }
  return urls;
}

export function attachRelay(httpServer) {
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/lan')) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  let nextId = 1;
  const clients = new Map(); // id -> { ws, id, name, players }

  const send = (ws, msg) => ws.readyState === 1 && ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  const broadcast = (msg, except) => {
    const raw = JSON.stringify(msg);
    for (const c of clients.values()) if (c !== except) send(c.ws, raw);
  };
  const lobby = () => {
    const machines = [...clients.values()].map((c) => ({ id: c.id, name: c.name, players: c.players }));
    broadcast({ t: 'lobby', machines, leader: machines[0]?.id ?? 0 });
  };

  wss.on('connection', (ws) => {
    const c = { ws, id: nextId++, name: `MACHINE ${nextId - 1}`, players: [] };
    clients.set(c.id, c);
    send(ws, { t: 'welcome', id: c.id });
    lobby();

    ws.on('message', (data) => {
      const raw = data.toString();
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      switch (msg.t) {
        case 'hello':
          c.name = String(msg.name ?? c.name).slice(0, 24);
          lobby();
          break;
        case 'players':
          c.players = Array.isArray(msg.players) ? msg.players.slice(0, 4) : [];
          lobby();
          break;
        case 'start':
          if ([...clients.keys()][0] === c.id) broadcast(msg);
          break;
        case 'in':
        case 'hash':
        case 'end':
          for (const o of clients.values()) if (o !== c) send(o.ws, raw);
          break;
      }
    });
    ws.on('close', () => {
      clients.delete(c.id);
      broadcast({ t: 'left', id: c.id });
      lobby();
    });
  });
  return wss;
}
