import { ApiError, apiFetch, apiPost } from '@/lib/api/client';
import type { UserRole } from '@/types';

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthSessionResponse {
  user: CurrentUser;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await apiFetch<AuthSessionResponse>('/api/v1/auth/session');
    return response.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function loginWithPassword(email: string, password: string): Promise<CurrentUser> {
  const response = await apiPost<AuthSessionResponse>('/api/v1/auth/login', {
    email,
    password,
  });
  return response.user;
}
