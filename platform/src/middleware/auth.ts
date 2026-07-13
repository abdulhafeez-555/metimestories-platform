import { FastifyRequest, FastifyReply } from 'fastify';
export async function requireParent(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const user = request.user as any;
    if (user.role !== 'parent') {
      return reply.status(403).send({ error: 'Parent access required' });
    }
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorised' });
  }
}
export async function requireAuthor(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const user = request.user as any;
    if (user.role !== 'author') {
      return reply.status(403).send({ error: 'Author access required' });
    }
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorised' });
  }
}
export async function requireChild(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const user = request.user as any;
    if (user.role !== 'child') {
      return reply.status(403).send({ error: 'Child access required' });
    }
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorised' });
  }
}
export async function requireStaff(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const user = request.user as any;
    if (user.role !== 'staff') {
      return reply.status(403).send({ error: 'Staff access required' });
    }
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorised' });
  }
}
