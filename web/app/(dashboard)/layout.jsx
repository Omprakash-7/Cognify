import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';

export default async function DashboardLayout({ children }) {
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Navbar user={user} />
      <div className="flex flex-1 pt-16">
        <Sidebar user={user} />
        <main className="flex-1 lg:pl-64 min-h-[calc(100vh-4rem)] bg-surface p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
