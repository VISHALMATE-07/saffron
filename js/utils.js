// Small helper functions used by many pages.

export const CATEGORIES = ["Starters", "Main Course", "Rice", "Breads", "Beverages", "Desserts"];
export const STATUSES = ["Pending", "Confirmed", "Preparing", "Ready", "Completed", "Cancelled"];
export const CATEGORY_EMOJI = {
  "Starters": "🥗", "Main Course": "🍛", "Rice": "🍚",
  "Breads": "🫓", "Beverages": "☕", "Desserts": "🍨"
};

// Small message that appears at the bottom of the screen and disappears.
// type: "info" | "success" | "error"
export function showToast(message, type = "info") {
  let box = document.getElementById("toastBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "toastBox";
    box.className = "toast-box";
    document.body.appendChild(box);
  }
  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.textContent = message;
  box.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// Prevents text from the database being treated as HTML (basic XSS protection).
export function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function formatPrice(amount) {
  return "₹" + Number(amount || 0).toLocaleString("en-IN");
}

// Firestore stores dates as Timestamp objects; convert to readable text.
export function formatDate(timestamp) {
  if (!timestamp || !timestamp.toDate) return "-";
  return timestamp.toDate().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

// Firestore document ids are long; show a short version to humans.
export function shortId(id) {
  return "#" + String(id).slice(0, 6).toUpperCase();
}

export function isValidPhone(phone) {
  return /^\d{10}$/.test(phone);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// An Error whose message is safe to show to the customer.
export function userError(message) {
  const err = new Error(message);
  err.isUserError = true;
  return err;
}
