/* =======================================================
   script.js — Unified & fixed version for index/product/orders/reset
   - Handles auth (login / signup / logout)
   - Password reset (send reset email + exchange code -> update password)
   - Products listing + pagination + search
   - Product page thumbnails + add-to-cart
   - Cart UI + save to localStorage
   - Checkout -> saves order with user id
   - Defensive: checks for missing DOM nodes (works across pages)
======================================================= */

/* ========== Supabase Setup ========== */
const SUPABASE_URL = "https://ytxhlihzxgftffaikumr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eGhsaWh6eGdmdGZmYWlrdW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODAxNTgsImV4cCI6MjA3OTQ1NjE1OH0._k5hfgJwVSrbXtlRDt3ZqCYpuU1k-_OqD7M0WML4ehA";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ========== Global Variables ========== */
let products = [];
let cart = JSON.parse(localStorage.getItem("cart") || "[]");
let currentPage = 1;
const itemsPerPage = 6;

/* ========== Utility helpers ========== */
function qs(id){ return document.getElementById(id); }
function show(el){ if(!el) return; el.classList.remove("hidden"); el.style.display = ""; }
function hide(el){ if(!el) return; el.classList.add("hidden"); el.style.display = "none"; }
function toast(msg){ try{ alert(msg); } catch(e){ console.log(msg); } }
function saveCart(){ localStorage.setItem("cart", JSON.stringify(cart)); }

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async ()=> {
  // 1) Initialize auth UI / listeners
  await checkAuth();

  // 2) Try to exchange password-reset "code" on reset page if present
  await handleResetExchange();

  // 3) Load products list if we are on products page
  if (qs("productsGrid")) await loadProducts();

  // 4) Update cart UI if present
  updateCartUI();

  // 5) Setup product page behavior if present
  await setupProductPage();

  // 6) Attach auth modal triggers/listeners
  attachAuthModalHandlers();

  // 7) Attach cart modal handlers (if present)
  qs("btnCart")?.addEventListener("click", ()=> show(qs("cartModal")));
  qs("closeCart")?.addEventListener("click", ()=> hide(qs("cartModal")));
  qs("clearCart")?.addEventListener("click", ()=> { cart = []; saveCart(); updateCartUI(); });

  // 8) Pagination/search listeners
  qs("search")?.addEventListener("input", ()=>{ currentPage = 1; renderProducts(); });
  qs("prevPage")?.addEventListener("click", ()=>{ if(currentPage>1){ currentPage--; renderProducts(); }});
  qs("nextPage")?.addEventListener("click", ()=>{ currentPage++; renderProducts(); });

  // 9) Checkout listener
  qs("checkout")?.addEventListener("click", async ()=>{
    const user = (await sb.auth.getUser()).data?.user;
    if(!user){ toast("Please login first to place an order."); return; }
    if(!cart.length){ toast("Cart is empty"); return; }

    const order = {
      user_id: user.id,
      total: cart.reduce((a,b)=>a + (b.price * b.qty), 0),
      items: cart,
      status: "Pending",
      created_at: new Date().toISOString()
    };

    const { error } = await sb.from("orders").insert([order]);
    if(error){ toast("Order error: " + error.message); console.error(error); return; }
    toast("Order placed!");
    cart = []; saveCart(); updateCartUI();
    hide(qs("cartModal"));
  });
});

/* ================= AUTH (check + UI) ================= */
async function checkAuth(){
  try{
    const { data } = await sb.auth.getUser();
    const user = data?.user || null;

    // Elements (some pages may not have these)
    const userArea = qs("userArea");
    const btnLogin = qs("btnLogin");
    const btnLogout = qs("btnLogout");
    const userEmailSpan = qs("userEmail");

    if(user){
      // logged in
      if(userArea) userArea.style.display = "flex";
      if(btnLogin) btnLogin.style.display = "none";
      if(btnLogout) btnLogout.style.display = "inline-block";
      if(userEmailSpan) userEmailSpan.textContent = user.email;
      // attach logout
      qs("btnLogout")?.addEventListener("click", async ()=>{
        await sb.auth.signOut();
        await checkAuth();
        location.reload();
      }, { once: true });
    } else {
      // not logged in
      if(userArea) userArea.style.display = "none";
      if(btnLogin) btnLogin.style.display = "inline-block";
      if(btnLogout) btnLogout.style.display = "none";
    }
  } catch(err){
    console.error("checkAuth error", err);
  }
}

/* ================= AUTH MODAL + flows ================= */
function attachAuthModalHandlers(){
  // Show login modal
  qs("btnLogin")?.addEventListener("click", ()=>{
    openAuthModal("login");
  });

  // If there's a "btnSignup" in some pages, attach to open signup
  qs("btnSignup")?.addEventListener("click", ()=> openAuthModal("signup"));

  // Modal buttons (may be absent on pages that don't include modal)
  const loginModal = qs("loginModal");
  const switchToSignup = qs("switchToSignup");
  const switchToLogin = qs("switchToLogin");
  const cancelAuth = qs("cancelAuth");
  const submitAuth = qs("submitAuth");
  const authMsg = qs("authMsg");
  const btnReset = qs("btnReset");

  // Switch links
  switchToSignup?.addEventListener("click", (e)=>{
    e.preventDefault();
    openAuthModal("signup");
  });
  switchToLogin?.addEventListener("click", (e)=>{
    e.preventDefault();
    openAuthModal("login");
  });

  cancelAuth?.addEventListener("click", ()=> hide(loginModal));

  submitAuth?.addEventListener("click", async ()=>{
    if(!submitAuth) return;
    submitAuth.disabled = true;
    if(authMsg) { authMsg.textContent = ""; authMsg.style.color = "red"; }

    const mode = loginModal?.dataset.mode || "login"; // "login" or "signup"
    const email = qs("authEmail")?.value?.trim();
    const password = qs("authPass")?.value?.trim();

    if(!email){ if(authMsg) authMsg.textContent = "Enter email"; submitAuth.disabled=false; return; }
    if(!password){ if(authMsg) authMsg.textContent = "Enter password"; submitAuth.disabled=false; return; }
    if(password.length < 6){ if(authMsg) authMsg.textContent = "Password must be at least 6 chars"; submitAuth.disabled=false; return; }

    try{
      if(mode === "login"){
        // Sign in
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if(error){ if(authMsg) authMsg.textContent = error.message; else toast(error.message); submitAuth.disabled=false; return; }
        // success
        if(authMsg){ authMsg.style.color = "green"; authMsg.textContent = "Logged in!"; }
        hide(loginModal);
        await checkAuth();
        updateCartUI();
        // optional reload so UI across pages shows logged in state
        setTimeout(()=> location.reload(), 300);
      } else {
        // Sign up
        const { data, error } = await sb.auth.signUp({ email, password });
        if(error){ if(authMsg) authMsg.textContent = error.message; else toast(error.message); submitAuth.disabled=false; return; }
        // success - supabase may require email confirmation depending on settings
        if(authMsg){ authMsg.style.color = "green"; authMsg.textContent = "Signed up! Check email if confirmation required."; }
        hide(loginModal);
        await checkAuth();
        setTimeout(()=> location.reload(), 500);
      }
    } catch(err){
      console.error("auth error", err);
      if(authMsg) authMsg.textContent = err.message || "Auth error";
    } finally {
      submitAuth.disabled = false;
    }
  });

  // Reset password (send reset email)
  btnReset?.addEventListener("click", async ()=>{
    const email = qs("authEmail")?.value?.trim();
    const authMsgEl = qs("authMsg");
    if(!email){ if(authMsgEl) authMsgEl.textContent = "Enter your email to reset password"; return; }
    if(authMsgEl){ authMsgEl.style.color = "black"; authMsgEl.textContent = "Sending reset email..."; }

    try{
      // Provide a redirectTo option so user lands on your reset page (change path if needed)
      const redirectTo = window.location.origin + "/reset_password.html"; // <-- ensure you have this file or change accordingly
      const { data, error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if(error){ if(authMsgEl) authMsgEl.textContent = error.message; else toast(error.message); return; }
      if(authMsgEl){ authMsgEl.style.color = "green"; authMsgEl.textContent = "Reset email sent (check inbox)."; }
    } catch(err){
      console.error("reset request error", err);
      if(authMsgEl) authMsgEl.textContent = err.message || "Could not send reset email.";
    }
  });
}

function openAuthModal(mode = "login"){
  const loginModal = qs("loginModal");
  if(!loginModal) return;

  // set mode dataset so submit handler knows whether to login/signup
  loginModal.dataset.mode = mode;
  qs("authTitle") && (qs("authTitle").textContent = mode === "login" ? "Login" : "Sign up");
  qs("submitAuth") && (qs("submitAuth").textContent = mode === "login" ? "Login" : "Sign up");
  // Switch link visibility
  if(qs("switchToSignup")) qs("switchToSignup").style.display = mode === "login" ? "" : "none";
  if(qs("switchToLogin")) qs("switchToLogin").style.display = mode === "signup" ? "" : "none";
  // clear messages
  if(qs("authMsg")) { qs("authMsg").textContent = ""; qs("authMsg").style.color = "red"; }
  show(loginModal);
}

/* ================= RESET PASSWORD: exchange code -> session ================= */
async function handleResetExchange(){
  // When user clicks link from email, supabase may append a `code` param to the URL.
  // Exchange the code for a session so we can call updateUser() on the reset page.
  try{
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if(!code) return;

    // Exchange code for session
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if(error){ console.warn("exchangeCodeForSession error:", error); return; }
    // session should now be set; some pages (reset page) rely on signed-in user to call updateUser()
    console.log("Password reset exchange success", data);
  } catch(err){
    console.error("handleResetExchange err", err);
  }
}

/* ================= PRODUCTS (list + render + pagination) ================= */
async function loadProducts(){
  try{
    const { data, error } = await sb.from("products").select("*");
    if(error){ console.error("products load error", error); return; }
    products = data || [];
    renderProducts();
  } catch(err){
    console.error("loadProducts err", err);
  }
}

function renderProducts(){
  const searchInput = qs("search");
  const productsGrid = qs("productsGrid");
  if(!productsGrid) return;

  const search = (searchInput?.value || "").toLowerCase();
  const filtered = products.filter(p => (p.title||"").toLowerCase().includes(search));
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  if(currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = filtered.slice(start, start + itemsPerPage);

  productsGrid.innerHTML = pageItems.map(p => {
    const img = p.image_url || p.image || (p.design_images && (Array.isArray(p.design_images) ? p.design_images[0] : (String(p.design_images).split(",")[0] || ""))) || "";
    return `
      <div class="bg-white p-4 rounded shadow flex flex-col">
        <img src="${img}" class="h-48 w-full object-contain mb-2" onerror="this.style.display='none'"/>
        <h3 class="font-semibold">${escapeHtml(p.title || "")}</h3>
        <p class="text-gray-500">${escapeHtml((p.description||"").substring(0,70))}...</p>
        <p class="text-xl font-bold mt-2">₹${p.price}</p>
        <a href="product.html?id=${p.id}" class="mt-auto px-4 py-2 bg-indigo-600 text-white rounded text-center">View</a>
      </div>
    `;
  }).join("");

  const pageInfo = qs("pageInfo");
  if(pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

/* ================= PRODUCT PAGE (thumbnails + add to cart) ================= */
async function setupProductPage(){
  const addToCartBtn = qs("addToCart");
  if(!addToCartBtn) return; // not on product page

  const productTitleEl = qs("productTitle");
  const productDescEl = qs("productDesc");
  const productPriceEl = qs("productPrice");
  const productImagesEl = qs("productImages");
  const mainProductImageEl = qs("mainProductImage");

  // Clear default
  if(mainProductImageEl) mainProductImageEl.src = "";

  const productIdStr = new URLSearchParams(window.location.search).get("id");
  const productId = productIdStr ? Number(productIdStr) : 0;
  if(!productId){ toast("Invalid product id"); return; }

  try{
    const { data: product, error } = await sb.from("products").select("*").eq("id", productId).maybeSingle();
    if(error || !product){ console.error(error); toast("Product not found"); return; }

    if(productTitleEl) productTitleEl.textContent = product.title || "";
    if(productDescEl) productDescEl.textContent = product.description || "";
    if(productPriceEl) productPriceEl.textContent = "₹" + (product.price || "0");

    // Normalize images array
    let images = [];
    if (Array.isArray(product.design_images)) images = product.design_images;
    else if (typeof product.design_images === "string"){
      try{ images = JSON.parse(product.design_images); }
      catch(e){ images = product.design_images.split(",").map(s => s.trim()).filter(Boolean); }
    }
    // fallback to image_url or image
    if(!images.length){
      if(product.image_url) images.push(product.image_url);
      else if(product.image) images.push(product.image);
    }

    let selectedImage = images[0] || "";
    if(mainProductImageEl) mainProductImageEl.src = selectedImage;

    // Render thumbnails safely
    if(productImagesEl){
      productImagesEl.innerHTML = images.map(url => `<img src="${url}" class="w-24 h-24 object-contain border rounded cursor-pointer hover:scale-105 transition" onerror="this.style.display='none'">`).join("");
      const thumbnails = productImagesEl.querySelectorAll("img");
      if(thumbnails.length) thumbnails[0].classList.add("border-indigo-600");

      thumbnails.forEach(imgEl => {
        imgEl.addEventListener("click", ()=>{
          selectedImage = imgEl.src;
          if(mainProductImageEl) mainProductImageEl.src = selectedImage;
          thumbnails.forEach(i => i.classList.remove("border-indigo-600"));
          imgEl.classList.add("border-indigo-600");
        });
      });
    }

    // Add to cart
    addToCartBtn.addEventListener("click", ()=>{
      const qty = Math.max(1, parseInt(qs("quantity")?.value || "1"));
      const existing = cart.find(c => c.id === product.id && c.image === selectedImage);
      if(existing) existing.qty += qty;
      else cart.push({ id: product.id, title: product.title, price: product.price, qty, image: selectedImage });
      saveCart();
      updateCartUI();
      toast("Added to cart");
    });

  } catch(err){
    console.error("setupProductPage err", err);
  }
}

/* ================= CART UI ================= */
function updateCartUI(){
  const cartItems = qs("cartItems");
  const cartCount = qs("cartCount");
  const cartTotal = qs("cartTotal");

  if(cartCount) cartCount.textContent = String(cart.reduce((s,_)=>s+1, 0)); // count items (not qty)
  if(!cartItems || !cartTotal) return;

  cartItems.innerHTML = "";
  let total = 0;
  cart.forEach((item, index)=>{
    total += (item.price || 0) * (item.qty || 1);
    const div = document.createElement("div");
    div.className = "flex justify-between items-center border-b pb-2";
    div.innerHTML = `<div>
        <p class="font-semibold">${escapeHtml(item.title || "")}</p>
        <p class="text-sm text-gray-500">₹${item.price} × ${item.qty}</p>
        ${item.image ? `<img src="${item.image}" class="w-16 h-16 object-contain mt-1" onerror="this.style.display='none'">` : ""}
      </div>
      <div class="flex gap-2 items-center">
        <button data-index="${index}" class="px-2 py-1 border rounded decrease">-</button>
        <span class="px-2">${item.qty}</span>
        <button data-index="${index}" class="px-2 py-1 border rounded increase">+</button>
        <button data-index="${index}" class="px-2 py-1 border rounded remove">Remove</button>
      </div>`;
    cartItems.appendChild(div);
  });

  cartTotal.textContent = "₹" + total;

  // Attach buttons
  cartItems.querySelectorAll("button.remove").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      const idx = Number(e.currentTarget.dataset.index);
      cart.splice(idx,1);
      saveCart();
      updateCartUI();
    });
  });
  cartItems.querySelectorAll("button.increase").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      const idx = Number(e.currentTarget.dataset.index);
      cart[idx].qty = (cart[idx].qty || 1) + 1;
      saveCart(); updateCartUI();
    });
  });
  cartItems.querySelectorAll("button.decrease").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      const idx = Number(e.currentTarget.dataset.index);
      cart[idx].qty = Math.max(1, (cart[idx].qty || 1) - 1);
      saveCart(); updateCartUI();
    });
  });
}

/* ================= HELPERS ================= */
function escapeHtml(str){
  if(!str) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
