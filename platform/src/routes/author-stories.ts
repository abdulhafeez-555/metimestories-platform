import { FastifyInstance } from 'fastify';
import { query, getClient } from '../db';
import { requireAuthor } from '../middleware/auth';
import {
  countSceneMarkers,
  extractPlaceholders,
  extractRequiredFieldKeys,
} from '../utils/story-parser';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Author story management routes  (revised, production-grade)
//
//  All routes require a valid author JWT and are strictly
//  ownership-scoped â€” every query filters by author_id from the
//  verified token, never from user input.
//
//  Merge-review changes applied:
//   1. Transactions around every multi-step write (create+sync,
//      update+sync, variant-upsert+story-update). Either the
//      whole operation commits or none of it does.
//   2. Batched story_fields insert via UNNEST â€” one INSERT, not N.
//   3. Structured logging on create/update/submit/delete.
//   4. Shared scene/placeholder parser (utils/story-parser) used
//      by BOTH this file and the DPF engine â€” they can never
//      disagree about scene breaks or placeholders.
//   5. Expanded pre-submission validation (title, content,
//      synopsis, value, scene breaks).
//   6. PUT semantics documented explicitly (COALESCE = PATCH-style
//      partial update; clearing a nullable field is intentionally
//      not supported via PUT â€” a deliberate decision, not an
//      oversight).
//
//  Verified against real schema:
//    stories.content, status enum (draft|in_review|published|
//    rejected|archived), age_band (little|young|middle|older),
//    override_type (full|intro|climax|ending|vocab),
//    constraints age_min>=3, age_max<=12, age_min<age_max,
//    scene_count 4-20, reading_time_mins 2-20.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const VALID_AGE_BANDS = ['little', 'young', 'middle', 'older'];
const VALID_OVERRIDE_TYPES = ['full', 'intro', 'climax', 'ending', 'vocab'];

function validateStoryConstraints(body: any): string | null {
  const ageMin = Number(body.age_min);
  const ageMax = Number(body.age_max);
  const sceneCount = Number(body.scene_count);
  const readingTime = Number(body.reading_time_mins);

  if (body.age_min !== undefined) {
    if (!Number.isInteger(ageMin) || ageMin < 3) return 'Minimum age must be 3 or above.';
  }
  if (body.age_max !== undefined) {
    if (!Number.isInteger(ageMax) || ageMax > 12) return 'Maximum age must be 12 or below.';
  }
  if (body.age_min !== undefined && body.age_max !== undefined) {
    if (ageMin >= ageMax) return 'Minimum age must be less than maximum age.';
  }
  if (body.scene_count !== undefined) {
    if (!Number.isInteger(sceneCount) || sceneCount < 4 || sceneCount > 20)
      return 'Scene count must be between 4 and 20.';
  }
  if (body.reading_time_mins !== undefined) {
    if (!Number.isInteger(readingTime) || readingTime < 2 || readingTime > 20)
      return 'Reading time must be between 2 and 20 minutes.';
  }
  return null;
}

// Sync story_fields to exactly match the placeholders in content.
// Runs INSIDE a caller-supplied transaction client so it commits
// or rolls back atomically with the story write that triggered it.
// Batched insert via UNNEST â€” one INSERT regardless of field count.
// Returns the list of unknown placeholders (present in content but
// not defined in personalization_fields) so the caller can warn.
async function syncStoryFieldsTx(client: any, storyId: number, content: string): Promise<string[]> {
  const requiredKeys = extractRequiredFieldKeys(content);

  // Resolve which keys are real defined fields.
  const fieldRows = await client.query(
    `SELECT id, field_key FROM personalization_fields WHERE field_key = ANY($1)`,
    [requiredKeys]
  );
  const knownKeys = new Set(fieldRows.rows.map((r: any) => r.field_key));
  const unknownKeys = requiredKeys.filter((k) => !knownKeys.has(k));

  // Replace the story's required fields to exactly match current content.
  await client.query(`DELETE FROM story_fields WHERE story_id = $1`, [storyId]);

  if (fieldRows.rows.length > 0) {
    // Batched insert: build parallel arrays and expand with UNNEST.
    const fieldIds = fieldRows.rows.map((r: any) => r.id);
    const sortOrders = fieldRows.rows.map((_: any, i: number) => i);
    await client.query(
      `INSERT INTO story_fields (story_id, field_id, required, sort_order)
       SELECT $1, f.field_id, true, f.sort_order
       FROM UNNEST($2::int[], $3::int[]) AS f(field_id, sort_order)`,
      [storyId, fieldIds, sortOrders]
    );
  }

  return unknownKeys;
}

export async function authorStoriesRoutes(fastify: FastifyInstance) {

  // â”€â”€ GET /api/author/stories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  fastify.get('/', { preHandler: requireAuthor }, async (request, reply) => {
    const author = request.user as any;
    const result = await query(
      `SELECT
         s.id, s.uuid, s.title, s.synopsis, s.status,
         s.age_min, s.age_max, s.scene_count, s.reading_time_mins,
         s.total_views, s.total_completions, s.avg_completion_rate,
         s.created_at, s.updated_at, s.published_at,
         sv.label AS value_label, sv.colour_hex AS value_colour,
         (SELECT COUNT(*) FROM story_age_variants sav WHERE sav.story_id = s.id) AS variant_count,
         (SELECT COUNT(*) FROM story_fields sf WHERE sf.story_id = s.id) AS field_count
       FROM stories s
       LEFT JOIN story_values sv ON sv.id = s.value_id
       WHERE s.author_id = $1 AND s.deleted_at IS NULL
       ORDER BY s.updated_at DESC`,
      [author.authorId]
    );
    return reply.send({ stories: result.rows, total: result.rows.length });
  });

  // â”€â”€ GET /api/author/stories/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  fastify.get('/:id', { preHandler: requireAuthor }, async (request, reply) => {
    const author = request.user as any;
    const { id } = request.params as any;

    const result = await query(
      `SELECT s.*, sv.label AS value_label, sv.colour_hex AS value_colour
       FROM stories s
       LEFT JOIN story_values sv ON sv.id = s.value_id
       WHERE s.id = $1 AND s.author_id = $2 AND s.deleted_at IS NULL`,
      [id, author.authorId]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Story not found' });
    }

    const variants = await query(
      `SELECT id, age_band, override_type, content, author_notes, updated_at
       FROM story_age_variants WHERE story_id = $1
       ORDER BY age_band, override_type`,
      [id]
    );
    const fields = await query(
      `SELECT pf.field_key, pf.label, pf.field_type, sf.required
       FROM story_fields sf
       JOIN personalization_fields pf ON pf.id = sf.field_id
       WHERE sf.story_id = $1 ORDER BY sf.sort_order`,
      [id]
    );

    return reply.send({
      story: result.rows[0],
      age_variants: variants.rows,
      required_fields: fields.rows,
    });
  });

  // â”€â”€ POST /api/author/stories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Create a draft + sync required fields, atomically.
  fastify.post('/', { preHandler: requireAuthor }, async (request, reply) => {
    const author = request.user as any;
    const body = request.body as any;

    if (!body.title || !body.content) {
      return reply.status(400).send({ error: 'Title and content are required.' });
    }
    const constraintError = validateStoryConstraints(body);
    if (constraintError) return reply.status(400).send({ error: constraintError });

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO stories
           (author_id, value_id, title, content, synopsis,
            age_min, age_max, age_adaptive, scene_count, reading_time_mins,
            outcome_focus, discussion_prompts, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'draft')
         RETURNING id, uuid, title, status, created_at`,
        [
          author.authorId,
          body.value_id || null,
          body.title.trim(),
          body.content,
          body.synopsis || null,
          body.age_min ?? 3,
          body.age_max ?? 10,
          body.age_adaptive ?? false,
          body.scene_count ?? 10,
          body.reading_time_mins ?? 7,
          body.outcome_focus || null,
          body.discussion_prompts ? JSON.stringify(body.discussion_prompts) : null,
        ]
      );

      const story = result.rows[0];
      const unknownPlaceholders = await syncStoryFieldsTx(client, story.id, body.content);

      await client.query('COMMIT');
      fastify.log.info(`Author ${author.authorId} created story ${story.id} ("${story.title}")`);

      return reply.status(201).send({
        message: 'Draft story created.',
        story,
        unknown_placeholders: unknownPlaceholders,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      fastify.log.error(`Author ${author.authorId} story create failed: ${err}`);
      return reply.status(500).send({ error: 'Could not create the story. Please try again.' });
    } finally {
      client.release();
    }
  });

  // â”€â”€ PUT /api/author/stories/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PATCH-style partial update: only provided fields change
  // (COALESCE). Clearing a nullable field to NULL via PUT is
  // intentionally NOT supported â€” the author editor always sends
  // the full form, so "clear" is not a real user action. If that
  // changes, add explicit nullable handling rather than relying on
  // COALESCE. Only draft/rejected stories are editable.
  fastify.put('/:id', { preHandler: requireAuthor }, async (request, reply) => {
    const author = request.user as any;
    const { id } = request.params as any;
    const body = request.body as any;

    const existing = await query(
      `SELECT id, status FROM stories
       WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL`,
      [id, author.authorId]
    );
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Story not found' });
    }
    const currentStatus = existing.rows[0].status;
    if (currentStatus !== 'draft' && currentStatus !== 'rejected') {
      return reply.status(409).send({
        error: `A story that is "${currentStatus}" cannot be edited. Only drafts and rejected stories can be changed.`,
      });
    }

    const constraintError = validateStoryConstraints(body);
    if (constraintError) return reply.status(400).send({ error: constraintError });

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE stories SET
           value_id           = COALESCE($1, value_id),
           title              = COALESCE($2, title),
           content            = COALESCE($3, content),
           synopsis           = COALESCE($4, synopsis),
           age_min            = COALESCE($5, age_min),
           age_max            = COALESCE($6, age_max),
           age_adaptive       = COALESCE($7, age_adaptive),
           scene_count        = COALESCE($8, scene_count),
           reading_time_mins  = COALESCE($9, reading_time_mins),
           outcome_focus      = COALESCE($10, outcome_focus),
           discussion_prompts = COALESCE($11, discussion_prompts),
           updated_at         = NOW()
         WHERE id = $12 AND author_id = $13
         RETURNING id, uuid, title, status, updated_at`,
        [
          body.value_id ?? null,
          body.title ?? null,
          body.content ?? null,
          body.synopsis ?? null,
          body.age_min ?? null,
          body.age_max ?? null,
          body.age_adaptive ?? null,
          body.scene_count ?? null,
          body.reading_time_mins ?? null,
          body.outcome_focus ?? null,
          body.discussion_prompts ? JSON.stringify(body.discussion_prompts) : null,
          id,
          author.authorId,
        ]
      );

      let unknownPlaceholders: string[] = [];
      if (body.content !== undefined) {
        unknownPlaceholders = await syncStoryFieldsTx(client, Number(id), body.content);
      }

      await client.query('COMMIT');
      fastify.log.info(`Author ${author.authorId} updated story ${id}`);

      return reply.send({
        message: 'Story updated.',
        story: result.rows[0],
        unknown_placeholders: unknownPlaceholders,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      fastify.log.error(`Author ${author.authorId} story ${id} update failed: ${err}`);
      return reply.status(500).send({ error: 'Could not update the story. Please try again.' });
    } finally {
      client.release();
    }
  });

  // â”€â”€ PUT /api/author/stories/:id/variants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Upsert an age variant AND flag the story age-adaptive, atomically.
  fastify.put('/:id/variants', { preHandler: requireAuthor }, async (request, reply) => {
    const author = request.user as any;
    const { id } = request.params as any;
    const { age_band, override_type, content, author_notes } = request.body as any;

    if (!age_band || !override_type || content === undefined) {
      return reply.status(400).send({ error: 'age_band, override_type and content are required.' });
    }
    if (!VALID_AGE_BANDS.includes(age_band)) {
      return reply.status(400).send({ error: `Invalid age_band. Must be one of: ${VALID_AGE_BANDS.join(', ')}` });
    }
    if (!VALID_OVERRIDE_TYPES.includes(override_type)) {
      return reply.status(400).send({ error: `Invalid override_type. Must be one of: ${VALID_OVERRIDE_TYPES.join(', ')}` });
    }

    const owns = await query(
      `SELECT id FROM stories WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL`,
      [id, author.authorId]
    );
    if (owns.rows.length === 0) {
      return reply.status(404).send({ error: 'Story not found' });
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO story_age_variants (story_id, age_band, override_type, content, author_notes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (story_id, age_band, override_type)
         DO UPDATE SET content = $4, author_notes = $5, updated_at = NOW()
         RETURNING id, age_band, override_type, updated_at`,
        [id, age_band, override_type, content, author_notes || null]
      );

      await client.query(`UPDATE stories SET age_adaptive = true, updated_at = NOW() WHERE id = $1`, [id]);

      await client.query('COMMIT');
      fastify.log.info(`Author ${author.authorId} saved ${age_band}/${override_type} variant on story ${id}`);

      return reply.send({ message: 'Age variant saved.', variant: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      fastify.log.error(`Author ${author.authorId} variant save on story ${id} failed: ${err}`);
      return reply.status(500).send({ error: 'Could not save the age variant. Please try again.' });
    } finally {
      client.release();
    }
  });

  // â”€â”€ DELETE /api/author/stories/:id/variants/:variantId â”€â”€â”€
  fastify.delete('/:id/variants/:variantId', { preHandler: requireAuthor }, async (request, reply) => {
    const author = request.user as any;
    const { id, variantId } = request.params as any;

    const owns = await query(
      `SELECT id FROM stories WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL`,
      [id, author.authorId]
    );
    if (owns.rows.length === 0) {
      return reply.status(404).send({ error: 'Story not found' });
    }

    await query(`DELETE FROM story_age_variants WHERE id = $1 AND story_id = $2`, [variantId, id]);
    fastify.log.info(`Author ${author.authorId} deleted variant ${variantId} from story ${id}`);
    return reply.send({ message: 'Age variant deleted.' });
  });

  // â”€â”€ POST /api/author/stories/:id/submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Move draft/rejected â†’ in_review, with full completeness checks.
  fastify.post('/:id/submit', { preHandler: requireAuthor }, async (request, reply) => {
    const author = request.user as any;
    const { id } = request.params as any;

    const existing = await query(
      `SELECT id, status, title, content, synopsis, scene_count, value_id, discussion_prompts
       FROM stories WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL`,
      [id, author.authorId]
    );
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Story not found' });
    }
    const story = existing.rows[0];

    if (story.status !== 'draft' && story.status !== 'rejected') {
      return reply.status(409).send({
        error: `This story is already "${story.status}" and cannot be submitted again.`,
      });
    }

    // Full pre-submission completeness â€” surface every problem at once
    // so the author fixes them in one pass, not one per attempt.
    const problems: string[] = [];
    if (!story.title || story.title.trim().length < 3) {
      problems.push('Give the story a title of at least 3 characters.');
    }
    if (!story.content || story.content.trim().length < 50) {
      problems.push('The story content is too short to review.');
    }
    if (!story.synopsis || story.synopsis.trim().length < 10) {
      problems.push('Add a synopsis of at least 10 characters â€” parents read this when browsing.');
    }
    if (!story.value_id) {
      problems.push('Select the value this story teaches.');
    }
    // Scene breaks â€” uses the SHARED parser, identical to the DPF engine.
    const sceneMarkers = countSceneMarkers(story.content);
    if (sceneMarkers < story.scene_count - 1) {
      problems.push(
        `Add scene breaks. This story is set to ${story.scene_count} scenes but only has ${sceneMarkers} scene break(s). You need ${story.scene_count - 1}.`
      );
    }

    if (problems.length > 0) {
      return reply.status(422).send({ error: 'Story is not ready for review.', problems });
    }

    await query(`UPDATE stories SET status = 'in_review', updated_at = NOW() WHERE id = $1`, [id]);
    fastify.log.info(`Author ${author.authorId} submitted story ${id} for review`);

    return reply.send({
      message: 'Story submitted for editorial review. You will be notified once it has been reviewed.',
      status: 'in_review',
    });
  });

  // â”€â”€ DELETE /api/author/stories/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  fastify.delete('/:id', { preHandler: requireAuthor }, async (request, reply) => {
    const author = request.user as any;
    const { id } = request.params as any;

    const existing = await query(
      `SELECT id, status FROM stories
       WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL`,
      [id, author.authorId]
    );
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Story not found' });
    }
    if (existing.rows[0].status === 'published') {
      return reply.status(409).send({
        error: 'Published stories cannot be deleted. Contact an admin to archive it instead.',
      });
    }

    await query(`UPDATE stories SET deleted_at = NOW() WHERE id = $1`, [id]);
    fastify.log.info(`Author ${author.authorId} deleted story ${id}`);
    return reply.send({ message: 'Story deleted.' });
  });


  // POST /api/author/stories/:id/archive - unpublish without deleting.
  // Preserves all reader history (favourites, views, video_jobs) via
  // ON DELETE CASCADE on the real deletion path never being triggered.
  // Only removes it from GET /api/stories, which only returns 'published'.
  fastify.post('/:id/archive', { preHandler: requireAuthor }, async (request, reply) => {
    const author = request.user as any;
    const { id } = request.params as any;

    const existing = await query(
      `SELECT id, status, title FROM stories
       WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL`,
      [id, author.authorId]
    );

    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Story not found' });
    }
    if (existing.rows[0].status !== 'published') {
      return reply.status(409).send({
        error: `Only published stories can be archived. This story is "${existing.rows[0].status}".`,
      });
    }

    await query(
      `UPDATE stories SET status = 'archived', archived_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );
    fastify.log.info(`Author ${author.authorId} archived story ${id} ("${existing.rows[0].title}")`);

    return reply.send({ message: 'Story archived. Families will no longer see it, but all reading history is preserved.', status: 'archived' });
  });
}
