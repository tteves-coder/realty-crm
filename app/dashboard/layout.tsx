import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  return (
    <div className="flex flex-col h-screen" style={{ background: "#f8f7ff" }}>
      <TopBar userEmail={session.user.email || ""} />
      <main className="flex-1 overflow-hidden">{children}</main>
      <BottomNav />
    </div>
  );
}
