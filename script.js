/* =======================================================
   script.js — FINAL CLEAN VERSION
   Works with:
   ✔ index.html (products page)
   ✔ product.html (details page)
   ✔ Cart (localStorage)
======================================================= */

/* ========== Supabase Setup ========== */
const SUPABASE_URL = "https://ytxhlihzxgftffaikumr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eGhsaWh6eGdmdGZmYWlrdW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODAxNTgsImV4cCI6MjA3OTQ1NjE1OH0._k5hfgJwVSrbXtlRDt3ZqCYpuU1k-_OqD7M0WML4ehA";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ========== Helpers ========== */
const $ = (id) => document.getElementById(id);
const rup = (n) => "₹" + Number(n || 0).toLocaleString();

/* Image fallback */
function setImageWithFallback(imgEl, url, title) {
  const fallback = `https://placehold.co/600x400?text=${encodeURIComponent(
    title || "Product"
  )}`;

  if (!imgEl) return;
  imgEl.src = url || fallback;

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
}

function addToCart(item) {
  const cart = loadCart();
  const found = cart.find((i) => i.id === String(item.id));

  if (found) found.qty += item.qty;
  else cart.push(item);

  saveCart(cart);
  alert("Added to cart");
}

/* ========== PRODUCTS PAGE (index.html) ========== */

async function setupIndexPage() {
  const grid = $("productsList");
  if (!grid) return; // index page not opened → skip

  const { data, error } = await sb.from("products").select("*").order("id");

  if (error) {
    grid.innerHTML = "Error loading products";
    return;
  }

  grid.innerHTML = "";

  data.forEach((p) => {
    const div = document.createElement("div");
    div.className = "bg-white shadow rounded p-4";

    div.innerHTML = `
      <a href="product.html?id=${p.id}">
        <img class="w-full h-48 object-contain mb-3 product-img"/>
      </a>

      <h3 class="font-semibold">${p.title}</h3>
      <p class="text-sm text-gray-600">${(p.description || "").slice(0, 80)}</p>

      <div class="flex justify-between mt-3">
        <span class="font-bold">${rup(p.price)}</span>
        <button class="addBtn px-3 py-1 border rounded" data-id="${p.id}">
          Add
        </button>
      </div>
    `;

    grid.appendChild(div);

    setImageWithFallback(
      div.querySelector(".product-img"),
      p.image_url,
      p.title
    );
  });

  // Add to Cart buttons
  document.querySelectorAll(".addBtn").forEach((btn) => {
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
    };
  });
}

/* ========== PRODUCT PAGE (product.html) ========== */

async function setupProductPage() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return; // not product page

  const { data: p } = await sb
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (!p) return alert("Product not found");

  $("productTitle").textContent = p.title;
  $("productDesc").textContent = p.description;
  $("productPrice").textContent = rup(p.price);

  setImageWithFallback($("productImage"), p.image_url, p.title);

  $("addToCart").onclick = () => {
    const qty = Number($("quantity").value) || 1;

    addToCart({
      id: String(p.id),
      title: p.title,
      price: p.price,
      qty,
    });
  };
}

/* ========== INIT ========== */

document.addEventListener("DOMContentLoaded", () => {
  if (location.pathname.includes("product.html")) {
    setupProductPage();
  } else {
    setupIndexPage();
  }
});
