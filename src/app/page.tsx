import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect('/dashboard');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0a0a0a]">
      <div className="max-w-2xl text-center">
        <div className="mb-4 text-xs uppercase tracking-widest text-[#737373]">
          FlowAI
        </div>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight mb-6">
          Describe a workflow.
          <br />
          <span className="text-[#6366f1]">We&apos;ll build it.</span>
        </h1>
        <p className="text-lg text-[#a3a3a3] mb-10 max-w-xl mx-auto">
          AI-native workflow automation. Type what you want in plain English —
          FlowAI generates the DAG and runs it on real integrations.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/sign-up"
            className="bg-[#6366f1] hover:bg-[#5158d4] transition px-6 py-3 rounded-md font-medium"
          >
            Get started
          </Link>
          <Link
            href="/sign-in"
            className="bg-[#111111] hover:bg-[#1f1f1f] border border-[#1f1f1f] transition px-6 py-3 rounded-md font-medium"
          >
            Sign in
          </Link>
        </div>
      </div>
      <div className="mt-24 text-sm text-[#525252]">
        Webhook · HTTP · Slack · Gmail
      </div>
    </div>
  );
}
