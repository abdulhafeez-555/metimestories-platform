import { FastifyInstance } from 'fastify';
import { query, getClient } from '../db';
import { requireStaff } from '../middleware/auth';

// Staff review endpoints.
//
// story_reviews.status (pending|approved|rejected|revision_requested)
// is distinct from stories.status (draft|in_review|published|rejected|archived).
// A decision here writes BOTH, in one transaction:
//   approved            -> stories.status = 'published', published_at = NOW()
//   rejected             -> stories.status = 'rejected'
//   revision_requested   -> stories.status = 'rejected'
//     (authors can already edit a 'rejected' story per author-stories.ts,
//      so revision_requested reuses that same reopen-for-editing path)

const DECISION_TO_STORY_STATUS: Record<string, string> = {
  approved: 'published',
  rejected: 'rejected',
  revision_requested: 'rejected',
};

export async function staffReviewRoutes(fastify: FastifyInstance) {

  // GET /api/staff/reviews - stories currently awaiting review
  fastify.get('/', { preHandler: requireStaff }, async (request, reply) => {
    const result = await query(
      `SELECT
         s.id, s.uuid, s.title, s.synopsis, s.status,
         s.age_min, s.age_max, s.scene_count, s.reading_time_mins,
         s.content, s.created_at, s.updated_at,
         a.id AS author_id, a.display_name AS author_name, a.email AS author_email,
         sv.label AS value_label, sv.colour_hex AS value_colour
       FROM stories s
       JOIN authors a ON a.id = s.author_id
       LEFT JOIN story_values sv ON sv.id = s.value_id
       WHERE s.status = 'in_review' AND s.deleted_at IS NULL
       ORDER BY s.updated_at ASC`
    );
    return reply.send({ stories: result.rows, total: result.rows.length });
  });

  // GET /api/staff/reviews/:storyId - full story + its variants, for review
  fastify.get('/:storyId', { preHandler: requireStaff }, async (request, reply) => {
    const { storyId } = request.params as any;

    const storyResult = await query(
      `SELECT s.*, a.display_name AS author_name, a.email AS author_email,
              sv.label AS value_label, sv.colour_hex AS value_colour
       FROM stories s
       JOIN authors a ON a.id = s.author_id
       LEFT JOIN story_values sv ON sv.id = s.value_id
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [storyId]
    );
    if (storyResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Story not found' });
    }

    const variants = await query(
      `SELECT id, age_band, override_type, content, author_notes, updated_at
       FROM story_age_variants WHERE story_id = $1 ORDER BY age_band, override_type`,
      [storyId]
    );

    const priorReviews = await query(
      `SELECT id, version_number, status, notes, safeguarding_check,
              dpf_compliance, age_appropriateness, submitted_at, reviewed_at
       FROM story_reviews WHERE story_id = $1 ORDER BY submitted_at DESC`,
      [storyId]
    );

    return reply.send({
      story: storyResult.rows[0],
      age_variants: variants.rows,
      prior_reviews: priorReviews.rows,
    });
  });

  // POST /api/staff/reviews/:storyId/decision - approve / reject / request revision
  fastify.post('/:storyId/decision', { preHandler: requireStaff }, async (request, reply) => {
    const staff = request.user as any;
    const { storyId } = request.params as any;
    const body = request.body as any;
    const { decision, notes, safeguarding_check, dpf_compliance, age_appropriateness } = body;

    if (!decision || !DECISION_TO_STORY_STATUS[decision]) {
      return reply.status(400).send({
        error: 'decision must be one of: approved, rejected, revision_requested',
      });
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const storyCheck = await client.query(
        `SELECT id, status, author_id, title FROM stories WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [storyId]
      );
      if (storyCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Story not found' });
      }
      if (storyCheck.rows[0].status !== 'in_review') {
        await client.query('ROLLBACK');
        return reply.status(409).send({
          error: `This story is "${storyCheck.rows[0].status}", not awaiting review.`,
        });
      }

      const versionResult = await client.query(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
         FROM story_reviews WHERE story_id = $1`,
        [storyId]
      );
      const versionNumber = versionResult.rows[0].next_version;

      await client.query(
        `INSERT INTO story_reviews
           (story_id, version_number, reviewer_id, status, notes,
            safeguarding_check, dpf_compliance, age_appropriateness, reviewed_at, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)`,
        [
          storyId, versionNumber, staff.staffId, decision, notes || null,
          safeguarding_check ?? null, dpf_compliance ?? null, age_appropriateness ?? null,
          decision === 'approved' ? new Date() : null,
        ]
      );

      const newStoryStatus = DECISION_TO_STORY_STATUS[decision];
      if (newStoryStatus === 'published') {
        await client.query(
          `UPDATE stories SET status = 'published', published_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [storyId]
        );
      } else {
        await client.query(
          `UPDATE stories SET status = $2, updated_at = NOW() WHERE id = $1`,
          [storyId, newStoryStatus]
        );
      }

      await client.query('COMMIT');
      fastify.log.info(`Staff ${staff.staffId} reviewed story ${storyId} ("${storyCheck.rows[0].title}"): ${decision}`);

      return reply.send({
        message:
          decision === 'approved'
            ? 'Story approved and published.'
            : decision === 'revision_requested'
            ? 'Revision requested. The author can now edit and resubmit.'
            : 'Story rejected.',
        story_status: newStoryStatus,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      fastify.log.error(`Staff review decision on story ${storyId} failed: ${err}`);
      return reply.status(500).send({ error: 'Could not record the review decision. Please try again.' });
    } finally {
      client.release();
    }
  });

}
