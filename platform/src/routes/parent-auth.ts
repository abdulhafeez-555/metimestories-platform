import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { query } from '../db';
import { send2FACode, generate2FACode } from '../utils/email';

export async function parentAuthRoutes(fastify: FastifyInstance) {

  // POST /api/auth/parent/register
  fastify.post('/register', async (request, reply) => {
    const { email, password, first_name, last_name } = request.body as any;

    if (!email || !password || !first_name || !last_name) {
      return reply.status(400).send({ error: 'All fields are required' });
    }

    if (password.length < 8) {
      return reply.status(400).send({ error: 'Password must be at least 8 characters' });
    }

    const existing = await query(
      'SELECT id FROM parents WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const referral_code = Math.random().toString(36).substring(2, 10).toUpperCase();

    const result = await query(
      `INSERT INTO parents (email, password_hash, first_name, last_name, referral_code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, uuid, email, first_name, last_name`,
      [email.toLowerCase(), password_hash, first_name, last_name, referral_code]
    );

    const parent = result.rows[0];

    const code = generate2FACode();
    await query(
      `INSERT INTO auth_2fa_codes (user_id, user_type, code, expires_at)
       VALUES ($1, 'parent', $2, NOW() + INTERVAL '10 minutes')`,
      [parent.id, code]
    );

    await send2FACode(parent.email, code, parent.first_name);

    return reply.status(201).send({
      message: 'Account created. Check your email for your verification code.',
      parent_id: parent.id,
      email: parent.email,
    });
  });

  // POST /api/auth/parent/login
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    const result = await query(
      `SELECT id, uuid, email, password_hash, first_name, last_name, status
       FROM parents WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const parent = result.rows[0];

    if (parent.status === 'suspended') {
      return reply.status(403).send({ error: 'Account suspended. Contact support.' });
    }

    const valid = await bcrypt.compare(password, parent.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    await query(
      `DELETE FROM auth_2fa_codes
       WHERE user_id = $1 AND user_type = 'parent' AND used = false`,
      [parent.id]
    );

    const code = generate2FACode();
    await query(
      `INSERT INTO auth_2fa_codes (user_id, user_type, code, expires_at)
       VALUES ($1, 'parent', $2, NOW() + INTERVAL '10 minutes')`,
      [parent.id, code]
    );

    await send2FACode(parent.email, code, parent.first_name);

    return reply.send({
      message: 'Verification code sent to your email.',
      parent_id: parent.id,
    });
  });

  // POST /api/auth/parent/verify-2fa
  fastify.post('/verify-2fa', async (request, reply) => {
    const { parent_id, code } = request.body as any;

    if (!parent_id || !code) {
      return reply.status(400).send({ error: 'parent_id and code are required' });
    }

    const result = await query(
      `SELECT id FROM auth_2fa_codes
       WHERE user_id = $1
       AND user_type = 'parent'
       AND code = $2
       AND used = false
       AND expires_at > NOW()`,
      [parent_id, code]
    );

    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid or expired code' });
    }

    await query(
      'UPDATE auth_2fa_codes SET used = true WHERE id = $1',
      [result.rows[0].id]
    );

    const parentResult = await query(
      'SELECT id, uuid, email, first_name, last_name FROM parents WHERE id = $1',
      [parent_id]
    );

    const parent = parentResult.rows[0];

    await query(
      'UPDATE parents SET last_login_at = NOW(), last_active_at = NOW() WHERE id = $1',
      [parent_id]
    );

    const token = fastify.jwt.sign(
      { parentId: parent.id, email: parent.email, role: 'parent' },
      { expiresIn: '7d' }
    );

    return reply.send({
      message: 'Login successful',
      token,
      parent: {
        id: parent.id,
        uuid: parent.uuid,
        email: parent.email,
        first_name: parent.first_name,
        last_name: parent.last_name,
        role: 'parent',
      }
    });
  });

}
