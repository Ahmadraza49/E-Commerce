/* =======================================================
   UPDATED script.js — Auth + Reset + Products + Cart + Orders + Categories
   Uses categories: "Men", "Women", "kids", "New Design"
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
function show(el) { if (el) el.classList.remove("hidden"); }
function hide(el) { if (el) el.classList.add("hidden"); }
function toast(msg) { alert(msg); }
function saveCart() { localStorage.setItem("cart", JSON.stringify(cart)); }

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  updateCartUI();          // show stored cart state immediately
  await checkAuth();
  await handleResetExchange();

  // Load products on products.html
  if (qs("productsGrid")) await loadProducts();

  // If product page, setup product view
  await setupProductPage();

  attachAuthModalHandlers();
  setupCartModal();
  attachPaginationHandlers();

  // update cartCount in header(s)
  const cartCountEl = qs("cartCount");
  if (cartCountEl) cartCountEl.textContent = cart.length;
});

/* ================= CART MODAL SETUP ================= */
function setupCartModal() {
  const btnCart = qs("btnCart");
  const cartModal = qs("cartModal");
  const closeCart = qs("closeCart");
  const clearCartBtn = qs("clearCart");
  const checkoutBtn = qs("checkout");

  if (btnCart && cartModal) {
    btnCart.addEventListener("click", () => cartModal.classList.toggle("hidden"));
  }
  if (closeCart) closeCart.addEventListener("click", () => hide(cartModal));

  clearCartBtn?.addEventListener("click", () => {
    cart = [];
    saveCart();
    updateCartUI();
    toast("Cart cleared");
  });

  checkoutBtn?.addEventListener("click", async () => {
    const user = (await sb.auth.getUser()).data?.user;
    if (!user) return toast("Please login first");
    if (!cart.length) return toast("Cart is empty");

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

/* ================= AUTH CHECK ================= */
async function checkAuth() {
  const { data } = await sb.auth.getUser();
  const user = data?.user;

  // If you have userArea / btnLogin / btnLogout in header, show/hide here
  const userArea = qs("userArea");
  const btnLogin = qs("btnLogin");
  const btnLogout = qs("btnLogout");
  const myOrdersBtn = qs("btnMyOrders");

  if (user) {
    if (userArea) show(userArea);
    if (btnLogin) hide(btnLogin);
    if (btnLogout) show(btnLogout);
    if (myOrdersBtn) show(myOrdersBtn);

    if (btnLogout) btnLogout.onclick = async () => { await sb.auth.signOut(); location.href = "products.html"; };
  } else {
    if (userArea) hide(userArea);
    if (btnLogin) show(btnLogin);
    if (btnLogout) hide(btnLogout);
    if (myOrdersBtn) hide(myOrdersBtn);
  }
}

/* ================= RESET PASSWORD EXCHANGE ================= */
async function handleResetExchange() {
  const code = new URLSearchParams(window.location.search).get("code");
  if (code) await sb.auth.exchangeCodeForSession(code);
}

/* ================= PRODUCTS (ALL) ================= */
async function loadProducts() {
  const { data, error } = await sb.from("products").select("*").order("id", { ascending: false });
  if (error) { console.error(error); return; }
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
      <p class="text-gray-500">${p.description?.slice(0, 70) || ""}...</p>
      <p class="text-xl font-bold mt-2">$${p.price}</p>
      <a href="product.html?id=${p.id}" class="mt-auto px-4 py-2 bg-indigo-600 text-white rounded text-center">View</a>
    </div>
  `).join("");

  qs("pageInfo").textContent = `Page ${currentPage} of ${totalPages}`;
}

/* ================= PAGINATION ================= */
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

/* ================= PRODUCT PAGE (single) ================= */
async function setupProductPage() {
  if (!qs("addToCart")) return; // not on product page

  const id = Number(new URLSearchParams(window.location.search).get("id"));
  if (!id) return;

  const { data: product, error } = await sb.from("products").select("*").eq("id", id).single();
  if (error || !product) return;

  qs("productTitle").textContent = product.title;
  qs("productDesc").textContent = product.description || "";
  qs("productPrice").textContent = "$" + product.price;

  const mainImg = qs("mainProductImage");
  const gallery = qs("productImages");

  let allImages = [];
  try {
    const designImgs = Array.isArray(product.design_images) ? product.design_images : (product.design_images ? JSON.parse(product.design_images) : []);
    if (product.image_url) allImages.push(product.image_url);
    if (Array.isArray(designImgs)) allImages.push(...designImgs);
  } catch (e) {
    if (product.image_url) allImages.push(product.image_url);
  }

  allImages = [...new Set(allImages)];
  if (allImages.length) mainImg.src = allImages[0];

  gallery.innerHTML = "";
  allImages.forEach(url => {
    const img = document.createElement("img");
    img.src = url;
    img.className = "w-20 h-20 object-cover rounded cursor-pointer border hover:opacity-70";
    img.onclick = () => { mainImg.src = url; };
    gallery.appendChild(img);
  });

  qs("addToCart").onclick = () => {
    const qty = Number(qs("quantity").value) || 1;
    const existing = cart.find(i => i.id === product.id);
    if (existing) existing.qty += qty;
    else cart.push({ id: product.id, title: product.title, price: product.price, qty, image: product.image_url || "" });
    saveCart();
    updateCartUI();
    toast("Added to cart");
  };
}

/* ================= CATEGORY PAGES ================= */
async function loadProductsByCategory(categoryName) {
  // categoryName must match exactly what's in DB: "Men", "Women", "kids", "New Design"
  try {
    const { data, error } = await sb.from("products").select("*").eq("category", categoryName).order("id", { ascending: false });
    if (error) { console.error(error); return; }
    const container = document.getElementById("productList");
    if (!container) return;
    container.innerHTML = "";

    if (!data || !data.length) {
      container.innerHTML = `<p class="text-gray-600">No products found.</p>`;
      return;
    }

    data.forEach((p) => {
      container.innerHTML += `
        <div class="bg-white p-3 rounded shadow">
          <img src="${p.image_url}" class="w-full h-40 object-cover rounded" alt="${p.title}">
          <h2 class="font-semibold mt-2">${p.title}</h2>
          <p class="text-sm text-gray-600">${p.description || ""}</p>
          <p class="font-bold mt-1">$${p.price}</p>
          <div class="mt-2 flex gap-2">
            <a href="product.html?id=${p.id}" class="flex-1 text-center bg-gray-200 py-1 rounded">View</a>
            <button onclick="addToCart(${p.id})" class="flex-1 bg-blue-600 text-white py-1 rounded">Add to Cart</button>
          </div>
        </div>
      `;
    });
  } catch (e) {
    console.error("Load category error:", e);
  }
}

/* ================= CART UI ================= */
function updateCartUI() {
  const cartItems = qs("cartItems");
  const cartCount = qs("cartCount");
  const cartTotal = qs("cartTotal");

  if (cartCount) cartCount.textContent = cart.length;

  // update all header cartCount elements if multiple present
  document.querySelectorAll("#cartCount").forEach(el => el.textContent = cart.length);

  if (!cartItems || !cartTotal) return;

  cartItems.innerHTML = "";
  let total = 0;

  cart.forEach((item, index) => {
    total += (Number(item.price) || 0) * (Number(item.qty) || 0);

    cartItems.innerHTML += `
      <div class="flex justify-between border-b pb-2 mt-2 items-center">
        <div>
          <p class="font-semibold">${item.title}</p>
          <p class="text-sm">$${item.price} × ${item.qty}</p>
        </div>
        <div class="flex gap-2 items-center">
          <button class="decrease px-2 py-1 border rounded" data-i="${index}">-</button>
          <button class="increase px-2 py-1 border rounded" data-i="${index}">+</button>
          <button class="remove px-2 py-1 border rounded" data-i="${index}">Remove</button>
        </div>
      </div>
    `;
  });

  cartTotal.textContent = "$" + total;

  // handlers
  cartItems.querySelectorAll(".remove").forEach(b => {
    b.onclick = () => { cart.splice(Number(b.dataset.i), 1); saveCart(); updateCartUI(); };
  });
  cartItems.querySelectorAll(".increase").forEach(b => {
    b.onclick = () => { cart[Number(b.dataset.i)].qty++; saveCart(); updateCartUI(); };
  });
  cartItems.querySelectorAll(".decrease").forEach(b => {
    b.onclick = () => {
      const i = Number(b.dataset.i);
      if (cart[i].qty > 1) cart[i].qty--;
      else cart.splice(i, 1);
      saveCart(); updateCartUI();
    };
  });

  // update header counters again
  document.querySelectorAll("#cartCount").forEach(el => el.textContent = cart.length);
}

/* ================= ADD TO CART BY ID ================= */
async function addToCart(productId) {
  // Try to find in local products cache first
  let product = products.find(p => Number(p.id) === Number(productId));
  if (!product) {
    // fetch single product
    const { data, error } = await sb.from("products").select("*").eq("id", productId).single();
    if (error || !data) { console.error(error); toast("Product not found"); return; }
    product = data;
  }

  const existing = cart.find(i => Number(i.id) === Number(product.id));
  if (existing) existing.qty++;
  else cart.push({ id: product.id, title: product.title, price: product.price, qty: 1, image: product.image_url || "" });

  saveCart();
  updateCartUI();
  toast("Added to cart");
}

/* ================= AUTH MODAL ================= */
function attachAuthModalHandlers() {
  const loginModal = qs("loginModal");
  const btnLogin = qs("btnLogin");
  const cancelAuth = qs("cancelAuth");
  const submitAuth = qs("submitAuth");
  const switchToSignup = qs("switchToSignup");
  const switchToLogin = qs("switchToLogin");
  const btnReset = qs("btnReset");
  const authMsg = qs("authMsg");

  if (btnLogin) btnLogin.onclick = () => {
    if (loginModal) {
      qs("authTitle").textContent = "Login";
      qs("authDesc").textContent = "Enter your credentials.";
      submitAuth.textContent = "Login";
      if (switchToSignup) switchToSignup.style.display = "inline";
      if (switchToLogin) switchToLogin.style.display = "none";
      loginModal.classList.toggle("hidden");
    }
  };

  cancelAuth?.addEventListener("click", () => loginModal && loginModal.classList.add("hidden"));

  switchToSignup?.addEventListener("click", () => {
    qs("authTitle").textContent = "Signup";
    qs("authDesc").textContent = "Create your account.";
    submitAuth.textContent = "Signup";
    switchToSignup.style.display = "none";
    switchToLogin.style.display = "inline";
  });

  switchToLogin?.addEventListener("click", () => {
    qs("authTitle").textContent = "Login";
    qs("authDesc").textContent = "Enter your credentials.";
    submitAuth.textContent = "Login";
    switchToSignup.style.display = "inline";
    switchToLogin.style.display = "none";
  });

  submitAuth?.addEventListener("click", async () => {
    const email = qs("authEmail").value.trim();
    const pass = qs("authPass").value.trim();
    authMsg.textContent = "Processing...";

    if (submitAuth.textContent === "Login") {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) { authMsg.textContent = error.message; return; }
      authMsg.textContent = "";
      location.reload();
      return;
    }

    const { error: signupErr } = await sb.auth.signUp({ email, password: pass, options: { emailRedirectTo: null }});
    if (signupErr) { authMsg.textContent = signupErr.message; return; }
    authMsg.textContent = "Signup successful! Please login now.";
    qs("authTitle").textContent = "Login";
    qs("authDesc").textContent = "Enter your email & password.";
    submitAuth.textContent = "Login";
  });

  btnReset?.addEventListener("click", async () => {
    const email = qs("authEmail").value.trim();
    if (!email) return alert("Enter your email first!");
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset.html" });
    alert(error ? error.message : "Reset email sent!");
  });
}

/* ================= ORDERS PAGE LOADER ================= */
async function loadOrdersPageIfPresent() {
  if (!qs("ordersList")) return;
  const user = (await sb.auth.getUser()).data?.user;
  const ordersList = qs("ordersList");
  if (!user) {
    ordersList.innerHTML = "<p class='text-center mt-10 text-red-600'>Please login to view your orders.</p>";
    return;
  }
  const { data: orders, error } = await sb.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) { ordersList.innerHTML = "<p class='text-red-600'>Error loading orders.</p>"; return; }
  if (!orders.length) { ordersList.innerHTML = "<p class='text-gray-600 text-center mt-8'>You have no orders yet.</p>"; return; }

  ordersList.innerHTML = orders.map(order => `
    <div class="bg-white p-4 rounded shadow">
      <div class="flex justify-between">
        <p class="font-semibold text-lg">Order #${order.id}</p>
        <span class="text-indigo-600 font-semibold">${order.status ? order.status : "Complete"}</span>
      </div>
      <p class="text-sm text-gray-500">${new Date(order.created_at).toLocaleString()}</p>
      <p class="mt-2 font-bold">Total: $${order.total}</p>
      <details class="mt-3">
        <summary class="cursor-pointer font-semibold text-gray-700">View Items</summary>
        <div class="mt-2 space-y-3">
          ${order.items.map(item => `
            <div class="border p-3 rounded flex gap-3 items-center">
              ${item.image ? `<img src="${item.image}" class="w-16 h-16 object-cover rounded" />` : ""}
              <div>
                <p class="font-semibold">${item.title}</p>
                <p class="text-sm text-gray-600">Qty: ${item.qty} × $${item.price} = <span class="font-semibold">$${item.qty * item.price}</span></p>
              </div>
            </div>
          `).join("")}
        </div>
      </details>
    </div>
  `).join("");
}

/* Run orders loader if ordersList present (after DOM ready) */
document.addEventListener("DOMContentLoaded", loadOrdersPageIfPresent);
