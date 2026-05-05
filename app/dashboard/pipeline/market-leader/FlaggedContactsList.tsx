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
};

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Split a single name field into first name + last name for Market Leader.
 * Splits on the first space: everything before = first, everything after = last.
 *   "John Smith"        -> { first: "John", last: "Smith" }
 *   "Mary Jane Watson"  -> { first: "Mary", last: "Jane Watson" }
 *   "Cher"              -> { first: "Cher", last: "" }
 *   null / ""           -> { first: "", last: "" }
 */
function splitName(name: string | null): { first: string; last: string } {
  if (!name) return { first: '', last: '' };
  const trimmed = name.trim();
  if (!trimmed) return { first: '', last: '' };
  const firstSpace = trimmed.indexOf(' ');
  if (firstSpace === -1) {
    return { first: trimmed, last: '' };
  }
  return {
    first: trimmed.slice(0, firstSpace),
    last: trimmed.slice(firstSpace + 1).trim(),
  };
}

function buildCsv(contacts: Contact[]): string {
  // Column headers match Market Leader's import template:
  // First Name + Last Name are required; email or phone satisfies their
  // "must have email OR phone OR address" rule.
  const headers = ['First Name', 'Last Name', 'Email', 'Phone'];
  const rows = contacts.map((c) => {
    const { first, last } = splitName(c.name);
    return [first, last, c.email, c.phone];
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
}: {
  initialContacts: Contact[];
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
      const csv = buildCsv(exportedContacts);
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

      const res = await fetch('/api/contacts/ml-flag', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: exportedIds, ml_update_needed: false }),
      });
      if (!res.ok) {
        throw new Error(
          'CSV downloaded, but failed to clear flags. Clear them manually or retry.'
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
        Exporting will download a CSV and automatically clear flags on these contacts.
      </p>

      <ul className="divide-y divide-navy-100 overflow-hidden rounded-xl border border-navy-100 bg-white">
        {contacts.map((c) => {
          const displayName = c.name || 'Unnamed contact';
          const isSelected = selected.has(c.id);
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
