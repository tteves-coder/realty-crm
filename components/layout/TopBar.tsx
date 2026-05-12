"use client";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useState } from "react";
import GlobalSearch from "@/components/GlobalSearch";

const PAGE_TITLES: Record<string, { title: string; emoji: string }> = {
  "/dashboard/today": { title: "Today", emoji: "☀️" },
  "/dashboard/priority": { title: "Priority Calls", emoji: "⭐" },
  "/dashboard/pipeline": { title: "Pipeline", emoji: "📊" },
  "/dashboard/tracker": { title: "Activity Tracker", emoji: "📈" },
  "/dashboard/contacts": { title: "Contacts", emoji: "👥" },
  "/dashboard/import": { title: "Import", emoji: "📥" },
};

export default function TopBar({ userEmail, userId }: { userEmail: string; userId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [showMenu, setShowMenu] = useState(false);
  const page = PAGE_TITLES[pathname] || { title: "APA CRM", emoji: "🏠" };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  // Smart-default for + button: infer contact_type from context.
  // (Today / Priority / Pipeline → Client by default; can be changed in the form.)
  const handleAddContact = () => {
    router.push("/dashboard/contacts/new");
  };

  return (
    <header className="safe-top" style={{ background: "linear-gradient(135deg, #13144a 0%, #1e1f6b 100%)" }}>
      <div className="flex items-center gap-3 px-4 h-14">
        {/* Title — hide on wider screens to make room for search */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg">{page.emoji}</span>
          <h1 className="text-sm font-display font-bold text-white hidden xs:block">{page.title}</h1>
        </div>

        {/* Search */}
        <GlobalSearch userId={userId} />

        {/* + Add Contact button */}
        <button
          onClick={handleAddContact}
          className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center flex-shrink-0 transition-colors active:scale-95"
          aria-label="Add contact"
          title="Add contact"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <button onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center text-white text-xs font-bold font-display"
            style={{ background: "linear-gradient(135deg, #f94021, #ff6b52)" }}>
            {userEmail.charAt(0).toUpperCase()}
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-10 z-20 bg-white rounded-2xl shadow-card-lg border border-navy-100 py-2 min-w-[180px]">
                <div className="px-4 py-2 border-b border-navy-50">
                  <p className="text-xs text-navy-400 truncate font-medium">{userEmail}</p>
                </div>
                <button onClick={handleSignOut}
                  className="w-full text-left px-4 py-3 text-sm text-coral-600 hover:bg-coral-50 flex items-center gap-2 font-medium">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
