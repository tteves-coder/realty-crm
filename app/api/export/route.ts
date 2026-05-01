// Export handled client-side in ContactsView.tsx to avoid serverless function costs
export const runtime = "edge"; // Use edge runtime (free tier, faster)
export async function GET() {
  return new Response(JSON.stringify({ message: "Use client-side export" }), {
    headers: { "Content-Type": "application/json" },
  });
}
