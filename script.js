// -------------- MARQUEE ANIMATION --------------
function startMarquee(marqueeElement) {
    const marqueeInner = marqueeElement.querySelector('.marquee-inner');
    const marqueeContent = marqueeElement.querySelectorAll('.marquee-content');
    const contentWidth = marqueeContent[0].offsetWidth;
    let offset = 0;
    const speed = 0.25; // Adjust speed of scrolling

    // Clone first content block to ensure smooth looping
    const firstClone = marqueeContent[0].cloneNode(true);
    marqueeInner.appendChild(firstClone);

    function animateMarquee() {
        offset -= speed;
        if (Math.abs(offset) >= contentWidth) {
            offset = 0; // Reset offset for seamless loop
        }
        marqueeInner.style.transform = `translateX(${offset}px)`;
        requestAnimationFrame(animateMarquee);
    }

    animateMarquee();
}

// Initialize marquees on window load
window.addEventListener('load', () => {
    document.querySelectorAll('.marquee').forEach(marquee => startMarquee(marquee));
});


// -------------- MOBILE NAVIGATION FIX --------------
function fixNav() {
    const nav = document.querySelector('.my-nav');
    
    function forceNavPosition() {
        if (window.innerWidth <= 520) {
            nav.style.cssText = `
                position: fixed !important;
                bottom: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                z-index: 997 !important;
                transform: none !important;
                -webkit-transform: none !important;
            `;
            window.scrollTo(window.scrollX, window.scrollY); // Prevent scroll from moving nav
        }
    }

    forceNavPosition();
    window.addEventListener('scroll', forceNavPosition, { passive: true });
    document.addEventListener('touchmove', forceNavPosition, { passive: true });
    document.addEventListener('touchend', forceNavPosition, { passive: true });
}

// Initialize mobile navigation fix
document.addEventListener('DOMContentLoaded', fixNav);
window.addEventListener('resize', fixNav);
window.addEventListener('orientationchange', fixNav);


// -------------- TESTIMONIAL SCROLLING --------------
let isDown = false;
let startX, scrollLeft;
const testimonialContainer = document.querySelector('.testimonial-container');

function handleTestimonialScroll(e) {
    if (!isDown) return; 
    e.preventDefault();
    const x = e.pageX - testimonialContainer.offsetLeft;
    const walk = (x - startX) * 2; // Adjust scroll speed
    testimonialContainer.scrollLeft = scrollLeft - walk;
}

// Mouse events for scrolling testimonials
testimonialContainer.addEventListener('mousedown', (e) => {
    isDown = true;
    testimonialContainer.classList.add('active');
    startX = e.pageX - testimonialContainer.offsetLeft;
    scrollLeft = testimonialContainer.scrollLeft;
});
testimonialContainer.addEventListener('mouseleave', () => { isDown = false; testimonialContainer.classList.remove('active'); });
testimonialContainer.addEventListener('mouseup', () => { isDown = false; testimonialContainer.classList.remove('active'); });
testimonialContainer.addEventListener('mousemove', handleTestimonialScroll);


// -------------- SCROLLER INDICATOR --------------
function updateScrollIndicator() {
    const scrollIndicator = document.querySelector('.scroller-indicator');
    const scrollTop = window.scrollY;
    const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercentage = (scrollTop / documentHeight) * 100;
    scrollIndicator.style.width = `${scrollPercentage}%`;
}

// Attach scroll event for scroller indicator
window.addEventListener('scroll', updateScrollIndicator);


// -------------- CAROUSEL PROGRESS AND BUTTON DISABLE --------------
document.addEventListener('DOMContentLoaded', () => {
    const carousel = document.querySelector('#carouselExampleIndicators');
    if (!carousel) return; // Exit if carousel doesn't exist

    const progressBar = carousel.closest('.carousel-card').querySelector('.carou-progress');
    const backButton = carousel.closest('.carousel-card').querySelector('.carousel-control-prev');
    const items = carousel.querySelectorAll('.carousel-item');
    const totalItems = items.length;

    // Update UI based on active slide
    function updateCarouselUI() {
        const activeIndex = [...items].findIndex(item => item.classList.contains('active'));
        const progressPercentage = ((activeIndex + 1) / totalItems) * 100;
        progressBar.style.width = `${progressPercentage}%`;

        // Disable/enable back button based on active slide
        if (activeIndex === 0) {
            backButton.disabled = true;
            backButton.classList.add('opacity-50');
        } else {
            backButton.disabled = false;
            backButton.classList.remove('opacity-50');
        }
    }

    updateCarouselUI(); // Initialize UI
    carousel.addEventListener('slid.bs.carousel', updateCarouselUI);
});
