const SOFTWARE_URL = "../app/login.html";
const TRIAL_URL = "../app/login.html?signup=trial";
const STRIPE_PRICE_LOOKUP_KEY = "barriercheck_monthly";

document.querySelectorAll(".software-link").forEach((link) => {
  link.setAttribute("href", SOFTWARE_URL);
});

document.querySelectorAll("[data-price-key]").forEach((input) => {
  input.value = STRIPE_PRICE_LOOKUP_KEY;
});

document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("is-visible");
  });
}, { threshold: 0.12 });

document.querySelectorAll(".tile, .workflow-steps article, .pricing-card").forEach((el) => {
  el.classList.add("reveal");
  observer.observe(el);
});