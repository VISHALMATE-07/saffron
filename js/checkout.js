// CART PAGE: shows the cart, places the order in Firestore, shows order history.
import { db } from "./firebase-config.js";
import { watchAuth } from "./auth.js";
import { doc, collection, getDoc, setDoc, getDocs, query, where, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getCart, clearCart, initCartPage, renderCart } from "./cart.js";
import {
  showToast, escapeHtml, formatPrice, formatDate, shortId,
  isValidPhone, userError
} from "./utils.js";

let currentUser = null;   // Firebase Auth user, or null for a guest

// ---------------- place order ----------------
async function placeOrder(event) {
  event.preventDefault();
  const errorBox = document.getElementById("formError");
  errorBox.textContent = "";

  const cart = getCart();
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.replace(/[\s-]/g, "");
  const notes = document.getElementById("custNotes").value.trim();

  // 1. Validate
  if (cart.length === 0) { errorBox.textContent = "Your cart is empty."; return; }
  if (name.length < 2) { errorBox.textContent = "Please enter your name."; return; }
  if (!isValidPhone(phone)) { errorBox.textContent = "Phone number must be exactly 10 digits."; return; }
  if (notes.length > 200) { errorBox.textContent = "Special instructions: maximum 200 characters."; return; }

  const button = document.getElementById("placeBtn");
  button.disabled = true;
  try {
    // 2. Do NOT trust the prices stored in the browser's localStorage.
    //    Read every item again from Firestore and use the REAL price.
    //    (NOTE: in a production system the total must be calculated/validated
    //     on a trusted server, e.g. a Cloud Function. A user can still edit
    //     the JavaScript in their browser. For this college project we
    //     re-read prices from Firestore, which is simple and good enough.)
    const items = [];
    let totalAmount = 0;
    for (const line of cart) {
      let menuData;
      try {
        const snap = await getDoc(doc(db, "menu", line.id));
        if (!snap.exists()) throw new Error("missing");
        menuData = snap.data();
      } catch (error) {
        throw userError('"' + line.name + '" is no longer available. Please remove it from your cart.');
      }
      if (menuData.available === false) {
        throw userError('"' + menuData.name + '" is not available right now. Please remove it.');
      }
      items.push({ menuId: line.id, name: menuData.name, price: menuData.price, quantity: line.quantity });
      totalAmount += menuData.price * line.quantity;
    }

    // 3. Create the order document. doc(collection(...)) makes a new empty
    //    reference so we know the order id before saving.
    const orderRef = doc(collection(db, "orders"));
    await setDoc(orderRef, {
      orderId: orderRef.id,
      customerId: currentUser ? currentUser.uid : null,   // null = guest order
      customerName: name,
      customerPhone: phone,
      notes: notes,
      items: items,               // array stored inside the order document
      totalAmount: totalAmount,
      status: "Pending",          // always starts as Pending
      createdAt: serverTimestamp()
    });

    // 4. Confirmation + clear cart
    clearCart();
    renderCart();
    document.getElementById("cartEmpty").classList.add("hidden");
    document.getElementById("cartFilled").classList.add("hidden");
    document.getElementById("successOrderId").textContent = shortId(orderRef.id);
    document.getElementById("successTotal").textContent = formatPrice(totalAmount);
    document.getElementById("orderSuccess").classList.remove("hidden");
    showToast("Order placed successfully", "success");
    window.scrollTo(0, 0);
    if (currentUser) loadMyOrders();
  } catch (error) {
    console.error(error);
    if (error.isUserError) {
      errorBox.textContent = error.message;
    } else {
      errorBox.textContent = "Something went wrong while placing your order. Please try again.";
      showToast("Something went wrong.", "error");
    }
  } finally {
    button.disabled = false;
  }
}

// ---------------- order history (logged-in customers) ----------------
async function loadMyOrders() {
  const box = document.getElementById("myOrders");
  box.innerHTML = '<p class="muted">Loading your orders...</p>';
  try {
    // Only orders whose customerId is the current user's uid.
    const q = query(collection(db, "orders"), where("customerId", "==", currentUser.uid));
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(d => d.data());
    // newest first (sorted here so no Firestore index is needed)
    orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    if (orders.length === 0) {
      box.innerHTML = '<p class="muted">You have not placed any orders yet.</p>';
      return;
    }
    box.innerHTML = orders.map(order => `
      <div class="card order-card">
        <div class="order-head">
          <strong>${shortId(order.orderId)}</strong>
          <span class="status status-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
        </div>
        <p class="muted">${formatDate(order.createdAt)}</p>
        <p>${order.items.map(i => escapeHtml(i.name) + " × " + i.quantity).join(", ")}</p>
        <strong>Total: ${formatPrice(order.totalAmount)}</strong>
      </div>`).join("");
  } catch (error) {
    console.error(error);
    box.innerHTML = '<p class="error-text">Could not load your orders.</p>';
  }
}

// ---------------- start ----------------
initCartPage();
document.getElementById("checkoutForm").addEventListener("submit", placeOrder);

watchAuth((user, profile) => {
  currentUser = user;
  document.getElementById("loginHint").classList.toggle("hidden", !!user);
  document.getElementById("myOrdersSection").classList.toggle("hidden", !user);
  if (user) {
    // Pre-fill the form from the saved profile
    const nameInput = document.getElementById("custName");
    const phoneInput = document.getElementById("custPhone");
    if (profile && !nameInput.value) nameInput.value = profile.name || "";
    if (profile && !phoneInput.value) phoneInput.value = profile.phone || "";
    loadMyOrders();
  }
});
