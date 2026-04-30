"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { SearchResult } from "@/lib/search";

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: "#f94021", MED: "#f59e0b", LOW: "#6171f5",
};

const STAGE_EMOJI: Record<string, string> = {
  Marketing: "📣", Processing: "⚙️", "In Contract": "📝", Other: "📌",
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function GlobalSearch({ userId }: { userId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const debouncedQuery = useDebounce(query, 300);

  // Search when query changes
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const q = debouncedQuery.trim().toLowerCase();
    supabase
      .from("contacts")
      .select("id, name, phone, email, city, pipeline_stage, priority_score")
      .eq("user_id", userId)
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%`)
      .limit(8)
      .then(({ data }) => {
        setResults((data as SearchResult[]) || []);
        setSelected(0);
        setLoading(false);
      });
  }, [debouncedQuery, userId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) { navigate(results[selected].id); }
    if (e.key === "Escape") { setOpen(false); setQuery(""); inputRef.current?.blur(); }
  };

  const navigate = useCallback((id: string) => {
    setOpen(false);
    setQuery("");
    router.push(`/contacts/${id}`);
  }, [router]);

  const showDropdown = open && (results.length > 0 || loading || query.length >= 2);

  return (
    <div ref={containerRef} className="relative flex-1 max-w-sm">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border-2 transition-all ${open ? "border-white/40 bg-white/15" : "border-white/20 bg-white/10"}`}>
        <svg className="w-4 h-4 text-white/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          placeholder="Search contacts..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-white placeholder-white/40 text-sm focus:outline-none min-w-0"
          autoCapitalize="none"
          autoCorrect="off"
        />
        {loading && <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />}
        {query && !loading && (
          <button onClick={() => { setQuery(""); setResults([]); }} className="text-white/40 hover:text-white flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-card-lg border border-navy-100 overflow-hidden z-50">
          {results.length === 0 && !loading && query.length >= 2 ? (
            <div className="px-4 py-3 text-sm text-navy-400 text-center">No contacts found</div>
          ) : (
            results.map((r, i) => (
              <button
                key={r.id}
                onClick={() => navigate(r.id)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-navy-50 last:border-0 ${i === selected ? "bg-navy-50" : "hover:bg-navy-50/50"}`}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #1e1f6b, #6171f5)" }}>
                  {r.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-semibold text-navy-900 text-sm truncate">{r.name}</p>
                    {r.priority_score && (
                      <span className="text-xs font-bold" style={{ color: PRIORITY_COLOR[r.priority_score] }}>
                        {r.priority_score}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-navy-400 truncate">
                    {STAGE_EMOJI[r.pipeline_stage]} {r.pipeline_stage}
                    {r.city ? ` · ${r.city}` : ""}
                    {r.phone ? ` · ${r.phone}` : ""}
                  </p>
                </div>
                <svg className="w-3 h-3 text-navy-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
