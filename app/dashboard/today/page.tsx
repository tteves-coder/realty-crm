import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { ui } from "@/components/uiStyles";
import TodayView from "@/components/tasks/TodayView";
export default async function Page() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  return <TodayView userId={session!.user.id} />;
}
