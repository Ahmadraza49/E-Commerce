/* =======================================================
   FINAL script.js — Auth + Reset + Products + Cart + Orders 
   (Signup → Show Login Form, No Auto Login, No Email Verify)
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
  await checkAuth();
  await handleResetExchange();

  if (qs("productsGrid")) await loadProducts();
  updateCartUI();
  await setupProductPage();
  attachAuthModalHandlers();
  setupCartModal();
  attachPaginationHandlers();
});

/* ================= CART MODAL SETUP ================= */
function setupCartModal() {
  const btnCart = qs("btnCart");
  const cartModal = qs("cartModal");
  const closeCart = qs("closeCart");
  const clearCartBtn = qs("clearCart");
  const checkoutBtn = qs("checkout");

  if (!btnCart || !cartModal) return;

  btnCart.addEventListener("click", () => show(cartModal));
  closeCart.addEventListener("click", () => hide(cartModal));

  clearCartBtn?.addEventListener("click", () => {
    cart = [];
    saveCart();
    updateCartUI();
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

  const userArea = qs("userArea");
  const btnLogin = qs("btnLogin");
  const btnLogout = qs("btnLogout");
  const myOrdersBtn = qs("btnMyOrders");

  if (user) {
    show(userArea);
    hide(btnLogin);
    show(btnLogout);
    show(myOrdersBtn);

    btnLogout?.addEventListener("click", async () => {
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

/* ================= RESET PASSWORD EXCHANGE ================= */
async function handleResetExchange() {
  const code = new URLSearchParams(window.location.search).get("code");
  if (code) await sb.auth.exchangeCodeForSession(code);
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
  const filtered = products.filter(p =>
    (p.title || "").toLowerCase().includes(search)
  );

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

/* ================= PRODUCT PAGE ================= */
async function setupProductPage() {
  if (!qs("addToCart")) return;

  const id = Number(new URLSearchParams(window.location.search).get("id"));
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

  let allImages = [];
  let designImgs = [];

  try {
    designImgs = typeof product.design_images === "string"
      ? JSON.parse(product.design_images)
      : product.design_images || [];
  } catch { designImgs = []; }

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
    b.onclick = () => { cart.splice(b.dataset.i, 1); saveCart(); updateCartUI(); };
  });
  cartItems.querySelectorAll(".increase").forEach(b => {
    b.onclick = () => { cart[b.dataset.i].qty++; saveCart(); updateCartUI(); };
  });
  cartItems.querySelectorAll(".decrease").forEach(b => {
    b.onclick = () => { 
      if(cart[b.dataset.i].qty > 1) cart[b.dataset.i].qty--;
      saveCart(); 
      updateCartUI(); 
    };
  });
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

  /* OPEN LOGIN MODAL */
  btnLogin?.addEventListener("click", () => {
    qs("authTitle").textContent = "Login";
    qs("authDesc").textContent = "Enter your credentials.";
    submitAuth.textContent = "Login";
    show(switchToSignup);
    hide(switchToLogin);
    show(loginModal);
  });

  cancelAuth?.addEventListener("click", () => hide(loginModal));

  /* SWITCH TO SIGNUP */
  switchToSignup?.addEventListener("click", () => {
    qs("authTitle").textContent = "Signup";
    qs("authDesc").textContent = "Create your account.";
    submitAuth.textContent = "Signup";
    hide(switchToSignup);
    show(switchToLogin);
  });

  /* SWITCH TO LOGIN */
  switchToLogin?.addEventListener("click", () => {
    qs("authTitle").textContent = "Login";
    qs("authDesc").textContent = "Enter your credentials.";
    submitAuth.textContent = "Login";
    hide(switchToLogin);
    show(switchToSignup);
  });

  /* SUBMIT LOGIN / SIGNUP */
  submitAuth?.addEventListener("click", async () => {
    const email = qs("authEmail").value.trim();
    const pass = qs("authPass").value.trim();
    authMsg.textContent = "Processing...";

    /* LOGIN */
    if (submitAuth.textContent === "Login") {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      authMsg.textContent = error ? error.message : "";
      if (!error) location.reload();
      return;
    }

    /* SIGNUP (NO AUTO LOGIN) */
    const { error: signupErr } = await sb.auth.signUp({
      email,
      password: pass,
      options: { emailRedirectTo: null }
    });

    if (signupErr) {
      authMsg.textContent = signupErr.message;
      return;
    }

    /* SHOW LOGIN FORM AFTER SIGNUP */
    authMsg.textContent = "Signup successful! Please login now.";

    qs("authTitle").textContent = "Login";
    qs("authDesc").textContent = "Enter your email & password.";
    submitAuth.textContent = "Login";

    show(switchToSignup);
    hide(switchToLogin);
  });

  /* RESET PASSWORD */
  btnReset?.addEventListener("click", async () => {
    const email = qs("authEmail").value.trim();
    if (!email) return alert("Enter your email first!");

    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset.html"
    });

    alert(error ? error.message : "Reset email sent!");
  });
}
