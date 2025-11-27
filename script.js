/* =======================================================
        SUPABASE SETUP
======================================================= */
const SUPABASE_URL = "https://ytxhlihzxgftffaikumr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eGhsaWh6eGdmdGZmYWlrdW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODAxNTgsImV4cCI6MjA3OTQ1NjE1OH0._k5hfgJwVSrbXtlRDt3ZqCYpuU1k-_OqD7M0WML4ehA";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =======================================================
        UTILITIES
======================================================= */
const $ = (id) => document.getElementById(id);
const rup = (n) => "$" + Number(n || 0).toLocaleString();

/* =======================================================
        CART (LOCAL STORAGE)
======================================================= */
const CART_KEY = "myshop_cart_v1";

function loadCart() {
  return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartUI();
}
function addToCart(item) {
  const cart = loadCart();
  const find = cart.find((i) => i.id === item.id);
  if (find) find.qty += item.qty;
  else cart.push({ ...item });
  saveCart(cart);
}
function removeFromCart(id) {
  saveCart(loadCart().filter((i) => i.id !== id));
}
function clearCart() {
  localStorage.removeItem(CART_KEY);
  updateCartUI();
}
function cartTotal() {
  return loadCart().reduce((s, i) => s + i.price * i.qty, 0);
}

/* =======================================================
        AUTH HANDLING
======================================================= */
async function initAuthUI() {
  const { data: { session } } = await sb.auth.getSession();
  setUser(session?.user?.email || null);

  sb.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user?.email || null);
  });
}

function setUser(email) {
  const userArea = $("userArea");
  const userEmail = $("userEmail");
  const btnLogin = $("btnLogin");
  const btnLogout = $("btnLogout");

  if (!btnLogin) return;

  if (email) {
    userArea.classList.remove("hidden");
    btnLogin.classList.add("hidden");
    userEmail.textContent = email;
  } else {
    userArea.classList.add("hidden");
    btnLogin.classList.remove("hidden");
  }

  if (btnLogout) {
    btnLogout.onclick = async () => {
      await sb.auth.signOut();
      alert("Logged out");
    };
  }
}

/* =======================================================
        CART UI UPDATE
======================================================= */
function updateCartUI() {
  const cart = loadCart();
  const count = cart.reduce((s, i) => s + i.qty, 0);

  const cartCount = $("cartCount");
  if (cartCount) cartCount.textContent = count;

  const cartWrap = $("cartItems");
  if (cartWrap) {
    cartWrap.innerHTML = "";
    if (!cart.length)
      cartWrap.innerHTML = `<p class="text-sm text-gray-500">Cart empty.</p>`;

    cart.forEach((i) => {
      let block = document.createElement("div");
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

    cartWrap.querySelectorAll(".removeBtn").forEach((b) =>
      b.addEventListener("click", (e) => {
        removeFromCart(e.target.dataset.id);
      })
    );
  }

  const totalEl = $("cartTotal");
  if (totalEl) totalEl.textContent = rup(cartTotal());
}

/* =======================================================
        CHECKOUT → SAVE ORDER
======================================================= */
async function checkout() {
  const user = (await sb.auth.getUser()).data.user;
  if (!user) {
    alert("Login first");
    showLoginModal();
    return;
  }

  const cart = loadCart();
  if (!cart.length) {
    alert("Cart empty!");
    return;
  }

  try {
    const order = {
      user_id: user.id,
      user_email: user.email,
      items: cart,
      total: cartTotal(),
      created_at: new Date().toISOString(),
    };

    const { data, error } = await sb.from("orders").insert(order);
    if (error) throw error;

    clearCart();
    alert("Order placed! ID = " + data[0].id);
  } catch (err) {
    alert("Checkout error: " + err.message);
  }
}

/* =======================================================
        LOGIN MODAL
======================================================= */
function showLoginModal() {
  const m = $("loginModal");
  if (m) m.classList.remove("hidden"), m.classList.add("flex");
}

/* =======================================================
        INDEX PAGE — LIST PRODUCTS
======================================================= */
let PAGE = 1;
const PER_PAGE = 6;

async function setupIndexPage() {
  const grid = $("productsGrid");
  const search = $("search");
  const prev = $("prevPage");
  const next = $("nextPage");

  async function loadProducts() {
    const query = search?.value?.trim().toLowerCase() || "";

    const { data, error } = await sb.from("products").select("*").order("id");
    if (error) return console.error(error);

    let items = data;
    if (query)
      items = items.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query)
      );

    const total = items.length;
    const start = (PAGE - 1) * PER_PAGE;
    const pageItems = items.slice(start, start + PER_PAGE);

    grid.innerHTML = "";
    pageItems.forEach((p) => {
      let div = document.createElement("div");
      div.className = "bg-white rounded shadow p-4 flex flex-col";
      div.innerHTML = `
        <a href="product.html?id=${p.id}" class="block h-48 mb-3">
          <img src="${p.image_url}" class="w-full h-full object-contain"/>
        </a>
        <h3 class="font-semibold text-lg">${p.title}</h3>
        <p class="text-sm text-gray-500">${(p.description || "").substr(0, 120)}</p>
        <div class="mt-3 flex justify-between">
          <span class="font-bold">${rup(p.price)}</span>
          <button class="addNow px-3 py-1 border rounded" data-id="${p.id}">Add</button>
        </div>
      `;
      grid.appendChild(div);
    });

    document.querySelectorAll(".addNow").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        const p = (
          await sb.from("products").select("*").eq("id", id).single()
        ).data;

        addToCart({
          id: String(p.id),
          title: p.title,
          price: p.price,
          qty: 1,
        });
        alert("Added to cart");
      })
    );

    $("pageInfo").textContent = `Page ${PAGE} — ${total} items`;

    prev.disabled = PAGE === 1;
    next.disabled = PAGE * PER_PAGE >= total;
  }

  prev.addEventListener("click", () => {
    if (PAGE > 1) PAGE--;
    loadProducts();
  });

  next.addEventListener("click", () => {
    PAGE++;
    loadProducts();
  });

  search.addEventListener("input", () => {
    PAGE = 1;
    loadProducts();
  });

  loadProducts();
}

/* =======================================================
        PRODUCT PAGE — SHOW PRODUCT
======================================================= */
async function setupProductPage() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return;

  const { data: p, error } = await sb
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return alert("Product not found");

  $("productImage").src = p.image_url;
  $("productTitle").textContent = p.title;
  $("productDesc").textContent = p.description;
  $("productPrice").textContent = rup(p.price);

  $("addToCart").onclick = () => {
    const qty = Number($("quantity").value) || 1;
    addToCart({
      id: String(p.id),
      title: p.title,
      price: p.price,
      qty,
    });
    alert("Added to cart");
  };
}

/* =======================================================
        PAGE INIT
======================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  await initAuthUI();
  updateCartUI();

  const cartBtn = $("btnCart") || $("btnCartHeader");
  if (cartBtn)
    cartBtn.addEventListener("click", () =>
      $("cartModal").classList.remove("hidden")
    );

  $("closeCart")?.addEventListener("click", () =>
    $("cartModal").classList.add("hidden")
  );

  $("clearCart")?.addEventListener("click", () => {
    if (confirm("Clear cart?")) clearCart();
  });

  $("checkout")?.addEventListener("click", checkout);

  $("btnLogin")?.addEventListener("click", showLoginModal);
  $("cancelLogin")?.addEventListener("click", () =>
    $("loginModal").classList.add("hidden")
  );

  $("sendMagic")?.addEventListener("click", async () => {
    const email = $("loginEmail").value.trim();
    const msg = $("loginMsg");
    if (!email) return (msg.textContent = "Enter email");

    msg.textContent = "Sending...";

    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.href },
    });

    msg.textContent = error ? "Error: " + error.message : "Magic link sent!";
  });

  if (location.pathname.includes("product.html")) setupProductPage();
  else setupIndexPage();
});
