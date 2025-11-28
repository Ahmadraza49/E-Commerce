/* =======================================================
   script.js — Cart + Auth + Products + Orders (FINAL)
======================================================= */

/* ========== Supabase Setup ========== */
const SUPABASE_URL = "https://ytxhlihzxgftffaikumr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eGhsaWh6eGdmdGZmYWlrdW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODAxNTgsImV4cCI6MjA3OTQ1NjE1OH0._k5hfgJwVSrbXtlRDt3ZqCYpuU1k-_OqD7M0WML4ehA";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Utilities */
const $ = (id) => document.getElementById(id);
const rup = (n) => "₹" + Number(n || 0).toLocaleString();

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/* Image fallback handler */
function setImageWithFallback(img, url, title) {
  if (!img) return;

  const fallback = `https://placehold.co/300x200?text=${encodeURIComponent(
    title
  )}`;

  img.src = url || fallback;
  img.onerror = () => {
    img.src = fallback;
  };
}

/* ========== CART LOGIC ========== */
const CART_KEY = "myshop_cart_v1";

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartUI();
}

function addToCart(item) {
  const cart = loadCart();
  const found = cart.find((i) => i.id === String(item.id));

  if (found) found.qty += item.qty;
  else cart.push(item);

  saveCart(cart);
}

function clearCart() {
  saveCart([]);
}

function cartTotalValue() {
  return loadCart().reduce(
    (sum, i) => sum + Number(i.price) * Number(i.qty),
    0
  );
}

function updateCartUI() {
  const cart = loadCart();

  if ($("cartCount"))
    $("cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);

  const wrap = $("cartItems");
  if (!wrap) return;

  wrap.innerHTML = "";

  if (!cart.length) {
    wrap.innerHTML = "Cart is empty";
  } else {
    cart.forEach((i) => {
      const row = document.createElement("div");
      row.className = "flex justify-between mb-2";

      row.innerHTML = `
        <div>
          <div class="font-semibold">${escapeHtml(i.title)}</div>
          <div class="text-sm">${i.qty} × ${rup(i.price)}</div>
        </div>
        <button class="removeBtn text-red-500" data-id="${i.id}">Remove</button>
      `;

      wrap.appendChild(row);
    });

    wrap.querySelectorAll(".removeBtn").forEach((btn) => {
      btn.onclick = () => {
        saveCart(loadCart().filter((x) => x.id !== btn.dataset.id));
      };
    });
  }

  if ($("cartTotal"))
    $("cartTotal").textContent = rup(cartTotalValue());
}

/* ========== AUTH UI ========== */

async function initAuthUI() {
  const { data } = await sb.auth.getSession();
  const user = data?.session?.user || null;

  setUser(user);

  sb.auth.onAuthStateChange((_e, session) => {
    setUser(session?.user || null);
  });
}

function setUser(user) {
  const loginBtn = $("btnLogin");
  const logoutBtn = $("btnLogout");

  if (logoutBtn) logoutBtn.onclick = logoutUser;

  if (user) {
    loginBtn?.classList.add("hidden");
    logoutBtn?.classList.remove("hidden");
  } else {
    loginBtn?.classList.remove("hidden");
    logoutBtn?.classList.add("hidden");
  }
}

async function logoutUser() {
  await sb.auth.signOut();
  clearCart();
  alert("Logged out");
  location.href = "index.html";
}

/* ========== AUTH MODAL ========== */

function showAuthModal(mode = "login") {
  const m = $("loginModal");
  if (!m) return;

  $("authTitle").textContent = mode === "signup" ? "Create Account" : "Login";
  $("authDesc").textContent =
    mode === "signup"
      ? "Create an account with email & password"
      : "Enter your login details";

  $("authMsg").textContent = "";
  $("authEmail").value = "";
  $("authPass").value = "";

  m.classList.remove("hidden");
  m.classList.add("flex");

  $("submitAuth").onclick = async () => {
    const email = $("authEmail").value.trim();
    const pass = $("authPass").value.trim();
    const msg = $("authMsg");

    msg.textContent = "Please wait...";

    let result;

    if (mode === "signup") result = await sb.auth.signUp({ email, password: pass });
    else result = await sb.auth.signInWithPassword({ email, password: pass });

    if (result.error) {
      msg.textContent = result.error.message;
      msg.style.color = "red";
      return;
    }

    msg.textContent =
      mode === "signup" ? "Account created!" : "Login successful!";
    msg.style.color = "green";

    setTimeout(() => location.reload(), 400);
  };

  $("btnReset").onclick = async () => {
    const email = $("authEmail").value.trim();
    if (!email) return alert("Enter email");
    const r = await sb.auth.resetPasswordForEmail(email);
    alert(r.error ? r.error.message : "Reset email sent!");
  };

  $("cancelAuth").onclick = () => m.classList.add("hidden");
}

/* ========== ORDERS PAGE ========== */

async function setupOrdersPage() {
  const list = $("ordersList");
  if (!list) return;

  const { data } = await sb.auth.getUser();
  const user = data?.user;

  if (!user) {
    list.textContent = "Login required.";
    showAuthModal("login");
    return;
  }

  list.textContent = "Loading...";

  const { data: orders, error } = await sb
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("id", { ascending: false });

  if (error) {
    list.textContent = "Error loading orders";
    return;
  }

  if (!orders.length) {
    list.textContent = "No orders found.";
    return;
  }

  list.innerHTML = "";

  orders.forEach((o) => {
    const card = document.createElement("div");
    card.className = "p-3 bg-white rounded shadow";

    card.innerHTML = `
      <div class="font-semibold">Order #${o.id}</div>
      <div>Status: <span class="font-bold">${o.status}</span></div>
      <div>Total: ${rup(o.total)}</div>
      <div class="mt-2 text-xs text-gray-500">${o.created_at}</div>

      <details class="mt-2">
        <summary class="cursor-pointer">Items</summary>
        <div class="mt-1 pl-3">
          ${o.items
            .map(
              (i) => `<div>${i.qty} × ${escapeHtml(i.title)} — ${rup(i.price)}</div>`
            )
            .join("")}
        </div>
      </details>
    `;

    list.appendChild(card);
  });
}

/* ========== INIT ========== */

document.addEventListener("DOMContentLoaded", async () => {
  await initAuthUI();
  updateCartUI();

  if ($("btnLogin"))
    $("btnLogin").onclick = () => showAuthModal("login");

  if (location.pathname.includes("orders.html"))
    setupOrdersPage();
});
