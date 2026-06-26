document.addEventListener("DOMContentLoaded", function () {
  // Gallery Filter Functionality
  const filterButtons = document.querySelectorAll(".filter-btn");
  const galleryItems = document.querySelectorAll(".gallery-item");

  filterButtons.forEach((button) => {
    button.addEventListener("click", function () {
      // Update active button
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      this.classList.add("active");

      const filterValue = this.getAttribute("data-filter");

      // Filter items
      galleryItems.forEach((item) => {
        if (
          filterValue === "all" ||
          item.getAttribute("data-category") === filterValue
        ) {
          item.style.display = "block";
        } else {
          item.style.display = "none";
        }
      });
    });
  });

  // Lightbox Functionality
  const lightbox = document.getElementById("lightbox-modal");
  const lightboxImg = document.getElementById("lightbox-image");
  const lightboxTitle = document.getElementById("lightbox-title");
  const lightboxDesc = document.getElementById("lightbox-description");
  const closeBtn = document.querySelector(".lightbox-close");
  const prevBtn = document.querySelector(".lightbox-prev");
  const nextBtn = document.querySelector(".lightbox-next");

  let currentImageIndex = 0;
  const galleryImages = Array.from(
    document.querySelectorAll(".gallery-expand")
  );

  // Open lightbox
  galleryImages.forEach((img, index) => {
    img.addEventListener("click", function (e) {
      e.preventDefault();
      currentImageIndex = index;
      updateLightbox();
      lightbox.style.display = "block";
      document.body.style.overflow = "hidden";
    });
  });

  // Close lightbox
  closeBtn.addEventListener("click", function () {
    lightbox.style.display = "none";
    document.body.style.overflow = "auto";
  });

  // Previous image
  prevBtn.addEventListener("click", function () {
    currentImageIndex =
      (currentImageIndex - 1 + galleryImages.length) % galleryImages.length;
    updateLightbox();
  });

  // Next image
  nextBtn.addEventListener("click", function () {
    currentImageIndex = (currentImageIndex + 1) % galleryImages.length;
    updateLightbox();
  });

  // Close when clicking outside image
  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox) {
      lightbox.style.display = "none";
      document.body.style.overflow = "auto";
    }
  });

  // Update lightbox content
  function updateLightbox() {
    const currentImage = galleryImages[currentImageIndex];
    const imgSrc = currentImage.getAttribute("href");
    const imgTitle = currentImage.getAttribute("data-title");

    lightboxImg.src = imgSrc;
    lightboxImg.alt = imgTitle;
    lightboxTitle.textContent =
      imgTitle.split(" at ")[0] || imgTitle.split(" in ")[0] || imgTitle;
    lightboxDesc.textContent = imgTitle;
  }

  // Keyboard navigation
  document.addEventListener("keydown", function (e) {
    if (lightbox.style.display === "block") {
      switch (e.key) {
        case "Escape":
          lightbox.style.display = "none";
          document.body.style.overflow = "auto";
          break;
        case "ArrowLeft":
          currentImageIndex =
            (currentImageIndex - 1 + galleryImages.length) %
            galleryImages.length;
          updateLightbox();
          break;
        case "ArrowRight":
          currentImageIndex = (currentImageIndex + 1) % galleryImages.length;
          updateLightbox();
          break;
      }
    }
  });

  // Simple testimonial slider
  const testimonialSlides = document.querySelectorAll(".testimonial-slide");
  let currentSlide = 0;

  function showSlide(n) {
    testimonialSlides.forEach((slide) => {
      slide.style.display = "none";
    });

    currentSlide = (n + testimonialSlides.length) % testimonialSlides.length;
    testimonialSlides[currentSlide].style.display = "block";
  }

  // Auto-rotate testimonials
  setInterval(() => {
    showSlide(currentSlide + 1);
  }, 5000);

  // Show first slide initially
  showSlide(0);
});
