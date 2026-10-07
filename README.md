# SAFFRON – Restaurant Management System

A restaurant website with online ordering and an admin dashboard.
Built with HTML, CSS, vanilla JavaScript and Firebase (Authentication + Firestore). No backend server.

## Features
- **Customer:** browse menu (live from Firestore), filter by category, cart (localStorage), checkout, register/login, order history (on the Cart page)
- **Admin:** login, dashboard stats, menu add/edit/delete, view orders, order details, change order status

## Technologies
HTML · CSS · JavaScript (ES modules) · Firebase Web SDK v10 (loaded from CDN) · Firebase Auth · Cloud Firestore

## Folder structure
```
SAFFRON/
├── index.html  menu.html  cart.html  login.html  register.html  admin.html
├── css/style.css
├── js/firebase-config.js   <- paste your Firebase config here
├── js/script.js            <- all logic, in labelled sections
├── firestore.rules
└── README.md
```

## Setup (do in order)
1. **Create project:** https://console.firebase.google.com → Add project (Analytics not needed).
2. **Enable login:** Build → Authentication → Get started → Sign-in method → **Email/Password** → Enable.
3. **Create Firestore:** Build → Firestore Database → Create database → choose a region → start in **production mode**.
4. **Add config:** Project settings (gear) → Your apps → Web `</>` → register app → copy `firebaseConfig`.
   Open `js/firebase-config.js` and replace the `YOUR_...` placeholders. Never use a service-account/Admin SDK key.
5. **Apply rules:** Firestore → Rules tab → paste the contents of `firestore.rules` → Publish.
6. **Run locally:** the project uses JS modules, so it will NOT work by double-clicking the HTML file.
   In VS Code install the **Live Server** extension → right-click `index.html` → Open with Live Server (`http://127.0.0.1:5500`).
7. **Create the admin account:** open `register.html` and register normally → Firestore console → `users` → click your document → change field `role` from `customer` to `admin`.
   (Nobody can do this from the website; the rules block it.)
8. **Add initial menu data:** login with the admin account → you land on admin.html → Menu Management → **Load sample menu** (14 items).

## Test customer workflow
1. Register a second account (different email) → menu.html shows items → try category buttons.
2. Add items, change quantity on cart.html, refresh (cart stays).
3. Enter name + 10-digit phone → PLACE ORDER → confirmation → order appears under "My Orders".

## Test admin workflow
1. Login as admin → Dashboard shows counts.
2. Menu Management: add, edit, delete an item (delete asks to confirm).
3. Orders: change a status, click View for details; Completed orders count toward Total Sales.
4. Check that a customer account visiting admin.html is sent back to login.

## Firestore structure
- `users/{uid}`: uid, name, email, phone, role (`customer`/`admin`), createdAt
- `menu/{menuId}`: name, category, description, price, imageUrl, available, createdAt
- `orders/{orderId}`: orderId, customerId, customerName, customerPhone, notes, items[{menuId,name,price,quantity}], totalAmount, status, createdAt

## How the rules match the code
| Code (script.js) | Rule |
|---|---|
| Register writes `users/{uid}` with role "customer" | create allowed only for own uid and role == customer |
| `getRole()` reads own user doc | read own doc, or admin |
| Menu page: `where("available","==",true)` | anyone can read available items; only admin reads/writes the rest |
| Admin menu add/edit/delete/seed | admin only |
| Checkout `setDoc` into `orders` | signed in, customerId == own uid, status == Pending, valid fields |
| My Orders: `where("customerId","==",uid)` | customers read only their own orders |
| Admin loads all orders, `updateDoc({status})` | admin only; only the `status` field may change |

Known limit (fine for a college project): the cart prices come from the browser, so a technical user could send a wrong price. A production app would recompute totals on a server (Cloud Functions).

## Viva cheat sheet
- **SAFFRON:** restaurant website with ordering + admin panel.
- **Why Firebase:** ready-made login and database, no server to write or host.
- **Firestore:** cloud NoSQL database. **Collection** = folder of records (`menu`); **document** = one record (one dish) with fields.
- **Firebase Authentication:** handles email/password sign-up, login, password reset and keeps the user logged in.
- **CRUD:** Create, Read, Update, Delete (admin menu management).
- **Login:** `signInWithEmailAndPassword` → read `users/{uid}.role` → admin goes to admin.html, customer to menu.
- **Role-based access:** role is stored in Firestore; the rules call `isAdmin()` to check it on every request.
- **Why users can't become admin:** register always writes `customer`, and the rules reject any other role or later role change.
- **Order storage:** one document in `orders` with customer info, items array, total, status "Pending", timestamp.
- **localStorage cart:** browser stores the cart as JSON, so it survives refresh; only the final order goes to Firestore.
- **Security rules:** server-side rules that allow/deny each read/write. Hiding a button is not security; rules are.
- **JS ↔ Firebase:** `script.js` imports the SDK and calls functions like `getDocs`, `setDoc`, `updateDoc` over the internet.
