import 'dotenv/config';
import { readFileSync } from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import express from 'express';
import { matchRouter } from './routes/matches.js';

const app = express();
const PORT = Number(process.env.PORT) || 8000;

app.use(express.json());

app.get('/', (_req, res) => {
  res.send('LivePulse server is running.');
});

app.use('/matches', matchRouter);

const useHttps = Boolean(process.env.HTTPS);

let server = app;

if (useHttps) {
  const keyPath = process.env.HTTPS_KEY_PATH;
  const certPath = process.env.HTTPS_CERT_PATH;

  if (!keyPath || !certPath) {
    console.error(
      'HTTPS is enabled, but HTTPS_KEY_PATH or HTTPS_CERT_PATH is missing. ' +
        'Set both env vars to certificate file paths.',
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
}

server.listen(PORT, () => {
  const protocol = useHttps ? 'https' : 'http';
  console.log(`Server started. URL: ${protocol}://localhost:${PORT}`);
});
