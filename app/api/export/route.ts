import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter"); // "needs_update" | "no_activity" | null

  let query = supabase
    .from("contacts")
    .select("*")
    .eq("user_id", session.user.id)
    .order("name");

  // Apply filters
  if (filter === "needs_update") {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    query = query.or(
      `last_contacted.is.null,last_contacted.lt.${thirtyDaysAgo.toISOString().split("T")[0]}`
    );
  } else if (filter === "no_email") {
    query = query.is("email", null);
  } else if (filter === "ml_update") {
    query = query.eq("ml_update_needed", true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build CSV
  const headers = [
    "Name", "Phone", "Email", "Address", "City", "State", "ZIP",
    "Pipeline Stage", "Campaign", "Status", "Priority",
    "Credit Score", "Equity Flag", "Mortgage Amount", "Year Purchased",
    "Next Steps", "Notes", "Last Contacted", "ML Update Needed",
    "Response Received", "Created At",
  ];

  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = (data || []).map((c: any) => [
    c.name, c.phone, c.email, c.address, c.city, c.state, c.zip,
    c.pipeline_stage, c.campaign, c.status, c.priority_score,
    c.credit_score, c.equity_flag, c.mortgage_amount, c.year_purchased,
    c.next_steps, c.notes, c.last_contacted, c.ml_update_needed,
    c.response_received, c.created_at?.split("T")[0],
  ].map(escape).join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  const filename = `contacts-${new Date().toISOString().split("T")[0]}${filter ? `-${filter}` : ""}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
