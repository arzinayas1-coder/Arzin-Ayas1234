import type { NextFunction, Request, Response } from 'express';
import { createUser, getUserByEmail } from './db.ts';
import type { UserProfile } from '../shared/types.ts';

export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

const DEFAULT_WORKSPACE_EMAIL = 'workspace@forge.local';
let cachedWorkspaceUser: UserProfile | null = null;

export function getOrCreateWorkspaceUser(): UserProfile {
  if (cachedWorkspaceUser) return cachedWorkspaceUser;
  const existing = getUserByEmail(DEFAULT_WORKSPACE_EMAIL);
  if (existing) {
    cachedWorkspaceUser = {
      id: existing.id,
      email: existing.email,
      name: existing.name,
      role: existing.role,
      createdAt: existing.createdAt,
    };
    return cachedWorkspaceUser;
  }
  cachedWorkspaceUser = createUser({
    email: DEFAULT_WORKSPACE_EMAIL,
    name: 'Workspace',
    passwordHash: 'no-auth-local-workspace',
  });
  return cachedWorkspaceUser;
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  req.user = getOrCreateWorkspaceUser();
  next();
}
