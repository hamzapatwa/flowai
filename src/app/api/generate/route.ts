import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { generateWorkflow } from '@/lib/ai/generate';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const { prompt } = await req.json();
  if (!prompt || typeof prompt !== 'string' || prompt.length > 5000) {
    return NextResponse.json(
      { error: 'Invalid prompt' },
      { status: 400 }
    );
  }

  try {
    const result = await generateWorkflow(prompt);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
