/* ========================================================
   ========== PRODUCT PAGE ========== */
async function setupProductPage(){
  const addToCartBtn = document.getElementById("addToCart");
  if(!addToCartBtn) return; // not a product page

  const productTitleEl = document.getElementById("productTitle");
  const productDescEl = document.getElementById("productDesc");
  const productPriceEl = document.getElementById("productPrice");
  const productImagesEl = document.getElementById("productImages");

  const productIdStr = new URLSearchParams(window.location.search).get("id");
  const productId = productIdStr ? Number(productIdStr) : 0;
  if(!productId){ alert("Invalid product!"); return; }

  const { data: product, error } = await sb.from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if(error || !product){ alert("Product not found!"); return; }

  productTitleEl.textContent = product.title;
  productDescEl.textContent = product.description;
  productPriceEl.textContent = `₹${product.price}`;

  // Handle design_images column
  let images = [];
  if (Array.isArray(product.design_images)) {
    images = product.design_images;
  } else if (typeof product.design_images === "string") {
    try {
      images = JSON.parse(product.design_images);
    } catch(e){
      images = product.design_images.split(",");
    }
  }
  images = images || [];

  // Render thumbnails
  productImagesEl.innerHTML = images.map(url => `
    <img src="${url}" class="w-48 h-48 object-contain border rounded cursor-pointer hover:scale-105 transition" />
  `).join("");

  // Set first image as selected
  let selectedImage = images[0] || "";

  // Add click events to thumbnails
  productImagesEl.querySelectorAll("img").forEach(imgEl => {
    imgEl.addEventListener("click", () => {
      selectedImage = imgEl.src;
      // Optional: highlight selected thumbnail
      productImagesEl.querySelectorAll("img").forEach(i => i.classList.remove("border-indigo-600"));
      imgEl.classList.add("border-indigo-600");
    });
  });

  // Add to cart
  addToCartBtn.addEventListener("click", () => {
    const qty = parseInt(document.getElementById("quantity")?.value) || 1;
    const existing = cart.find(c => c.id === product.id && c.image === selectedImage);
    if(existing) existing.qty += qty;
    else cart.push({ id: product.id, title: product.title, price: product.price, qty, image: selectedImage });
    saveCart();
    updateCartUI();
    alert("Added to cart!");
  });
}
