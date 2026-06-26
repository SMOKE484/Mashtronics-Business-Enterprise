// Slider functionality for Why Choose Us page
document.addEventListener("DOMContentLoaded", function () {
  // Select all necessary elements
  const nextBtn = document.querySelector(".why-nav-arrows .why-next");
  const prevBtn = document.querySelector(".why-nav-arrows .why-prev");
  const slider = document.querySelector(".why-slider");
  const sliderList = slider.querySelector(".why-list");
  const thumbnailContainer = document.querySelector(".why-thumbnails");
  const thumbnailItems = thumbnailContainer.querySelectorAll(".why-thumb-item");
  const slides = sliderList.querySelectorAll(".why-item");

  let currentIndex = 0;
  const slideCount = slides.length;

  // Initialize slider
  function initSlider() {
    // Set active class on first slide
    slides[0].classList.add("active");
    thumbnailItems[0].classList.add("active");

    // Set up thumbnail click events
    thumbnailItems.forEach((thumb, index) => {
      thumb.addEventListener("click", () => {
        goToSlide(index);
      });
    });
  }

  // Go to specific slide
  function goToSlide(index) {
    // Update current index
    currentIndex = index;

    // Remove active class from all slides and thumbnails
    slides.forEach((slide) => slide.classList.remove("active"));
    thumbnailItems.forEach((thumb) => thumb.classList.remove("active"));

    // Add active class to current slide and thumbnail
    slides[currentIndex].classList.add("active");
    thumbnailItems[currentIndex].classList.add("active");

    // Update slider position
    sliderList.style.transform = `translateX(-${currentIndex * 100}%)`;
  }

  // Next slide
  function nextSlide() {
    currentIndex = (currentIndex + 1) % slideCount;
    goToSlide(currentIndex);
  }

  // Previous slide
  function prevSlide() {
    currentIndex = (currentIndex - 1 + slideCount) % slideCount;
    goToSlide(currentIndex);
  }

  // Event listeners for navigation buttons
  if (nextBtn) nextBtn.addEventListener("click", nextSlide);
  if (prevBtn) prevBtn.addEventListener("click", prevSlide);

  // Keyboard navigation
  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") {
      nextSlide();
    } else if (e.key === "ArrowLeft") {
      prevSlide();
    }
  });

  // Initialize the slider
  initSlider();

  // Auto-advance slides (optional)
  let slideInterval = setInterval(nextSlide, 5000);

  // Pause on hover
  slider.addEventListener("mouseenter", () => {
    clearInterval(slideInterval);
  });

  slider.addEventListener("mouseleave", () => {
    slideInterval = setInterval(nextSlide, 5000);
  });
});
