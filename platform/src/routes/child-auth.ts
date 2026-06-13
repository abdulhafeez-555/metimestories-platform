import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { query } from '../db';

export async function childAuthRoutes(fastify: FastifyInstance) {

  // POST /api/auth/child/login
  fastify.post('/login', async (request, reply) => {
    const { parent_id, child_id, pin } = request.body as any;

    if (!parent_id || !child_id || !pin) {
      return reply.status(400).send({ error: 'parent_id, child_id and pin are required' });
    }

    const result = await query(
      `SELECT id, uuid, name, date_of_birth, pin_hash, status
       FROM children
       WHERE id = $1 AND parent_id = $2 AND deleted_at IS NULL`,
      [child_id, parent_id]
    );

    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const child = result.rows[0];

    if (child.status === 'suspended') {
      return reply.status(403).send({ error: 'Account suspended' });
    }

    const valid = await bcrypt.compare(pin.toString(), child.pin_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid PIN' });
    }

    await query(
      'UPDATE children SET last_active_at = NOW() WHERE id = $1',
      [child.id]
    );

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

    const { age, age_band } = ageResult.rows[0];

    const token = fastify.jwt.sign(
      {
        childId: child.id,
        parentId: parent_id,
        name: child.name,
        age,
        age_band,
        role: 'child'
      },
      { expiresIn: '8h' }
    );

    return reply.send({
      message: 'Welcome back!',
      token,
      child: {
        id: child.id,
        uuid: child.uuid,
        name: child.name,
        age,
        age_band,
        role: 'child',
      }
    });
  });

}
