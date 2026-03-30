import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from './index';
import type { JWTPayload } from '@/types';

export async function getAuthFromRequest(req: NextRequest): Promise<JWTPayload | null> {
  const token = req.cookies.get('auth-token')?.value;
  if (!token) return null;
  try {
    return await verifyJWT(token);
  } catch {
    return null;
  }
}

export function createAuthMiddleware() {
  return async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;

    // Public routes
    if (path === '/' || path.startsWith('/login') || path.startsWith('/api/v1/auth')) {
      return NextResponse.next();
    }

    const auth = await getAuthFromRequest(req);

    if (!auth) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Role-based routing
    if (path.startsWith('/talent') && auth.role !== 'talent') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    if (path.startsWith('/enterprise') && auth.role !== 'enterprise') {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const response = NextResponse.next();
    response.headers.set('x-user-id', auth.userId);
    response.headers.set('x-user-role', auth.role);
    response.headers.set('x-user-email', auth.email);
    return response;
  };
}
