/* =======================================================
   CLEANED script.js — Auth + Reset + Products + Cart + Orders
   Supports:
   - Main products page (productsGrid)
   - Product page (product.html?id=... OR product.html?img=...)
   - Category pages (menImages / womenImages / kidsImages)
   - Cart modal, add to cart, checkout
======================================================= */

/* ========== Supabase Setup ========== */
const SUPABASE_URL = "https://ytxhlihzxgftffaikumr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eGhsaWh6eGdmdGZmYWlrdW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODAxNTgsImV4cCI6MjA3OTQ1NjE1OH0._k5hfgJwVSrbXtlRDt3ZqCYpuU1k-_OqD7M0WML4ehA";

if (!window.supabase) {
  console.error("Supabase client not loaded. Make sure the <script src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'></script> is included BEFORE script.js");
}
const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  // basic init tasks
  await checkAuth().catch(e => console.error(e));
  await handleResetExchange().catch(e => console.error(e));

  if (qs("productsGrid")) await loadProducts().catch(e => console.error(e));
  updateCartUI();
  await setupProductPage().catch(e => console.error(e)); // handles product.html (id or img)
  attachAuthModalHandlers();
  setupCartModal();
  attachPaginationHandlers();

  // categories dropdown safe wiring
  const btnCategories = qs("btnCategories");
  const menuCategories = qs("menuCategories");
  if (btnCategories && menuCategories) {
    btnCategories.addEventListener("click", () => menuCategories.classList.toggle("hidden"));
    document.addEventListener("click", (e) => {
      if (!btnCategories.contains(e.target) && !menuCategories.contains(e.target)) {
        menuCategories.classList.add("hidden");
      }
    });
  }

  // Auto-load category pages if their container exists
  if (qs("menImages")) loadCategoryImages("men", "menImages");
  if (qs("womenImages")) loadCategoryImages("women", "womenImages");
  if (qs("kidsImages")) loadCategoryImages("kids", "kidsImages");
});

/* ================= CART MODAL SETUP ================= */
function setupCartModal() {
  const btnCart = qs("btnCart");
  const cartModal = qs("cartModal");
  const closeCart = qs("closeCart");
  const clearCartBtn = qs("clearCart");
  const checkoutBtn = qs("checkout");

  // If there's no cart modal or cart button on page, do nothing
  if (!cartModal) return;

  // show/hide
  if (btnCart) btnCart.addEventListener("click", () => show(cartModal));
  if (closeCart) closeCart.addEventListener("click", () => hide(cartModal));

  clearCartBtn?.addEventListener("click", () => {
    cart = [];
    saveCart();
    updateCartUI();
  });

  checkoutBtn?.addEventListener("click", async () => {
    try {
      const user = (await sb.auth.getUser()).data?.user;
      if (!user) return toast("Please login first");
      if (!cart.length) return toast("Cart is empty");

      const order = {
        user_id: user.id,
        items: cart,
        total: cart.reduce((a, b) => a + Number(b.price) * Number(b.qty), 0),
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
    } catch (err) {
      console.error(err);
      toast("Checkout failed");
    }
  });
}

/* ================= AUTH CHECK ================= */
async function checkAuth() {
  if (!sb) return;
  const { data } = await sb.auth.getUser();
  const user = data?.user;

  const userArea = qs("userArea");
  const btnLogin = qs("btnLogin");
  const btnLogout = qs("btnLogout");
  const myOrdersBtn = qs("btnMyOrders");

  if (user) {
    if (userArea) show(userArea);
    if (btnLogin) hide(btnLogin);
    if (btnLogout) show(btnLogout);
    if (myOrdersBtn) show(myOrdersBtn);

    btnLogout?.addEventListener("click", async () => {
      await sb.auth.signOut();
      location.reload();
    });
  } else {
    if (userArea) hide(userArea);
    if (btnLogin) show(btnLogin);
    if (btnLogout) hide(btnLogout);
    if (myOrdersBtn) hide(myOrdersBtn);
  }
}

/* ================= RESET PASSWORD EXCHANGE ================= */
async function handleResetExchange() {
  if (!sb) return;
  const code = new URLSearchParams(window.location.search).get("code");
  if (code) await sb.auth.exchangeCodeForSession(code);
}

/* ================= PRODUCTS (main listing) ================= */
async function loadProducts() {
  if (!sb) return;
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
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = filtered.slice(start, start + itemsPerPage);

  grid.innerHTML = pageItems.map(p => `
    <div class="bg-white p-4 rounded shadow flex flex-col">
      <img src="${p.image_url || ''}" class="h-48 w-full object-contain mb-2" />
      <h3 class="font-semibold">${p.title}</h3>
      <p class="text-gray-500">${(p.description||'').slice(0, 70)}...</p>
      <p class="text-xl font-bold mt-2">$${p.price}</p>
      <div class="mt-auto flex gap-2 pt-2">
        <a href="product.html?id=${p.id}" class="px-3 py-2 bg-gray-200 rounded text-center flex-1">View</a>
        <button onclick="addToCartFromCategory(${p.id})" class="px-3 py-2 bg-indigo-600 text-white rounded flex-1">Add</button>
      </div>
    </div>
  `).join("");

  if (qs("pageInfo")) qs("pageInfo").textContent = `Page ${currentPage} of ${totalPages}`;
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

/* ================= CATEGORY IMAGES (for men/women/kids pages) ================= */
async function loadCategoryImages(category, containerId) {
  if (!sb) return;
  const box = document.getElementById(containerId);
  if (!box) return;

  // first try: if you also keep products with category, fetch from products table
  // fallback: fetch from category_images table
  let data = null;
  try {
    const prodRes = await sb.from("products").select("*").eq("category", category);
    if (prodRes.error) throw prodRes.error;
    if (prodRes.data && prodRes.data.length) {
      data = prodRes.data.map(p => ({
        image_url: p.image_url,
        title: p.title,
        price: p.price,
        product_id: p.id
      }));
    } else {
      // try category_images table
      const catRes = await sb.from("category_images").select("*").eq("category", category);
      if (catRes.error) throw catRes.error;
      data = catRes.data || [];
    }
  } catch (err) {
    console.error("loadCategoryImages error:", err);
    box.innerHTML = "<p class='text-red-600'>Error loading items</p>";
    return;
  }

  // render grid cards (either product records or plain images from category_images)
  box.innerHTML = (data || []).map(item => {
    // if product_id exists we render product card with View + Add
    if (item.product_id) {
      return `
        <div class="bg-white p-3 rounded shadow flex flex-col">
          <img src="${item.image_url || ''}" class="w-full h-56 object-cover rounded mb-3" />
          <h3 class="font-semibold mb-1">${item.title || ''}</h3>
          <p class="font-bold mb-3">$${item.price || ''}</p>
          <div class="mt-auto flex gap-2">
            <a href="product.html?id=${item.product_id}" class="px-3 py-2 bg-gray-200 rounded flex-1 text-center">View</a>
            <button onclick="addToCartFromCategory(${item.product_id})" class="px-3 py-2 bg-indigo-600 text-white rounded flex-1">Add</button>
          </div>
        </div>
      `;
    }

    // else it's a simple image entry from category_images table
    const url = item.image_url || "";
    return `
      <div class="bg-white p-3 rounded shadow flex flex-col">
        <img src="${url}" class="w-full h-64 object-cover rounded mb-3" />
        <div class="mt-auto">
          <button onclick="window.location.href='product.html?img=${encodeURIComponent(url)}'"
            class="w-full px-3 py-2 bg-indigo-600 text-white rounded">View</button>
        </div>
      </div>
    `;
  }).join("");
}

/* ========== Add to cart helper used by category/product listings ========== */
async function addToCartFromCategory(productId) {
  try {
    if (!sb) return;
    // fetch product by id
    const { data, error } = await sb.from("products").select("*").eq("id", productId).single();
    if (error || !data) {
      console.error(error || "No product");
      return toast("Cannot add to cart (product not found)");
    }
    const existing = cart.find(i => i.id === data.id);
    if (existing) existing.qty += 1;
    else cart.push({ id: data.id, title: data.title, price: Number(data.price || 0), qty: 1 });
    saveCart();
    updateCartUI();
    toast("Added to cart");
  } catch (err) {
    console.error(err);
    toast("Add to cart failed");
  }
}

/* ================= PRODUCT PAGE (single) =================
   Supports:
   - product.html?id=123  => load product from products table
   - product.html?img=URL  => preview an image (custom), price set to example $99
========================================================= */
async function setupProductPage() {
  // page might not have addToCart element -> return early
  if (!qs("addToCart")) return;

  const params = new URLSearchParams(window.location.search);
  const imgUrl = params.get("img");
  const id = params.get("id");

  // Case A: opened from category image (img param only)
  if (imgUrl && !id) {
    qs("productTitle").textContent = "Custom Design";
    qs("productDesc").textContent = "Preview of selected design.";
    qs("productPrice").textContent = "$99";

    const mainImg = qs("mainProductImage");
    const gallery = qs("productImages");
    mainImg.src = imgUrl;
    gallery.innerHTML = `
      <img src="${imgUrl}" class="w-20 h-20 object-cover rounded cursor-pointer border" onclick="document.getElementById('mainProductImage').src='${imgUrl}'" />
    `;

    qs("addToCart").onclick = () => {
      const qty = Number(qs("quantity").value) || 1;
      cart.push({
        id: "design-" + Date.now(),
        title: "Custom Design",
        price: 99,
        qty
      });
      saveCart();
      updateCartUI();
      toast("Added design to cart");
    };
    return;
  }

  // Case B: normal product with id
  if (!id) return; // not a product page

  if (!sb) return;
  const { data: product, error } = await sb.from("products").select("*").eq("id", Number(id)).single();
  if (error || !product) {
    console.error("Product load error:", error);
    return;
  }

  qs("productTitle").textContent = product.title || "";
  qs("productDesc").textContent = product.description || "";
  qs("productPrice").textContent = "$" + (product.price ?? 0);

  const mainImg = qs("mainProductImage");
  const gallery = qs("productImages");

  let allImages = [];
  let designImgs = [];

  try {
    designImgs = typeof product.design_images === "string"
      ? JSON.parse(product.design_images)
      : product.design_images || [];
  } catch (err) {
    designImgs = [];
  }

  if (product.image_url) allImages.push(product.image_url);
  if (Array.isArray(designImgs)) allImages.push(...designImgs);

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
    else cart.push({ id: product.id, title: product.title, price: Number(product.price || 0), qty });
    saveCart();
    updateCartUI();
    toast("Added to cart");
  };
}

/* ================= CART UI ================= */
function updateCartUI() {
  const cartItems = qs("cartItems");
  const cartCount = qs("cartCount");
  const cartTotal = qs("cartTotal");

  if (cartCount) cartCount.textContent = cart.length;
  if (!cartItems || !cartTotal) {
    // still ensure cartCount updates if exists
    return;
  }

  cartItems.innerHTML = "";
  let total = 0;

  cart.forEach((item, index) => {
    total += Number(item.price || 0) * Number(item.qty || 0);

    cartItems.innerHTML += `
      <div class="flex justify-between border-b pb-2 mt-2">
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
    b.onclick = () => { cart.splice(Number(b.dataset.i), 1); saveCart(); updateCartUI(); };
  });
  cartItems.querySelectorAll(".increase").forEach(b => {
    b.onclick = () => { cart[Number(b.dataset.i)].qty++; saveCart(); updateCartUI(); };
  });
  cartItems.querySelectorAll(".decrease").forEach(b => {
    b.onclick = () => {
      const idx = Number(b.dataset.i);
      if (cart[idx].qty > 1) cart[idx].qty--;
      saveCart();
      updateCartUI();
    };
  });
}

/* ================= AUTH MODAL (basic wiring) ================= */
function attachAuthModalHandlers() {
  const loginModal = qs("loginModal");
  const btnLogin = qs("btnLogin");
  const cancelAuth = qs("cancelAuth");
  const submitAuth = qs("submitAuth");
  const switchToSignup = qs("switchToSignup");
  const switchToLogin = qs("switchToLogin");
  const btnReset = qs("btnReset");
  const authMsg = qs("authMsg");

  if (!submitAuth) return;

  btnLogin?.addEventListener("click", () => {
    qs("authTitle").textContent = "Login";
    qs("authDesc").textContent = "Enter your credentials.";
    submitAuth.textContent = "Login";
    if (switchToSignup) show(switchToSignup);
    if (switchToLogin) hide(switchToLogin);
    show(loginModal);
  });

  cancelAuth?.addEventListener("click", () => hide(loginModal));

  switchToSignup?.addEventListener("click", () => {
    qs("authTitle").textContent = "Signup";
    qs("authDesc").textContent = "Create your account.";
    submitAuth.textContent = "Signup";
    hide(switchToSignup);
    show(switchToLogin);
  });

  switchToLogin?.addEventListener("click", () => {
    qs("authTitle").textContent = "Login";
    qs("authDesc").textContent = "Enter your credentials.";
    submitAuth.textContent = "Login";
    hide(switchToLogin);
    show(switchToSignup);
  });

  submitAuth.addEventListener("click", async () => {
    if (!sb) return;
    const email = qs("authEmail")?.value.trim() || "";
    const pass = qs("authPass")?.value.trim() || "";
    if (authMsg) authMsg.textContent = "Processing...";

    if (submitAuth.textContent === "Login") {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (authMsg) authMsg.textContent = error ? error.message : "";
      if (!error) location.reload();
      return;
    }

    const { error: signupErr } = await sb.auth.signUp({
      email,
      password: pass,
      options: { emailRedirectTo: null }
    });

    if (signupErr) {
      if (authMsg) authMsg.textContent = signupErr.message;
      return;
    }

    if (authMsg) authMsg.textContent = "Signup successful! Please login now.";
    qs("authTitle").textContent = "Login";
    qs("authDesc").textContent = "Enter your email & password.";
    submitAuth.textContent = "Login";
    if (switchToSignup) show(switchToSignup);
    if (switchToLogin) hide(switchToLogin);
  });

  btnReset?.addEventListener("click", async () => {
    if (!sb) return;
    const email = qs("authEmail")?.value.trim();
    if (!email) return alert("Enter your email first!");
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset.html"
    });
    alert(error ? error.message : "Reset email sent!");
  });
}

   async function login() {
email,
password,
});


if (error) {
alert(error.message);
return;
}


localStorage.setItem("user", JSON.stringify(data.user));
window.location.href = "index.html";
}


/* ===============================
SIGNUP
================================ */
async function signup() {
const email = document.getElementById("email").value;
const password = document.getElementById("password").value;


let { data, error } = await supabaseClient.auth.signUp({ email, password });


if (error) {
alert(error.message);
return;
}


alert("Account created! Now login.");
window.location.href = "login.html";
}


/* ===============================
RESET PASSWORD
================================ */
async function resetPassword() {
const email = document.getElementById("email").value;


let { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
redirectTo: "https://your-vercel-url.com/update-password.html",
});


if (error) {
alert(error.message);
return;
}


alert("Password reset link sent to your email!");
}


/* ===============================
LOGOUT
================================ */
async function logout() {
await supabaseClient.auth.signOut();
localStorage.removeItem("user");
window.location.href = "login.html";
}
