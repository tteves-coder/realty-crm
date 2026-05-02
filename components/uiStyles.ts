// uiStyles.ts
// Simple shared UI style system for CRM consistency

export const getStatusBadge = (status: string) => {
  const normalized = status.toLowerCase();

  if (normalized.includes("processing")) {
    return "bg-blue-500/10 text-blue-300 border-blue-500/30";
  }

  if (normalized.includes("marketing")) {
    return "bg-purple-500/10 text-purple-300 border-purple-500/30";
  }

  if (normalized.includes("contract")) {
    return "bg-yellow-500/10 text-yellow-300 border-yellow-500/30";
  }

  if (normalized.includes("closed")) {
    return "bg-green-500/10 text-green-300 border-green-500/30";
  }

  return "bg-white/10 text-white/60 border-white/20";
};
