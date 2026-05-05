import Link from 'next/link';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Flag } from 'lucide-react';

/**
 * Pipeline header button that links to the Market Leader flagged contacts view.
 * Shows a gold count badge when contacts are flagged.
 */
export async function MarketLeaderButton() {
  const supabase = createServerComponentClient({ cookies });
  const { count } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('ml_update_needed', true);

  const flaggedCount = count ?? 0;

  return (
    <Link
      href="/dashboard/pipeline/market-leader"
      className="relative inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm font-medium text-navy-900 transition hover:bg-navy-50 active:scale-[0.98]"
      aria-label={
        flaggedCount > 0
          ? `Market Leader updates: ${flaggedCount} flagged`
          : 'Market Leader updates'
      }
    >
      <Flag className="h-4 w-4 text-coral-500" aria-hidden />
      <span className="hidden sm:inline">Market Leader</span>
      <span className="sm:hidden">ML</span>
      {flaggedCount > 0 && (
        <span
          className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gold-500 px-1.5 text-xs font-semibold text-navy-900"
          aria-hidden
        >
          {flaggedCount > 99 ? '99+' : flaggedCount}
        </span>
      )}
    </Link>
  );
}
