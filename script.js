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


// ===== Live Clock =====
(() => {
  const comps = document.querySelectorAll('.time-comp');

  function renderOne(comp){
    const tz   = comp.dataset.timezone || 'Asia/Dubai';
    const city = comp.dataset.city || 'Abu Dhabi';

    const cityEl = comp.querySelector('.city');
    if (cityEl && cityEl.textContent !== city) cityEl.textContent = city;

    const hmEl   = comp.querySelector('.hm');
    const secEl  = comp.querySelector('.sec');
    const apEl   = comp.querySelector('.ampm');
    if (!hmEl || !secEl || !apEl) return;

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).formatToParts(new Date());

    let hour    = parts.find(p => p.type === 'hour')?.value ?? '00';
    const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
    const second = parts.find(p => p.type === 'second')?.value ?? '00';
    const ampm   = (parts.find(p => p.type === 'dayPeriod')?.value ?? 'AM').toUpperCase();

    // Drop leading zero on hour
    hour = String(parseInt(hour, 10));

    hmEl.textContent  = `${hour}:${minute}`;
    secEl.textContent = String(second).padStart(2,'0');
    apEl.textContent  = ampm;
  }

  function renderAll(){ comps.forEach(renderOne); }

  let tick = null;
  function start(){ renderAll(); tick = setInterval(renderAll, 1000); }
  function stop(){ clearInterval(tick); tick = null; }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });
})();


document.addEventListener("DOMContentLoaded", () => {
  // Initialize Confetti with the hidden trigger
  const confetti = new Confetti("confetti-trigger");
  confetti.destroyTarget(false); // prevent hiding trigger

  let fired = false;

  function isAtBottom(offset = 10) {
    return (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - offset);
  }

  function fireConfettiAtCenter() {
    const x = window.innerWidth / 2;
    const y = window.innerHeight / 2;

    const trigger = document.getElementById("confetti-trigger");
    const event = new MouseEvent("click", {
      clientX: x,
      clientY: y,
      bubbles: true
    });
    trigger.dispatchEvent(event);
  }

  window.addEventListener("scroll", () => {
    if (!fired && isAtBottom()) {
      fired = true;
      fireConfettiAtCenter();
    }
  });
});

/* ===== Build Gradual Blur bands inside .my-nav ===== */
/* ===== Build Gradual Blur bands inside .my-nav ===== */
(function buildNavBlur(){
  const stack = document.getElementById('navBlurStack');
  if (!stack) return;

  const css  = () => getComputedStyle(document.documentElement);
  const lerp = (a,b,t) => a + (b-a)*t;

  function render(){
    // kill effect entirely on mobile
    if (window.innerWidth <= 520){
      stack.innerHTML = '';
      return;
    }

    const s = css();
    const L        = parseInt(s.getPropertyValue('--nav-blur-layers')) || 10;
    const blurMin  = parseFloat(s.getPropertyValue('--nav-blur-min')) || 1;
    const blurMax  = parseFloat(s.getPropertyValue('--nav-blur-max')) || 14;
    const angle    = (s.getPropertyValue('--nav-blur-angle') || '180deg').trim();
    const win      = (s.getPropertyValue('--nav-band-window') || '10%').trim();
    const feather  = (s.getPropertyValue('--nav-band-feather') || '10%').trim();

    stack.innerHTML = '';

    for (let i=0; i<L; i++){
      const layer = document.createElement('div');
      layer.className = 'nav-blur-layer';

      const start = i * 10;
      const sPct = start;
      const aPct = start + parseFloat(feather);
      const bPct = aPct + parseFloat(win);
      const ePct = bPct + parseFloat(feather);

      const mask = `linear-gradient(${angle},
        transparent ${sPct}%,
        black ${aPct}%,
        black ${bPct}%,
        transparent ${ePct}%
      )`;

      const t    = (L === 1) ? 1 : (i / (L - 1));
      const blur = lerp(blurMin, blurMax, t).toFixed(2) + 'px';

      layer.style.webkitMaskImage      = mask;
      layer.style.maskImage            = mask;
      layer.style.webkitBackdropFilter = `blur(${blur})`;
      layer.style.backdropFilter       = `blur(${blur})`;

      stack.appendChild(layer);
    }
  }

  const init = () => render();
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }

  window.addEventListener('resize', render, { passive:true });
  window.addEventListener('orientationchange', render);
})();
