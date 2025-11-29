/* =======================================================
   FINAL MASTER script.js — Auth + Reset + Products + Cart + Orders
======================================================= */

/* ========== Supabase Setup ========== */
const SUPABASE_URL = "https://ytxhlihzxgftffaikumr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eGhsaWh6eGdmdGZmYWlrdW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODAxNTgsImV4cCI6MjA3OTQ1NjE1OH0._k5hfgJwVSrbXtlRDt3ZqCYpuU1k-_OqD7M0WML4ehA";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ========== Global Variables ========== */
let products = [];
let cart = JSON.parse(localStorage.getItem("cart") || "[]");
let currentPage = 1;
const itemsPerPage = 6;

/* ========== Helpers ========== */
function qs(id) { return document.getElementById(id); }
function show(el) { el?.classList.remove("hidden"); }
function hide(el) { el?.classList.add("hidden"); }
function toast(msg) { alert(msg); }
function saveCart() { localStorage.setItem("cart", JSON.stringify(cart)); }

/* =====================================================
   INIT
===================================================== */
document.addEventListener("DOMContentLoaded", async () => {

  await checkAuth();
  await handleResetExchange();

  if (qs("productsGrid")) await loadProducts(); // ON HOME PAGE
  updateCartUI();
  await setupProductPage(); // ON PRODUCT PAGE

  setupCartModal();
  setupSearchPagination();
  setupCheckout();
  attachAuthModalHandlers();
});

/* =====================================================
   AUTH — Login, Logout, Signup
===================================================== */
async function checkAuth() {
  const user = (await sb.auth.getUser()).data?.user;

  const userArea = qs("userArea");
  const btnLogin = qs("btnLogin");
  const btnLogout = qs("btnLogout");
  const myOrdersBtn = qs("btnMyOrders");
  const userEmailSpan = qs("userEmail");

  if (user) {
    show(userArea);
    hide(btnLogin);
    show(btnLogout);
    show(myOrdersBtn);
    if (userEmailSpan) userEmailSpan.textContent = user.email;

    btnLogout?.addEventListener("click", async () => {
      await sb.auth.signOut();
      location.reload();
    }, { once: true });

  } else {
    hide(userArea);
    show(btnLogin);
    hide(btnLogout);
    hide(myOrdersBtn);
  }
}

/* =====================================================
   AUTH MODAL
===================================================== */
function attachAuthModalHandlers() {

  qs("btnLogin")?.addEventListener("click", () => openAuthModal("login"));
  qs("btnSignup")?.addEventListener("click", () => openAuthModal("signup"));

  const loginModal = qs("loginModal");
  const authMsg = qs("authMsg");

  qs("switchToSignup")?.addEventListener("click", e => { e.preventDefault(); openAuthModal("signup") });
  qs("switchToLogin")?.addEventListener("click", e => { e.preventDefault(); openAuthModal("login") });
  qs("cancelAuth")?.addEventListener("click", () => hide(loginModal));

  qs("submitAuth")?.addEventListener("click", async () => {
    const mode = loginModal.dataset.mode;
    const email = qs("authEmail").value.trim();
    const password = qs("authPass").value.trim();
    const btn = qs("submitAuth");

    authMsg.textContent = "";
    btn.disabled = true;

    if (!email) return authMsg.textContent = "Enter email";
    if (!password) return authMsg.textContent = "Enter password";

    if (mode === "login") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) authMsg.textContent = error.message;
      else location.reload();
    } else {
      const { error } = await sb.auth.signUp({ email, password });
      if (error) authMsg.textContent = error.message;
      else location.reload();
    }

    btn.disabled = false;
  });

  qs("btnReset")?.addEventListener("click", async () => {
    const email = qs("authEmail").value.trim();
    if (!email) return authMsg.textContent = "Enter email";

    const redirectTo = window.location.origin + "/reset_password.html";

    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    authMsg.textContent =
      error ? error.message : "Reset link sent!";
  });
}

function openAuthModal(mode) {
  const modal = qs("loginModal");
  modal.dataset.mode = mode;

  qs("authTitle").textContent = mode === "login" ? "Login" : "Sign Up";
  qs("submitAuth").textContent = mode === "login" ? "Login" : "Sign Up";

  show(qs("switchToSignup"));
  hide(qs("switchToLogin"));

  if (mode === "signup") {
    hide(qs("switchToSignup"));
    show(qs("switchToLogin"));
  }

  qs("authMsg").textContent = "";
  show(modal);
}

/* =====================================================
   RESET PASSWORD
===================================================== */
async function handleResetExchange() {
  const code = new URLSearchParams(window.location.search).get("code");
  if (!code) return;
  await sb.auth.exchangeCodeForSession(code);
}

/* =====================================================
   PRODUCTS PAGE (HOME)
===================================================== */
async function loadProducts() {
  const { data } = await sb.from("products").select("*");
  products = data || [];
  renderProducts();
}

function renderProducts() {
  const grid = qs("productsGrid");
  if (!grid) return;

  const search = (qs("search")?.value || "").toLowerCase();
  const filtered = products.filter(p =>
    (p.title || "").toLowerCase().includes(search)
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  currentPage = Math.min(currentPage, totalPages);

  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = filtered.slice(start, start + itemsPerPage);

  grid.innerHTML = pageItems.map(p => `
    <div class="bg-white p-4 rounded shadow flex flex-col">
      <img src="${p.image_url || p.image}" class="h-48 w-full object-contain mb-2" />
      <h3 class="font-semibold">${p.title}</h3>
      <p class="text-gray-500">${p.description?.slice(0, 70)}...</p>
      <p class="text-xl font-bold mt-2">$${p.price}</p>
      <a href="product.html?id=${p.id}" class="mt-auto px-4 py-2 bg-indigo-600 text-white rounded text-center">View</a>
    </div>
  `).join("");

  qs("pageInfo").textContent = `Page ${currentPage} of ${totalPages}`;
}

/* =====================================================
   PRODUCT PAGE (single product)
===================================================== */
async function setupProductPage() {
  if (!qs("addToCart")) return;

  const id = Number(new URLSearchParams(window.location.search).get("id"));
  if (!id) return;

  const { data: product } = await sb.from("products").select("*").eq("id", id).maybeSingle();
  if (!product) return;

  qs("productTitle").textContent = product.title;
  qs("productDesc").textContent = product.description;
  qs("productPrice").textContent = "$" + product.price;

  qs("mainProductImage").src = product.image_url || product.image;

  qs("addToCart").onclick = () => {
    const qty = Number(qs("quantity").value) || 1;

    const item = cart.find(i => i.id === id);
    if (item) item.qty += qty;
    else cart.push({ id, title: product.title, price: product.price, qty });

    saveCart();
    updateCartUI();
    toast("Added to cart!");
  };
}

/* =====================================================
   CART MODAL
===================================================== */
function setupCartModal() {
  qs("btnCart")?.addEventListener("click", () => show(qs("cartModal")));
  qs("closeCart")?.addEventListener("click", () => hide(qs("cartModal")));

  qs("clearCart")?.addEventListener("click", () => {
    cart = [];
    saveCart();
    updateCartUI();
  });
}

function updateCartUI() {
  const cartItems = qs("cartItems");
  const cartCount = qs("cartCount");
  const cartTotal = qs("cartTotal");

  if (cartCount) cartCount.textContent = cart.length;
  if (!cartItems || !cartTotal) return;

  cartItems.innerHTML = "";
  let total = 0;

  cart.forEach((item, i) => {
    total += item.price * item.qty;

    cartItems.innerHTML += `
      <div class="flex justify-between border-b pb-2">
        <div>
          <p class="font-semibold">${item.title}</p>
          <p>$${item.price} × ${item.qty}</p>
        </div>
        <div class="flex gap-2">
          <button class="decrease" data-i="${i}">-</button>
          <button class="increase" data-i="${i}">+</button>
          <button class="remove" data-i="${i}">Remove</button>
        </div>
      </div>
    `;
  });

  cartTotal.textContent = "$" + total;

  cartItems.querySelectorAll(".remove").forEach(b => {
    b.onclick = () => { cart.splice(b.dataset.i, 1); saveCart(); updateCartUI(); }
  });

  cartItems.querySelectorAll(".increase").forEach(b => {
    b.onclick = () => { cart[b.dataset.i].qty++; saveCart(); updateCartUI(); }
  });

  cartItems.querySelectorAll(".decrease").forEach(b => {
    b.onclick = () => {
      cart[b.dataset.i].qty = Math.max(1, cart[b.dataset.i].qty - 1);
      saveCart();
      updateCartUI();
    }
  });
}

/* =====================================================
   CHECKOUT → Create Order
===================================================== */
function setupCheckout() {

  qs("checkout")?.addEventListener("click", async () => {
    const user = (await sb.auth.getUser()).data?.user;
    if (!user) return toast("Please login first");
    if (!cart.length) return toast("Cart is empty");

    const order = {
      user_id: user.id,
      items: cart,
      total: cart.reduce((a, b) => a + (b.price * b.qty), 0),
      status: "completed",
      created_at: new Date().toISOString()
    };

    const { error } = await sb.from("orders").insert([order]);
    if (error) return toast("Order error: " + error.message);

    toast("Order placed!");
    cart = []; saveCart(); updateCartUI();
    hide(qs("cartModal"));
  });
}

/* =====================================================
   SEARCH + PAGINATION
===================================================== */
function setupSearchPagination() {
  qs("search")?.addEventListener("input", () => { currentPage = 1; renderProducts(); });
  qs("prevPage")?.addEventListener("click", () => { if (currentPage > 1) { currentPage--; renderProducts(); } });
  qs("nextPage")?.addEventListener("click", () => { currentPage++; renderProducts(); });
}
