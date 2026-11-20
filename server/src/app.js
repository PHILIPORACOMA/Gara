import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.disable('x-powered-by');
// Images are loaded by the client from a different origin (Vite dev server).
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.clientOrigins }));
if (env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

// Public uploads only (portfolio, GCash QR). ID images and deposit screenshots live in
// uploads/private and are served through a role-checked route, never statically.
app.use('/uploads/public', express.static(path.resolve(env.UPLOAD_DIR, 'public'), { maxAge: '1d' }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
