import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * PATCH /api/contacts/ml-flag
 *
 * Body: { ids: string[], ml_update_needed: boolean }
 *
 * Bulk-update the ml_update_needed flag for the given contact IDs.
 * Used by the Market Leader page for individual + bulk clears, and
 * by the export flow to auto-clear flags after CSV download.
 *
 * Relies on Supabase RLS to scope writes to the current user's contacts.
 */
export async function PATCH(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { ids?: unknown; ml_update_needed?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === 'string')
    : null;
  const flag =
    typeof body.ml_update_needed === 'boolean' ? body.ml_update_needed : false;

  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }

  const { error, count } = await supabase
    .from('contacts')
    .update({ ml_update_needed: flag }, { count: 'exact' })
    .in('id', ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: count ?? 0 });
}
