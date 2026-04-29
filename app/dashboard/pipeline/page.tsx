import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import PipelineBoard from "@/components/pipeline/PipelineBoard";
export default async function Page() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  return <PipelineBoard userId={session!.user.id} />;
}
