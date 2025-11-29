/* =======================================================
   FINAL script.js — Auth + Reset + Products + Cart + Orders + Designs
======================================================= */

/* ========== Supabase Setup ========== */
const SUPABASE_URL = "https://ytxhlihzxgftffaikumr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eGhsaWh6eGdmdGZmYWlrdW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODAxNTgsImV4cCI6MjA3OTQ1NjE1OH0._k5hfgJwVSrbXtlRDt3ZqCYpuU1k-_OqD7M0WML4ehA";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  await checkAuth();
  await handleResetExchange();
  if (qs("productsGrid")) await loadProducts();
  updateCartUI();
  await setupProductPage();
  setupCartModal();
  attachAuthModalHandlers();
  attachPaginationHandlers();
});

/* =======================================================
   CART MODAL
======================================================= */
function setupCartModal() {
  const btnCart = qs("btnCart");
  const cartModal = qs("cartModal");

  if (!btnCart || !cartModal) return;

  btnCart.addEventListener("click", () => show(cartModal));
  qs("closeCart")?.addEventListener("click", () => hide(cartModal));

  qs("clearCart")?.addEventListener("click", () => {
    cart = [];
    saveCart();
    updateCartUI();
  });

  qs("checkout")?.addEventListener("click", async () => {
    const user = (await sb.auth.getUser())?.data?.user;

    if (!user) return toast("Please login first!");
    if (!cart.length) return toast("Cart is empty!");

    const order = {
      user_id: user.id,
      items: cart,
      total: cart.reduce((a, b) => a + b.price * b.qty, 0),
      status: "pending",
      created_at: new Date().toISOString()
    };

    const { error } = await sb.from("orders").insert([order]);
    if (error) return toast("Order error: " + error.message);

    toast("Order placed!");

    cart = [];
    saveCart();
    updateCartUI();
    hide(cartModal);

    window.location.href = "orders.html";
  });
}

/* =======================================================
   AUTH CHECK
======================================================= */
async function checkAuth() {
  const user = (await sb.auth.getUser())?.data?.user;

  const userArea = qs("userArea");
  const btnLogin = qs("btnLogin");
  const btnLogout = qs("btnLogout");
  const myOrdersBtn = qs("btnMyOrders");

  if (user) {
    show(userArea);
    hide(btnLogin);
    show(btnLogout);
    show(myOrdersBtn);

    btnLogout.addEventListener("click", async () => {
      await sb.auth.signOut();
      location.reload();
    });
  } else {
    hide(userArea);
    show(btnLogin);
    hide(btnLogout);
    hide(myOrdersBtn);
  }
}

/* =======================================================
   PASSWORD RESET URL EXCHANGE
======================================================= */
async function handleResetExchange() {
  const code = new URLSearchParams(window.location.search).get("code");
  if (code) await sb.auth.exchangeCodeForSession(code);
}

/* =======================================================
   PRODUCTS LIST + SEARCH + PAGINATION
======================================================= */
async function loadProducts() {
  const { data } = await sb.from("products").select("*");
  products = data || [];
  renderProducts();
}

function renderProducts() {
  const grid = qs("productsGrid");
  if (!grid) return;

  const searchText = (qs("search")?.value || "").toLowerCase();

  const filtered = products.filter(p =>
    (p.title || "").toLowerCase().includes(searchText)
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * itemsPerPage;
  const items = filtered.slice(start, start + itemsPerPage);

  grid.innerHTML = items.map(p => `
    <div class="bg-white p-4 rounded shadow flex flex-col">
      <img src="${p.image_url}" class="h-48 w-full object-contain mb-2" />
      <h3 class="font-semibold">${p.title}</h3>
      <p class="text-gray-500">${p.description?.slice(0, 70)}...</p>
      <p class="text-xl font-bold mt-2">$${p.price}</p>
      <a href="product.html?id=${p.id}" class="mt-auto px-4 py-2 bg-indigo-600 text-white rounded text-center">View</a>
    </div>
  `).join("");

  qs("pageInfo").textContent = `Page ${currentPage} of ${totalPages}`;
}

function attachPaginationHandlers() {
  qs("prevPage")?.addEventListener("click", () => {
    if (currentPage > 1) { currentPage--; renderProducts(); }
  });
  qs("nextPage")?.addEventListener("click", () => {
    currentPage++; renderProducts();
  });
  qs("search")?.addEventListener("input", () => {
    currentPage = 1;
    renderProducts();
  });
}

/* =======================================================
   PRODUCT PAGE
======================================================= */
async function setupProductPage() {
  if (!qs("addToCart")) return;

  const id = Number(new URLSearchParams(location.search).get("id"));
  if (!id) return;

  const { data: product } = await sb.from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (!product) return;

  qs("productTitle").textContent = product.title;
  qs("productDesc").textContent = product.description;
  qs("productPrice").textContent = "$" + product.price;

  const mainImg = qs("mainProductImage");
  const gallery = qs("productImages");

  let images = [];

  try {
    let designImgs = typeof product.design_images === "string"
      ? JSON.parse(product.design_images)
      : product.design_images || [];

    if (product.image_url) images.push(product.image_url);
    if (Array.isArray(designImgs)) images.push(...designImgs);
  } catch {}

  images = [...new Set(images)];

  if (images.length) mainImg.src = images[0];

  gallery.innerHTML = "";
  images.forEach(url => {
    const img = document.createElement("img");
    img.src = url;
    img.className = "w-20 h-20 rounded object-cover cursor-pointer border";
    img.onclick = () => (mainImg.src = url);
    gallery.appendChild(img);
  });

  qs("addToCart").addEventListener("click", () => {
    const qty = Number(qs("quantity").value) || 1;
    const existing = cart.find(i => i.id === id);

    if (existing) existing.qty += qty;
    else cart.push({ id, title: product.title, price: product.price, qty });

    saveCart();
    updateCartUI();
    toast("Added to cart!");
  });
}

/* =======================================================
   CART UI
======================================================= */
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
      <div class="flex justify-between pb-2 border-b mt-2">
        <div>
          <p class="font-semibold">${item.title}</p>
          <p>$${item.price} × ${item.qty}</p>
        </div>
        <div class="flex gap-2">
          <button class="dec" data-i="${i}">-</button>
          <button class="inc" data-i="${i}">+</button>
          <button class="remove" data-i="${i}">Remove</button>
        </div>
      </div>
    `;
  });

  cartTotal.textContent = "$" + total;

  cartItems.querySelectorAll(".remove").forEach(btn => {
    btn.onclick = () => {
      cart.splice(btn.dataset.i, 1);
      saveCart();
      updateCartUI();
    };
  });

  cartItems.querySelectorAll(".inc").forEach(btn => {
    btn.onclick = () => {
      cart[btn.dataset.i].qty++;
      saveCart();
      updateCartUI();
    };
  });

  cartItems.querySelectorAll(".dec").forEach(btn => {
    btn.onclick = () => {
      if (cart[btn.dataset.i].qty > 1) cart[btn.dataset.i].qty--;
      saveCart();
      updateCartUI();
    };
  });
}

/* =======================================================
   AUTH MODAL (LOGIN + SIGNUP + RESET)
======================================================= */
function attachAuthModalHandlers() {
  const modal = qs("loginModal");
  const btnLogin = qs("btnLogin");
  const btnReset = qs("btnReset");

  btnLogin?.addEventListener("click", () => show(modal));
  qs("cancelAuth")?.addEventListener("click", () => hide(modal));

  qs("switchToSignup")?.addEventListener("click", () => {
    qs("authTitle").textContent = "Signup";
    qs("authDesc").textContent = "Create a new account.";
    qs("submitAuth").textContent = "Signup";
    show(qs("switchToLogin"));
    hide(qs("switchToSignup"));
  });

  qs("switchToLogin")?.addEventListener("click", () => {
    qs("authTitle").textContent = "Login";
    qs("authDesc").textContent = "Enter your credentials.";
    qs("submitAuth").textContent = "Login";
    hide(qs("switchToLogin"));
    show(qs("switchToSignup"));
  });

  qs("submitAuth")?.addEventListener("click", async () => {
    const email = qs("authEmail").value.trim();
    const pass = qs("authPass").value.trim();

    if (!email || !pass) return toast("Enter all fields!");

    const btn = qs("submitAuth");
    btn.disabled = true;

    if (btn.textContent === "Login") {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      btn.disabled = false;
      if (error) return toast(error.message);
      location.reload();
    } else {
      const { error } = await sb.auth.signUp({ email, password: pass });
      btn.disabled = false;
      if (error) return toast(error.message);
      toast("Signup successful! Check your email for verification.");
    }
  });

  btnReset?.addEventListener("click", async () => {
    const email = qs("authEmail").value.trim();
    if (!email) return toast("Enter email first!");

    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset.html"
    });

    if (error) return toast(error.message);
    toast("Password reset email sent!");
  });
}
