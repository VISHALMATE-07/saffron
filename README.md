# SAFFRON – Restaurant Management System

HTML + CSS + vanilla JavaScript, with **Firebase Authentication** and **Cloud Firestore**.
No Node.js, no backend server, no build step.

## Architecture

```
HTML / CSS / JavaScript (browser)
        |
Firebase Web SDK (modular, loaded from Google's CDN)
        |
Firebase Authentication  (who are you?)   +   Firestore  (data + role)
```

## Folder structure

```
SAFFRON-FB/
├── index.html      Home (hero, specialities, about, why us, contact)
├── menu.html       Menu from Firestore + categories + Add to Cart
├── cart.html       Cart, checkout, order confirmation, "My Orders"
├── login.html      Login + forgot password
├── register.html   Customer registration
├── admin.html      Admin dashboard (stats, menu CRUD, orders)
├── css/style.css
├── js/
│   ├── firebase-config.js   <-- PASTE YOUR FIREBASE CONFIG HERE
│   ├── auth.js      navbar, register, login, logout, role lookup
│   ├── menu.js      load menu, category filter, add to cart
│   ├── cart.js      cart in localStorage (add/remove/+/-/total)
│   ├── checkout.js  place order, order history
│   ├── admin.js     dashboard, menu CRUD, order status
│   └── utils.js     toast, formatting, validation helpers
├── assets/images/
├── firestore.rules  PLACEHOLDER (you write the real rules)
└── README.md
```

## Firestore structure (3 collections)

```
users/{uid}        uid, name, email, phone, role ("customer" | "admin"), createdAt
menu/{autoId}      name, category, description, price (number), imageUrl, available (bool), createdAt
orders/{autoId}    orderId, customerId (uid or null for guest), customerName, customerPhone,
                   notes, items [ {menuId, name, price, quantity} ], totalAmount,
                   status, createdAt
```
Order `status` values: Pending, Confirmed, Preparing, Ready, Completed, Cancelled.

## Firebase setup (one time)

1. Go to https://console.firebase.google.com and click **Add project** (Analytics not needed).
2. **Authentication > Get started > Sign-in method > Email/Password > Enable > Save.**
3. **Firestore Database > Create database.** Choose a location near you.
   For your very first test you may pick **test mode**; replace it with real rules before you finish (see below).
4. **Project settings (gear) > General > Your apps > Web (`</>`)**. Register the app, then copy the `firebaseConfig` values.
5. Open `js/firebase-config.js` and replace every `PASTE_...` value.
6. Never create or download a service-account / Admin SDK JSON file for this project.

## Run locally (Windows, VS Code)

The site uses JavaScript modules, which do **not** work if you double-click the HTML file. Use a tiny local server:

1. Install the VS Code extension **Live Server** (by Ritwick Dey).
2. Open the `SAFFRON-FB` folder in VS Code.
3. Right-click `index.html` > **Open with Live Server**. The site opens at `http://127.0.0.1:5500`.

`localhost` / `127.0.0.1` are already allowed by Firebase Authentication.

## Create the first admin

1. Open the site, go to **Register**, and create a normal account.
2. Firebase Console > **Firestore Database > users >** click your user document.
3. Change the field `role` from `customer` to `admin` and save.
4. Log out and log in again at `login.html`. You are sent to `admin.html`.

Admin is never chosen on the registration form. The console edit is the only way, and the rules must keep it that way.

## Add sample menu items

Log in as admin > **Menu Management > Add Sample Menu Items**. It writes 16 documents (all 6 categories) into Firestore. Run it only once, otherwise you get duplicates. You can also add, edit and delete items with the other buttons.

## Test customer ordering

1. Open `menu.html`: items load from Firestore. Try the category buttons.
2. Click **Add to Cart** on a few items. The navbar count changes. Refresh the page: the cart is still there.
3. Open `cart.html`: use + / − / ✕, check the total.
4. Enter name and a 10-digit phone, press **PLACE ORDER**. You see the order id. The cart is cleared.
5. Check Firestore Console > `orders`: a new document exists.
6. Register or log in as a customer, order again: **My Orders** appears at the bottom of `cart.html`.

## Test the admin dashboard

1. Log in as admin. The Dashboard shows the statistics.
2. **Orders:** change a status in the dropdown (Pending > Preparing > Completed); click **View** for details.
3. **Menu Management:** add, edit, delete (with confirmation) and untick **Available**. The item disappears from `menu.html`.
4. Log in as a normal customer and open `admin.html`: you see "Access denied".

---

## FIRESTORE SECURITY RULE REQUIREMENTS

Write `firestore.rules` yourself after reviewing this table against the code. These are the exact operations the app performs.

**Helper ideas:** `isSignedIn()`, `isAdmin()` = signed in AND `get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'`.

### users/{uid}
| Who | Operation | Requirement |
|---|---|---|
| Signed-in user | **create** own doc (register.html, `setDoc`) | `request.auth.uid == uid`, and `role == 'customer'`, and `uid` field equals the auth uid. Only the fields uid, name, email, phone, role, createdAt. |
| Signed-in user | **read** own doc (every page, `getDoc`) | `request.auth.uid == uid` |
| Admin | read any user | optional |
| Anyone | **update** `role` | **never allowed.** Users must not change their own role. Easiest: no client updates at all. |
| Anyone | delete | not needed, deny |

### menu/{itemId}
| Who | Operation | Requirement |
|---|---|---|
| Anyone (even logged out) | **list/get** | only docs where `available == true`. menu.js queries `where("available","==",true)`; checkout.js reads single docs. |
| Admin | **read all** | including unavailable (admin.js reads the whole collection) |
| Admin | **create / update / delete** | `isAdmin()` (add item, edit item, delete item, sample-data batch) |
| Everyone else | write | deny |

### orders/{orderId}
| Who | Operation | Requirement |
|---|---|---|
| Customer or guest | **create** (`setDoc` in checkout.js) | `customerId == request.auth.uid` when signed in, `customerId == null` for guests (never someone else's uid). `status == 'Pending'`. `totalAmount` is a number > 0. `items` is a non-empty list. `customerName` 2-50 chars, `customerPhone` 10 digits, `createdAt == request.time`. |
| Customer | **read / list** own orders (`where("customerId","==",uid)`) | `resource.data.customerId == request.auth.uid` |
| Admin | **read / list** all (ordered by createdAt) | `isAdmin()` |
| Admin | **update** | only the `status` field, and only to one of the 6 allowed values (`request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status'])`) |
| Customer | update / delete | **deny** (customers cannot change status) |
| Unauthenticated user | read orders, users, any admin data | **deny** |

### Things the rules cannot do alone
- Rules can check the shape of an order, but not that `totalAmount` equals the real price sum. checkout.js re-reads prices from Firestore before saving, but a determined user can still edit browser JavaScript. A production system would validate totals in a trusted backend (Cloud Function). This is out of scope for the mini-project, so mention it in your viva.
- Guest orders cannot be read back by guests (no login). That keeps other people's phone numbers private.
- No composite indexes are needed: all queries use one filter and sort in JavaScript, except admin's single-field `orderBy("createdAt")`.

---

## Viva cheat-sheet (short answers)

1. **What is SAFFRON?** A restaurant website where customers order food online and the admin manages the menu and orders.
2. **Why Firebase?** Ready-made login and a cloud database, so no server is needed. The frontend talks to it directly.
3. **What is Firestore?** A NoSQL cloud database that stores data as documents inside collections.
4. **What is Firebase Authentication?** A service that handles registration, login, logout and password reset securely.
5. **What is CRUD?** Create, Read, Update, Delete. Example: the admin adds, views, edits and deletes menu items.
6. **Collection?** A group of documents, like a table (`menu`, `orders`, `users`).
7. **Document?** One record, like a row: a set of fields with a unique id.
8. **How does login work?** Firebase checks email and password, then we read `users/{uid}` to get the role and open the right page.
9. **Admin vs customer?** The `role` field in `users/{uid}`. Admin pages check it, and Firestore rules enforce it.
10. **How is an order stored?** One document in `orders` with customer details, an `items` array, total, status and time.
11. **How does the cart work?** It is stored in the browser's localStorage and only saved to Firestore when the order is placed.
12. **What are Security Rules?** Rules on the Firebase server that decide who may read or write each document. The browser cannot bypass them.
13. **Why can't users change their role?** Otherwise anyone could make themselves admin and see or change every order.
14. **How does the frontend talk to Firebase?** Through the Firebase Web SDK in JavaScript modules (`getDocs`, `setDoc`, `signInWithEmailAndPassword`).
15. **What happens when an order is placed?** Details are validated, prices are re-read from Firestore, an order document with status Pending is created, the cart is cleared, and the order id is shown.
