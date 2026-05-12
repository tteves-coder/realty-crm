import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import NewContactForm from "@/components/contacts/NewContactForm";

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  // Default contact_type can be passed via ?type=Partner|Client|Lead
  const defaultType =
    searchParams.type === "Partner" ? "Partner" :
    searchParams.type === "Lead" ? "Lead" : "Client";

  return <NewContactForm userId={session.user.id} defaultType={defaultType} />;
}
