import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * GET /api/contacts/ml-flag-count
 * Returns: { count: number }
 *
 * Used by the Pipeline header button to show how many contacts are
 * flagged for Market Leader updates.
 */
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { count, error } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('ml_update_needed', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 });
}
