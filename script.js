/* =======================================================
   script.js — Complete version for index + product pages
======================================================= */

/* ========== Supabase Setup ========== */
const SUPABASE_URL = "https://ytxhlihzxgftffaikumr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eGhsaWh6eGdmdGZmYWx...";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ========== Global Variables ========== */
let products = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentPage = 1;
const itemsPerPage = 6;

/* ========================================================
   ========== INIT ========== 
======================================================== */
document.addEventListener("DOMContentLoaded", async () => {
  await checkAuth();
  if (document.getElementById("productsGrid")) loadProducts();
  if (document.getElementById("btnCart")) updateCartUI();
  setupProductPage();
});

/* ========================================================
   ========== AUTH ========== 
======================================================== */
async function checkAuth() {
  const { data } = await sb.auth.getUser();
  const userArea = document.getElementById("userArea");
  const btnLogin = document.getElementById("btnLogin");
  const btnSignup = document.getElementById("btnSignup");
  const btnLogout = document.getElementById("btnLogout");

  if (data.user) {
    if (userArea) userArea.style.display = "flex";
    if (btnLogin) btnLogin.style.display = "none";
    if (btnSignup) btnSignup?.style.display = "none";
    if (btnLogout) btnLogout.style.display = "inline-block";
  } else {
    if (userArea) userArea.style.display = "none";
    if (btnLogin) btnLogin.style.display = "inline-block";
    if (btnSignup) btnSignup?.style.display = "inline-block";
    if (btnLogout) btnLogout.style.display = "none";
  }
}

// Logout
document.getElementById("btnLogout")?.addEventListener("click", async () => {
  await sb.auth.signOut();
  checkAuth();
  location.reload();
});

/* ========================================================
   ========== PRODUCTS ========== 
======================================================== */
async function loadProducts() {
  const { data, error } = await sb.from("products").select("*");
  if (error) { console.error(error); return; }
  products = data;
  renderProducts();
}

function renderProducts() {
  const searchInput = document.getElementById("search");
  const productsGrid = document.getElementById("productsGrid");
  const search = searchInput?.value.toLowerCase() || "";
  const filtered = products.filter(p => p.title.toLowerCase().includes(search));
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  if (currentPage > totalPages) currentPage = totalPages || 1;
  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = filtered.slice(start, start + itemsPerPage);

  if (productsGrid) {
    productsGrid.innerHTML = pageItems.map(p => `
      <div class="bg-white p-4 rounded shadow flex flex-col">
        <img src="${p.image_url}" class="h-48 w-full object-contain mb-2" />
        <h3 class="font-semibold">${p.title}</h3>
        <p class="text-gray-500">${p.description.substring(0, 50)}...</p>
        <p class="text-xl font-bold mt-2">$${p.price}</p>
        <a href="product.html?id=${p.id}" class="mt-auto px-4 py-2 bg-indigo-600 text-white rounded text-center">View</a>
      </div>
    `).join("");
  }

  const pageInfo = document.getElementById("pageInfo");
  if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
}

// Pagination & Search
document.getElementById("search")?.addEventListener("input", () => { currentPage = 1; renderProducts(); });
document.getElementById("prevPage")?.addEventListener("click", () => { if (currentPage > 1) { currentPage--; renderProducts(); } });
document.getElementById("nextPage")?.addEventListener("click", () => { currentPage++; renderProducts(); });

/* ========================================================
   ========== CART ========== 
======================================================== */
function saveCart() { localStorage.setItem("cart", JSON.stringify(cart)); }

function updateCartUI() {
  const cartItems = document.getElementById("cartItems");
  const cartCount = document.getElementById("cartCount");
  const cartTotal = document.getElementById("cartTotal");
  if (!cartItems || !cartCount || !cartTotal) return;

  cartItems.innerHTML = "";
  let total = 0;
  cart.forEach((item, index) => {
    total += item.price * item.qty;
    const div = document.createElement("div");
    div.className = "flex justify-between items-center border-b pb-2";
    div.innerHTML = `
      <div>
        <p class="font-semibold">${item.title}</p>
        <p class="text-sm text-gray-500">$${item.price} × ${item.qty}</p>
        ${item.image ? `<img src="${item.image}" class="w-16 h-16 object-contain mt-1"/>` : ""}
      </div>
      <button data-index="${index}" class="px-2 py-1 border rounded">Remove</button>
    `;
    cartItems.appendChild(div);
  });

  cartCount.textContent = cart.length;
  cartTotal.textContent = `$${total}`;

  document.querySelectorAll("#cartItems button").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = e.target.dataset.index;
      cart.splice(idx, 1);
      saveCart();
      updateCartUI();
    });
  });
}

// Cart modal
document.getElementById("btnCart")?.addEventListener("click", () => document.getElementById("cartModal")?.classList.remove("hidden"));
document.getElementById("closeCart")?.addEventListener("click", () => document.getElementById("cartModal")?.classList.add("hidden"));
document.getElementById("clearCart")?.addEventListener("click", () => { cart = []; saveCart(); updateCartUI(); });

/* ========================================================
   ========== PRODUCT PAGE ========== 
======================================================== */
async function setupProductPage() {
  const addToCartBtn = document.getElementById("addToCart");
  if (!addToCartBtn) return;

  const productTitleEl = document.getElementById("productTitle");
  const productDescEl = document.getElementById("productDesc");
  const productPriceEl = document.getElementById("productPrice");
  const productImagesEl = document.getElementById("productImages");
  const mainProductImageEl = document.getElementById("mainProductImage");
  if (mainProductImageEl) mainProductImageEl.src = "";

  const productIdStr = new URLSearchParams(window.location.search).get("id");
  const productId = productIdStr ? Number(productIdStr) : 0;
  if (!productId) { alert("Invalid product!"); return; }

  const { data: product, error } = await sb.from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if (error || !product) { alert("Product not found!"); return; }

  productTitleEl.textContent = product.title;
  productDescEl.textContent = product.description;
  productPriceEl.textContent = `$${product.price}`;

  let images = [];
  if (Array.isArray(product.design_images)) images = product.design_images;
  else if (typeof product.design_images === "string") {
    try { images = JSON.parse(product.design_images); } 
    catch (e) { images = product.design_images.split(","); }
  }

  let selectedImage = images[0] || "";
  if (mainProductImageEl) mainProductImageEl.src = selectedImage;

  // Render thumbnails
  productImagesEl.innerHTML = images.map(url => `
    <img src="${url}" class="w-24 h-24 object-contain border rounded cursor-pointer hover:scale-105 transition"/>
  `).join("");

  const thumbnails = productImagesEl.querySelectorAll("img");
  if (thumbnails.length) thumbnails[0].classList.add("border-indigo-600");

  thumbnails.forEach(imgEl => {
    imgEl.addEventListener("click", () => {
      selectedImage = imgEl.src;
      if (mainProductImageEl) mainProductImageEl.src = selectedImage;
      thumbnails.forEach(i => i.classList.remove("border-indigo-600"));
      imgEl.classList.add("border-indigo-600");
    });
  });

  addToCartBtn.addEventListener("click", () => {
    const qty = parseInt(document.getElementById("quantity")?.value) || 1;
    const existing = cart.find(c => c.id === product.id && c.image === selectedImage);
    if (existing) existing.qty += qty;
    else cart.push({ id: product.id, title: product.title, price: product.price, qty, image: selectedImage });
    saveCart();
    updateCartUI();
    alert("Added to cart!");
  });
}

/* ========================================================
   ========== CHECKOUT ========== 
======================================================== */
document.getElementById("checkout")?.addEventListener("click", async () => {
  const user = (await sb.auth.getUser()).data.user;
  if (!user) { alert("Login first"); return; }
  if (!cart.length) { alert("Cart empty"); return; }

  const order = {
    user_id: user.id,
    total: cart.reduce((a, b) => a + b.price * b.qty, 0),
    items: cart,
    status: "Pending",
    created_at: new Date().toISOString()
  };

  const { error } = await sb.from("orders").insert([order]);
  if (error) { alert(error.message); return; }
  alert("Order placed!");
  cart = [];
  saveCart();
  updateCartUI();
  document.getElementById("cartModal")?.classList.add("hidden");
});
