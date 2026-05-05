'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flag } from 'lucide-react';

/**
 * Pipeline header button that links to the Market Leader flagged contacts view.
 * Shows a gold count badge when contacts are flagged.
 *
 * This is a client component so it can be embedded inside other client components
 * (like PipelineBoard). It fetches the flagged-contact count from a small API
 * route on mount.
 */
export function MarketLeaderButton() {
  const [flaggedCount, setFlaggedCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/contacts/ml-flag-count')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.count === 'number') {
          setFlaggedCount(data.count);
        }
      })
      .catch(() => {
        // Silent failure — button still works, just no badge
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showBadge = flaggedCount !== null && flaggedCount > 0;

  return (
    <Link
      href="/dashboard/pipeline/market-leader"
      className="relative inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm font-medium text-navy-900 transition hover:bg-navy-50 active:scale-[0.98]"
      aria-label={
        showBadge
          ? `Market Leader updates: ${flaggedCount} flagged`
          : 'Market Leader updates'
      }
    >
      <Flag className="h-4 w-4 text-coral-500" aria-hidden />
      <span className="hidden sm:inline">Market Leader</span>
      <span className="sm:hidden">ML</span>
      {showBadge && (
        <span
          className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gold-500 px-1.5 text-xs font-semibold text-navy-900"
          aria-hidden
        >
          {flaggedCount! > 99 ? '99+' : flaggedCount}
        </span>
      )}
    </Link>
  );
}
