import { Router } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../core/database';
import { env } from '../config/env';

const router = Router();

const loginSchema = z.object({
  username: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenant_name: z.string().min(3),
});

router.post('/login', async (req, res) => {
  const data = loginSchema.parse(req.body);
  
  const user = await prisma.user.findUnique({
    where: { email: data.username }
  });

  if (!user || !user.isActive) {
    res.status(401).json({ detail: 'Incorrect email or password' });
    return;
  }

  const validPassword = await argon2.verify(user.passwordHash, data.password);
  if (!validPassword) {
    res.status(401).json({ detail: 'Incorrect email or password' });
    return;
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any
  });

  res.json({ access_token: token, token_type: 'bearer' });
});

router.post('/register', async (req, res) => {
  const data = registerSchema.parse(req.body);

  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    res.status(400).json({ detail: 'Email already registered' });
    return;
  }

  const existingTenant = await prisma.tenant.findUnique({ where: { name: data.tenant_name } });
  if (existingTenant) {
    res.status(400).json({ detail: 'Tenant name already exists' });
    return;
  }

  const passwordHash = await argon2.hash(data.password);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      tenants: {
        create: {
          name: data.tenant_name
        }
      }
    }
  });

  res.status(201).json({ id: user.id, email: user.email });
});

export default router;
