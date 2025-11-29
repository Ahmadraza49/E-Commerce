/* ============================
   Supabase Setup
============================ */
const SUPABASE_URL = "https://ytxhlihzxgftffaikumr.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============================
   Global Cart
============================ */
let cart = [];

/* ============================
   Load Products (Index Page)
============================ */
async function loadProducts() {
  if (!document.getElementById("products")) return;

  let { data, error } = await supabase.from("products").select("*");
  if (error) {
    document.getElementById("products").innerHTML =
      "<p class='text-red-600'>Failed to load products.</p>";
    return;
  }

  document.getElementById("products").innerHTML = data
    .map(
      (p) => `
    <div class="bg-white p-3 shadow rounded">
      <img src="${p.image}" class="w-full h-32 object-cover rounded" />

      <h3 class="font-bold mt-2">${p.name}</h3>
      <p class="font-bold text-green-700">$${p.price}</p>

      <a href="product.html?id=${p.id}" class="bg-blue-600 text-white px-3 py-1 rounded block mt-2 text-center">View</a>
    </div>`
    )
    .join("");
}

/* ============================
   Load Single Product Page
============================ */
async function loadProductPage() {
  if (!document.getElementById("productDetails")) return;

  const id = new URLSearchParams(location.search).get("id");

  let { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) {
    document.getElementById("productDetails").innerHTML =
      "<p class='text-red-600'>Product not found.</p>";
    return;
  }

  document.getElementById("productDetails").innerHTML = `
      <img src="${data.image}" class="w-full h-60 object-cover rounded" />

      <h2 class="text-2xl font-bold mt-3">${data.name}</h2>
      <p class="text-xl font-bold text-green-700">$${data.price}</p>

      <p class="mt-3">${data.description || ""}</p>

      <button onclick="addToCart(${data.id}, '${data.name}', ${data.price})"
        class="bg-black text-white px-4 py-2 rounded mt-4 w-full">
        Add to Cart
      </button>
  `;
}

/* ============================
   Cart
============================ */
function addToCart(id, name, price) {
  cart.push({ id, name, price });

  alert("Added to cart!");
}

/* ============================
   Show Cart
============================ */
function showCart() {
  document.getElementById("cartModal").classList.remove("hidden");

  let html = "";
  let total = 0;

  cart.forEach((item) => {
    html += `<p>${item.name} — $${item.price}</p>`;
    total += item.price;
  });

  document.getElementById("cartItems").innerHTML = html;
  document.getElementById("cartTotal").innerText = "Total: $" + total;
}

/* ============================
   Checkout
============================ */
async function checkout() {
  const user = (await supabase.auth.getUser()).data.user;

  if (!user) {
    alert("Please login first!");
    return;
  }

  let total = cart.reduce((t, i) => t + i.price, 0);

  await supabase.from("orders").insert([
    {
      user_id: user.id,
      items: cart,
      total: total,
      status: "Pending",
    },
  ]);

  cart = [];
  alert("Order placed!");
  document.getElementById("cartModal").classList.add("hidden");
}

/* ============================
   AUTH — Login / Signup / Reset
============================ */
async function startAuth() {
  // Buttons
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const ordersPageBtn = document.getElementById("ordersPageBtn");

  const loginModal = document.getElementById("loginModal");
  const signupModal = document.getElementById("signupModal");
  const resetModal = document.getElementById("resetModal");

  // Check Session
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (user) {
      loginBtn.classList.add("hidden");
      logoutBtn.classList.remove("hidden");
      ordersPageBtn.classList.remove("hidden");
    }
  });

  // Login open
  loginBtn.onclick = () => loginModal.classList.remove("hidden");

  // Login
  document.getElementById("doLogin").onclick = async () => {
    let email = document.getElementById("loginEmail").value;
    let pass = document.getElementById("loginPass").value;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) {
      document.getElementById("loginError").innerText = error.message;
    } else {
      location.reload();
    }
  };

  // Logout
  logoutBtn.onclick = async () => {
    await supabase.auth.signOut();
    location.reload();
  };

  // Signup open
  document.getElementById("openSignup").onclick = () => {
    loginModal.classList.add("hidden");
    signupModal.classList.remove("hidden");
  };

  // Signup
  document.getElementById("doSignup").onclick = async () => {
    let email = document.getElementById("signupEmail").value;
    let pass = document.getElementById("signupPass").value;

    let { error } = await supabase.auth.signUp({ email, password: pass });

    if (error) {
      document.getElementById("signupError").innerText = error.message;
    } else {
      alert("Account created! Please login.");
      signupModal.classList.add("hidden");
    }
  };

  // Reset
  document.getElementById("openReset").onclick = () => {
    loginModal.classList.add("hidden");
    resetModal.classList.remove("hidden");
  };

  document.getElementById("doReset").onclick = async () => {
    let email = document.getElementById("resetEmail").value;

    await supabase.auth.resetPasswordForEmail(email);

    document.getElementById("resetMsg").innerText =
      "Reset link sent to your email!";
  };

  // Close buttons
  document.getElementById("closeLogin").onclick = () =>
    loginModal.classList.add("hidden");
  document.getElementById("closeSignup").onclick = () =>
    signupModal.classList.add("hidden");
  document.getElementById("closeReset").onclick = () =>
    resetModal.classList.add("hidden");

  // Cart
  document.getElementById("cartOpenBtn").onclick = showCart;
  document.getElementById("closeCart").onclick = () =>
    document.getElementById("cartModal").classList.add("hidden");
  document.getElementById("checkoutBtn").onclick = checkout;
}

/* ============================
   INIT
============================ */
loadProducts();
loadProductPage();
startAuth();
