import { FastifyInstance } from 'fastify';
import { query } from '../db';
import { requireParent, requireChild } from '../middleware/auth';

export async function storiesRoutes(fastify: FastifyInstance) {

  // GET /api/stories — get story library
  // Accessible by both parents and children
  // Filters by age band if child token provided
  fastify.get('/', async (request, reply) => {
    const { value_id, age_band, featured, limit = 20, offset = 0 } = request.query as any;

    let whereClause = `WHERE s.status = 'published'`;
    const params: any[] = [];
    let paramCount = 0;

    if (age_band) {
      paramCount++;
      whereClause += ` AND s.age_min <= (
        SELECT DATE_PART('year', AGE(date_of_birth))::INTEGER
        FROM children WHERE uuid = $${paramCount}
        LIMIT 1
      )`;
      // Simple age band filter instead
      const ageBandMap: any = {
        little: '3 AND 4',
        young: '5 AND 6',
        middle: '7 AND 8',
        older: '9 AND 12',
      };
    }

    if (value_id) {
      paramCount++;
      params.push(value_id);
      whereClause += ` AND s.value_id = $${paramCount}`;
    }

    if (featured === 'true') {
      whereClause += ` AND s.is_featured = true`;
    }

    paramCount++;
    params.push(Number(limit));
    const limitParam = paramCount;

    paramCount++;
    params.push(Number(offset));
    const offsetParam = paramCount;

    const result = await query(
      `SELECT
        s.id,
        s.uuid,
        s.title,
        s.synopsis,
        s.thumbnail_url,
        s.age_min,
        s.age_max,
        s.age_adaptive,
        s.reading_time_mins,
        s.is_featured,
        s.total_views,
        s.avg_completion_rate,
        s.published_at,
        sv.value_key,
        sv.label as value_label,
        sv.colour_hex as value_colour,
        a.display_name as author_name
       FROM stories s
       LEFT JOIN story_values sv ON sv.id = s.value_id
       LEFT JOIN authors a ON a.id = s.author_id
       ${whereClause}
       ORDER BY s.is_featured DESC, s.published_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM stories s ${whereClause}`,
      params.slice(0, params.length - 2)
    );

    return reply.send({
      stories: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: Number(limit),
      offset: Number(offset),
    });
  });

  // GET /api/stories/values — get all story values for browsing
  fastify.get('/values', async (request, reply) => {
    const result = await query(
      `SELECT id, value_key, label, description, icon, colour_hex, sort_order
       FROM story_values
       WHERE is_active = true
       ORDER BY sort_order ASC`
    );

    return reply.send({ values: result.rows });
  });

  // GET /api/stories/:uuid — get single story details
  fastify.get('/:uuid', async (request, reply) => {
    const { uuid } = request.params as any;

    const result = await query(
      `SELECT
        s.id,
        s.uuid,
        s.title,
        s.synopsis,
        s.thumbnail_url,
        s.age_min,
        s.age_max,
        s.age_adaptive,
        s.reading_time_mins,
        s.scene_count,
        s.is_featured,
        s.total_views,
        s.total_completions,
        s.avg_completion_rate,
        s.published_at,
        sv.value_key,
        sv.label as value_label,
        sv.colour_hex as value_colour,
        sv.description as value_description,
        a.display_name as author_name,
        a.bio as author_bio
       FROM stories s
       LEFT JOIN story_values sv ON sv.id = s.value_id
       LEFT JOIN authors a ON a.id = s.author_id
       WHERE s.uuid = $1 AND s.status = 'published'`,
      [uuid]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Story not found' });
    }

    const story = result.rows[0];

    // Get required personalisation fields for this story
    const fieldsResult = await query(
      `SELECT pf.field_key, pf.label, pf.field_type, pf.scope,
              pf.age_prompts_json, sf.required
       FROM story_fields sf
       JOIN personalization_fields pf ON pf.id = sf.field_id
       WHERE sf.story_id = $1
       ORDER BY sf.sort_order ASC`,
      [story.id]
    );

    return reply.send({
      story: {
        ...story,
        required_fields: fieldsResult.rows,
      }
    });
  });

  // GET /api/stories/for-child/:childId — get stories filtered for a specific child's age
  fastify.get('/for-child/:childId', { preHandler: requireParent }, async (request, reply) => {
    const parent = request.user as any;
    const { childId } = request.params as any;
    const { value_id } = request.query as any;

    // Verify child belongs to this parent
    const childResult = await query(
      `SELECT id, name, DATE_PART('year', AGE(date_of_birth))::INTEGER as age,
       CASE
         WHEN DATE_PART('year', AGE(date_of_birth)) BETWEEN 3 AND 4 THEN 'little'
         WHEN DATE_PART('year', AGE(date_of_birth)) BETWEEN 5 AND 6 THEN 'young'
         WHEN DATE_PART('year', AGE(date_of_birth)) BETWEEN 7 AND 8 THEN 'middle'
         ELSE 'older'
       END as age_band
       FROM children WHERE id = $1 AND parent_id = $2 AND deleted_at IS NULL`,
      [childId, parent.parentId]
    );

    if (childResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Child not found' });
    }

    const child = childResult.rows[0];

    let whereClause = `WHERE s.status = 'published'
      AND s.age_min <= $1 AND s.age_max >= $1`;
    const params: any[] = [child.age];

    if (value_id) {
      params.push(value_id);
      whereClause += ` AND s.value_id = $${params.length}`;
    }

    const result = await query(
      `SELECT
        s.id,
        s.uuid,
        s.title,
        s.synopsis,
        s.thumbnail_url,
        s.age_min,
        s.age_max,
        s.reading_time_mins,
        s.is_featured,
        s.total_views,
        sv.value_key,
        sv.label as value_label,
        sv.colour_hex as value_colour,
        -- Check if video already generated for this child
        vj.status as video_status,
        vj.video_url
       FROM stories s
       LEFT JOIN story_values sv ON sv.id = s.value_id
       LEFT JOIN video_jobs vj ON vj.story_id = s.id AND vj.child_id = $2
       ${whereClause}
       ORDER BY s.is_featured DESC, vj.status DESC, s.published_at DESC`,
      [...params, child.id]
    );

    return reply.send({
      child: {
        id: child.id,
        name: child.name,
        age: child.age,
        age_band: child.age_band,
      },
      stories: result.rows,
      total: result.rows.length,
    });
  });

}
