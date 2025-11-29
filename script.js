/* =======================================================
   FINAL script.js — Auth + Reset + Products + Cart + Orders + Product Designs
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

/* ========== Utility helpers ========== */
function qs(id) { return document.getElementById(id); }
function show(el) { if (el) el.style.display = ""; }
function hide(el) { if (el) el.style.display = "none"; }
function toast(msg) { alert(msg); }
function saveCart() { localStorage.setItem("cart", JSON.stringify(cart)); }

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {

  await checkAuth();
  await handleResetExchange();

  if (qs("productsGrid")) await loadProducts();
  updateCartUI();
  await setupProductPage();  // <-- FIXED product page loader

  attachAuthModalHandlers();

  qs("btnCart")?.addEventListener("click", () => show(qs("cartModal")));
  qs("closeCart")?.addEventListener("click", () => hide(qs("cartModal")));
  qs("clearCart")?.addEventListener("click", () => {
    cart = [];
    saveCart();
    updateCartUI();
  });

  // Search + Pagination
  qs("search")?.addEventListener("input", () => {
    currentPage = 1;
    renderProducts();
  });

  qs("prevPage")?.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderProducts();
    }
  });

  qs("nextPage")?.addEventListener("click", () => {
    currentPage++;
    renderProducts();
  });

  // Checkout
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
    cart = [];
    saveCart();
    updateCartUI();
    hide(qs("cartModal"));
  });
});

/* ================= AUTH ================= */
async function checkAuth() {
  const { data } = await sb.auth.getUser();
  const user = data?.user;

  const userArea = qs("userArea");
  const btnLogin = qs("btnLogin");
  const btnLogout = qs("btnLogout");
  const myOrdersBtn = qs("btnMyOrders");
  const userEmailSpan = qs("userEmail");

  if (user) {
    if (userArea) userArea.style.display = "flex";
    if (btnLogin) btnLogin.style.display = "none";
    if (btnLogout) btnLogout.style.display = "inline-block";
    if (myOrdersBtn) myOrdersBtn.style.display = "inline-block";
    if (userEmailSpan) userEmailSpan.textContent = user.email;

    btnLogout?.addEventListener("click", async () => {
      await sb.auth.signOut();
      location.reload();
    });

  } else {
    if (userArea) userArea.style.display = "none";
    if (btnLogin) btnLogin.style.display = "inline-block";
    if (btnLogout) btnLogout.style.display = "none";
    if (myOrdersBtn) myOrdersBtn.style.display = "none";
  }
}

/* ================= RESET PASSWORD ================= */
async function handleResetExchange() {
  const code = new URLSearchParams(window.location.search).get("code");
  if (code) await sb.auth.exchangeCodeForSession(code);
}

/* ================= AUTH MODAL ================= */
function attachAuthModalHandlers() {
  // (unchanged — same as your last version)
}

/* ================= PRODUCTS ================= */
async function loadProducts() {
  const { data } = await sb.from("products").select("*");
  products = data || [];
  renderProducts();
}

function renderProducts() {
  const grid = qs("productsGrid");
  if (!grid) return;

  const search = (qs("search")?.value || "").toLowerCase();
  const filtered = products.filter(p => (p.title || "").toLowerCase().includes(search));

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = filtered.slice(start, start + itemsPerPage);

  grid.innerHTML = pageItems.map(p => `
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

/* ============================================================
   PRODUCT PAGE — FIXED DESIGN IMAGES LOADER
============================================================ */
async function setupProductPage() {
  if (!qs("addToCart")) return;

  const id = Number(new URLSearchParams(window.location.search).get("id"));
  if (!id) return;

  const { data: product } = await sb.from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (!product) return;

  // Set text info
  qs("productTitle").textContent = product.title;
  qs("productDesc").textContent = product.description;
  qs("productPrice").textContent = "$" + product.price;

  const mainImg = qs("mainProductImage");
  const gallery = qs("productImages");

  // FIXED — support design_images array from JSONB
  let designImages = [];
  if (Array.isArray(product.design_images)) {
    designImages = product.design_images;
  }

  // Add main image at start (always)
  if (product.image_url) {
    designImages.unshift(product.image_url);
  }

  // Avoid duplicates
  designImages = [...new Set(designImages)];

  // Set main image
  mainImg.src = designImages.length ? designImages[0] : "";

  // Render thumbnails
  gallery.innerHTML = "";
  designImages.forEach(url => {
    const img = document.createElement("img");
    img.src = url;
    img.className =
      "w-20 h-20 object-cover rounded cursor-pointer border hover:opacity-70";

    img.onclick = () => {
      mainImg.src = url;
    };

    gallery.appendChild(img);
  });

  // Add to Cart
  qs("addToCart").addEventListener("click", () => {
    const qty = Number(qs("quantity").value) || 1;

    const existing = cart.find(i => i.id === id);
    if (existing) existing.qty += qty;
    else cart.push({ id, title: product.title, price: product.price, qty });

    saveCart();
    updateCartUI();
    toast("Added to cart");
  });
}

/* ================= CART UI ================= */
function updateCartUI() {
  const cartItems = qs("cartItems");
  const cartCount = qs("cartCount");
  const cartTotal = qs("cartTotal");

  if (cartCount) cartCount.textContent = cart.length;
  if (!cartItems || !cartTotal) return;

  cartItems.innerHTML = "";
  let total = 0;

  cart.forEach((item, index) => {
    total += item.price * item.qty;

    cartItems.innerHTML += `
      <div class="flex justify-between border-b pb-2">
        <div>
          <p class="font-semibold">${item.title}</p>
          <p>$${item.price} × ${item.qty}</p>
        </div>
        <div class="flex gap-2">
          <button class="decrease" data-i="${index}">-</button>
          <button class="increase" data-i="${index}">+</button>
          <button class="remove" data-i="${index}">Remove</button>
        </div>
      </div>
    `;
  });

  cartTotal.textContent = "$" + total;

  cartItems.querySelectorAll(".remove").forEach(b => {
    b.onclick = () => {
      cart.splice(b.dataset.i, 1);
      saveCart();
      updateCartUI();
    };
  });

  cartItems.querySelectorAll(".increase").forEach(b => {
    b.onclick = () => {
      cart[b.dataset.i].qty++;
      saveCart();
      updateCartUI();
    };
  });

  cartItems.querySelectorAll(".decrease").forEach(b => {
    b.onclick = () => {
      cart[b.dataset.i].qty = Math.max(1, cart[b.dataset.i].qty - 1);
      saveCart();
      updateCartUI();
    };
  });
}
