// ------------------------------
// CART SYSTEM
// ------------------------------

const $ = id => document.getElementById(id);

let cart = JSON.parse(localStorage.getItem("cart")) || [];

/* Update Count */
function updateCartCount() {
  const countSpan = $("cartCount");
  if (countSpan) countSpan.textContent = cart.length;
}

/* Save Cart */
function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
}

/* Render Cart Modal */
function renderCart() {
  const box = $("cartItems");
  if (!box) return;
  box.innerHTML = "";

  if (cart.length === 0) {
    box.innerHTML = "<p>No items in cart.</p>";
    return;
  }

  cart.forEach(item => {
    const div = document.createElement("div");
    div.className = "p-2 border rounded flex justify-between";
    div.innerHTML = `
      <span>${item.name}</span>
      <span>$${item.price}</span>
    `;
    box.appendChild(div);
  });
}

// ------------------------------
// EVENT HANDLERS
// ------------------------------

window.addEventListener("DOMContentLoaded", () => {

  updateCartCount();

  // Open Cart (index + product)
  $("btnCart")?.addEventListener("click", () => {
    $("cartModal").classList.remove("hidden");
    renderCart();
  });

  // Close Cart
  $("closeCart")?.addEventListener("click", () => {
    $("cartModal").classList.add("hidden");
  });

  // PRODUCT PAGE ADD TO CART
  $("addToCartBtn")?.addEventListener("click", () => {
    const name = $("productName")?.innerText;
    const price = $("productPrice")?.innerText.replace("$", "");

    cart.push({ name, price });
    saveCart();
    alert("Added to Cart!");
  });
});
