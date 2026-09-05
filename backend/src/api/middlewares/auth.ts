import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../core/database';
import { env } from '../../config/env';

export interface AuthRequest extends Request {
  user?: any;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ detail: 'Missing or invalid authentication token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub }
    });

    if (!user || !user.isActive) {
      res.status(401).json({ detail: 'User not found or inactive' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ detail: 'Token expired or invalid' });
  }
};
