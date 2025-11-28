/* =======================================================
   script.js — Cart + Auth + Products + Orders (UPDATED)
   + product categories + design gallery support
======================================================= */

/* ========== Supabase Setup ========== */
const SUPABASE_URL = "https://ytxhlihzxgftffaikumr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eGhsaWh6eGdmdGZmYWlrdW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODAxNTgsImV4cCI6MjA3OTQ1NjE1OH0._k5hfgJwVSrbXtlRDt3ZqCYpuU1k-_OqD7M0WML4ehA";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ========== Utilities ========== */
const $ = (id) => document.getElementById(id);
const rup = (n) => "₹" + Number(n || 0).toLocaleString();

/* Image fallback */
function setImageWithFallback(imgEl, url, title) {
  const fallback = `https://placehold.co/600x400?text=${encodeURIComponent(
    title || "Product"
  )}&font=roboto`;

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

/* ========== Cart (LocalStorage) ========== */

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

/* ========== AUTH UI (Email HIDDEN) ========== */

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
  const btnLogout = $("btnLogout");

  // EMAIL HIDE ALWAYS
  if ($("userEmail")) {
    $("userEmail").textContent = "";
    $("userEmail").style.display = "none";
  }

  if (user) {
    userArea?.classList.remove("hidden");
    btnLogin?.classList.add("hidden");
  } else {
    userArea?.classList.add("hidden");
    btnLogin?.classList.remove("hidden");
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

/* ========== AUTH Helpers ========== */

async function signupAndLogin(email, password) {
  const { error: signErr } = await sb.auth.signUp({ email, password });
  if (signErr && signErr.status !== 400) return { error: signErr };

  return await sb.auth.signInWithPassword({ email, password });
}

async function loginWithPassword(email, password) {
  return await sb.auth.signInWithPassword({ email, password });
}

async function sendResetEmail(email) {
  const redirectTo = `${location.origin}/reset.html`;
  return await sb.auth.resetPasswordForEmail(email, { redirectTo });
}

/* ========== AUTH MODAL ========== */

function showAuthModal(mode = "login") {
  const m = $("loginModal");
  if (!m) return;

  $("authTitle").textContent =
    mode === "signup" ? "Create Account" : "Login";

  $("authDesc").textContent =
    mode === "signup"
      ? "Create an account with email & password."
      : "Enter your login details.";

  $("authMsg").textContent = "";
  $("authEmail").value = "";
  $("authPass").value = "";

  $("submitAuth").textContent =
    mode === "signup" ? "Sign Up" : "Login";

  $("switchToSignup").style.display =
    mode === "signup" ? "none" : "inline";

  $("switchToLogin").style.display =
    mode === "signup" ? "inline" : "none";

  m.classList.remove("hidden");
  m.classList.add("flex");

  $("submitAuth").onclick = async () => {
    const email = $("authEmail").value.trim();
    const pass = $("authPass").value.trim();
    const msg = $("authMsg");

    msg.textContent = "Please wait...";

    let result =
      mode === "signup"
        ? await signupAndLogin(email, pass)
        : await loginWithPassword(email, pass);

    if (result.error) {
      msg.textContent = result.error.message;
      msg.style.color = "red";
      return;
    }

    msg.textContent =
      mode === "signup" ? "Account created!" : "Login successful!";
    msg.style.color = "green";

    setTimeout(() => (m.classList.add("hidden"), location.reload()), 300);
  };

  $("cancelAuth").onclick = () => m.classList.add("hidden");

  $("btnReset").onclick = async () => {
    const email = $("authEmail").value.trim();
    if (!email) return alert("Enter email first");
    const r = await sendResetEmail(email);
    alert(r.error ? r.error.message : "Reset email sent!");
  };

  $("switchToSignup").onclick = () => showAuthModal("signup");
  $("switchToLogin").onclick = () => showAuthModal("login");
}

/* ========== CART UI ========== */

function updateCartUI() {
  const cart = loadCart();

  if ($("cartCount"))
    $("cartCount").textContent = cart.reduce(
      (s, i) => s + Number(i.qty),
      0
    );

  const wrap = $("cartItems");
  if (!wrap) return;

  wrap.innerHTML = "";

  if (!cart.length) {
    wrap.innerHTML = `<p class="text-gray-500">Cart is empty</p>`;
  } else {
    cart.forEach((i) => {
      const div = document.createElement("div");
      div.className = "flex justify-between items-center mb-2";

      div.innerHTML = `
        <div>
          <div class="font-semibold">${escapeHtml(i.title)}</div>
          <div class="text-sm">Qty ${i.qty} × ${rup(i.price)}</div>
        </div>
        <button class="removeBtn text-red-500" data-id="${i.id}">
          Remove
        </button>
      `;

      wrap.appendChild(div);
    });

    wrap.querySelectorAll(".removeBtn").forEach((b) => {
      b.onclick = () => {
        const newCart = loadCart().filter(
          (x) => x.id !== b.dataset.id
        );
        saveCart(newCart);
      };
    });
  }

  if ($("cartTotal")) $("cartTotal").textContent = rup(cartTotalValue());
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/* ========== CHECKOUT — SAVE ORDER ========== */

async function checkoutHandler() {
  const { data } = await sb.auth.getUser();
  const user = data?.user;

  if (!user)
    return showAuthModal("login");

  const cart = loadCart();
  if (!cart.length)
    return alert("Cart empty");

  const order = {
    user_id: user.id,
    items: cart,
    total: cartTotalValue(),
    status: "Pending",
    created_at: new Date().toISOString(),
  };

  const { error } = await sb.from("orders").insert(order);
  if (error) {
    alert("Order failed");
    return;
  }

  clearCart();
  alert("Order placed successfully!");
}

/* ========== PRODUCTS PAGE (index) ========== */

let PAGE = 1;
const PER_PAGE = 6;

async function setupIndexPage() {
  // If category param present, inject into UI search (so user sees it's filtered)
  const urlCat = new URLSearchParams(location.search).get("category");
  if (urlCat && $("search")) {
    // Use search input placeholder as informational hint
    $("search").value = "";
    $("search").placeholder = `Filtering category: ${urlCat}`;
  }

  loadProducts();

  if ($("search")) {
    $("search").oninput = () => {
      PAGE = 1;
      loadProducts();
    };
  }

  $("prevPage")?.onclick = () => {
    if (PAGE > 1) PAGE--;
    loadProducts();
  };

  $("nextPage")?.onclick = () => {
    PAGE++;
    loadProducts();
  };
}

function normalizeDesignImagesField(field) {
  // field might be null, JSON string, array, or comma-separated string
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (typeof field === "string") {
    // try parse JSON
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // not JSON — fall through
    }
    // comma-separated?
    if (field.includes(",")) {
      return field.split(",").map(s => s.trim()).filter(Boolean);
    }
    // single URL string:
    return [field.trim()];
  }
  return [];
}

async function loadProducts() {
  const grid = $("productsGrid");
  if (!grid) return;

  const q = ($("search")?.value || "").toLowerCase();
  const urlCat = new URLSearchParams(location.search).get("category");

  const { data, error } = await sb
    .from("products")
    .select("*")
    .order("id");

  if (error) {
    grid.innerHTML = "Error loading products";
    return;
  }

  let list = data || [];

  if (urlCat) {
    list = list.filter((p) => String(p.category || "").toLowerCase() === String(urlCat).toLowerCase());
  }

  if (q) list = list.filter((p) =>
    String(p.title || "").toLowerCase().includes(q) ||
    String(p.description || "").toLowerCase().includes(q) ||
    String(p.category || "").toLowerCase().includes(q)
  );

  const start = (PAGE - 1) * PER_PAGE;
  const items = list.slice(start, start + PER_PAGE);

  grid.innerHTML = "";

  if (!items.length) {
    grid.innerHTML = `<p>No products found</p>`;
    return;
  }

  items.forEach((p) => {
    const div = document.createElement("div");
    div.className = "bg-white shadow rounded p-3";

    const categoryBadge = p.category ? `<a href="index.html?category=${encodeURIComponent(p.category)}" class="inline-block mb-2 text-xs px-2 py-1 bg-gray-100 rounded">${escapeHtml(p.category)}</a>` : "";

    div.innerHTML = `
      ${categoryBadge}
      <a href="product.html?id=${p.id}">
        <img class="w-full h-48 object-contain product-img mb-2"/>
      </a>
      <h3 class="font-semibold">${escapeHtml(p.title)}</h3>
      <p class="text-sm">${escapeHtml(
        (p.description || "").slice(0, 80)
      )}</p>

      <div class="flex justify-between mt-3">
        <span class="font-bold">${rup(p.price)}</span>
        <button class="addNow px-3 py-1 border rounded" data-id="${p.id}">Add</button>
      </div>
    `;

    grid.appendChild(div);

    setImageWithFallback(
      div.querySelector(".product-img"),
      p.image_url,
      p.title
    );
  });

  // update pageInfo
  $("pageInfo").textContent = `Page ${PAGE}`;

  document
    .querySelectorAll(".addNow")
    .forEach((btn) => {
      btn.onclick = async () => {
        const { data: p } = await sb
          .from("products")
          .select("*")
          .eq("id", btn.dataset.id)
          .single();

        addToCart({
          id: String(p.id),
          title: p.title,
          price: p.price,
          qty: 1,
        });

        alert("Added to cart");
      };
    });
}

/* ========== PRODUCT PAGE ========== */

async function setupProductPage() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return;

  const { data: p, error } = await sb
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !p) {
    console.error("Product load error:", error);
    return;
  }

  $("productTitle").textContent = p.title;
  $("productDesc").textContent = p.description || "";
  $("productPrice").textContent = rup(p.price);

  // main image
  setImageWithFallback($("productImage"), p.image_url, p.title);

  // category button
  if ($("productCategory")) {
    const catBtn = $("productCategory");
    if (p.category) {
      catBtn.textContent = p.category;
      catBtn.onclick = () => {
        // go back to index with category filter
        location.href = `index.html?category=${encodeURIComponent(p.category)}`;
      };
      catBtn.style.display = "inline-block";
    } else {
      catBtn.style.display = "none";
    }
  }

  // designs gallery (multiple images)
  if ($("designGallery")) {
    const gallery = $("designGallery");
    gallery.innerHTML = "";

    const designs = normalizeDesignImagesField(p.design_images);

    // include primary image as first thumbnail if no designs
    if (!designs.length && p.image_url) {
      const t = document.createElement("img");
      t.src = p.image_url;
      t.className = "h-20 w-28 object-cover rounded border cursor-pointer";
      t.onclick = () => setImageWithFallback($("productImage"), p.image_url, p.title);
      gallery.appendChild(t);
    } else {
      designs.forEach((dUrl, idx) => {
        const t = document.createElement("img");
        t.src = dUrl;
        t.className = "h-20 w-28 object-cover rounded border cursor-pointer";
        t.onerror = () => (t.src = `https://placehold.co/200x150?text=Image`);
        t.onclick = () => setImageWithFallback($("productImage"), dUrl, p.title);
        gallery.appendChild(t);
      });
    }
  }

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

/* ========== INIT ========== */

document.addEventListener("DOMContentLoaded", async () => {
  await initAuthUI();
  updateCartUI();

  $("btnCart")?.onclick = () =>
    $("cartModal")?.classList.remove("hidden");

  $("closeCart")?.onclick = () =>
    $("cartModal")?.classList.add("hidden");

  $("clearCart")?.onclick = () => {
    if (confirm("Clear cart?")) clearCart();
  };

  $("checkout")?.onclick = checkoutHandler;

  $("btnLogin")?.onclick = () => showAuthModal("login");

  $("switchToSignup")?.addEventListener("click", () =>
    showAuthModal("signup")
  );

  $("switchToLogin")?.addEventListener("click", () =>
    showAuthModal("login")
  );

  if (location.pathname.includes("product.html"))
    setupProductPage();
  else setupIndexPage();
});
