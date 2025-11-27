/* =======================================================
   FINAL script.js — Email+Password auth, reset, products, orders
   SIGNUP BUTTON FIXED ✔
======================================================= */

/* ========== Supabase setup ========== */
const SUPABASE_URL = "https://ytxhlihzxgftffaikumr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eGhsaWh6eGdmdGZmYWlrdW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODAxNTgsImV4cCI6MjA3OTQ1NjE1OH0._k5hfgJwVSrbXtlRDt3ZqCYpuU1k-_OqD7M0WML4ehA";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ========== Utilities ========== */
const $ = (id) => document.getElementById(id);
const rup = (n) => "₹" + Number(n || 0).toLocaleString();

function setImageWithFallback(imgEl, url, title) {
  const fallback = `https://placehold.co/600x400?text=${encodeURIComponent(title || "Product")}&font=roboto`;
  if (!imgEl) return;
  if (!url) {
    imgEl.src = fallback;
    return;
  }
  imgEl.src = url;
  imgEl.onerror = () => {
    imgEl.onerror = null;
    imgEl.src = fallback;
  };
}

/* ========== In-memory cart ========== */
let CART = [];
function loadCart() { return CART; }
function saveCartToMemory(cart) { CART = cart; updateCartUI(); }
function addToCart(item) {
  const cart = loadCart();
  const found = cart.find(i => i.id === item.id);
  if (found) found.qty += item.qty;
  else cart.push({...item});
  saveCartToMemory(cart);
}
function removeFromCart(id) { saveCartToMemory(loadCart().filter(i => i.id !== id)); }
function clearCart() { CART = []; updateCartUI(); }
function cartTotal() { return loadCart().reduce((s,i)=> s + Number(i.price) * i.qty, 0); }

/* ========== AUTH ========== */
async function initAuthUI() {
  try {
    const res = await sb.auth.getSession();
    const session = res?.data?.session;
    setUser(session?.user ?? null);
  } catch (e) { console.warn("initAuthUI error:", e); }

  sb.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
  });
}

function setUser(user) {
  const userArea = $("userArea");
  const btnLogin = $("btnLogin");
  const btnLogout = $("btnLogout");

  if (!btnLogin) return;

  if (user) {
    userArea.classList.remove("hidden");
    btnLogin.classList.add("hidden");
  } else {
    userArea.classList.add("hidden");
    btnLogin.classList.remove("hidden");
  }

  if (btnLogout) {
    btnLogout.onclick = async () => {
      await sb.auth.signOut();
      clearCart();
      alert("Logged out");
      window.location.href = "index.html";
    };
  }
}

/* Signup then auto login */
async function signupAndLogin(email, password) {
  if (!email || !password) return { error: { message: "Provide email & password" } };

  const { error: signErr } = await sb.auth.signUp({ email, password });
  if (signErr && signErr.status !== 400) {
    return { error: signErr };
  }

  return await sb.auth.signInWithPassword({ email, password });
}

async function loginWithPassword(email, password) {
  if (!email || !password) return { error: { message: "Provide email & password" } };
  return await sb.auth.signInWithPassword({ email, password });
}

async function sendResetEmail(email) {
  if (!email) return { error: { message: "Enter email" } };
  const redirectTo = `${location.origin}/reset.html`;
  return await sb.auth.resetPasswordForEmail(email, { redirectTo });
}

/* ==========================================================
   AUTH MODAL FIXED ✔ (Signup button showing correctly now)
========================================================== */
function showAuthModal(mode = "login") {
  const m = $("loginModal");
  if (!m) return;

  const title = $("authTitle");
  const desc = $("authDesc");
  const msg = $("authMsg");
  const btn = $("submitAuth");
  const swSignup = $("switchToSignup");
  const swLogin = $("switchToLogin");

  title.textContent = mode === "signup" ? "Sign up" : "Login";
  desc.textContent = mode === "signup"
    ? "Create an account with email and password."
    : "Enter your email and password to sign in.";

  msg.textContent = "";
  $("authEmail").value = "";
  $("authPass").value = "";

  /* 🔥 THIS IS THE FIX 🔥 */
  if (mode === "signup") {
    btn.textContent = "Create Account";
    swSignup.style.display = "none";
    swLogin.style.display = "inline";
  } else {
    btn.textContent = "Login";
    swSignup.style.display = "inline";
    swLogin.style.display = "none";
  }

  /* Show modal */
  m.classList.remove("hidden");
  m.classList.add("flex");

  /* Submit handler */
  btn.onclick = async () => {
    const email = $("authEmail").value.trim();
    const pass = $("authPass").value.trim();

    msg.style.color = "red";
    msg.textContent = "Processing...";

    if (mode === "signup") {
      const { error } = await signupAndLogin(email, pass);
      if (error) return msg.textContent = error.message;

      msg.style.color = "green";
      msg.textContent = "Signup successful!";
      m.classList.add("hidden");
      return window.location.href = "index.html";
    } else {
      const { error } = await loginWithPassword(email, pass);
      if (error) return msg.textContent = error.message;

      msg.style.color = "green";
      msg.textContent = "Login successful!";
      m.classList.add("hidden");
      return window.location.href = "index.html";
    }
  };

  $("cancelAuth").onclick = () => m.classList.add("hidden");

  $("btnReset").onclick = async () => {
    const email = $("authEmail").value.trim();
    if (!email) return alert("Enter email first");
    const r = await sendResetEmail(email);
    if (r.error) alert(r.error.message);
    else alert("Password reset email sent");
  };

  swSignup.onclick = (e) => { e.preventDefault(); showAuthModal("signup"); };
  swLogin.onclick = (e) => { e.preventDefault(); showAuthModal("login"); };
}

/* ========== Cart UI ========== */
function updateCartUI() {
  const cart = loadCart();
  const count = cart.reduce((s,i)=>s + i.qty, 0);
  if ($("cartCount")) $("cartCount").textContent = count;

  const wrap = $("cartItems");
  if (!wrap) return;

  wrap.innerHTML = "";
  if (!cart.length) {
    wrap.innerHTML = `<p class="text-sm text-gray-500">Cart empty.</p>`;
  } else {
    cart.forEach(i => {
      const div = document.createElement("div");
      div.className = "flex items-center justify-between";
      div.innerHTML = `
        <div>
          <div class="font-semibold">${i.title}</div>
          <div class="text-sm text-gray-500">Qty ${i.qty} × ${rup(i.price)}</div>
        </div>
        <div class="text-right">
          <div class="font-bold">${rup(i.qty * i.price)}</div>
          <button data-id="${i.id}" class="removeBtn text-sm mt-1">Remove</button>
        </div>`;
      wrap.appendChild(div);
    });

    wrap.querySelectorAll(".removeBtn")
    .forEach(btn => btn.onclick = () => removeFromCart(btn.dataset.id));
  }

  if ($("cartTotal")) $("cartTotal").textContent = rup(cartTotal());
}

/* ========== Checkout ========== */
async function checkout() {
  const userResp = await sb.auth.getUser();
  const user = userResp?.data?.user;
  if (!user) return alert("Please login first"), showAuthModal("login");

  const cart = loadCart();
  if (!cart.length) return alert("Cart empty");

  const order = {
    user_id: user.id,
    user_email: user.email,
    items: cart,
    total: cartTotal(),
    created_at: new Date().toISOString()
  };

  const { data, error } = await sb.from("orders").insert(order).select("id");
  if (error) return alert(error.message);

  clearCart();
  alert("Order placed! ID: " + (data?.[0]?.id || "?"));
}

/* ========== Products Page ========== */
let PAGE = 1;
const PER_PAGE = 6;
let isLoadingProducts = false;

async function setupIndexPage() {
  const grid = $("productsGrid");
  const search = $("search");
  const prev = $("prevPage");
  const next = $("nextPage");

  async function loadProducts() {
    if (isLoadingProducts) return;
    isLoadingProducts = true;

    const q = (search?.value || "").toLowerCase();
    const start = (PAGE - 1) * PER_PAGE;
    const end = start + PER_PAGE - 1;

    const { data, error } = await sb.from("products")
      .select("*")
      .order("id")
      .range(start, end);

    if (error) {
      grid.innerHTML = `<p class="text-red-500">Error loading products.</p>`;
      return (isLoadingProducts = false);
    }

    let items = data;
    if (q) items = items.filter(p => p.title.toLowerCase().includes(q));

    grid.innerHTML = "";
    if (!items.length) {
      grid.innerHTML = `<p class="text-gray-500">No products found.</p>`;
    } else {
      items.forEach(p => {
        const div = document.createElement("div");
        div.className = "bg-white rounded shadow p-4 flex flex-col";

        div.innerHTML = `
          <a href="product.html?id=${p.id}" class="block h-48 mb-3">
            <img class="w-full h-full object-contain product-img" />
          </a>
          <h3 class="font-semibold text-lg">${p.title}</h3>
          <p class="text-sm text-gray-500">${p.description.substring(0,100)}</p>
          <div class="mt-3 flex justify-between">
            <span class="font-bold">${rup(p.price)}</span>
            <button class="addNow px-3 py-1 border rounded" data-id="${p.id}">Add</button>
          </div>
        `;

        grid.appendChild(div);
        setImageWithFallback(div.querySelector(".product-img"), p.image_url, p.title);
      });

      document.querySelectorAll(".addNow")
        .forEach(btn => {
          btn.onclick = async () => {
            const { data: p } = await sb.from("products").select("*").eq("id", btn.dataset.id).single();
            addToCart({ id: String(p.id), title: p.title, price: p.price, qty: 1 });
            alert("Added to cart");
          };
        });
    }

    $("pageInfo").textContent = `Page ${PAGE}`;
    prev.disabled = PAGE === 1;
    isLoadingProducts = false;
  }

  prev.onclick = () => { if (PAGE > 1) PAGE--; loadProducts(); };
  next.onclick = () => { PAGE++; loadProducts(); };
  search.oninput = () => { PAGE = 1; loadProducts(); };

  loadProducts();
}

/* ========== Product Page ========== */
async function setupProductPage() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return;

  const { data: p, error } = await sb.from("products").select("*").eq("id", id).single();
  if (error) return alert("Product not found");

  setImageWithFallback($("productImage"), p.image_url, p.title);
  $("productTitle").textContent = p.title;
  $("productDesc").textContent = p.description;
  $("productPrice").textContent = rup(p.price);

  $("addToCart").onclick = () => {
    const qty = Number($("quantity").value) || 1;
    addToCart({ id: String(p.id), title: p.title, price: p.price, qty });
    alert("Added to cart");
  };
}

/* ========== INIT ========== */
document.addEventListener("DOMContentLoaded", async () => {
  await initAuthUI();
  updateCartUI();

  $("btnCart")?.addEventListener("click", () => $("cartModal").classList.remove("hidden"));
  $("closeCart")?.addEventListener("click", () => $("cartModal").classList.add("hidden"));
  $("clearCart")?.addEventListener("click", () => confirm("Clear cart?") && clearCart());
  $("checkout")?.addEventListener("click", checkout);

  $("btnLogin")?.addEventListener("click", () => showAuthModal("login"));
  $("switchToSignup")?.addEventListener("click", (e)=> { e.preventDefault(); showAuthModal("signup"); });
  $("switchToLogin")?.addEventListener("click", (e)=> { e.preventDefault(); showAuthModal("login"); });
  $("cancelAuth")?.addEventListener("click", () => $("loginModal").classList.add("hidden"));

  if (location.pathname.includes("product.html")) setupProductPage();
  else setupIndexPage();
});
