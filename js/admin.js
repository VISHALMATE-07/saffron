// ADMIN DASHBOARD: statistics, menu CRUD, order management.
//
// Access control:
//   1. Not logged in            -> sent to login.html
//   2. Logged in, role != admin -> "Access denied"
//   3. role == admin            -> dashboard is shown
// IMPORTANT: this check only controls what the page SHOWS. The real
// protection is the Firestore Security Rules (they refuse non-admin writes).
import { db } from "./firebase-config.js";
import { watchAuth, logoutUser } from "./auth.js";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
  query, orderBy, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast, escapeHtml, formatPrice, formatDate, shortId, STATUSES } from "./utils.js";

let menuItems = [];     // all menu documents (including unavailable ones)
let orders = [];        // all order documents, newest first
let editingId = null;   // menu document id being edited (null = adding new)
let started = false;

const $ = id => document.getElementById(id);

// ---------- sample data (used ONLY by the "Add Sample Menu Items" button) ----------
// The website never displays this list directly; it is written to Firestore first.
const SAMPLE_MENU = [
  ["Veg Manchurian", "Starters", 160, "Crispy vegetable balls tossed in a spicy Indo-Chinese sauce."],
  ["Paneer Tikka", "Starters", 200, "Marinated paneer cubes grilled in the tandoor."],
  ["Veg Spring Rolls", "Starters", 140, "Crunchy rolls stuffed with fresh vegetables."],
  ["Paneer Butter Masala", "Main Course", 220, "Soft paneer cooked in rich creamy tomato gravy."],
  ["Dal Makhani", "Main Course", 190, "Black lentils slow-cooked overnight with butter and cream."],
  ["Masala Dosa", "Main Course", 120, "Golden crisp dosa filled with spiced potato, with chutneys."],
  ["Veg Biryani", "Rice", 180, "Fragrant basmati rice cooked with vegetables and saffron."],
  ["Jeera Rice", "Rice", 110, "Basmati rice tempered with cumin seeds."],
  ["Butter Naan", "Breads", 50, "Soft tandoori bread brushed with butter."],
  ["Garlic Naan", "Breads", 60, "Naan topped with garlic and coriander."],
  ["Tandoori Roti", "Breads", 30, "Whole wheat bread baked in the tandoor."],
  ["Cold Coffee", "Beverages", 90, "Chilled creamy coffee shake."],
  ["Masala Chai", "Beverages", 40, "Hot Indian tea with ginger and spices."],
  ["Fresh Lime Soda", "Beverages", 70, "Refreshing lime soda, sweet or salted."],
  ["Gulab Jamun", "Desserts", 80, "Soft milk dumplings in warm sugar syrup."],
  ["Chocolate Brownie", "Desserts", 120, "Warm fudgy brownie with chocolate sauce."]
];

// ---------- access check ----------
watchAuth((user, profile) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  if (!profile || profile.role !== "admin") {
    $("adminDenied").classList.remove("hidden");
    $("adminApp").classList.add("hidden");
    return;
  }
  $("adminDenied").classList.add("hidden");
  $("adminApp").classList.remove("hidden");
  if (!started) {
    started = true;
    startAdmin();
  }
});

function startAdmin() {
  // Sidebar
  document.querySelectorAll("[data-section]").forEach(button =>
    button.addEventListener("click", () => showSection(button.dataset.section)));
  $("logoutBtn").addEventListener("click", async () => {
    await logoutUser();
    window.location.href = "login.html";
  });

  // Menu management
  $("addMenuBtn").addEventListener("click", () => openMenuModal(null));
  $("seedBtn").addEventListener("click", addSampleMenu);
  $("menuForm").addEventListener("submit", saveMenuItem);
  $("cancelMenuBtn").addEventListener("click", closeMenuModal);
  $("menuTableBody").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit]");
    const del = event.target.closest("[data-delete]");
    if (edit) openMenuModal(menuItems.find(i => i.id === edit.dataset.edit));
    if (del) deleteMenuItem(del.dataset.delete);
  });

  // Orders
  $("ordersTableBody").addEventListener("change", event => {
    const select = event.target.closest("select[data-order]");
    if (select) updateOrderStatus(select.dataset.order, select.value);
  });
  $("ordersTableBody").addEventListener("click", event => {
    const view = event.target.closest("[data-view]");
    if (view) openOrderModal(orders.find(o => o.id === view.dataset.view));
  });
  $("closeOrderBtn").addEventListener("click", () => $("orderModal").classList.add("hidden"));
  $("refreshBtn").addEventListener("click", loadData);

  loadData();
}

function showSection(name) {
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("hidden", p.id !== "panel-" + name));
  document.querySelectorAll("[data-section]").forEach(b => b.classList.toggle("active", b.dataset.section === name));
}

// ---------- READ: load menu + orders from Firestore ----------
async function loadData() {
  try {
    const [menuSnap, orderSnap] = await Promise.all([
      getDocs(collection(db, "menu")),
      getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")))
    ]);
    menuItems = menuSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    menuItems.sort((a, b) => String(a.category).localeCompare(String(b.category)) ||
                              String(a.name).localeCompare(String(b.name)));
    orders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStats();
    renderMenuTable();
    renderOrdersTable();
  } catch (error) {
    console.error(error);
    showToast("Could not load data. Check Firestore rules and your admin role.", "error");
  }
}

function renderStats() {
  const countStatus = s => orders.filter(o => o.status === s).length;
  // Total sales = all orders except cancelled ones
  const sales = orders.filter(o => o.status !== "Cancelled")
                      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  $("statMenu").textContent = menuItems.length;
  $("statOrders").textContent = orders.length;
  $("statPending").textContent = countStatus("Pending");
  $("statCompleted").textContent = countStatus("Completed");
  $("statSales").textContent = formatPrice(sales);
}

// ---------- MENU: render ----------
function renderMenuTable() {
  const body = $("menuTableBody");
  if (menuItems.length === 0) {
    body.innerHTML = '<tr><td colspan="5" class="muted">No menu items yet. Click "Add Sample Menu Items" or "Add Menu Item".</td></tr>';
    return;
  }
  body.innerHTML = menuItems.map(item => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td>${formatPrice(item.price)}</td>
      <td>${item.available ? "Yes" : "<span class='error-text'>No</span>"}</td>
      <td class="actions">
        <button class="btn btn-small btn-outline" data-edit="${escapeHtml(item.id)}">Edit</button>
        <button class="btn btn-small btn-danger" data-delete="${escapeHtml(item.id)}">Delete</button>
      </td>
    </tr>`).join("");
}

// ---------- MENU: create / update ----------
function openMenuModal(item) {
  editingId = item ? item.id : null;
  $("menuModalTitle").textContent = item ? "Edit Menu Item" : "Add Menu Item";
  $("mName").value = item ? item.name : "";
  $("mCategory").value = item ? item.category : "Starters";
  $("mDescription").value = item ? (item.description || "") : "";
  $("mPrice").value = item ? item.price : "";
  $("mImage").value = item ? (item.imageUrl || "") : "";
  $("mAvailable").checked = item ? !!item.available : true;
  $("menuModal").classList.remove("hidden");
}

function closeMenuModal() {
  $("menuModal").classList.add("hidden");
  editingId = null;
}

async function saveMenuItem(event) {
  event.preventDefault();
  const data = {
    name: $("mName").value.trim(),
    category: $("mCategory").value,
    description: $("mDescription").value.trim(),
    price: Number($("mPrice").value),
    imageUrl: $("mImage").value.trim(),
    available: $("mAvailable").checked
  };
  if (data.name.length < 2) { showToast("Please enter the item name.", "error"); return; }
  if (!(data.price > 0)) { showToast("Price must be greater than 0.", "error"); return; }

  try {
    if (editingId) {
      await updateDoc(doc(db, "menu", editingId), data);                       // UPDATE
      showToast("Menu item updated", "success");
    } else {
      await addDoc(collection(db, "menu"), { ...data, createdAt: serverTimestamp() });   // CREATE
      showToast("Menu item added", "success");
    }
    closeMenuModal();
    loadData();
  } catch (error) {
    console.error(error);
    showToast("Could not save the menu item.", "error");
  }
}

// ---------- MENU: delete ----------
async function deleteMenuItem(id) {
  const item = menuItems.find(i => i.id === id);
  if (!item || !confirm('Delete "' + item.name + '" permanently?')) return;
  try {
    await deleteDoc(doc(db, "menu", id));                                       // DELETE
    showToast("Menu item deleted", "success");
    loadData();
  } catch (error) {
    console.error(error);
    showToast("Could not delete the menu item.", "error");
  }
}

// ---------- MENU: sample data ----------
async function addSampleMenu() {
  if (menuItems.length > 0 &&
      !confirm("The menu already has " + menuItems.length + " items. Adding samples will create duplicates. Continue?")) {
    return;
  }
  try {
    const batch = writeBatch(db);          // saves all documents together
    SAMPLE_MENU.forEach(([name, category, price, description]) => {
      batch.set(doc(collection(db, "menu")), {
        name, category, price, description,
        imageUrl: "", available: true, createdAt: serverTimestamp()
      });
    });
    await batch.commit();
    showToast("Sample menu added", "success");
    loadData();
  } catch (error) {
    console.error(error);
    showToast("Could not add sample data. Check Firestore rules.", "error");
  }
}

// ---------- ORDERS ----------
function renderOrdersTable() {
  const body = $("ordersTableBody");
  if (orders.length === 0) {
    body.innerHTML = '<tr><td colspan="7" class="muted">No orders yet.</td></tr>';
    return;
  }
  body.innerHTML = orders.map(order => `
    <tr>
      <td><strong>${shortId(order.id)}</strong></td>
      <td>${escapeHtml(order.customerName)}</td>
      <td>${escapeHtml(order.customerPhone)}</td>
      <td>${formatPrice(order.totalAmount)}</td>
      <td>${formatDate(order.createdAt)}</td>
      <td>
        <select class="status-select status-${escapeHtml(order.status)}" data-order="${escapeHtml(order.id)}">
          ${STATUSES.map(s => `<option ${s === order.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
      <td><button class="btn btn-small btn-outline" data-view="${escapeHtml(order.id)}">View</button></td>
    </tr>`).join("");
}

// UPDATE only the status field of an order
async function updateOrderStatus(id, status) {
  try {
    await updateDoc(doc(db, "orders", id), { status: status });
    const order = orders.find(o => o.id === id);
    if (order) order.status = status;
    showToast("Order " + shortId(id) + " is now " + status, "success");
    renderStats();
    renderOrdersTable();
  } catch (error) {
    console.error(error);
    showToast("Could not update the status.", "error");
    loadData();
  }
}

function openOrderModal(order) {
  if (!order) return;
  $("orderDetails").innerHTML = `
    <p><strong>Order:</strong> ${shortId(order.id)} <span class="muted">(${escapeHtml(order.id)})</span></p>
    <p><strong>Customer:</strong> ${escapeHtml(order.customerName)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(order.customerPhone)}</p>
    <p><strong>Date:</strong> ${formatDate(order.createdAt)}</p>
    <p><strong>Status:</strong> <span class="status status-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span></p>
    ${order.notes ? `<p><strong>Instructions:</strong> ${escapeHtml(order.notes)}</p>` : ""}
    <div class="table-wrap"><table>
      <thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Subtotal</th></tr></thead>
      <tbody>${order.items.map(i => `
        <tr><td>${escapeHtml(i.name)}</td><td>${formatPrice(i.price)}</td>
        <td>${i.quantity}</td><td>${formatPrice(i.price * i.quantity)}</td></tr>`).join("")}
      </tbody>
    </table></div>
    <p class="total-row">Total: <strong>${formatPrice(order.totalAmount)}</strong></p>`;
  $("orderModal").classList.remove("hidden");
}
