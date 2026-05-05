'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Download, X, Check, Loader2 } from 'lucide-react';

type Contact = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  updated_at: string;
  last_ml_export_at: string | null;
};

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

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function splitName(name: string | null): { first: string; last: string } {
  if (!name) return { first: '', last: '' };
  const trimmed = name.trim();
  if (!trimmed) return { first: '', last: '' };
  const firstSpace = trimmed.indexOf(' ');
  if (firstSpace === -1) return { first: trimmed, last: '' };
  return {
    first: trimmed.slice(0, firstSpace),
    last: trimmed.slice(firstSpace + 1).trim(),
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  // Output as YYYY-MM-DD; trim time portion if present
  return iso.slice(0, 10);
}

/**
 * Filter items to only those newer than the cutoff timestamp.
 * If cutoff is null, returns everything (first-time export = full history).
 */
function sinceCutoff<T>(
  items: T[],
  cutoff: string | null,
  getTimestamp: (item: T) => string | null
): T[] {
  if (!cutoff) return items;
  const cutoffMs = new Date(cutoff).getTime();
  return items.filter((item) => {
    const ts = getTimestamp(item);
    if (!ts) return false;
    return new Date(ts).getTime() > cutoffMs;
  });
}

function formatTasks(tasks: Task[]): string {
  if (tasks.length === 0) return '';
  // Sort newest first by created_at
  const sorted = [...tasks].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return sorted
    .map((t) => {
      const status = t.status
        ? `[${t.status.charAt(0).toUpperCase() + t.status.slice(1)}]`
        : '[Unknown]';
      const desc = t.description || '(no description)';
      const due = t.due_date ? ` - due ${formatDate(t.due_date)}` : '';
      return `${status} ${desc}${due}`;
    })
    .join(' | ');
}

function formatTouchLogs(logs: TouchLog[]): string {
  if (logs.length === 0) return '';
  // Sort newest first by touched_at
  const sorted = [...logs].sort(
    (a, b) =>
      new Date(b.touched_at).getTime() - new Date(a.touched_at).getTime()
  );
  return sorted
    .map((l) => {
      const date = formatDate(l.touched_at);
      const type = l.touch_type ? ` (${l.touch_type})` : '';
      const notes = l.notes || '';
      return `${date}${type}: ${notes}`;
    })
    .join(' | ');
}

function buildCsv(
  contacts: Contact[],
  tasksByContact: Record<string, Task[]>,
  touchLogsByContact: Record<string, TouchLog[]>
): string {
  const headers = [
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Tasks Since Last Export',
    'Touch Logs Since Last Export',
    'Last Exported',
  ];
  const rows = contacts.map((c) => {
    const { first, last } = splitName(c.name);
    const cutoff = c.last_ml_export_at;

    const allTasks = tasksByContact[c.id] ?? [];
    const allLogs = touchLogsByContact[c.id] ?? [];

    // Tasks: filter by created_at (so newly-created tasks show up,
    // including pending ones that haven't been due yet)
    const newTasks = sinceCutoff(allTasks, cutoff, (t) => t.created_at);
    // Touch logs: filter by touched_at
    const newLogs = sinceCutoff(allLogs, cutoff, (l) => l.touched_at);

    return [
      first,
      last,
      c.email,
      c.phone,
      formatTasks(newTasks),
      formatTouchLogs(newLogs),
      cutoff ? formatDate(cutoff) : 'Never',
    ];
  });

  const bom = '\ufeff';
  return (
    bom +
    [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\r\n')
  );
}

export function FlaggedContactsList({
  initialContacts,
  tasksByContact,
  touchLogsByContact,
}: {
  initialContacts: Contact[];
  tasksByContact: Record<string, Task[]>;
  touchLogsByContact: Record<string, TouchLog[]>;
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, startClearing] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allSelected = contacts.length > 0 && selected.size === contacts.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(contacts.map((c) => c.id)));
  }

  async function handleExport() {
    if (contacts.length === 0) return;
    setError(null);
    setIsExporting(true);

    const exportedContacts = [...contacts];
    const exportedIds = exportedContacts.map((c) => c.id);

    try {
      const csv = buildCsv(exportedContacts, tasksByContact, touchLogsByContact);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `market-leader-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Two server updates after download:
      // 1) Stamp last_ml_export_at to now (so next export is "since now")
      // 2) Clear ml_update_needed flag
      const res = await fetch('/api/contacts/ml-flag', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: exportedIds,
          ml_update_needed: false,
          stamp_last_export: true,
        }),
      });
      if (!res.ok) {
        throw new Error(
          'CSV downloaded, but failed to update contacts. Clear flags manually or retry.'
        );
      }

      setContacts((prev) => prev.filter((c) => !exportedIds.includes(c.id)));
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }

  function clearFlags(ids: string[]) {
    if (ids.length === 0) return;
    setError(null);
    startClearing(async () => {
      try {
        const res = await fetch('/api/contacts/ml-flag', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, ml_update_needed: false }),
        });
        if (!res.ok) throw new Error(`Clear failed (${res.status})`);

        setContacts((prev) => prev.filter((c) => !ids.includes(c.id)));
        setSelected((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Clear failed');
      }
    });
  }

  if (contacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-navy-200 bg-white p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-jade-50">
          <Check className="h-6 w-6 text-jade-600" />
        </div>
        <h2 className="font-display font-semibold text-navy-900">
          All caught up
        </h2>
        <p className="mt-1 text-sm text-navy-500">
          No contacts are flagged for Market Leader updates.
        </p>
        <Link
          href="/dashboard/pipeline"
          className="mt-4 inline-block text-sm font-medium text-coral-600 hover:text-coral-700"
        >
          Back to Pipeline
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-navy-100 bg-white p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-navy-300 text-coral-500 focus:ring-coral-400"
          />
          <span className="text-navy-700">
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </span>
        </label>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => clearFlags([...selected])}
              disabled={isClearing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-coral-200 bg-coral-50 px-3 py-1.5 text-sm font-medium text-coral-700 transition hover:bg-coral-100 disabled:opacity-50"
            >
              {isClearing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              Clear {selected.size}
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || contacts.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-jade-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-jade-700 disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-coral-200 bg-coral-50 px-3 py-2 text-sm text-coral-700">
          {error}
        </div>
      )}

      <p className="px-1 text-xs text-navy-500">
        CSV includes tasks and touch logs since each contact&apos;s last export.
        Exporting clears flags and updates the last-exported timestamp.
      </p>

      <ul className="divide-y divide-navy-100 overflow-hidden rounded-xl border border-navy-100 bg-white">
        {contacts.map((c) => {
          const displayName = c.name || 'Unnamed contact';
          const isSelected = selected.has(c.id);
          const taskCount = (tasksByContact[c.id] ?? []).filter((t) => {
            if (!c.last_ml_export_at) return true;
            return new Date(t.created_at) > new Date(c.last_ml_export_at);
          }).length;
          const logCount = (touchLogsByContact[c.id] ?? []).filter((l) => {
            if (!c.last_ml_export_at) return true;
            return new Date(l.touched_at) > new Date(c.last_ml_export_at);
          }).length;

          return (
            <li
              key={c.id}
              className={`flex items-center gap-3 px-3 py-3 transition ${
                isSelected ? 'bg-coral-50/40' : 'bg-white'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleOne(c.id)}
                className="h-4 w-4 shrink-0 rounded border-navy-300 text-coral-500 focus:ring-coral-400"
                aria-label={`Select ${displayName}`}
              />
              <Link
                href={`/dashboard/contacts/${c.id}`}
                className="min-w-0 flex-1"
              >
                <p className="truncate font-medium text-navy-900">{displayName}</p>
                <p className="truncate text-xs text-navy-500">
                  {c.email ?? c.phone ?? '—'}
                  {(taskCount > 0 || logCount > 0) && (
                    <span className="ml-2 text-navy-400">
                      · {taskCount} task{taskCount === 1 ? '' : 's'}, {logCount} log
                      {logCount === 1 ? '' : 's'}
                    </span>
                  )}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => clearFlags([c.id])}
                disabled={isClearing}
                className="shrink-0 rounded-md p-1.5 text-navy-400 transition hover:bg-coral-50 hover:text-coral-600 disabled:opacity-50"
                aria-label={`Clear flag for ${displayName}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
