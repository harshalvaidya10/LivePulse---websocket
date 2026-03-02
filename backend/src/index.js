import 'dotenv/config';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import express from 'express';
import { matchRouter } from './routes/matches.js';
import { attachWebSocketServer } from './ws/server.js';
import { securityMiddleware } from '../arcjet.js';
import { commentaryRouter } from './routes/commentary.js';
import { providerApiSportsRouter } from "./routes/providerApiSports.js";
import { startApiSportsLivePoller } from "./jobs/apiSportsLivePoller.js";
import cors from "cors";

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || '0.0.0.0';
const httpsEnv = process.env.HTTPS?.trim().toLowerCase();
const useHttps = httpsEnv === 'true' || httpsEnv === '1';

const app = express();
let server;

app.use(express.json());

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow server-to-server requests or curl (no origin)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.get('/', (_req, res) => {
  res.send('LivePulse server is running.');
});

app.use(securityMiddleware());

app.use("/providers/api-sports", providerApiSportsRouter);

app.use('/matches', matchRouter);

app.use('/matches/:id/commentary', commentaryRouter);

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

const { broadcastMatchCreated, broadcastCommentary, broadcastScoreUpdated } =
  attachWebSocketServer(server);

app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentary = broadcastCommentary;
app.locals.broadcastScoreUpdated = broadcastScoreUpdated;

startApiSportsLivePoller(app, { intervalMs: 15 * 60 * 1000 });

server.listen(PORT, HOST, () => {
  const protocol = useHttps ? 'https' : 'http';
  const wsProtocol = useHttps ? 'wss' : 'ws';
  const baseUrl = HOST === '0.0.0.0' ? `${protocol}://localhost:${PORT}` : `${protocol}://${HOST}:${PORT}`;

  console.log(`Server is running on ${baseUrl}`);
  console.log(`WebSocket server is running on ${baseUrl.replace(protocol, wsProtocol)}/ws`);
});
