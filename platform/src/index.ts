import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import { parentAuthRoutes } from './routes/parent-auth';
import { childAuthRoutes } from './routes/child-auth';
import { authorAuthRoutes } from './routes/author-auth';
import { childrenRoutes } from './routes/children';
import { storiesRoutes } from './routes/stories';

dotenv.config();

const app = Fastify({ logger: true });

// Plugins
app.register(cors, { origin: true });
app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret' });

// Auth routes
app.register(parentAuthRoutes, { prefix: '/api/auth/parent' });
app.register(childAuthRoutes,  { prefix: '/api/auth/child' });
app.register(authorAuthRoutes, { prefix: '/api/auth/author' });

// Resource routes
app.register(childrenRoutes, { prefix: '/api/children' });
app.register(storiesRoutes,  { prefix: '/api/stories' });

// Health check
app.get('/healthz', async () => ({
  status: 'ok',
  service: 'MeTimeStories API',
  version: '1.0.0',
  timestamp: new Date().toISOString()
}));

// Start server
const start = async () => {
  try {
    await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
    console.log('MeTimeStories API running on http://localhost:3000');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
