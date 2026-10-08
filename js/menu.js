// MENU PAGE: reads the menu from Firestore, filters by category, adds to cart.
import "./auth.js";   // fills the navbar on this page
import { db } from "./firebase-config.js";
import { collection, getDocs, query, where }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { addToCart } from "./cart.js";
import { showToast, escapeHtml, formatPrice, CATEGORIES, CATEGORY_EMOJI } from "./utils.js";

let allItems = [];            // menu items loaded from Firestore
let activeCategory = "All";

const grid = document.getElementById("menuGrid");
const statusBox = document.getElementById("menuStatus");

// Read the "menu" collection.
// We ask only for available == true, because the Firestore rules will allow
// the public to read ONLY available items (a query must match the rules).
async function loadMenu() {
  statusBox.textContent = "Loading menu...";
  grid.innerHTML = "";
  try {
    const q = query(collection(db, "menu"), where("available", "==", true));
    const snapshot = await getDocs(q);
    allItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Sort: by category order, then by name (done here to avoid a Firestore index)
    allItems.sort((a, b) =>
      CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) ||
      String(a.name).localeCompare(String(b.name)));

    statusBox.textContent = "";
    renderMenu();
  } catch (error) {
    console.error(error);
    statusBox.innerHTML = 'Could not load the menu. Check your Firebase setup and internet. ' +
      '<button class="btn btn-small" id="retryBtn">Try again</button>';
    document.getElementById("retryBtn").addEventListener("click", loadMenu);
  }
}

function renderMenu() {
  const items = allItems.filter(i => activeCategory === "All" || i.category === activeCategory);

  if (allItems.length === 0) {
    statusBox.textContent = "No menu items found. (Admin: login and use \"Add Sample Menu Items\" in Menu Management.)";
    grid.innerHTML = "";
    return;
  }
  if (items.length === 0) {
    statusBox.textContent = "No items in this category yet.";
    grid.innerHTML = "";
    return;
  }
  statusBox.textContent = "";

  grid.innerHTML = items.map(item => {
    const emoji = CATEGORY_EMOJI[item.category] || "🍽️";
    const hasImage = /^https?:\/\//i.test(item.imageUrl || "");
    const picture = hasImage
      ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy" data-emoji="${emoji}">`
      : `<span>${emoji}</span>`;
    return `
      <article class="card food-card">
        <div class="food-img">${picture}</div>
        <div class="food-body">
          <span class="tag">${escapeHtml(item.category)}</span>
          <h3>${escapeHtml(item.name)}</h3>
          <p class="muted">${escapeHtml(item.description || "")}</p>
          <div class="food-foot">
            <span class="price">${formatPrice(item.price)}</span>
            <button class="btn btn-small" data-add="${escapeHtml(item.id)}">Add to Cart</button>
          </div>
        </div>
      </article>`;
  }).join("");

  // If an image URL is broken, show the emoji instead.
  grid.querySelectorAll("img[data-emoji]").forEach(img => {
    img.addEventListener("error", () => {
      img.parentElement.innerHTML = `<span>${img.dataset.emoji}</span>`;
    });
  });
}

// Category buttons
document.getElementById("categoryBar").addEventListener("click", event => {
  const chip = event.target.closest("button[data-category]");
  if (!chip) return;
  activeCategory = chip.dataset.category;
  document.querySelectorAll("#categoryBar .chip").forEach(c =>
    c.classList.toggle("active", c === chip));
  renderMenu();
});

// "Add to Cart" buttons
grid.addEventListener("click", event => {
  const button = event.target.closest("button[data-add]");
  if (!button) return;
  const item = allItems.find(i => i.id === button.dataset.add);
  if (!item) return;
  addToCart({ id: item.id, name: item.name, price: item.price });
  showToast(item.name + " added to cart", "success");
});

loadMenu();
