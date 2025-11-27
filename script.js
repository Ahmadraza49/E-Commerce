/* =======================================================
   FINAL script.js — Email+Password auth, reset, products, orders
   Paste/replace your existing script.js with this file.
   ======================================================= */

/* ========== Supabase setup (you provided) ========== */
const SUPABASE_URL = "https://ytxhlihzxgftffaikumr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eGhsaWh6eGdmdGZmYWlrdW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODAxNTgsImV4cCI6MjA3OTQ1NjE1OH0._k5hfgJwVSrbXtlRDt3ZqCYpuU1k-_OqD7M0WML4ehA";
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

/* ========== In-memory cart (no localStorage) ========== */
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

/* ========== AUTH (email + password) ========== */
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

/* NOTE: we intentionally DO NOT display user email in header for privacy */
function setUser(user) {
  const userArea = $("userArea");
  const btnLogin = $("btnLogin");
  const btnLogout = $("btnLogout");

  if (!btnLogin) return;

  if (user) {
    // show only generic user area (no email text)
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
      // redirect to index to refresh state
      window.location.href = "index.html";
    };
  }
}

/* Signup then auto-login */
async function signupAndLogin(email, password) {
  if (!email || !password) return { error: { message: "Provide email & password" } };

  // sign up
  const { data: signData, error: signErr } = await sb.auth.signUp({ email, password });
  // ignore "already registered" style messages and proceed to sign in
  if (signErr && signErr.status && signErr.status !== 400) {
    return { error: signErr };
  }

  // sign in
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  return { data, error };
}

async function loginWithPassword(email, password) {
  if (!email || !password) return { error: { message: "Provide email & password" } };
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  return { data, error };
}

/* Reset password: sends reset email with redirect back to site (use reset.html if you create it) */
async function sendResetEmail(email) {
  if (!email) return { error: { message: "Enter email" } };
  const redirectTo = `${location.origin}/reset.html`; // create reset.html to accept the token and allow password change
  return await sb.auth.resetPasswordForEmail(email, { redirectTo });
}

/* ========== CART UI ========== */
function updateCartUI() {
  const cart = loadCart();
  const count = cart.reduce((s,i)=>s + i.qty, 0);
  const cartCount = $("cartCount");
  if (cartCount) cartCount.textContent = count;

  const cartWrap = $("cartItems");
  if (!cartWrap) return;
  cartWrap.innerHTML = "";
  if (!cart.length) {
    cartWrap.innerHTML = `<p class="text-sm text-gray-500">Cart empty.</p>`;
  } else {
    cart.forEach(i => {
      const block = document.createElement("div");
      block.className = "flex items-center justify-between";
      block.innerHTML = `
        <div>
          <div class="font-semibold">${i.title}</div>
          <div class="text-sm text-gray-500">Qty ${i.qty} × ${rup(i.price)}</div>
        </div>
        <div class="text-right">
          <div class="font-bold">${rup(i.qty * i.price)}</div>
          <button data-id="${i.id}" class="removeBtn text-sm mt-1">Remove</button>
        </div>
      `;
      cartWrap.appendChild(block);
    });
    cartWrap.querySelectorAll(".removeBtn").forEach(b => b.addEventListener("click", (e) => {
      removeFromCart(e.currentTarget.dataset.id);
    }));
  }
  const totalEl = $("cartTotal");
  if (totalEl) totalEl.textContent = rup(cartTotal());
}

/* ========== Checkout: save order to Supabase ========== */
async function checkout() {
  const userResp = await sb.auth.getUser();
  const user = userResp?.data?.user;
  if (!user) {
    alert("Please login first");
    showAuthModal("login");
    return;
  }
  const cart = loadCart();
  if (!cart.length) { alert("Cart is empty"); return; }

  const order = {
    user_id: user.id,
    user_email: user.email,
    items: cart,
    total: cartTotal(),
    created_at: new Date().toISOString()
  };

  const { data, error } = await sb.from("orders").insert(order).select("id");
  if (error) {
    console.error("Order save error:", error);
    alert("Order failed: " + error.message);
    return;
  }
  clearCart();
  alert("Order placed! ID = " + (data?.[0]?.id || "(unknown)"));
}

/* ========== Auth Modal (login/signup UI + reset) ========== */
function showAuthModal(mode = "login") {
  const m = $("loginModal");
  if (!m) return;

  $("authTitle").textContent = mode === "signup" ? "Sign up" : "Login";
  $("authDesc").textContent = mode === "signup" ? "Create an account with email and password." : "Enter your email and password to sign in.";
  $("authMsg").textContent = "";

  // ensure inputs are empty (so previous email not prefilled)
  if ($("authEmail")) $("authEmail").value = "";
  if ($("authPass")) $("authPass").value = "";

  $("switchToSignup").style.display = mode === "signup" ? "none" : "inline";
  $("switchToLogin").style.display = mode === "signup" ? "inline" : "none";

  m.classList.remove("hidden");
  m.classList.add("flex");

  const submitBtn = $("submitAuth");
  const cancelBtn = $("cancelAuth");
  const resetBtn = $("btnReset");

  submitBtn.onclick = async () => {
    const email = ($("authEmail")?.value || "").trim();
    const pass = ($("authPass")?.value || "").trim();
    const msg = $("authMsg");
    msg.style.color = "red";
    msg.textContent = "Processing...";

    try {
      if (mode === "signup") {
        const { data, error } = await signupAndLogin(email, pass);
        if (error) { msg.textContent = error.message || "Signup error"; return; }
        msg.style.color = "green";
        msg.textContent = "Signup & login successful. Redirecting...";
        m.classList.add("hidden");
        setTimeout(()=> window.location.href = "index.html", 600);
      } else {
        const { data, error } = await loginWithPassword(email, pass);
        if (error) { msg.textContent = error.message || "Login error"; return; }
        msg.style.color = "green";
        msg.textContent = "Login successful. Redirecting...";
        m.classList.add("hidden");
        setTimeout(()=> window.location.href = "index.html", 600);
      }
    } catch (e) { msg.textContent = e.message || String(e); }
  };

  cancelBtn.onclick = () => m.classList.add("hidden");

  // reset button handler (sends reset email)
  if (resetBtn) {
    resetBtn.onclick = async () => {
      const email = ($("authEmail")?.value || "").trim();
      if (!email) { alert("Enter your email first"); return; }
      const res = await sendResetEmail(email);
      if (res.error) alert(res.error.message || "Reset failed");
      else alert("Password reset email sent — check your inbox.");
    };
  }

  $("switchToSignup").onclick = (ev) => { ev.preventDefault(); showAuthModal("signup"); };
  $("switchToLogin").onclick = (ev) => { ev.preventDefault(); showAuthModal("login"); };
}

/* ========== Products: server-side pagination (range) ========== */
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
    const q = (search?.value || "").trim().toLowerCase();
    const start = (PAGE - 1) * PER_PAGE;
    const end = start + PER_PAGE - 1;

    try {
      const { data, error } = await sb.from("products").select("*").order("id", { ascending: true }).range(start, end);
      if (error) { console.error("Products fetch error:", error); grid.innerHTML = `<p class="text-sm text-red-500">Failed to load products.</p>`; isLoadingProducts = false; return; }

      let items = data || [];
      if (q) items = items.filter(p => (p.title||"").toLowerCase().includes(q) || (p.description||"").toLowerCase().includes(q));

      grid.innerHTML = "";
      if (!items.length) grid.innerHTML = `<p class="text-sm text-gray-500">No products found.</p>`;

      items.forEach(p => {
        const div = document.createElement("div");
        div.className = "bg-white rounded shadow p-4 flex flex-col";
        div.innerHTML = `
          <a href="product.html?id=${p.id}" class="block h-48 mb-3">
            <img class="w-full h-full object-contain product-img" alt="${(p.title||'Product').replace(/\"/g,'')}" />
          </a>
          <h3 class="font-semibold text-lg">${p.title||'Untitled'}</h3>
          <p class="text-sm text-gray-500">${(p.description||'').substr(0,120)}</p>
          <div class="mt-3 flex justify-between">
            <span class="font-bold">${rup(p.price)}</span>
            <button class="addNow px-3 py-1 border rounded" data-id="${p.id}">Add</button>
          </div>
        `;
        grid.appendChild(div);
        const imgEl = div.querySelector(".product-img");
        setImageWithFallback(imgEl, p.image_url, p.title);
      });

      document.querySelectorAll(".addNow").forEach(btn => btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.dataset.id;
        try {
          const { data: pResp } = await sb.from("products").select("*").eq("id", id).limit(1).single();
          const p = pResp;
          if (!p) return alert("Product not found");
          addToCart({ id: String(p.id), title: p.title, price: Number(p.price), qty: 1 });
          alert("Added to cart");
        } catch (err) { console.error(err); alert("Failed to add to cart"); }
      }));

      $("pageInfo").textContent = `Page ${PAGE}`;
      prev.disabled = PAGE === 1;
      next.disabled = false;
    } catch (err) {
      console.error("Load products failed:", err);
      grid.innerHTML = `<p class="text-sm text-red-500">Error loading products.</p>`;
    } finally { isLoadingProducts = false; }
  }

  prev.addEventListener("click", ()=> { if (PAGE>1) PAGE--; loadProducts(); });
  next.addEventListener("click", ()=> { PAGE++; loadProducts(); });
  search.addEventListener("input", ()=> { PAGE = 1; loadProducts(); });

  loadProducts();
}

/* ========== Product page ========== */
async function setupProductPage() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return;
  try {
    const { data: p, error } = await sb.from("products").select("*").eq("id", id).single();
    if (error) return alert("Product not found");
    setImageWithFallback($("productImage"), p.image_url, p.title);
    $("productTitle").textContent = p.title;
    $("productDesc").textContent = p.description;
    $("productPrice").textContent = rup(p.price);
    $("addToCart").onclick = () => {
      const qty = Number($("quantity").value) || 1;
      addToCart({ id: String(p.id), title: p.title, price: Number(p.price), qty });
      alert("Added to cart");
    };
  } catch (err) { console.error(err); alert("Failed to load product"); }
}

/* ========== Page init ========== */
document.addEventListener("DOMContentLoaded", async () => {
  // warn if multiple supabase scripts
  if (window.__supabase_script_loaded_twice) console.warn("Supabase script may be loaded multiple times.");
  await initAuthUI();
  updateCartUI();

  const cartBtn = $("btnCart") || $("btnCartHeader");
  if (cartBtn) cartBtn.addEventListener("click", () => $("cartModal").classList.remove("hidden"));
  $("closeCart")?.addEventListener("click", () => $("cartModal").classList.add("hidden"));
  $("clearCart")?.addEventListener("click", () => { if (confirm("Clear cart?")) clearCart(); });
  $("checkout")?.addEventListener("click", checkout);

  $("btnLogin")?.addEventListener("click", () => showAuthModal("login"));

  // switch links if present
  $("switchToSignup")?.addEventListener("click", (e)=> { e.preventDefault(); showAuthModal("signup"); });
  $("switchToLogin")?.addEventListener("click", (e)=> { e.preventDefault(); showAuthModal("login"); });

  $("cancelAuth")?.addEventListener("click", () => $("loginModal").classList.add("hidden"));

  // reset button (if present) is wired inside showAuthModal

  if (location.pathname.includes("product.html")) setupProductPage();
  else setupIndexPage();
});
