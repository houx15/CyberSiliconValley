import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { comparePassword, signJWT } from '@/lib/auth';
import { eq } from 'drizzle-orm';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return NextResponse.json(
        { error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const token = await signJWT({
      userId: user.id,
      role: user.role as 'talent' | 'enterprise',
      email: user.email,
    });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, role: user.role },
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
