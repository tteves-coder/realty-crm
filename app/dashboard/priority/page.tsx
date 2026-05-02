import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { ui } from "@/components/uiStyles";
import PriorityList from "@/components/priority/PriorityList";
export default async function Page() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  return <PriorityList userId={session!.user.id} />;
}
