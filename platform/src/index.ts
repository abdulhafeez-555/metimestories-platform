import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/healthz', async () => {
  return { status: 'ok', service: 'MeTimeStories API' };
});

const start = async () => {
  try {
    await app.listen({
      port: Number(process.env.PORT) || 3000,
      host: '0.0.0.0'
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
