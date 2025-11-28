/* =======================================================
   script.js — Fixed version for index + product pages
======================================================= */

/* ========== Supabase Setup ========== */
const SUPABASE_URL = "https://ytxhlihzxgftffaikumr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eGhsaWh6eGdmdGZmYWlrdW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODAxNTgsImV4cCI6MjA3OTQ1NjE1OH0._k5hfgJwVSrbXtlRDt3ZqCYpuU1k-_OqD7M0WML4ehA";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ========== Global Variables ========== */
let products = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentPage = 1;
const itemsPerPage = 6;

/* ========== DOM Elements ========== */
const loginModal = document.getElementById("loginModal");
const btnLogin = document.getElementById("btnLogin");
const cancelAuth = document.getElementById("cancelAuth");
const submitAuth = document.getElementById("submitAuth");
const switchToSignup = document.getElementById("switchToSignup");
const switchToLogin = document.getElementById("switchToLogin");
const authEmail = document.getElementById("authEmail");
const authPass = document.getElementById("authPass");
const authMsg = document.getElementById("authMsg");
const btnReset = document.getElementById("btnReset");
const authTitle = document.getElementById("authTitle");
const authDesc = document.getElementById("authDesc");
const userArea = document.getElementById("userArea");
const userEmail = document.getElementById("userEmail");
const btnLogout = document.getElementById("btnLogout");

const cartModal = document.getElementById("cartModal");
const btnCart = document.getElementById("btnCart");
const closeCart = document.getElementById("closeCart");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const clearCartBtn = document.getElementById("clearCart");
const checkoutBtn = document.getElementById("checkout");
const cartCount = document.getElementById("cartCount");

const productsGrid = document.getElementById("productsGrid");
const searchInput = document.getElementById("search");
const prevPage = document.getElementById("prevPage");
const nextPage = document.getElementById("nextPage");
const pageInfo = document.getElementById("pageInfo");

/* ========================================================
   ========== INIT ========== */
document.addEventListener("DOMContentLoaded", async () => {
  await checkAuth();
  if (productsGrid) loadProducts();
  if (btnCart) updateCartUI();
  setupProductPage();
});

/* ========================================================
   ========== AUTH ========== */
async function checkAuth() {
  const { data } = await sb.auth.getUser();
  if (data.user) {
    if(userArea){ userArea.style.display="flex"; userEmail.textContent=data.user.email;}
    if(btnLogin) btnLogin.style.display="none";
  } else {
    if(userArea) userArea.style.display="none";
    if(btnLogin) btnLogin.style.display="inline-block";
  }
}

btnLogin?.addEventListener("click", ()=>loginModal.classList.remove("hidden"));
cancelAuth?.addEventListener("click", ()=>{ loginModal.classList.add("hidden"); authMsg.textContent=""; });

switchToSignup?.addEventListener("click", ()=>{ 
  authTitle.textContent="Sign Up"; 
  authDesc.textContent="Create your account."; 
  submitAuth.textContent="Sign Up"; 
  switchToSignup.style.display="none"; 
  switchToLogin.style.display="inline"; 
});
switchToLogin?.addEventListener("click", ()=>{ 
  authTitle.textContent="Login"; 
  authDesc.textContent="Enter your email and password."; 
  submitAuth.textContent="Login"; 
  switchToSignup.style.display="inline"; 
  switchToLogin.style.display="none"; 
});

submitAuth?.addEventListener("click", async ()=>{
  const email = authEmail.value.trim(); 
  const pass = authPass.value.trim();
  if(!email || !pass){ authMsg.textContent="Please enter email & password."; return; }
  authMsg.textContent="Processing...";
  try{
    if(submitAuth.textContent==="Login"){
      const { error } = await sb.auth.signInWithPassword({email,password:pass});
      if(error) authMsg.textContent=error.message; else location.reload();
    } else {
      const { error } = await sb.auth.signUp({email,password:pass});
      if(error) authMsg.textContent=error.message; else location.reload();
    }
  } catch(e){ authMsg.textContent=e.message; }
});

btnReset?.addEventListener("click", async ()=>{
  const email = authEmail.value.trim(); 
  if(!email){ authMsg.textContent="Enter your email first"; return; }
  const { error } = await sb.auth.resetPasswordForEmail(email);
  if(error) authMsg.textContent=error.message; else authMsg.textContent="Check your email to reset password.";
});

btnLogout?.addEventListener("click", async ()=>{ await sb.auth.signOut(); location.reload(); });

/* ========================================================
   ========== PRODUCTS ========== */
async function loadProducts() {
  const { data, error } = await sb.from("products").select("*");
  if(error){ console.error(error); return; }
  products=data; renderProducts();
}

function renderProducts(){
  const search = searchInput?.value.toLowerCase()||"";
  const filtered = products.filter(p=>p.title.toLowerCase().includes(search));
  const totalPages = Math.ceil(filtered.length/itemsPerPage);
  if(currentPage>totalPages) currentPage=totalPages||1;
  const start=(currentPage-1)*itemsPerPage;
  const pageItems=filtered.slice(start,start+itemsPerPage);
  if(productsGrid){
    productsGrid.innerHTML=pageItems.map(p=>`
      <div class="bg-white p-4 rounded shadow flex flex-col">
        <img src="${p.image_url}" class="h-48 w-full object-contain mb-2" />
        <h3 class="font-semibold">${p.title}</h3>
        <p class="text-gray-500">${p.description.substring(0,50)}...</p>
        <p class="text-xl font-bold mt-2">₹${p.price}</p>
        <a href="product.html?id=${p.id}" class="mt-auto px-4 py-2 bg-indigo-600 text-white rounded text-center">View</a>
      </div>
    `).join("");
  }
  if(pageInfo) pageInfo.textContent=`Page ${currentPage} of ${totalPages||1}`;
}

searchInput?.addEventListener("input", ()=>{ currentPage=1; renderProducts(); });
prevPage?.addEventListener("click", ()=>{ if(currentPage>1){ currentPage--; renderProducts(); }});
nextPage?.addEventListener("click", ()=>{ currentPage++; renderProducts(); });

/* ========================================================
   ========== CART ========== */
btnCart?.addEventListener("click", ()=>cartModal.classList.remove("hidden"));
closeCart?.addEventListener("click", ()=>cartModal.classList.add("hidden"));
clearCartBtn?.addEventListener("click", ()=>{ cart=[]; saveCart(); updateCartUI(); });

function saveCart(){ localStorage.setItem("cart",JSON.stringify(cart)); }

function updateCartUI(){
  if(!cartItems || !cartCount || !cartTotal) return;
  cartItems.innerHTML="";
  let total=0;
  cart.forEach((item,index)=>{
    total+=item.price*item.qty;
    const div=document.createElement("div");
    div.className="flex justify-between items-center border-b pb-2";
    div.innerHTML=`<div><p class="font-semibold">${item.title}</p><p class="text-sm text-gray-500">₹${item.price} × ${item.qty}</p></div>
                   <button data-index="${index}" class="px-2 py-1 border rounded">Remove</button>`;
    cartItems.appendChild(div);
  });
  cartCount.textContent=cart.length;
  cartTotal.textContent=`₹${total}`;

  document.querySelectorAll("#cartItems button").forEach(btn=>{
    btn.addEventListener("click",(e)=>{ 
      const idx=e.target.dataset.index; 
      cart.splice(idx,1); 
      saveCart(); 
      updateCartUI(); 
    });
  });
}

/* ========================================================
   ========== PRODUCT PAGE ========== */
async function setupProductPage(){
  const addToCartBtn = document.getElementById("addToCart");
  if(!addToCartBtn) return; // not a product page

  const productTitleEl = document.getElementById("productTitle");
  const productDescEl = document.getElementById("productDesc");
  const productPriceEl = document.getElementById("productPrice");
  const productImageEl = document.getElementById("productImage");

  const productIdStr = new URLSearchParams(window.location.search).get("id");
  const productId = productIdStr ? Number(productIdStr) : 0;
  if(!productId){ alert("Invalid product!"); return; }

  const { data, error } = await sb.from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if(error || !data){ alert("Product not found!"); return; }

  const product = data;
  if(productTitleEl) productTitleEl.textContent = product.title;
  if(productDescEl) productDescEl.textContent = product.description;
  if(productPriceEl) productPriceEl.textContent = `₹${product.price}`;
  if(productImageEl) productImageEl.src = product.image_url;

  addToCartBtn.addEventListener("click", ()=>{
    const qty = parseInt(document.getElementById("quantity")?.value) || 1;
    const existing = cart.find(c => c.id === product.id);
    if(existing) existing.qty += qty;
    else cart.push({id: product.id, title: product.title, price: product.price, qty});
    saveCart(); updateCartUI(); alert("Added to cart!");
  });
}

/* ========================================================
   ========== CHECKOUT ========== */
checkoutBtn?.addEventListener("click", async ()=>{
  const user = (await sb.auth.getUser()).data.user;
  if(!user){ alert("Login first"); return; }
  if(!cart.length){ alert("Cart empty"); return; }

  const order = {
    user_id: user.id,
    total: cart.reduce((a,b)=>a+b.price*b.qty,0),
    items: cart,
    status: "Pending",
    created_at: new Date().toISOString()
  };

  const { error } = await sb.from("orders").insert([order]);
  if(error){ alert(error.message); return; }
  alert("Order placed!");
  cart=[]; saveCart(); updateCartUI();
  cartModal.classList.add("hidden");
});
