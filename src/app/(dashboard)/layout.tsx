import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { Workflow, Plug, Home } from 'lucide-react';
import { ToastProvider } from '@/components/ui/toast';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <ToastProvider>
      <div className="min-h-screen flex bg-[#0a0a0a]">
        <aside className="w-56 border-r border-[#1f1f1f] flex flex-col">
          <div className="px-6 py-5 border-b border-[#1f1f1f]">
            <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
              <span className="text-[#6366f1]">Flow</span>AI
            </Link>
          </div>
          <nav className="flex flex-col p-2 gap-0.5 flex-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-[#1f1f1f] text-[#a3a3a3] hover:text-[#fafafa]"
            >
              <Home className="h-4 w-4" /> Dashboard
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-[#1f1f1f] text-[#a3a3a3] hover:text-[#fafafa]"
            >
              <Workflow className="h-4 w-4" /> Workflows
            </Link>
            <Link
              href="/integrations"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-[#1f1f1f] text-[#a3a3a3] hover:text-[#fafafa]"
            >
              <Plug className="h-4 w-4" /> Integrations
            </Link>
          </nav>
          <div className="p-4 border-t border-[#1f1f1f]">
            <UserButton />
          </div>
        </aside>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </ToastProvider>
  );
}
