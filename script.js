/* --------------------------
    SUPABASE SETUP
--------------------------- */
const sb = window.supabase.createClient(
  "https://ytxhlihzxgftffaikumr.supabase.co",
  "YOUR_PUBLIC_ANON_KEY"
);

/* --------------------------
    INPUTS
--------------------------- */
const signupEmail = document.getElementById("signup-email");
const signupPass = document.getElementById("signup-pass");
const loginEmail = document.getElementById("login-email");
const loginPass = document.getElementById("login-pass");

/* --------------------------
    BUTTONS
--------------------------- */
const btnSignup = document.getElementById("btn-signup");
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const btnReset = document.getElementById("btn-reset");

/* --------------------------
    SIGNUP
--------------------------- */
btnSignup?.addEventListener("click", async () => {
  const email = signupEmail.value.trim();
  const password = signupPass.value.trim();

  if (!email || !password) return alert("Fill all fields");

  const { data, error } = await sb.auth.signUp({ email, password });

  if (error) return alert(error.message);

  alert("Account created! Now login.");
});

/* --------------------------
    LOGIN
--------------------------- */
btnLogin?.addEventListener("click", async () => {
  const email = loginEmail.value.trim();
  const password = loginPass.value.trim();

  if (!email || !password) return alert("Fill all fields");

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return alert("Wrong email or password");

  // Redirect after login
  window.location.href = "index.html";
});

/* --------------------------
    RESET PASSWORD (Send email)
--------------------------- */
btnReset?.addEventListener("click", async () => {
  const email = loginEmail.value.trim();

  if (!email) return alert("Enter your email first");

  const { data, error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: "https://YOUR_DOMAIN/reset.html", // important!
  });

  if (error) return alert(error.message);

  alert("Password reset email sent!");
});

/* --------------------------
    LOGOUT
--------------------------- */
btnLogout?.addEventListener("click", async () => {
  await sb.auth.signOut();
  window.location.href = "login.html";
});

/* --------------------------
    HIDE USER EMAIL FROM UI
--------------------------- */

// If somewhere in your HTML:
// <span id="user-email"></span>

const emailBox = document.getElementById("user-email");
if (emailBox) emailBox.style.display = "none";   // 100% hide
