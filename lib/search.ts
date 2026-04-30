import { createClient } from "./supabase";
import { Contact } from "./database.types";

export interface SearchResult {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  pipeline_stage: string;
  priority_score: string | null;
}

export async function searchContacts(
  query: string,
  userId: string,
  limit = 8
): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const supabase = createClient();
  const q = query.trim().toLowerCase();

  const { data, error } = await supabase
    .from("contacts")
    .select("id, name, phone, email, city, pipeline_stage, priority_score")
    .eq("user_id", userId)
    .or(
      `name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,notes.ilike.%${q}%,city.ilike.%${q}%,next_steps.ilike.%${q}%`
    )
    .limit(limit);

  if (error) return [];
  return (data as SearchResult[]) || [];
}
