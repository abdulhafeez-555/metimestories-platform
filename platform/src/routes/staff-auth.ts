import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { query } from '../db';
import { send2FACode, generate2FACode } from '../utils/email';

// Staff accounts are created directly in the database (see the
// bootstrap script), never via public registration — this is an
// internal review team, not a public sign-up flow.

export async function staffAuthRoutes(fastify: FastifyInstance) {

  // POST /api/auth/staff/login
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    const result = await query(
      `SELECT id, uuid, email, password_hash, display_name, role, is_suspended
       FROM staff WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const staff = result.rows[0];

    if (staff.is_suspended) {
      return reply.status(403).send({ error: 'Account suspended. Contact an administrator.' });
    }

    const valid = await bcrypt.compare(password, staff.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    await query(
      `DELETE FROM auth_2fa_codes WHERE user_id = $1 AND user_type = 'staff' AND used = false`,
      [staff.id]
    );

    const code = generate2FACode();
    await query(
      `INSERT INTO auth_2fa_codes (user_id, user_type, code, expires_at)
       VALUES ($1, 'staff', $2, NOW() + INTERVAL '10 minutes')`,
      [staff.id, code]
    );

    await send2FACode(staff.email, code, staff.display_name);

    return reply.send({
      message: 'Verification code sent to your email.',
      staff_id: staff.id,
    });
  });

  // POST /api/auth/staff/verify-2fa
  fastify.post('/verify-2fa', async (request, reply) => {
    const { staff_id, code } = request.body as any;

    if (!staff_id || !code) {
      return reply.status(400).send({ error: 'staff_id and code are required' });
    }

    const result = await query(
      `SELECT id FROM auth_2fa_codes
       WHERE user_id = $1 AND user_type = 'staff' AND code = $2
       AND used = false AND expires_at > NOW()`,
      [staff_id, code]
    );

    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid or expired code' });
    }

    await query('UPDATE auth_2fa_codes SET used = true WHERE id = $1', [result.rows[0].id]);

    const staffResult = await query(
      `SELECT id, uuid, email, display_name, role FROM staff WHERE id = $1`,
      [staff_id]
    );
    const staff = staffResult.rows[0];

    await query('UPDATE staff SET last_login_at = NOW() WHERE id = $1', [staff_id]);

    const token = fastify.jwt.sign(
      { staffId: staff.id, email: staff.email, role: 'staff', staffRole: staff.role },
      { expiresIn: '7d' }
    );

    return reply.send({
      message: 'Login successful',
      token,
      staff: {
        id: staff.id,
        uuid: staff.uuid,
        email: staff.email,
        display_name: staff.display_name,
        role: 'staff',
        staff_role: staff.role,
      },
    });
  });

}
