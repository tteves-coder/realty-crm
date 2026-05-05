import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * PATCH /api/contacts/ml-flag
 * Body: {
 *   ids: string[],
 *   ml_update_needed: boolean,
 *   stamp_last_export?: boolean   // if true, also set last_ml_export_at = now()
 * }
 *
 * Bulk-update the ml_update_needed flag for the given contact IDs.
 * Optionally also stamps last_ml_export_at, used by the export flow so
 * future exports only include tasks/touch logs created after this point.
 */
export async function PATCH(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    ids?: unknown;
    ml_update_needed?: unknown;
    stamp_last_export?: unknown;
  };
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
  const stampExport = body.stamp_last_export === true;

  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { ml_update_needed: flag };
  if (stampExport) {
    updates.last_ml_export_at = new Date().toISOString();
  }

  const { error, count } = await supabase
    .from('contacts')
    .update(updates, { count: 'exact' })
    .in('id', ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: count ?? 0 });
}
