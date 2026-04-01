import { NextRequest, NextResponse } from 'next/server';

type SessionUser = {
  id: string;
  email: string;
  role: 'talent' | 'enterprise';
};

type SessionResponse = {
  user: SessionUser;
};

const PUBLIC_PATHS = ['/', '/login'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/login') || pathname.startsWith('/api/');
}

function expectedRoleForPath(pathname: string): SessionUser['role'] | null {
  if (pathname.startsWith('/talent')) {
    return 'talent';
  }
  if (pathname.startsWith('/enterprise')) {
    return 'enterprise';
  }
  return null;
}

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (isPublicPath(path)) {
    return NextResponse.next();
  }

  const token = req.cookies.get('auth-token')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const response = await fetch(`${req.nextUrl.origin}/api/v1/auth/session`, {
      headers: {
        cookie: req.headers.get('cookie') || '',
      },
    });

    if (!response.ok) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const payload = (await response.json()) as SessionResponse;
    const expectedRole = expectedRoleForPath(path);
    if (expectedRole !== null && payload.user.role !== expectedRole) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', payload.user.id);
    requestHeaders.set('x-user-role', payload.user.role);
    requestHeaders.set('x-user-email', payload.user.email);
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch {
    return NextResponse.redirect(new URL('/login', req.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)'],
};
