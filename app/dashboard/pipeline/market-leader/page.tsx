import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { FlaggedContactsList } from './FlaggedContactsList';

export const dynamic = 'force-dynamic';

type Task = {
  id: string;
  contact_id: string;
  description: string | null;
  due_date: string | null;
  status: string | null;
  created_at: string;
};

type TouchLog = {
  id: string;
  contact_id: string;
  touch_type: string | null;
  notes: string | null;
  touched_at: string;
};

export default async function MarketLeaderPage() {
  const supabase = createServerComponentClient({ cookies });

  // 1) Get flagged contacts
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, name, email, phone, updated_at, last_ml_export_at')
    .eq('ml_update_needed', true)
    .order('updated_at', { ascending: false });

  if (error) {
    return (
      <div className="p-4">
        <p className="text-coral-600">
          Failed to load flagged contacts: {error.message}
        </p>
      </div>
    );
  }

  const contactList = contacts ?? [];
  const contactIds = contactList.map((c) => c.id);

  // 2) Fetch tasks + touch logs for those contacts (only if there are any)
  let tasksByContact: Record<string, Task[]> = {};
  let touchLogsByContact: Record<string, TouchLog[]> = {};

  if (contactIds.length > 0) {
    // Chunk to avoid URL-too-long with many contacts
    const CHUNK = 200;

    for (let i = 0; i < contactIds.length; i += CHUNK) {
      const chunk = contactIds.slice(i, i + CHUNK);

      const [tasksRes, logsRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, contact_id, description, due_date, status, created_at')
          .in('contact_id', chunk),
        supabase
          .from('touch_logs')
          .select('id, contact_id, touch_type, notes, touched_at')
          .in('contact_id', chunk),
      ]);

      for (const t of (tasksRes.data ?? []) as Task[]) {
        if (!tasksByContact[t.contact_id]) tasksByContact[t.contact_id] = [];
        tasksByContact[t.contact_id].push(t);
      }
      for (const l of (logsRes.data ?? []) as TouchLog[]) {
        if (!touchLogsByContact[l.contact_id])
          touchLogsByContact[l.contact_id] = [];
        touchLogsByContact[l.contact_id].push(l);
      }
    }
  }

  return (
    <div className="min-h-screen bg-navy-50/30 pb-24">
      <header className="sticky top-0 z-10 border-b border-navy-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href="/dashboard/pipeline"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-navy-600 hover:bg-navy-50"
            aria-label="Back to Pipeline"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-lg font-semibold text-navy-900">
              Market Leader Updates
            </h1>
            <p className="text-xs text-navy-500">
              {contactList.length} flagged{' '}
              {contactList.length === 1 ? 'contact' : 'contacts'}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        <FlaggedContactsList
          initialContacts={contactList}
          tasksByContact={tasksByContact}
          touchLogsByContact={touchLogsByContact}
        />
      </main>
    </div>
  );
}
