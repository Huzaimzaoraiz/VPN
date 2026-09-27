import { Router } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../core/database';
import { env } from '../config/env';
import { requireAuth, AuthRequest } from './middlewares/auth';
import { EmailService } from '../services/email_service';

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

  if (!user.isEmailVerified) {
    res.status(403).json({ detail: 'Please verify your email before logging in.' });
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

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      isEmailVerified: false,
      otpCode,
      otpExpiresAt,
      tenants: {
        create: {
          name: data.tenant_name
        }
      }
    }
  });

  await EmailService.sendOtp(user.email, otpCode);

  res.status(201).json({ id: user.id, email: user.email });
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

router.post('/verify-otp', async (req, res) => {
  const data = verifyOtpSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    res.status(400).json({ detail: 'User not found' });
    return;
  }

  if (user.isEmailVerified) {
    res.status(400).json({ detail: 'Email already verified' });
    return;
  }

  if (user.otpCode !== data.otp) {
    res.status(400).json({ detail: 'Invalid OTP code' });
    return;
  }

  if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    res.status(400).json({ detail: 'OTP code has expired.' });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      otpCode: null,
      otpExpiresAt: null
    }
  });

  const token = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any
  });

  res.json({ access_token: token, token_type: 'bearer' });
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = req.user;
  const tenants = await prisma.tenant.findMany({
    where: { ownerId: user.id }
  });
  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    tenants: tenants.map(t => ({ id: t.id, name: t.name }))
  });
});

export default router;
