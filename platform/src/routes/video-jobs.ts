import { FastifyInstance } from 'fastify';
import { query } from '../db';
import { requireParent } from '../middleware/auth';

export async function videoJobsRoutes(fastify: FastifyInstance) {

  // POST /api/video-jobs — request video generation for a child + story
  fastify.post('/', { preHandler: requireParent }, async (request, reply) => {
    const parent = request.user as any;
    const { child_id, story_id } = request.body as any;

    if (!child_id || !story_id) {
      return reply.status(400).send({ error: 'child_id and story_id are required' });
    }

    // Verify child belongs to this parent
    const childResult = await query(
      `SELECT c.id, c.name,
       DATE_PART('year', AGE(c.date_of_birth))::INTEGER as age,
       CASE
         WHEN DATE_PART('year', AGE(c.date_of_birth)) BETWEEN 3 AND 4 THEN 'little'
         WHEN DATE_PART('year', AGE(c.date_of_birth)) BETWEEN 5 AND 6 THEN 'young'
         WHEN DATE_PART('year', AGE(c.date_of_birth)) BETWEEN 7 AND 8 THEN 'middle'
         ELSE 'older'
       END as age_band
       FROM children c
       WHERE c.id = $1 AND c.parent_id = $2 AND c.deleted_at IS NULL`,
      [child_id, parent.parentId]
    );

    if (childResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Child not found' });
    }

    const child = childResult.rows[0];

    // Verify story exists and is published
    const storyResult = await query(
      `SELECT id, title, scene_count, current_version
       FROM stories WHERE id = $1 AND status = 'published'`,
      [story_id]
    );

    if (storyResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Story not found' });
    }

    const story = storyResult.rows[0];

    // Check if video already exists and is done
    const existingJob = await query(
      `SELECT id, uuid, status, video_url, age_band_used, story_version_at_generation
       FROM video_jobs
       WHERE child_id = $1 AND story_id = $2`,
      [child_id, story_id]
    );

    if (existingJob.rows.length > 0) {
      const job = existingJob.rows[0];

      // If done and same version — serve cached video
      if (job.status === 'done' &&
          job.story_version_at_generation === story.current_version &&
          job.age_band_used === child.age_band) {
        return reply.send({
          message: 'Video already generated',
          job_id: job.id,
          status: 'done',
          video_url: job.video_url,
          cached: true,
        });
      }

      // If already queued or processing
      if (job.status === 'queued' || job.status === 'processing') {
        return reply.send({
          message: 'Video generation already in progress',
          job_id: job.id,
          status: job.status,
          cached: false,
        });
      }
    }

    // Get child's personalisation data
    const profileData = await query(
      `SELECT pf.field_key, cpd.value
       FROM child_profile_data cpd
       JOIN personalization_fields pf ON pf.id = cpd.field_id
       WHERE cpd.child_id = $1`,
      [child_id]
    );

    const profile: any = {};
    profileData.rows.forEach((row: any) => {
      profile[row.field_key] = row.value;
    });

    // Get child appearance profile
    const appearanceResult = await query(
      'SELECT appearance_profile FROM children WHERE id = $1',
      [child_id]
    );
    const appearance = appearanceResult.rows[0]?.appearance_profile || {};

    // Create or update video job
    let jobResult;
    if (existingJob.rows.length > 0) {
      // Update existing failed/stale job
      jobResult = await query(
        `UPDATE video_jobs
         SET status = 'queued',
             age_band_used = $1,
             story_version_at_generation = $2,
             retry_count = retry_count + 1,
             queued_at = NOW(),
             started_at = NULL,
             completed_at = NULL,
             video_url = NULL,
             error_message = NULL
         WHERE child_id = $3 AND story_id = $4
         RETURNING id, uuid`,
        [child.age_band, story.current_version, child_id, story_id]
      );
    } else {
      // Create new job
      jobResult = await query(
        `INSERT INTO video_jobs (child_id, story_id, age_band_used, story_version_at_generation, status)
         VALUES ($1, $2, $3, $4, 'queued')
         RETURNING id, uuid`,
        [child_id, story_id, child.age_band, story.current_version]
      );
    }

    const job = jobResult.rows[0];

    // Send to pipeline (fire and forget)
    const pipelinePayload = {
      job_id: job.id,
      job_uuid: job.uuid,
      child: {
        id: child.id,
        name: child.name,
        age: child.age,
        age_band: child.age_band,
        appearance_profile: appearance,
        profile_data: profile,
      },
      story: {
        id: story.id,
        title: story.title,
        scene_count: story.scene_count,
        version: story.current_version,
      },
      webhook_url: `${process.env.API_URL || 'http://localhost:3000'}/api/webhook/video-complete`,
    };

    // Fire pipeline request asynchronously
    const pipelineUrl = process.env.PIPELINE_URL || 'http://localhost:8000';
    fetch(`${pipelineUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pipelinePayload),
    }).catch((err) => {
      console.error('Pipeline request failed:', err.message);
    });

    return reply.status(202).send({
      message: 'Video generation queued',
      job_id: job.id,
      job_uuid: job.uuid,
      status: 'queued',
      child_name: child.name,
      story_title: story.title,
      estimated_minutes: 5,
    });
  });

  // GET /api/video-jobs/:jobId — check job status
  fastify.get('/:jobId', { preHandler: requireParent }, async (request, reply) => {
    const parent = request.user as any;
    const { jobId } = request.params as any;

    const result = await query(
      `SELECT vj.id, vj.uuid, vj.status, vj.video_url,
              vj.age_band_used, vj.queued_at, vj.started_at,
              vj.completed_at, vj.error_message,
              c.name as child_name, s.title as story_title
       FROM video_jobs vj
       JOIN children c ON c.id = vj.child_id
       JOIN stories s ON s.id = vj.story_id
       WHERE vj.id = $1 AND c.parent_id = $2`,
      [jobId, parent.parentId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return reply.send({ job: result.rows[0] });
  });

  // GET /api/video-jobs/child/:childId — get all jobs for a child
  fastify.get('/child/:childId', { preHandler: requireParent }, async (request, reply) => {
    const parent = request.user as any;
    const { childId } = request.params as any;

    const result = await query(
      `SELECT vj.id, vj.uuid, vj.status, vj.video_url,
              vj.age_band_used, vj.queued_at, vj.completed_at,
              s.title as story_title, s.thumbnail_url,
              sv.label as value_label
       FROM video_jobs vj
       JOIN stories s ON s.id = vj.story_id
       LEFT JOIN story_values sv ON sv.id = s.value_id
       JOIN children c ON c.id = vj.child_id
       WHERE vj.child_id = $1 AND c.parent_id = $2
       ORDER BY vj.queued_at DESC`,
      [childId, parent.parentId]
    );

    return reply.send({ jobs: result.rows });
  });

}
