import { createAuthMiddleware } from '@/lib/auth/middleware';

export default createAuthMiddleware();

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)'],
};
