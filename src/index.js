import 'dotenv/config';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import express from 'express';
import { matchRouter } from './routes/matches.js';
import { attachWebSocketServer } from './ws/server.js';

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || '0.0.0.0';
const useHttps = Boolean(process.env.HTTPS);

const app = express();
let server;

app.use(express.json());

app.get('/', (_req, res) => {
  res.send('LivePulse server is running.');
});

app.use('/matches', matchRouter);

if (useHttps) {
  const keyPath = process.env.HTTPS_KEY_PATH;
  const certPath = process.env.HTTPS_CERT_PATH;

  if (!keyPath || !certPath) {
    console.error(
      'HTTPS is enabled, but HTTPS_KEY_PATH or HTTPS_CERT_PATH is missing. ' +
        'Set both environment variables.',
    );
    process.exit(1);
  }

  try {
    const key = readFileSync(path.resolve(process.cwd(), keyPath));
    const cert = readFileSync(path.resolve(process.cwd(), certPath));
    server = https.createServer({ key, cert }, app);
  } catch (error) {
    console.error('Failed to read HTTPS certificate files:', error);
    process.exit(1);
  }
} else {
  server = http.createServer(app);
}

const { broadcastMatchCreated } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

server.listen(PORT, HOST, () => {
  const protocol = useHttps ? 'https' : 'http';
  const wsProtocol = useHttps ? 'wss' : 'ws';
  const baseUrl = HOST === '0.0.0.0' ? `${protocol}://localhost:${PORT}` : `${protocol}://${HOST}:${PORT}`;

  console.log(`Server is running on ${baseUrl}`);
  console.log(`WebSocket server is running on ${baseUrl.replace(protocol, wsProtocol)}/ws`);
});
