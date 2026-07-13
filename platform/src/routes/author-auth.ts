import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { query } from '../db';
import { send2FACode, generate2FACode } from '../utils/email';
import { verifyGoogleToken } from '../utils/googleAuth';

export async function authorAuthRoutes(fastify: FastifyInstance) {

  // POST /api/auth/author/register
  fastify.post('/register', async (request, reply) => {
    const { email, password, display_name, bio } = request.body as any;

    if (!email || !password || !display_name) {
      return reply.status(400).send({ error: 'Email, password and display name are required' });
    }

    if (password.length < 8) {
      return reply.status(400).send({ error: 'Password must be at least 8 characters' });
    }

    const existing = await query(
      'SELECT id FROM authors WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO authors (email, password_hash, display_name, bio)
       VALUES ($1, $2, $3, $4)
       RETURNING id, uuid, email, display_name, is_verified, can_self_publish`,
      [email.toLowerCase(), password_hash, display_name, bio || null]
    );

    const author = result.rows[0];

    const code = generate2FACode();
    await query(
      `INSERT INTO auth_2fa_codes (user_id, user_type, code, expires_at)
       VALUES ($1, 'author', $2, NOW() + INTERVAL '10 minutes')`,
      [author.id, code]
    );

    await send2FACode(author.email, code, author.display_name);

    return reply.status(201).send({
      message: 'Author account created. Check your email for your verification code.',
      author_id: author.id,
      email: author.email,
      note: 'Your account requires admin approval before you can publish stories.',
    });
  });

  // POST /api/auth/author/login
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    const result = await query(
      `SELECT id, uuid, email, password_hash, display_name, status,
              is_verified, is_suspended, can_self_publish, guidelines_accepted_at
       FROM authors WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const author = result.rows[0];

    if (author.is_suspended) {
      return reply.status(403).send({ error: 'Account suspended. Contact support.' });
    }

    if (author.status === 'deleted') {
      return reply.status(403).send({ error: 'Account no longer exists.' });
    }

    const valid = await bcrypt.compare(password, author.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    await query(
      `DELETE FROM auth_2fa_codes
       WHERE user_id = $1 AND user_type = 'author' AND used = false`,
      [author.id]
    );

    const code = generate2FACode();
    await query(
      `INSERT INTO auth_2fa_codes (user_id, user_type, code, expires_at)
       VALUES ($1, 'author', $2, NOW() + INTERVAL '10 minutes')`,
      [author.id, code]
    );

    await send2FACode(author.email, code, author.display_name);

    return reply.send({
      message: 'Verification code sent to your email.',
      author_id: author.id,
    });
  });

  // POST /api/auth/author/verify-2fa
  fastify.post('/verify-2fa', async (request, reply) => {
    const { author_id, code } = request.body as any;

    if (!author_id || !code) {
      return reply.status(400).send({ error: 'author_id and code are required' });
    }

    const result = await query(
      `SELECT id FROM auth_2fa_codes
       WHERE user_id = $1
       AND user_type = 'author'
       AND code = $2
       AND used = false
       AND expires_at > NOW()`,
      [author_id, code]
    );

    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid or expired code' });
    }

    await query(
      'UPDATE auth_2fa_codes SET used = true WHERE id = $1',
      [result.rows[0].id]
    );

    const authorResult = await query(
      `SELECT id, uuid, email, display_name, is_verified,
              can_self_publish, guidelines_accepted_at, guidelines_version
       FROM authors WHERE id = $1`,
      [author_id]
    );

    const author = authorResult.rows[0];

    await query(
      'UPDATE authors SET last_login_at = NOW() WHERE id = $1',
      [author_id]
    );

    const token = fastify.jwt.sign(
      {
        authorId: author.id,
        email: author.email,
        role: 'author',
        is_verified: author.is_verified,
        can_self_publish: author.can_self_publish,
        guidelines_accepted: !!author.guidelines_accepted_at,
      },
      { expiresIn: '7d' }
    );

    return reply.send({
      message: 'Login successful',
      token,
      author: {
        id: author.id,
        uuid: author.uuid,
        email: author.email,
        display_name: author.display_name,
        role: 'author',
        is_verified: author.is_verified,
        can_self_publish: author.can_self_publish,
        guidelines_accepted: !!author.guidelines_accepted_at,
      }
    });
  });

  // POST /api/auth/author/google
  // Verifies a Google ID token, then finds-or-creates the account.
  // Links to an existing email/password account if one matches.
  // No 2FA step - Google's own sign-in is the verification.
  fastify.post('/google', async (request, reply) => {
    const { id_token } = request.body as any;

    if (!id_token) {
      return reply.status(400).send({ error: 'id_token is required' });
    }

    let profile;
    try {
      profile = await verifyGoogleToken(id_token);
    } catch (err) {
      return reply.status(401).send({ error: 'Could not verify this Google account. Please try again.' });
    }

    const existing = await query(
      `SELECT id, uuid, email, display_name, is_verified, can_self_publish,
              guidelines_accepted_at, is_suspended, provider_user_id
       FROM authors WHERE email = $1 AND deleted_at IS NULL`,
      [profile.email]
    );

    let author;

    if (existing.rows.length > 0) {
      author = existing.rows[0];

      if (author.is_suspended) {
        return reply.status(403).send({ error: 'This account has been suspended. Please get in touch with us for help.' });
      }

      if (!author.provider_user_id) {
        await query(
          `UPDATE authors
           SET provider_user_id = $1, profile_picture = $2,
               email_verified = true, email_verified_at = NOW()
           WHERE id = $3`,
          [profile.googleId, profile.picture, author.id]
        );
      }
    } else {
      const result = await query(
        `INSERT INTO authors
           (email, display_name, auth_provider, provider_user_id,
            profile_picture, email_verified, email_verified_at)
         VALUES ($1, $2, 'google', $3, $4, true, NOW())
         RETURNING id, uuid, email, display_name, is_verified, can_self_publish, guidelines_accepted_at`,
        [profile.email, profile.fullName, profile.googleId, profile.picture]
      );
      author = result.rows[0];
    }

    await query('UPDATE authors SET last_login_at = NOW() WHERE id = $1', [author.id]);

    const token = fastify.jwt.sign(
      {
        authorId: author.id,
        email: author.email,
        role: 'author',
        is_verified: author.is_verified,
        can_self_publish: author.can_self_publish,
        guidelines_accepted: !!author.guidelines_accepted_at,
      },
      { expiresIn: '7d' }
    );

    return reply.send({
      message: 'Login successful',
      token,
      author: {
        id: author.id,
        uuid: author.uuid,
        email: author.email,
        display_name: author.display_name,
        role: 'author',
        is_verified: author.is_verified,
        can_self_publish: author.can_self_publish,
        guidelines_accepted: !!author.guidelines_accepted_at,
      },
    });
  });

}
