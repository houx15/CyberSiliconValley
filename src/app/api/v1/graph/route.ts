import { NextResponse } from 'next/server';
import { getGraphData } from '@/lib/graph/queries';

export async function GET() {
  try {
    const data = await getGraphData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/v1/graph error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch graph data' },
      { status: 500 }
    );
  }
}
