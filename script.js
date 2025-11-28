/* =======================================================
   script.js — Cart (localStorage) + Auth + Products + Orders
   - Persist cart to localStorage
   - Checkout inserts into Supabase orders table
   - Auth UI updates user area
   ======================================================= */

/* ========== Supabase setup ========== */
const SUPABASE_URL = "https://ytxhlihzxgftffaikumr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eGhsaWh6eGdmdGZmYWlrdW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODAxNTgsImV4cCI6MjA3OTQ1NjE1OH0._k5hfgJwVSrbXtlRDt3ZqCYpuU1k-_OqD7M0WML4ehA";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ========== Utilities ========== */
const $ = (id) => document.getElementById(id);
const rup = (n) => "₹" + Number(n || 0).toLocaleString();

/* Image fallback helper */
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

/* ========== Cart (localStorage-backed) ========== */
const CART_KEY = "myshop_cart_v1";

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse cart:", e);
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch (e) {
    console.warn("Failed to save cart:", e);
  }
  updateCartUI();
}

function addToCart(item) {
  if (!item || !item.id) return;
  const cart = loadCart();
  const found = cart.find(i => i.id === String(item.id));
  if (found) found.qty = Number(found.qty || 0) + Number(item.qty || 1);
  else cart.push({ id: String(item.id), title: item.title, price: Number(item.price || 0), qty: Number(item.qty || 1) });
  saveCart(cart);
}

function removeFromCart(id) {
  const cart = loadCart().filter(i => i.id !== String(id));
  saveCart(cart);
}

function clearCart() {
  saveCart([]);
}

function cartTotalValue() {
  return loadCart().reduce((s, i) => s + Number(i.price) * Number(i.qty), 0);
}

/* ========== Auth UI ========== */
async function initAuthUI() {
  try {
    const res = await sb.auth.getSession();
    setUser(res?.data?.session?.user ?? null);
  } catch (e) {
    console.warn("initAuthUI error:", e);
  }

  sb.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
  });
}

function setUser(user) {
  const userArea = $("userArea");
  const btnLogin = $("btnLogin");
  const btnLogout = $("btnLogout");
  const userEmailEl = $("userEmail");

  if (user) {
    if (userArea) userArea.classList.remove("hidden");
    if (btnLogin) btnLogin.classList.add("hidden");
    if (userEmailEl) userEmailEl.textContent = user.email || "";
  } else {
    if (userArea) userArea.classList.add("hidden");
    if (btnLogin) btnLogin.classList.remove("hidden");
    if (userEmailEl) userEmailEl.textContent = "";
  }

  if (btnLogout) {
    btnLogout.onclick = async () => {
      try {
        await sb.auth.signOut();
      } catch (e) {
        console.warn("signOut error:", e);
      }
      clearCart();
      alert("Logged out");
      window.location.href = "index.html";
    };
  }
}

/* ========== Auth helpers (signup/login/reset) ========== */
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

/* ========== Auth modal logic (shared) ========== */
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

  if (mode === "signup") {
    btn.textContent = "Create Account";
    swSignup.style.display = "none";
    swLogin.style.display = "inline";
  } else {
    btn.textContent = "Login";
    swSignup.style.display = "inline";
    swLogin.style.display = "none";
  }

  m.classList.remove("hidden");
  m.classList.add("flex");

  btn.onclick = async () => {
    const email = $("authEmail").value.trim();
    const pass = $("authPass").value.trim();

    msg.style.color = "red";
    msg.textContent = "Processing...";

    try {
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
    } catch (e) {
      console.error("auth error:", e);
      msg.style.color = "red";
      msg.textContent = "Something went wrong";
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

/* ========== Cart UI rendering ========== */
function updateCartUI() {
  const cart = loadCart();
  const count = cart.reduce((s, i) => s + Number(i.qty || 0), 0);
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
          <div class="font-semibold">${escapeHtml(i.title)}</div>
          <div class="text-sm text-gray-500">Qty ${i.qty} × ${rup(i.price)}</div>
        </div>
        <div class="text-right">
          <div class="font-bold">${rup(Number(i.qty) * Number(i.price))}</div>
          <button data-id="${i.id}" class="removeBtn text-sm mt-1">Remove</button>
        </div>`;
      wrap.appendChild(div);
    });

    wrap.querySelectorAll(".removeBtn")
      .forEach(btn => btn.onclick = () => removeFromCart(btn.dataset.id));
  }

  if ($("cartTotal")) $("cartTotal").textContent = rup(cartTotalValue());
}

/* Simple HTML escape to avoid accidental injection when rendering titles/descriptions */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ========== Checkout (insert order into Supabase) ========== */
async function checkoutHandler() {
  const session = await sb.auth.getUser();
  const user = session?.data?.user;
  if (!user) {
    alert("Please login first");
    showAuthModal("login");
    return;
  }

  const cart = loadCart();
  if (!cart.length) {
    alert("Cart empty");
    return;
  }

  const total = cartTotalValue();

  const order = {
    user_id: user.id,
    user_email: user.email,
    items: cart,
    total: total,
    status: "Pending",
    created_at: new Date().toISOString()
  };

  try {
    const { data, error } = await sb.from("orders").insert(order).select("id");
    if (error) {
      console.error("order insert error:", error);
      alert("Order failed: " + (error.message || "unknown"));
      return;
    }
    clearCart();
    alert("Order placed! ID: " + (data?.[0]?.id || "?"));
    // Optionally redirect to orders page:
    // window.location.href = "orders.html";
  } catch (e) {
    console.error("checkout exception:", e);
    alert("Order failed");
  }
}

/* ========== Products listing (index) ========== */
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
      console.error("products error:", error);
      grid.innerHTML = `<p class="text-red-500">Error loading products.</p>`;
      isLoadingProducts = false;
      return;
    }

    let items = data || [];
    if (q) items = items.filter(p => (p.title || "").toLowerCase().includes(q));

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
          <h3 class="font-semibold text-lg">${escapeHtml(p.title)}</h3>
          <p class="text-sm text-gray-500">${escapeHtml((p.description || "").substring(0,100))}</p>
          <div class="mt-3 flex justify-between items-center">
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
            try {
              const { data: p, error } = await sb.from("products").select("*").eq("id", btn.dataset.id).single();
              if (error) {
                console.error("product fetch error:", error);
                alert("Failed to add product");
                return;
              }
              addToCart({ id: String(p.id), title: p.title, price: p.price, qty: 1 });
              alert("Added to cart");
            } catch (e) {
              console.error("addNow error:", e);
              alert("Failed to add product");
            }
          };
        });
    }

    if ($("pageInfo")) $("pageInfo").textContent = `Page ${PAGE}`;
    if (prev) prev.disabled = PAGE === 1;
    isLoadingProducts = false;
  }

  prev.onclick = () => { if (PAGE > 1) PAGE--; loadProducts(); };
  next.onclick = () => { PAGE++; loadProducts(); };
  if (search) search.oninput = () => { PAGE = 1; loadProducts(); };

  loadProducts();
}

/* ========== Product page setup ========== */
async function setupProductPage() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return;

  const { data: p, error } = await sb.from("products").select("*").eq("id", id).single();
  if (error || !p) {
    console.error("product page error:", error);
    return alert("Product not found");
  }

  setImageWithFallback($("productImage"), p.image_url, p.title);
  if ($("productTitle")) $("productTitle").textContent = p.title;
  if ($("productDesc")) $("productDesc").textContent = p.description;
  if ($("productPrice")) $("productPrice").textContent = rup(p.price);

  const addBtn = $("addToCart");
  if (addBtn) {
    addBtn.onclick = () => {
      const qty = Number($("quantity")?.value || 1) || 1;
      addToCart({ id: String(p.id), title: p.title, price: p.price, qty });
      alert("Added to cart");
    };
  }
}

/* ========== INIT — wire up buttons & pages ========== */
document.addEventListener("DOMContentLoaded", async () => {
  await initAuthUI();

  // initial render of cart UI
  updateCartUI();

  // Cart open/close
  $("btnCart")?.addEventListener("click", () => {
    const modal = $("cartModal");
    if (modal) modal.classList.remove("hidden");
  });

  $("closeCart")?.addEventListener("click", () => {
    const modal = $("cartModal");
    if (modal) modal.classList.add("hidden");
  });

  // clear & checkout handlers
  $("clearCart")?.addEventListener("click", () => {
    if (confirm("Clear cart?")) clearCart();
  });

  $("checkout")?.addEventListener("click", checkoutHandler);

  // Login modal
  $("btnLogin")?.addEventListener("click", () => showAuthModal("login"));
  $("switchToSignup")?.addEventListener("click", (e) => { e.preventDefault(); showAuthModal("signup"); });
  $("switchToLogin")?.addEventListener("click", (e) => { e.preventDefault(); showAuthModal("login"); });
  $("cancelAuth")?.addEventListener("click", () => $("loginModal")?.classList.add("hidden"));

  // Page specific
  if (location.pathname.includes("product.html")) await setupProductPage();
  else await setupIndexPage();
});
