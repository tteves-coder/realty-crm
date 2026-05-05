import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { FlaggedContactsList } from './FlaggedContactsList';

// Always re-fetch on navigation so the list reflects current flag state
// (e.g. after toggling flags on individual contact pages).
export const dynamic = 'force-dynamic';

export default async function MarketLeaderPage() {
  const supabase = createClient();
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone, updated_at')
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
              {contacts?.length ?? 0} flagged{' '}
              {contacts?.length === 1 ? 'contact' : 'contacts'}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        <FlaggedContactsList initialContacts={contacts ?? []} />
      </main>
    </div>
  );
}
