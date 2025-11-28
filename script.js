/* =======================================================
   script.js — Cart + Auth + Products + Orders (UPDATED)
======================================================= */

const SUPABASE_URL = "https://ytxhlihzxgftffaikumr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eGhsaWh6eGdmdGZmYWlrdW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODAxNTgsImV4cCI6MjA3OTQ1NjE1OH0._k5hfgJwVSrbXtlRDt3ZqCYpuU1k-_OqD7M0WML4ehA";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* UTILS */
const $ = (id) => document.getElementById(id);
const rup = (n) => "₹" + Number(n || 0).toLocaleString();

/* image fallback */
function setImageWithFallback(img, url, title) {
  const fallback = `https://placehold.co/600x400?text=${encodeURIComponent(
    title || "Product"
  )}`;

  if (!url) {
    img.src = fallback;
    return;
  }

  img.src = url;
  img.onerror = () => (img.src = fallback);
}

/* CART STORAGE */
const CART_KEY = "myshop_cart_v1";

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(c) {
  localStorage.setItem(CART_KEY, JSON.stringify(c));
  updateCartUI();
}

function addToCart(item) {
  const cart = loadCart();
  const f = cart.find((x) => x.id === String(item.id));

  if (f) f.qty += item.qty;
  else cart.push(item);

  saveCart(cart);
}

function clearCart() {
  saveCart([]);
}

function cartTotalValue() {
  return loadCart().reduce(
    (s, i) => s + Number(i.price) * Number(i.qty),
    0
  );
}

/* AUTH */
async function initAuthUI() {
  const { data } = await sb.auth.getSession();
  setUser(data?.session?.user || null);

  sb.auth.onAuthStateChange((_e, session) =>
    setUser(session?.user || null)
  );
}

function setUser(user) {
  const userArea = $("userArea");
  const btnLogin = $("btnLogin");

  if (userArea) {
    if (user) userArea.classList.remove("hidden");
    else userArea.classList.add("hidden");
  }

  if (btnLogin) {
    if (user) btnLogin.classList.add("hidden");
    else btnLogin.classList.remove("hidden");
  }
}

/* LOGIN / SIGNUP MODAL */
function showAuthModal(mode = "login") {
  const m = $("loginModal");
  if (!m) return;

  $("authTitle").textContent =
    mode === "signup" ? "Create Account" : "Login";
  $("authDesc").textContent =
    mode === "signup"
      ? "Create your account"
      : "Login to continue";

  $("authEmail").value = "";
  $("authPass").value = "";
  $("authMsg").textContent = "";

  $("submitAuth").textContent =
    mode === "signup" ? "Sign Up" : "Login";

  $("switchToSignup").style.display =
    mode === "signup" ? "none" : "inline";
  $("switchToLogin").style.display =
    mode === "signup" ? "inline" : "none";

  m.classList.remove("hidden");

  $("submitAuth").onclick = async () => {
    const email = $("authEmail").value.trim();
    const pass = $("authPass").value.trim();
    const msg = $("authMsg");

    msg.textContent = "Please wait...";

    let res =
      mode === "signup"
        ? await sb.auth.signUp({ email, password: pass })
        : await sb.auth.signInWithPassword({ email, password: pass });

    if (res.error) {
      msg.textContent = res.error.message;
      msg.style.color = "red";
      return;
    }

    msg.textContent =
      mode === "signup" ? "Account created!" : "Logged in!";
    msg.style.color = "green";

    setTimeout(() => location.reload(), 300);
  };

  $("cancelAuth").onclick = () => m.classList.add("hidden");

  $("btnReset").onclick = async () => {
    const email = $("authEmail").value.trim();
    if (!email) return alert("Enter email");
    await sb.auth.resetPasswordForEmail(email);
    alert("Reset email sent!");
  };

  $("switchToSignup").onclick = () => showAuthModal("signup");
  $("switchToLogin").onclick = () => showAuthModal("login");
}

/* CART UI */
function updateCartUI() {
  const cart = loadCart();

  if ($("cartCount"))
    $("cartCount").textContent = cart.reduce((a, b) => a + b.qty, 0);

  const wrap = $("cartItems");
  if (!wrap) return;

  wrap.innerHTML = "";

  if (!cart.length) {
    wrap.innerHTML = `<p class="text-gray-500">Cart empty</p>`;
  } else {
    cart.forEach((i) => {
      let d = document.createElement("div");
      d.className = "flex justify-between mb-2";

      d.innerHTML = `
        <div>
          <div class="font-semibold">${i.title}</div>
          <div class="text-sm">Qty ${i.qty} × ${rup(i.price)}</div>
        </div>
        <button class="removeBtn text-red-600" data-id="${i.id}">
          Remove
        </button>
      `;

      wrap.appendChild(d);
    });

    wrap.querySelectorAll(".removeBtn").forEach((b) => {
      b.onclick = () => {
        saveCart(loadCart().filter((x) => x.id !== b.dataset.id));
      };
    });
  }

  if ($("cartTotal"))
    $("cartTotal").textContent = rup(cartTotalValue());
}

/* CHECKOUT */
async function checkoutHandler() {
  const { data } = await sb.auth.getUser();
  const user = data?.user;

  if (!user) return showAuthModal("login");

  const cart = loadCart();
  if (!cart.length) return alert("Cart empty");

  await sb.from("orders").insert({
    user_id: user.id,
    items: cart,
    total: cartTotalValue(),
    status: "Pending",
    created_at: new Date().toISOString(),
  });

  clearCart();
  alert("Order placed!");
}

/* PRODUCTS PAGE */
let PAGE = 1;
const PER_PAGE = 6;

async function setupIndexPage() {
  loadProducts();

  $("search").oninput = () => {
    PAGE = 1;
    loadProducts();
  };

  $("prevPage").onclick = () => {
    if (PAGE > 1) PAGE--;
    loadProducts();
  };

  $("nextPage").onclick = () => {
    PAGE++;
    loadProducts();
  };
}

async function loadProducts() {
  const grid = $("productsGrid");
  const q = ($("search")?.value || "").toLowerCase();

  const { data } = await sb.from("products").select("*").order("id");

  let list = data || [];

  if (q)
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description || "")
          .toLowerCase()
          .includes(q)
    );

  const items = list.slice((PAGE - 1) * PER_PAGE, PAGE * PER_PAGE);

  grid.innerHTML = "";

  if (!items.length) {
    grid.innerHTML = `<p>No products found</p>`;
    return;
  }

  items.forEach((p) => {
    let d = document.createElement("div");
    d.className = "bg-white p-3 rounded shadow";

    d.innerHTML = `
      <a href="product.html?id=${p.id}">
        <img class="w-full h-48 object-contain product-img mb-2" />
      </a>
      <h3 class="font-semibold">${p.title}</h3>
      <p class="text-sm">${(p.description || "").slice(0, 80)}</p>

      <div class="flex justify-between mt-3">
        <span class="font-bold">${rup(p.price)}</span>
        <button class="addNow px-3 py-1 border rounded" data-id="${p.id}">
          Add
        </button>
      </div>
    `;

    grid.appendChild(d);

    setImageWithFallback(
      d.querySelector(".product-img"),
      p.image_url,
      p.title
    );
  });

  $("pageInfo").textContent = `Page ${PAGE}`;

  document.querySelectorAll(".addNow").forEach((b) => {
    b.onclick = async () => {
      const { data: p } = await sb
        .from("products")
        .select("*")
        .eq("id", b.dataset.id)
        .single();

      addToCart({
        id: p.id,
        title: p.title,
        price: p.price,
        qty: 1,
      });

      alert("Added to cart");
    };
  });
}

/* PRODUCT PAGE */
async function setupProductPage() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return;

  const { data: p } = await sb
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  $("productTitle").textContent = p.title;
  $("productDesc").textContent = p.description;
  $("productPrice").textContent = rup(p.price);

  setImageWithFallback($("productImage"), p.image_url, p.title);

  if (p.category) {
    $("productCategory").textContent = p.category;
    $("productCategory").style.display = "inline-block";
    $("productCategory").onclick = () =>
      (location.href = `index.html?category=${p.category}`);
  }

  const gallery = $("designGallery");
  gallery.innerHTML = "";

  let designs = [];
  try {
    designs = JSON.parse(p.design_images || "[]");
  } catch {}

  designs.forEach((url) => {
    let t = document.createElement("img");
    t.src = url;
    t.className =
      "h-20 w-28 object-cover rounded border cursor-pointer";
    t.onclick = () =>
      setImageWithFallback($("productImage"), url, p.title);
    gallery.appendChild(t);
  });

  $("addToCart").onclick = () => {
    addToCart({
      id: p.id,
      title: p.title,
      price: p.price,
      qty: Number($("quantity").value) || 1,
    });

    alert("Added to cart");
  };
}

/* INIT */
document.addEventListener("DOMContentLoaded", async () => {
  await initAuthUI();
  updateCartUI();

  $("btnCart").onclick = () =>
    $("cartModal").classList.remove("hidden");

  $("closeCart").onclick = () =>
    $("cartModal").classList.add("hidden");

  $("clearCart").onclick = () => {
    if (confirm("Clear cart?")) clearCart();
  };

  $("checkout").onclick = checkoutHandler;

  $("btnLogin").onclick = () => showAuthModal("login");

  if (location.pathname.includes("product.html"))
    setupProductPage();
  else setupIndexPage();
});
