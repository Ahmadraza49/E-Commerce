/* =======================================================
   UPDATED script.js — fixes: signup 422 visibility, modal button text, error feedback
   Replace your existing script.js with this file.
   ======================================================= */

/* ========== Supabase setup (your values) ========== */
const SUPABASE_URL = "https://ytxhlihzxgftffaikumr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eGhsaWh6eGdmdGZmYWlrdW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODAxNTgsImV4cCI6MjA3OTQ1NjE1OH0._k5hfgJwVSrbXtlRDt3ZqCYpuU1k-_OqD7M0WML4ehA";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ========== Utilities ========== */
const $ = (id) => document.getElementById(id);
const rup = (n) => "₹" + Number(n || 0).toLocaleString();

function setImageWithFallback(imgEl, url, title) {
  const fallback = `https://placehold.co/600x400?text=${encodeURIComponent(title || "Product")}&font=roboto`;
  if (!imgEl) return;
  if (!url) { imgEl.src = fallback; return; }
  imgEl.src = url;
  imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = fallback; };
}

/* ========== In-memory cart ========== */
let CART = [];
function loadCart() { return CART; }
function saveCartToMemory(cart) { CART = cart; updateCartUI(); }
function addToCart(item) {
  const cart = loadCart();
  const found = cart.find(i => i.id === item.id);
  if (found) found.qty += item.qty; else cart.push({...item});
  saveCartToMemory(cart);
}
function removeFromCart(id) { saveCartToMemory(loadCart().filter(i => i.id !== id)); }
function clearCart() { CART = []; updateCartUI(); }
function cartTotal() { return loadCart().reduce((s,i)=> s + Number(i.price) * i.qty, 0); }

/* ========== Auth (email + password) ========== */
async function initAuthUI() {
  try {
    const res = await sb.auth.getSession();
    const session = res?.data?.session;
    setUser(session?.user ?? null);
  } catch (e) { console.warn("initAuthUI error:", e); }
  sb.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
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

/* SIGNUP then auto-login (improved error handling) */
async function signupAndLogin(email, password) {
  if (!email || !password) return { error: { message: "Provide email & password" } };

  // sign up
  const { data: signData, error: signErr } = await sb.auth.signUp({ email, password });

  // If signErr exists, return it (we show message to user). Many cases (422) come here.
  if (signErr) {
    return { error: signErr };
  }

  // sign in after successful signup (or if supabase auto-signed-in, signInWithPassword will still succeed)
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  return { data, error };
}

async function loginWithPassword(email, password) {
  if (!email || !password) return { error: { message: "Provide email & password" } };
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  return { data, error };
}

/* Send reset email */
async function sendResetEmail(email) {
  if (!email) return { error: { message: "Enter email" } };
  const redirectTo = `${location.origin}/reset.html`;
  return await sb.auth.resetPasswordForEmail(email, { redirectTo });
}

/* ========== Cart UI ========== */
function updateCartUI() {
  const cart = loadCart();
  const count = cart.reduce((s,i)=> s + i.qty, 0);
  const cartCount = $("cartCount"); if (cartCount) cartCount.textContent = count;
  const cartWrap = $("cartItems"); if (!cartWrap) return;
  cartWrap.innerHTML = "";
  if (!cart.length) cartWrap.innerHTML = `<p class="text-sm text-gray-500">Cart empty.</p>`;
  else {
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
    cartWrap.querySelectorAll(".removeBtn").forEach(b => b.addEventListener("click", (e)=> removeFromCart(e.currentTarget.dataset.id)));
  }
  const totalEl = $("cartTotal"); if (totalEl) totalEl.textContent = rup(cartTotal());
}

/* ========== Checkout ========== */
async function checkout() {
  const userResp = await sb.auth.getUser();
  const user = userResp?.data?.user;
  if (!user) { alert("Please login first"); showAuthModal("login"); return; }
  const cart = loadCart(); if (!cart.length) { alert("Cart is empty"); return; }
  const order = { user_id: user.id, user_email: user.email, items: cart, total: cartTotal(), created_at: new Date().toISOString() };
  const { data, error } = await sb.from("orders").insert(order).select("id");
  if (error) { console.error("Order save error:", error); alert("Order failed: " + error.message); return; }
  clearCart();
  alert("Order placed! ID = " + (data?.[0]?.id || "(unknown)"));
}

/* ========== Auth Modal (improved) ========== */
function showAuthModal(mode = "login") {
  const m = $("loginModal"); if (!m) return;

  // set text and submit button label
  $("authTitle").textContent = mode === "signup" ? "Sign up" : "Login";
  $("authDesc").textContent = mode === "signup" ? "Create an account with email and password." : "Enter your email and password to sign in.";
  $("authMsg").textContent = "";

  // do NOT forcibly clear authEmail/authPass so user can type (but clear message)
  // show/hide mode links
  const switchToSignup = $("switchToSignup"), switchToLogin = $("switchToLogin");
  if (switchToSignup) switchToSignup.style.display = mode === "signup" ? "none" : "inline";
  if (switchToLogin) switchToLogin.style.display = mode === "signup" ? "inline" : "none";

  // set submit button label properly
  const submitBtn = $("submitAuth");
  if (submitBtn) submitBtn.textContent = mode === "signup" ? "Sign up" : "Login";

  m.classList.remove("hidden"); m.classList.add("flex");

  // handlers
  const cancelBtn = $("cancelAuth");
  cancelBtn.onclick = () => m.classList.add("hidden");

  submitBtn.onclick = async () => {
    const email = ($("authEmail")?.value || "").trim();
    const pass = ($("authPass")?.value || "").trim();
    const msg = $("authMsg");
    msg.style.color = "red"; msg.textContent = "Processing...";

    try {
      if (mode === "signup") {
        const { data, error } = await signupAndLogin(email, pass);
        if (error) {
          // Show detailed API error
          msg.textContent = error?.message || JSON.stringify(error) || "Signup error";
          return;
        }
        msg.style.color = "green"; msg.textContent = "Signup & login successful. Redirecting...";
        m.classList.add("hidden"); setTimeout(()=> window.location.href = "index.html", 600);
      } else {
        const { data, error } = await loginWithPassword(email, pass);
        if (error) {
          msg.textContent = error?.message || JSON.stringify(error) || "Login error";
          return;
        }
        msg.style.color = "green"; msg.textContent = "Login successful. Redirecting...";
        m.classList.add("hidden"); setTimeout(()=> window.location.href = "index.html", 600);
      }
    } catch (err) { msg.textContent = err?.message || String(err); }
  };

  // reset handler
  const resetBtn = $("btnReset");
  if (resetBtn) {
    resetBtn.onclick = async () => {
      const email = ($("authEmail")?.value || "").trim();
      if (!email) { alert("Enter your email first"); return; }
      const res = await sendResetEmail(email);
      if (res?.error) alert(res.error.message || "Reset failed");
      else alert("Password reset email sent — check your inbox.");
    };
  }

  // link switches
  $("switchToSignup")?.addEventListener("click", (ev) => { ev.preventDefault(); showAuthModal("signup"); });
  $("switchToLogin")?.addEventListener("click", (ev) => { ev.preventDefault(); showAuthModal("login"); });
}

/* ========== Products: server-side pagination ========== */
let PAGE = 1; const PER_PAGE = 6; let isLoadingProducts = false;
async function setupIndexPage() {
  const grid = $("productsGrid"), search = $("search"), prev = $("prevPage"), next = $("nextPage");
  async function loadProducts() {
    if (isLoadingProducts) return; isLoadingProducts = true;
    const q = (search?.value || "").trim().toLowerCase();
    const start = (PAGE - 1) * PER_PAGE, end = start + PER_PAGE - 1;
    try {
      const { data, error } = await sb.from("products").select("*").order("id", { ascending: true }).range(start, end);
      if (error) { console.error("Products fetch error:", error); grid.innerHTML = `<p class="text-sm text-red-500">Failed to load products.</p>`; isLoadingProducts = false; return; }
      let items = data || [];
      if (q) items = items.filter(p => (p.title||"").toLowerCase().includes(q) || (p.description||"").toLowerCase().includes(q));
      grid.innerHTML = ""; if (!items.length) grid.innerHTML = `<p class="text-sm text-gray-500">No products found.</p>`;
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
          const p = pResp; if (!p) return alert("Product not found");
          addToCart({ id: String(p.id), title: p.title, price: Number(p.price), qty: 1 }); alert("Added to cart");
        } catch (err) { console.error(err); alert("Failed to add to cart"); }
      }));
      $("pageInfo").textContent = `Page ${PAGE}`;
      prev.disabled = PAGE === 1; next.disabled = false;
    } catch (err) { console.error("Load products failed:", err); grid.innerHTML = `<p class="text-sm text-red-500">Error loading products.</p>`; }
    finally { isLoadingProducts = false; }
  }
  prev.addEventListener("click", ()=> { if (PAGE>1) PAGE--; loadProducts(); });
  next.addEventListener("click", ()=> { PAGE++; loadProducts(); });
  search.addEventListener("input", ()=> { PAGE = 1; loadProducts(); });
  loadProducts();
}

/* ========== Product page ========== */
async function setupProductPage() {
  const id = new URLSearchParams(location.search).get("id"); if (!id) return;
  try {
    const { data: p, error } = await sb.from("products").select("*").eq("id", id).single();
    if (error) return alert("Product not found");
    setImageWithFallback($("productImage"), p.image_url, p.title);
    $("productTitle").textContent = p.title; $("productDesc").textContent = p.description; $("productPrice").textContent = rup(p.price);
    $("addToCart").onclick = () => {
      const qty = Number($("quantity").value) || 1;
      addToCart({ id: String(p.id), title: p.title, price: Number(p.price), qty });
      alert("Added to cart");
    };
  } catch (err) { console.error(err); alert("Failed to load product"); }
}

/* ========== Page init ========== */
document.addEventListener("DOMContentLoaded", async () => {
  await initAuthUI();
  updateCartUI();
  const cartBtn = $("btnCart") || $("btnCartHeader"); if (cartBtn) cartBtn.addEventListener("click", ()=> $("cartModal").classList.remove("hidden"));
  $("closeCart")?.addEventListener("click", ()=> $("cartModal").classList.add("hidden"));
  $("clearCart")?.addEventListener("click", ()=> { if (confirm("Clear cart?")) clearCart(); });
  $("checkout")?.addEventListener("click", checkout);
  $("btnLogin")?.addEventListener("click", ()=> showAuthModal("login"));
  $("switchToSignup")?.addEventListener("click", (e)=> { e.preventDefault(); showAuthModal("signup"); });
  $("switchToLogin")?.addEventListener("click", (e)=> { e.preventDefault(); showAuthModal("login"); });
  $("cancelAuth")?.addEventListener("click", ()=> $("loginModal").classList.add("hidden"));
  if (location.pathname.includes("product.html")) setupProductPage(); else setupIndexPage();
});
