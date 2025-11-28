/* =======================================================
   FINAL script.js — Auth + Auto Login + Products + Cart + Orders
   Email confirmation OFF compatible
======================================================= */

/* ========== Supabase Setup ========== */
const SUPABASE_URL = "https://ytxhlihzxgftffaikumr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eGhsaWh6eGZ0ZmZhaWt1bXIiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.dujC0gk7sZ0YNR1N1c6GwKWrTizJHxtN2tTMsZPqjEc";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============================
      AUTH HANDLING (LOGIN + SIGNUP)
============================ */

async function submitAuth(type) {
  const email = document.getElementById("authEmail").value;
  const password = document.getElementById("authPassword").value;
  const authMsg = document.getElementById("authMsg");

  authMsg.textContent = "";

  if (!email || !password) {
    authMsg.textContent = "Please enter email & password";
    return;
  }

  if (type === "login") {
    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      authMsg.textContent = error.message;
      return;
    }

    hide(modal);
    location.reload();
  }

  /* ============================
        SIGNUP (Auto-login enabled)
  ============================ */
  else {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      authMsg.textContent = error.message;
      return;
    }

    // AUTO LOGIN
    const login = await sb.auth.signInWithPassword({ email, password });
    if (login.error) {
      authMsg.textContent = login.error.message;
      return;
    }

    hide(modal);
    location.reload();
  }
}

/* ============================
      CART FUNCTIONS
============================ */
let cart = JSON.parse(localStorage.getItem("cart") || "[]");

function addToCart(item) {
  cart.push(item);
  localStorage.setItem("cart", JSON.stringify(cart));
  alert("Item added to cart");
}

/* ============================
      LOAD PRODUCTS
============================ */
async function loadProducts() {
  const { data, error } = await sb.from("products").select("*");

  if (error) {
    console.error(error);
    return;
  }

  const list = document.getElementById("productList");

  list.innerHTML = data
    .map(
      (p) => `
    <div class="p-3 bg-white shadow rounded">
      <img src="${p.image}" class="w-full h-40 object-cover rounded" />
      <h2 class="font-bold text-lg mt-2">${p.name}</h2>
      <p class="text-gray-600">Rs ${p.price}</p>
      <button onclick='addToCart(${JSON.stringify(p)})' class="mt-2 bg-blue-600 text-white px-3 py-1 rounded">Add to cart</button>
    </div>`
    )
    .join("");
}

/* ============================
      LOAD ORDERS
============================ */
async function loadOrders() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { data, error } = await sb
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("id", { ascending: false });

  if (error) return console.error(error);

  const list = document.getElementById("orderList");
  if (!list) return;

  list.innerHTML = data
    .map(
      (o) => `
      <div class="p-4 bg-gray-100 rounded shadow">
        <h2 class="font-bold">Order #${o.id}</h2>
        <p class="text-gray-600">${o.status}</p>
        <p>Total: Rs ${o.total}</p>
      </div>`
    )
    .join("");
}

/* ============================
      MODAL HELPERS
============================ */
const modal = document.getElementById("authModal");
function show(m) {
  m.classList.remove("hidden");
}
function hide(m) {
  m.classList.add("hidden");
}

/* ============================
      INIT
============================ */
window.onload = async () => {
  loadProducts();
  loadOrders();
};
