// DOM Ready Function
document.addEventListener("DOMContentLoaded", function () {
  // Mobile Navigation Toggle
  const navToggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");

  navToggle.addEventListener("click", function () {
    const isExpanded = this.getAttribute("aria-expanded") === "true";
    this.setAttribute("aria-expanded", !isExpanded);
    nav.setAttribute("data-visible", !isExpanded);

    // Toggle body scroll when menu is open
    document.body.style.overflow = isExpanded ? "auto" : "hidden";
  });

  // Close mobile menu when clicking on a link
  const navLinks = document.querySelectorAll(".nav__link");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (nav.getAttribute("data-visible") === "true") {
        navToggle.setAttribute("aria-expanded", "false");
        nav.setAttribute("data-visible", "false");
        document.body.style.overflow = "auto";
      }
    });
  });

  // Hero Stats Animation
  animateStats();

  // Smooth Scrolling for Anchor Links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();

      const targetId = this.getAttribute("href");
      if (targetId === "#") return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 80, // Adjust for header height
          behavior: "smooth",
        });
      }
    });
  });

  // Sticky Header on Scroll
  const header = document.querySelector(".header");
  window.addEventListener("scroll", function () {
    if (window.scrollY > 100) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });

  // Back to Top Button
  const backToTopBtn = document.querySelector(".back-to-top");
  window.addEventListener("scroll", function () {
    if (window.scrollY > 300) {
      backToTopBtn.classList.add("visible");
    } else {
      backToTopBtn.classList.remove("visible");
    }
  });

  // Form Submission Handling
  const contactForm = document.getElementById("contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();

      // Get form data
      const formData = new FormData(this);

      // Here you would typically send the data to your server
      // For demonstration, we'll just show a success message
      alert("Thank you for your message! We will contact you soon.");
      this.reset();

      // In a real implementation, you would use fetch() or AJAX here
      /* 
            fetch('your-endpoint', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                // Handle success
            })
            .catch(error => {
                // Handle error
            });
            */
    });
  }

  // Initialize any other components
  initServiceCardHover();
  initScrollAnimations();
});

// Animate Statistics Numbers
function animateStats() {
  const stats = document.querySelectorAll("[data-count]");
  if (!stats.length) return;

  const observer = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const statElement = entry.target;
          const target = parseInt(statElement.getAttribute("data-count"));
          const duration = 2000; // Animation duration in ms
          const startTime = performance.now();

          const animate = (currentTime) => {
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            const currentValue = Math.floor(progress * target);

            statElement.textContent = currentValue;

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              // Add plus sign if present in original text
              if (statElement.textContent.includes("+")) {
                statElement.textContent = target + "+";
              } else if (statElement.textContent.includes("%")) {
                statElement.textContent = target + "%";
              } else {
                statElement.textContent = target;
              }
            }
          };

          requestAnimationFrame(animate);
          observer.unobserve(statElement);
        }
      });
    },
    { threshold: 0.5, rootMargin: "0px 0px -50px 0px" }
  );

  stats.forEach((stat) => observer.observe(stat));
}

// Service Card Hover Effects
function initServiceCardHover() {
  const serviceCards = document.querySelectorAll(".service-card");

  serviceCards.forEach((card) => {
    card.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-10px)";
      this.style.boxShadow = "0 15px 30px rgba(0, 0, 0, 0.15)";
    });

    card.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(-5px)";
      this.style.boxShadow = "0 10px 20px rgba(0, 0, 0, 0.1)";
    });
  });
}

// Scroll Animations
function initScrollAnimations() {
  const animateOnScroll = (elements, animationClass) => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(animationClass);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    elements.forEach((element) => observer.observe(element));
  };

  // Animate elements with these classes when they scroll into view
  animateOnScroll(document.querySelectorAll(".fade-in"), "active");
  animateOnScroll(document.querySelectorAll(".slide-up"), "active");
}

// Debounce function for scroll/resize events
function debounce(func, wait = 20, immediate = true) {
  let timeout;
  return function () {
    const context = this,
      args = arguments;
    const later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}
