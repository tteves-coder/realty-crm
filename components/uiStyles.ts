// uiStyles.ts
// Simple shared UI style system for CRM consistency

export const ui = {
  page: "min-h-screen bg-gray-50",

  card: "bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition p-3",
  cardStrong: "bg-white rounded-xl border border-gray-300 shadow-md hover:shadow-lg transition p-4",

  section: "bg-gray-50 rounded-2xl p-3 border border-gray-200",

  title: "text-sm font-semibold text-gray-900",
  subtitle: "text-xs text-gray-500",

  input: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",

  button: {
    primary: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition",
    secondary: "px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition",
    danger: "px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition",
  },

  badge: {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    orange: "bg-orange-100 text-orange-700",
    gray: "bg-gray-100 text-gray-700",
    red: "bg-red-100 text-red-700",
  },
};
