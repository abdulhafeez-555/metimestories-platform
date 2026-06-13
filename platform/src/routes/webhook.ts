import { FastifyInstance } from 'fastify';
import { query } from '../db';

export async function webhookRoutes(fastify: FastifyInstance) {

  // POST /api/webhook/video-complete
  // Called by the Python pipeline when video generation is done
  fastify.post('/video-complete', async (request, reply) => {
    const {
      job_id,
      status,
      video_url,
      cloudflare_video_id,
      thumbnail_url,
      generation_cost_pence,
      error_message,
      error_code,
    } = request.body as any;

    if (!job_id || !status) {
      return reply.status(400).send({ error: 'job_id and status are required' });
    }

    // Verify job exists
    const jobCheck = await query(
      'SELECT id, child_id, story_id FROM video_jobs WHERE id = $1',
      [job_id]
    );

    if (jobCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    const job = jobCheck.rows[0];

    if (status === 'done') {
      // Update job as complete
      await query(
        `UPDATE video_jobs
         SET status = 'done',
             video_url = $1,
             cloudflare_video_id = $2,
             thumbnail_url = $3,
             generation_cost_pence = $4,
             completed_at = NOW()
         WHERE id = $5`,
        [video_url, cloudflare_video_id || null, thumbnail_url || null,
         generation_cost_pence || null, job_id]
      );

      // Log the completion event in story_views
      await query(
        `INSERT INTO story_views (child_id, story_id, video_job_id, event_type, watch_duration_secs, pct_watched)
         VALUES ($1, $2, $3, 'started', 0, 0)
         ON CONFLICT DO NOTHING`,
        [job.child_id, job.story_id, job_id]
      );

      // Create notification for parent
      const childResult = await query(
        'SELECT name, parent_id FROM children WHERE id = $1',
        [job.child_id]
      );

      const storyResult = await query(
        'SELECT title FROM stories WHERE id = $1',
        [job.story_id]
      );

      if (childResult.rows.length > 0 && storyResult.rows.length > 0) {
        const child = childResult.rows[0];
        const story = storyResult.rows[0];

        await query(
          `INSERT INTO notifications (parent_id, child_id, type, title, body, action_url)
           VALUES ($1, $2, 'story_ready', $3, $4, $5)`,
          [
            child.parent_id,
            job.child_id,
            `${child.name}'s story is ready!`,
            `"${story.title}" has been personalised for ${child.name}. Tap to watch!`,
            `/watch/${job_id}`,
          ]
        );
      }

      console.log(`Video job ${job_id} completed successfully`);

    } else if (status === 'failed') {
      // Update job as failed
      await query(
        `UPDATE video_jobs
         SET status = 'failed',
             error_message = $1,
             error_code = $2,
             completed_at = NOW()
         WHERE id = $3`,
        [error_message || 'Unknown error', error_code || null, job_id]
      );

      console.error(`Video job ${job_id} failed: ${error_message}`);

    } else if (status === 'processing') {
      // Update job as processing
      await query(
        `UPDATE video_jobs SET status = 'processing', started_at = NOW() WHERE id = $1`,
        [job_id]
      );
    }

    return reply.send({ received: true, job_id });
  });

  // GET /api/webhook/health — pipeline health check
  fastify.get('/health', async (request, reply) => {
    return reply.send({
      status: 'ok',
      service: 'MeTimeStories Webhook',
      timestamp: new Date().toISOString(),
    });
  });

}
