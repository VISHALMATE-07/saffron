// CART LOGIC. The cart lives in the browser's localStorage (NOT in Firestore).
// It is only written to Firestore when the customer presses "Place Order".
//
// Cart format:  [ { id: "menuDocId", name: "Veg Biryani", price: 180, quantity: 2 }, ... ]
import { escapeHtml, formatPrice } from "./utils.js";

const CART_KEY = "saffronCart";
const MAX_QUANTITY = 20;

export function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

// item = { id, name, price }
export function addToCart(item) {
  const cart = getCart();
  const existing = cart.find(line => line.id === item.id);
  if (existing) {
    if (existing.quantity < MAX_QUANTITY) existing.quantity++;
  } else {
    cart.push({ id: item.id, name: item.name, price: item.price, quantity: 1 });
  }
  saveCart(cart);
}

export function removeFromCart(id) {
  saveCart(getCart().filter(line => line.id !== id));
}

export function increaseQuantity(id) {
  const cart = getCart();
  const line = cart.find(l => l.id === id);
  if (line && line.quantity < MAX_QUANTITY) line.quantity++;
  saveCart(cart);
}

export function decreaseQuantity(id) {
  let cart = getCart();
  const line = cart.find(l => l.id === id);
  if (line) line.quantity--;
  cart = cart.filter(l => l.quantity > 0);   // quantity 0 means remove
  saveCart(cart);
}

export function calculateTotal() {
  return getCart().reduce((sum, line) => sum + line.price * line.quantity, 0);
}

export function clearCart() {
  saveCart([]);
}

// Shows the number in the navbar badge.
export function updateCartCount() {
  const badge = document.getElementById("cartCount");
  if (!badge) return;
  badge.textContent = getCart().reduce((sum, line) => sum + line.quantity, 0);
}

// Draws the cart table on cart.html
export function renderCart() {
  const body = document.getElementById("cartItems");
  if (!body) return;
  const cart = getCart();

  document.getElementById("cartEmpty").classList.toggle("hidden", cart.length > 0);
  document.getElementById("cartFilled").classList.toggle("hidden", cart.length === 0);

  body.innerHTML = cart.map(line => `
    <tr>
      <td>${escapeHtml(line.name)}</td>
      <td>${formatPrice(line.price)}</td>
      <td>
        <span class="qty-controls">
          <button type="button" data-action="dec" data-id="${escapeHtml(line.id)}" aria-label="Decrease">−</button>
          <strong>${line.quantity}</strong>
          <button type="button" data-action="inc" data-id="${escapeHtml(line.id)}" aria-label="Increase">+</button>
        </span>
      </td>
      <td>${formatPrice(line.price * line.quantity)}</td>
      <td><button type="button" class="icon-btn" data-action="remove" data-id="${escapeHtml(line.id)}" title="Remove">✕</button></td>
    </tr>`).join("");

  document.getElementById("cartSubtotal").textContent = formatPrice(calculateTotal());
  document.getElementById("cartTotal").textContent = formatPrice(calculateTotal());
}

// Call once on cart.html: draws the cart and listens for +, -, remove clicks.
export function initCartPage() {
  const body = document.getElementById("cartItems");
  if (!body) return;
  body.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.action === "inc") increaseQuantity(id);
    if (button.dataset.action === "dec") decreaseQuantity(id);
    if (button.dataset.action === "remove") removeFromCart(id);
    renderCart();
  });
  renderCart();
}
