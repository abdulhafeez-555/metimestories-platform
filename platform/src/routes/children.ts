import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { query } from '../db';
import { requireParent } from '../middleware/auth';

export async function childrenRoutes(fastify: FastifyInstance) {

  // POST /api/children — create a child profile
  // Requires parent JWT token
  fastify.post('/', { preHandler: requireParent }, async (request, reply) => {
    const parent = request.user as any;
    const { name, date_of_birth, pin, appearance_profile } = request.body as any;

    if (!name || !date_of_birth || !pin) {
      return reply.status(400).send({ error: 'name, date_of_birth and pin are required' });
    }

    // Validate PIN is 4 digits
    if (!/^\d{4}$/.test(pin.toString())) {
      return reply.status(400).send({ error: 'PIN must be exactly 4 digits' });
    }

    // Validate date of birth
    const dob = new Date(date_of_birth);
    if (isNaN(dob.getTime())) {
      return reply.status(400).send({ error: 'Invalid date of birth format. Use YYYY-MM-DD' });
    }

    // Check age is between 1 and 18
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 1 || age > 18) {
      return reply.status(400).send({ error: 'Child age must be between 1 and 18' });
    }

    // Hash PIN
    const pin_hash = await bcrypt.hash(pin.toString(), 10);

    // Insert child
    const result = await query(
      `INSERT INTO children (parent_id, name, date_of_birth, pin_hash, appearance_profile)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, uuid, name, date_of_birth`,
      [
        parent.parentId,
        name.trim(),
        date_of_birth,
        pin_hash,
        appearance_profile ? JSON.stringify(appearance_profile) : null
      ]
    );

    const child = result.rows[0];

    // Get age and age band
    const ageResult = await query(
      `SELECT DATE_PART('year', AGE(date_of_birth))::INTEGER as age,
       CASE
         WHEN DATE_PART('year', AGE(date_of_birth)) BETWEEN 3 AND 4 THEN 'little'
         WHEN DATE_PART('year', AGE(date_of_birth)) BETWEEN 5 AND 6 THEN 'young'
         WHEN DATE_PART('year', AGE(date_of_birth)) BETWEEN 7 AND 8 THEN 'middle'
         ELSE 'older'
       END as age_band
       FROM children WHERE id = $1`,
      [child.id]
    );

    const { age: childAge, age_band } = ageResult.rows[0];

    return reply.status(201).send({
      message: 'Child profile created successfully',
      child: {
        id: child.id,
        uuid: child.uuid,
        name: child.name,
        date_of_birth: child.date_of_birth,
        age: childAge,
        age_band,
      }
    });
  });

  // GET /api/children — get all children for logged in parent
  fastify.get('/', { preHandler: requireParent }, async (request, reply) => {
    const parent = request.user as any;

    const result = await query(
      `SELECT c.id, c.uuid, c.name, c.date_of_birth, c.status,
              c.total_stories_watched, c.last_active_at,
              DATE_PART('year', AGE(c.date_of_birth))::INTEGER as age,
              CASE
                WHEN DATE_PART('year', AGE(c.date_of_birth)) BETWEEN 3 AND 4 THEN 'little'
                WHEN DATE_PART('year', AGE(c.date_of_birth)) BETWEEN 5 AND 6 THEN 'young'
                WHEN DATE_PART('year', AGE(c.date_of_birth)) BETWEEN 7 AND 8 THEN 'middle'
                ELSE 'older'
              END as age_band
       FROM children c
       WHERE c.parent_id = $1 AND c.deleted_at IS NULL
       ORDER BY c.created_at ASC`,
      [parent.parentId]
    );

    return reply.send({
      children: result.rows,
      total: result.rows.length,
    });
  });

  // GET /api/children/:id — get single child profile
  fastify.get('/:id', { preHandler: requireParent }, async (request, reply) => {
    const parent = request.user as any;
    const { id } = request.params as any;

    const result = await query(
      `SELECT c.id, c.uuid, c.name, c.date_of_birth, c.status,
              c.appearance_profile, c.total_stories_watched, c.last_active_at,
              DATE_PART('year', AGE(c.date_of_birth))::INTEGER as age,
              CASE
                WHEN DATE_PART('year', AGE(c.date_of_birth)) BETWEEN 3 AND 4 THEN 'little'
                WHEN DATE_PART('year', AGE(c.date_of_birth)) BETWEEN 5 AND 6 THEN 'young'
                WHEN DATE_PART('year', AGE(c.date_of_birth)) BETWEEN 7 AND 8 THEN 'middle'
                ELSE 'older'
              END as age_band
       FROM children c
       WHERE c.id = $1 AND c.parent_id = $2 AND c.deleted_at IS NULL`,
      [id, parent.parentId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Child not found' });
    }

    return reply.send({ child: result.rows[0] });
  });

  // PUT /api/children/:id — update child profile
  fastify.put('/:id', { preHandler: requireParent }, async (request, reply) => {
    const parent = request.user as any;
    const { id } = request.params as any;
    const { name, date_of_birth, appearance_profile } = request.body as any;

    // Verify child belongs to this parent
    const existing = await query(
      'SELECT id FROM children WHERE id = $1 AND parent_id = $2 AND deleted_at IS NULL',
      [id, parent.parentId]
    );

    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Child not found' });
    }

    await query(
      `UPDATE children
       SET name = COALESCE($1, name),
           date_of_birth = COALESCE($2, date_of_birth),
           appearance_profile = COALESCE($3, appearance_profile),
           updated_at = NOW()
       WHERE id = $4`,
      [
        name || null,
        date_of_birth || null,
        appearance_profile ? JSON.stringify(appearance_profile) : null,
        id
      ]
    );

    return reply.send({ message: 'Child profile updated successfully' });
  });

  // DELETE /api/children/:id — soft delete child profile
  fastify.delete('/:id', { preHandler: requireParent }, async (request, reply) => {
    const parent = request.user as any;
    const { id } = request.params as any;

    const existing = await query(
      'SELECT id FROM children WHERE id = $1 AND parent_id = $2 AND deleted_at IS NULL',
      [id, parent.parentId]
    );

    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Child not found' });
    }

    await query(
      'UPDATE children SET deleted_at = NOW() WHERE id = $1',
      [id]
    );

    return reply.send({ message: 'Child profile deleted successfully' });
  });

}
