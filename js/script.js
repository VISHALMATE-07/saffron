// ===================== Firebase =====================
import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, writeBatch, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const page = document.body.dataset.page;   // which HTML page is open
const CATEGORIES = ["All", "Starters", "Main Course", "Rice", "Breads", "Beverages", "Desserts"];
const ICONS = { Starters: "🥟", "Main Course": "🍛", Rice: "🍚", Breads: "🫓", Beverages: "🥤", Desserts: "🍨" };
const STATUSES = ["Pending", "Confirmed", "Preparing", "Ready", "Completed", "Cancelled"];

// ===================== Utilities =====================
const $ = id => document.getElementById(id);
const money = n => "₹" + Number(n).toLocaleString("en-IN");
const shortId = id => "#" + id.slice(0, 6).toUpperCase();
const fdate = ts => (ts && ts.toDate ? ts.toDate().toLocaleString("en-IN") : "—");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ERRORS = {
  "auth/invalid-credential": "Wrong email or password.", "auth/user-not-found": "Wrong email or password.",
  "auth/wrong-password": "Wrong email or password.", "auth/invalid-email": "Enter a valid email address.",
  "auth/email-already-in-use": "This email is already registered. Try logging in.",
  "auth/weak-password": "Password must be at least 6 characters.", "auth/too-many-requests": "Too many attempts. Try again later.",
  "permission-denied": "Permission denied by Firestore rules."
};
const friendly = e => ERRORS[e.code] || e.message;
function toast(msg, type = "ok") {
  const t = document.createElement("div");
  t.className = "toast " + (type === "err" ? "err" : "");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ===================== Authentication =====================
let currentUser = null, currentRole = null;

async function getRole(uid) {            // role lives in Firestore: users/{uid}.role
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data().role : null;
}

onAuthStateChanged(auth, async user => {
  currentUser = user;
  currentRole = user ? await getRole(user.uid).catch(() => null) : null;
  const link = $("authLink");
  if (link) {
    if (user) {
      link.textContent = "Logout"; link.href = "#";
      link.onclick = e => { e.preventDefault(); signOut(auth).then(() => (location.href = "index.html")); };
      if (currentRole === "admin" && !$("adminLink"))
        link.parentElement.insertAdjacentHTML("beforebegin", '<li><a id="adminLink" href="admin.html">Admin</a></li>');
    } else { link.textContent = "Login"; link.href = "login.html"; }
  }
  if (page === "admin") initAdmin();
  if (page === "cart") initCartUser();
});

$("loginForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const cred = await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
    if ((await getRole(cred.user.uid)) === "admin") return (location.href = "admin.html");
    const next = new URLSearchParams(location.search).get("next") || "";
    location.href = /^[a-z]+\.html$/.test(next) ? next : "menu.html";
  } catch (err) { toast(friendly(err), "err"); }
});

$("forgotLink")?.addEventListener("click", async e => {
  e.preventDefault();
  const email = $("email").value.trim();
  if (!email) return toast("Type your email first, then click Forgot password.", "err");
  try { await sendPasswordResetEmail(auth, email); toast("Password reset email sent."); }
  catch (err) { toast(friendly(err), "err"); }
});

$("logoutBtn")?.addEventListener("click", () => signOut(auth).then(() => (location.href = "login.html")));

// ===================== Registration =====================
$("registerForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("name").value.trim(), email = $("email").value.trim(), phone = $("phone").value.trim(), pw = $("password").value;
  if (name.length < 2) return toast("Enter your full name.", "err");
  if (!/^\d{10}$/.test(phone)) return toast("Phone must be 10 digits.", "err");
  if (pw.length < 6) return toast("Password must be at least 6 characters.", "err");
  if (pw !== $("confirm").value) return toast("Passwords do not match.", "err");
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, pw);
    // Role is ALWAYS "customer" here. Admin is set manually in the Firebase console.
    await setDoc(doc(db, "users", user.uid), { uid: user.uid, name, email, phone, role: "customer", createdAt: serverTimestamp() });
    toast("Account created!");
    setTimeout(() => (location.href = "menu.html"), 900);
  } catch (err) { toast(friendly(err), "err"); }
});

// ===================== Menu =====================
let menuItems = [], activeCat = "All";

async function loadMenu() {
  const grid = $("menuGrid");
  grid.innerHTML = '<p class="msg">Loading menu…</p>';
  try {
    // The where() filter must match the security rule (customers may only read available items)
    const snap = await getDocs(query(collection(db, "menu"), where("available", "==", true)));
    menuItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    $("categories").innerHTML = CATEGORIES.map(c => `<button data-cat="${c}" class="${c === activeCat ? "active" : ""}">${c}</button>`).join("");
    renderMenu();
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<p class="msg err">Could not load the menu. Check your Firebase config and rules.</p>';
  }
}

function renderMenu() {
  const items = menuItems.filter(m => activeCat === "All" || m.category === activeCat);
  $("menuGrid").innerHTML = items.length ? items.map(m => `
    <div class="card dish">
      <div class="emoji">${m.imageUrl ? `<img src="${esc(m.imageUrl)}" alt="${esc(m.name)}">` : ICONS[m.category] || "🍽️"}</div>
      <span class="tag">${esc(m.category)}</span><h3>${esc(m.name)}</h3><p>${esc(m.description)}</p>
      <div class="row"><span class="price">${money(m.price)}</span><button class="btn small" data-add="${m.id}">Add to Cart</button></div>
    </div>`).join("") : '<p class="msg">No items in this category yet.</p>';
}

$("categories")?.addEventListener("click", e => {
  const b = e.target.closest("[data-cat]"); if (!b) return;
  activeCat = b.dataset.cat;
  document.querySelectorAll("#categories button").forEach(x => x.classList.toggle("active", x === b));
  renderMenu();
});
$("menuGrid")?.addEventListener("click", e => {
  const b = e.target.closest("[data-add]"); if (!b) return;
  addToCart(menuItems.find(m => m.id === b.dataset.add));
});

// ===================== Cart (localStorage) =====================
function getCart() { try { return JSON.parse(localStorage.getItem("saffronCart")) || []; } catch { return []; } }
function saveCart(c) { localStorage.setItem("saffronCart", JSON.stringify(c)); updateCartCount(); }
function addToCart(item) {
  const cart = getCart(), found = cart.find(x => x.id === item.id);
  if (found) found.quantity++; else cart.push({ id: item.id, name: item.name, price: item.price, quantity: 1 });
  saveCart(cart); toast(item.name + " added to cart");
}
function removeFromCart(id) { saveCart(getCart().filter(x => x.id !== id)); renderCart(); }
function increaseQuantity(id) { const c = getCart(); c.find(x => x.id === id).quantity++; saveCart(c); renderCart(); }
function decreaseQuantity(id) {
  const c = getCart(), item = c.find(x => x.id === id);
  if (item.quantity <= 1) return removeFromCart(id);
  item.quantity--; saveCart(c); renderCart();
}
const calculateTotal = () => getCart().reduce((s, i) => s + i.price * i.quantity, 0);
function updateCartCount() { const el = $("cartCount"); if (el) el.textContent = getCart().reduce((s, i) => s + i.quantity, 0); }

function renderCart() {
  const cart = getCart(), box = $("cartItems");
  $("checkout").hidden = !cart.length;
  if (!cart.length) { box.innerHTML = '<p class="msg">Your cart is empty. <a href="menu.html"><b>Browse the menu</b></a></p>'; return; }
  box.innerHTML = `<div class="tablewrap"><table><thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Subtotal</th><th></th></tr></thead><tbody>
    ${cart.map(i => `<tr><td>${esc(i.name)}</td><td>${money(i.price)}</td>
      <td><button class="qty" data-act="dec" data-id="${i.id}">−</button> ${i.quantity} <button class="qty" data-act="inc" data-id="${i.id}">+</button></td>
      <td>${money(i.price * i.quantity)}</td><td><button class="qty del" data-act="rm" data-id="${i.id}">✕</button></td></tr>`).join("")}
    </tbody></table></div><p class="total">Subtotal: ${money(calculateTotal())}<br><b>Total: ${money(calculateTotal())}</b></p>`;
}
$("cartItems")?.addEventListener("click", e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  ({ inc: increaseQuantity, dec: decreaseQuantity, rm: removeFromCart })[b.dataset.act](b.dataset.id);
});

// ===================== Checkout =====================
async function initCartUser() {            // runs on cart.html once we know who is logged in
  renderCart();
  if (!currentUser) { $("myOrders").innerHTML = '<p class="msg"><a href="login.html?next=cart.html"><b>Login</b></a> to place and view orders.</p>'; return; }
  try {
    const u = await getDoc(doc(db, "users", currentUser.uid));
    if (u.exists()) { $("custName").value ||= u.data().name; $("custPhone").value ||= u.data().phone; }
  } catch (err) { console.error(err); }
  loadMyOrders();
}

async function placeOrder() {
  const cart = getCart(), name = $("custName").value.trim(), phone = $("custPhone").value.trim();
  if (!currentUser) { toast("Please login to place an order.", "err"); return setTimeout(() => (location.href = "login.html?next=cart.html"), 1200); }
  if (!cart.length) return toast("Your cart is empty.", "err");
  if (name.length < 2) return toast("Enter your name.", "err");
  if (!/^\d{10}$/.test(phone)) return toast("Enter a valid 10-digit phone number.", "err");
  const btn = $("placeOrder"); btn.disabled = true;
  try {
    const ref = doc(collection(db, "orders"));      // new empty document with an auto ID
    await setDoc(ref, {
      orderId: ref.id, customerId: currentUser.uid, customerName: name, customerPhone: phone, notes: $("notes").value.trim(),
      items: cart.map(i => ({ menuId: i.id, name: i.name, price: i.price, quantity: i.quantity })),
      totalAmount: calculateTotal(), status: "Pending", createdAt: serverTimestamp()
    });
    localStorage.removeItem("saffronCart"); updateCartCount();
    $("cartBox").innerHTML = `<div class="card center"><h2>✅ Order placed!</h2><p>Your order ID is <b>${shortId(ref.id)}</b>. Status: Pending.</p><br><a class="btn" href="menu.html">Order more</a></div>`;
    loadMyOrders();
  } catch (err) { console.error(err); toast("Order failed: " + friendly(err), "err"); btn.disabled = false; }
}
$("placeOrder")?.addEventListener("click", placeOrder);

async function loadMyOrders() {            // customer order history
  const box = $("myOrders");
  try {
    const snap = await getDocs(query(collection(db, "orders"), where("customerId", "==", currentUser.uid)));
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    box.innerHTML = orders.length ? orders.map(o => `<div class="card order"><div class="row"><b>${shortId(o.id)}</b><span class="badge ${o.status}">${o.status}</span></div>
      <small>${fdate(o.createdAt)}</small><p>${o.items.map(i => `${esc(i.name)} × ${i.quantity}`).join(", ")}</p><b>${money(o.totalAmount)}</b></div>`).join("")
      : '<p class="msg">No orders yet.</p>';
  } catch (err) { box.innerHTML = '<p class="msg err">Could not load your orders.</p>'; console.error(err); }
}

// ===================== Admin =====================
let adminMenu = [], adminOrders = [];

function initAdmin() {
  if (!currentUser || currentRole !== "admin") {      // UI check only; Firestore rules are the real protection
    toast("Admin access only. Please login as admin.", "err");
    return setTimeout(() => (location.href = "login.html"), 1500);
  }
  $("adminApp").hidden = false;
  loadAdminData();
}

async function loadAdminData() {
  try {
    const [m, o] = await Promise.all([getDocs(collection(db, "menu")), getDocs(collection(db, "orders"))]);
    adminMenu = m.docs.map(d => ({ id: d.id, ...d.data() }));
    adminOrders = o.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderStats(); renderAdminMenu(); renderAdminOrders();
  } catch (err) { console.error(err); toast(friendly(err), "err"); }
}

document.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(t => (t.hidden = t.id !== "tab-" + b.dataset.tab));
  document.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("active", x === b));
}));

function renderStats() {
  const done = adminOrders.filter(o => o.status === "Completed");
  $("statMenu").textContent = adminMenu.length;
  $("statOrders").textContent = adminOrders.length;
  $("statPending").textContent = adminOrders.filter(o => o.status === "Pending").length;
  $("statDone").textContent = done.length;
  $("statSales").textContent = money(done.reduce((s, o) => s + o.totalAmount, 0));   // sales = completed orders
}

// ----- Menu CRUD -----
function renderAdminMenu() {
  $("menuBody").innerHTML = adminMenu.length ? adminMenu.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.category)}</td><td>${money(m.price)}</td>
    <td>${m.available ? "Yes" : "No"}</td><td><button class="btn small" data-edit="${m.id}">Edit</button> <button class="btn small outline" data-del="${m.id}">Delete</button></td></tr>`).join("")
    : '<tr><td colspan="5">No menu items yet. Click "Load sample menu" or "Add Item".</td></tr>';
}
function openMenuForm(m = {}) {
  $("menuForm").reset();
  $("mId").value = m.id || ""; $("mName").value = m.name || ""; $("mCategory").value = m.category || "Starters";
  $("mDesc").value = m.description || ""; $("mPrice").value = m.price ?? ""; $("mImage").value = m.imageUrl || "";
  $("mAvail").checked = m.available !== false;
  $("menuDialogTitle").textContent = m.id ? "Edit Item" : "Add Item";
  $("menuDialog").showModal();
}
$("addMenuBtn")?.addEventListener("click", () => openMenuForm());

$("menuForm")?.addEventListener("submit", async e => {          // CREATE or UPDATE
  e.preventDefault();
  const id = $("mId").value;
  const data = { name: $("mName").value.trim(), category: $("mCategory").value, description: $("mDesc").value.trim(),
    price: Number($("mPrice").value), imageUrl: $("mImage").value.trim(), available: $("mAvail").checked };
  if (!(data.price > 0)) return toast("Enter a valid price.", "err");
  try {
    if (id) await updateDoc(doc(db, "menu", id), data);
    else await addDoc(collection(db, "menu"), { ...data, createdAt: serverTimestamp() });
    $("menuDialog").close(); toast("Menu item saved."); loadAdminData();
  } catch (err) { toast(friendly(err), "err"); }
});

$("menuBody")?.addEventListener("click", async e => {
  const edit = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
  if (edit) openMenuForm(adminMenu.find(m => m.id === edit.dataset.edit));
  if (del && confirm("Delete this menu item permanently?")) {      // DELETE
    try { await deleteDoc(doc(db, "menu", del.dataset.del)); toast("Item deleted."); loadAdminData(); }
    catch (err) { toast(friendly(err), "err"); }
  }
});

// Sample data is used ONLY by this one-click seeding button; the website always reads from Firestore.
const SAMPLE_MENU = [
  ["Veg Manchurian", "Starters", 160, "Crispy vegetable balls in a tangy Indo-Chinese sauce."],
  ["Paneer Tikka", "Starters", 200, "Smoky tandoor-grilled paneer cubes with spices."],
  ["Veg Spring Rolls", "Starters", 140, "Crunchy rolls stuffed with seasoned vegetables."],
  ["Paneer Butter Masala", "Main Course", 220, "Soft paneer cooked in rich creamy tomato gravy."],
  ["Dal Makhani", "Main Course", 190, "Slow-cooked black lentils finished with butter and cream."],
  ["Masala Dosa", "Main Course", 120, "Crisp rice crepe filled with spiced potato."],
  ["Veg Biryani", "Rice", 180, "Fragrant basmati rice layered with vegetables and spices."],
  ["Jeera Rice", "Rice", 110, "Basmati rice tempered with cumin."],
  ["Butter Naan", "Breads", 50, "Soft tandoori bread brushed with butter."],
  ["Garlic Naan", "Breads", 60, "Naan topped with garlic and coriander."],
  ["Tandoori Roti", "Breads", 30, "Whole wheat bread baked in the tandoor."],
  ["Cold Coffee", "Beverages", 90, "Chilled, creamy coffee."],
  ["Masala Chai", "Beverages", 40, "Spiced Indian tea with milk."],
  ["Fresh Lime Soda", "Beverages", 70, "Refreshing lime soda, sweet or salted."]
];
$("seedBtn")?.addEventListener("click", async () => {
  if (adminMenu.length && !confirm("Menu already has items. Add the 14 sample items anyway?")) return;
  try {
    const batch = writeBatch(db);
    SAMPLE_MENU.forEach(([name, category, price, description]) =>
      batch.set(doc(collection(db, "menu")), { name, category, description, price, imageUrl: "", available: true, createdAt: serverTimestamp() }));
    await batch.commit(); toast("Sample menu added."); loadAdminData();
  } catch (err) { toast(friendly(err), "err"); }
});

// ----- Order management -----
function renderAdminOrders() {
  $("ordersBody").innerHTML = adminOrders.length ? adminOrders.map(o => `<tr><td>${shortId(o.id)}</td><td>${esc(o.customerName)}</td><td>${esc(o.customerPhone)}</td>
    <td>${money(o.totalAmount)}</td><td>${fdate(o.createdAt)}</td>
    <td><select data-status="${o.id}">${STATUSES.map(s => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select></td>
    <td><button class="btn small" data-view="${o.id}">View</button></td></tr>`).join("") : '<tr><td colspan="7">No orders yet.</td></tr>';
}
$("ordersBody")?.addEventListener("change", async e => {
  const sel = e.target.closest("[data-status]"); if (!sel) return;
  try {
    await updateDoc(doc(db, "orders", sel.dataset.status), { status: sel.value });
    adminOrders.find(o => o.id === sel.dataset.status).status = sel.value;
    renderStats(); toast("Status updated.");
  } catch (err) { toast(friendly(err), "err"); renderAdminOrders(); }
});
$("ordersBody")?.addEventListener("click", e => {
  const b = e.target.closest("[data-view]"); if (!b) return;
  const o = adminOrders.find(x => x.id === b.dataset.view);
  $("orderDetails").innerHTML = `<h3>Order ${shortId(o.id)}</h3><p><b>${esc(o.customerName)}</b> · ${esc(o.customerPhone)}</p>
    <p>Date: ${fdate(o.createdAt)}<br>Status: <span class="badge ${o.status}">${o.status}</span>${o.notes ? `<br>Notes: ${esc(o.notes)}` : ""}</p>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>${o.items.map(i => `<tr><td>${esc(i.name)}</td><td>${i.quantity}</td><td>${money(i.price)}</td></tr>`).join("")}</tbody></table>
    <p class="total"><b>Total: ${money(o.totalAmount)}</b></p>`;
  $("orderDialog").showModal();
});

// ===================== Start =====================
updateCartCount();
if (page === "menu") loadMenu();
