import { FastifyInstance } from 'fastify';
import { query } from '../db';
import { requireParent } from '../middleware/auth';

export async function personalisationRoutes(fastify: FastifyInstance) {

  // GET /api/personalisation/fields — get all available DPF fields
  fastify.get('/fields', async (request, reply) => {
    const result = await query(
      `SELECT id, field_key, label, field_type, scope,
              age_adaptive, age_prompts_json, options_json, sort_order
       FROM personalization_fields
       WHERE is_active = true
       ORDER BY sort_order ASC`
    );

    return reply.send({ fields: result.rows });
  });

  // GET /api/personalisation/:childId — get a child's saved answers
  fastify.get('/:childId', { preHandler: requireParent }, async (request, reply) => {
    const parent = request.user as any;
    const { childId } = request.params as any;

    // Verify child belongs to this parent
    const childCheck = await query(
      'SELECT id, name FROM children WHERE id = $1 AND parent_id = $2 AND deleted_at IS NULL',
      [childId, parent.parentId]
    );

    if (childCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Child not found' });
    }

    const result = await query(
      `SELECT pf.field_key, pf.label, pf.field_type, pf.scope,
              cpd.value, cpd.updated_at
       FROM child_profile_data cpd
       JOIN personalization_fields pf ON pf.id = cpd.field_id
       WHERE cpd.child_id = $1
       ORDER BY pf.sort_order ASC`,
      [childId]
    );

    return reply.send({
      child_id: parseInt(childId),
      child_name: childCheck.rows[0].name,
      profile: result.rows,
    });
  });

  // POST /api/personalisation/:childId — save answers for a child
  // Accepts array of {field_key, value} pairs
  // Uses UPSERT — updates existing answers, inserts new ones
  fastify.post('/:childId', { preHandler: requireParent }, async (request, reply) => {
    const parent = request.user as any;
    const { childId } = request.params as any;
    const { answers } = request.body as any;

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return reply.status(400).send({ error: 'answers array is required' });
    }

    // Verify child belongs to this parent
    const childCheck = await query(
      'SELECT id FROM children WHERE id = $1 AND parent_id = $2 AND deleted_at IS NULL',
      [childId, parent.parentId]
    );

    if (childCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Child not found' });
    }

    // Get field IDs for the provided field keys
    const fieldKeys = answers.map((a: any) => a.field_key);
    const fieldsResult = await query(
      `SELECT id, field_key FROM personalization_fields
       WHERE field_key = ANY($1) AND is_active = true`,
      [fieldKeys]
    );

    const fieldMap = new Map(fieldsResult.rows.map((f: any) => [f.field_key, f.id]));

    // UPSERT each answer
    let savedCount = 0;
    for (const answer of answers) {
      const fieldId = fieldMap.get(answer.field_key);
      if (!fieldId) continue;

      await query(
        `INSERT INTO child_profile_data (child_id, field_id, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (child_id, field_id)
         DO UPDATE SET value = $3, updated_at = NOW()`,
        [childId, fieldId, answer.value.toString()]
      );
      savedCount++;
    }

    return reply.send({
      message: `${savedCount} answers saved successfully`,
      child_id: parseInt(childId),
      saved_count: savedCount,
    });
  });

  // GET /api/personalisation/:childId/missing/:storyId
  // Check which fields a story needs that the child hasn't answered yet
  fastify.get('/:childId/missing/:storyId', { preHandler: requireParent }, async (request, reply) => {
    const parent = request.user as any;
    const { childId, storyId } = request.params as any;

    // Verify child belongs to this parent
    const childCheck = await query(
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
      [childId, parent.parentId]
    );

    if (childCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Child not found' });
    }

    const child = childCheck.rows[0];

    // Get story required fields that child hasn't answered
    const result = await query(
      `SELECT pf.field_key, pf.label, pf.field_type, pf.scope,
              pf.age_prompts_json, sf.required,
              cpd.value as existing_value
       FROM story_fields sf
       JOIN personalization_fields pf ON pf.id = sf.field_id
       LEFT JOIN child_profile_data cpd ON cpd.field_id = pf.id AND cpd.child_id = $1
       WHERE sf.story_id = $2
       ORDER BY sf.sort_order ASC`,
      [childId, storyId]
    );

    const missing = result.rows.filter((f: any) => !f.existing_value && f.required);
    const answered = result.rows.filter((f: any) => f.existing_value);

    return reply.send({
      child: {
        id: child.id,
        name: child.name,
        age: child.age,
        age_band: child.age_band,
      },
      missing_fields: missing,
      answered_fields: answered,
      ready_to_generate: missing.length === 0,
    });
  });

}
