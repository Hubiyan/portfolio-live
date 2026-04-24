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


// -------------- TESTIMONIAL SCROLLING (Reusable) --------------
document.querySelectorAll('.testimonial-container').forEach(container => {
    let isDown = false;
    let startX;
    let scrollLeft;

    function handleScroll(e) {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 2; // Adjust scroll speed
        container.scrollLeft = scrollLeft - walk;
    }

    container.addEventListener('mousedown', e => {
        isDown = true;
        container.classList.add('active');
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
    });

    container.addEventListener('mouseleave', () => {
        isDown = false;
        container.classList.remove('active');
    });

    container.addEventListener('mouseup', () => {
        isDown = false;
        container.classList.remove('active');
    });

    container.addEventListener('mousemove', handleScroll);
});

// -------------- SCROLLER INDICATOR --------------
function updateScrollIndicator() {
    const scrollIndicator = document.querySelector('.scroller-indicator');
    if (!scrollIndicator) return;
    const scrollTop = window.scrollY;
    const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercentage = (scrollTop / documentHeight) * 100;
    scrollIndicator.style.width = `${scrollPercentage}%`;  // ✅ fixed
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


// ===== Live Clock (Hours & Minutes only) =====
(() => {
  const comps = document.querySelectorAll('.time-comp');

  function renderOne(comp){
    const tz   = comp.dataset.timezone || 'Asia/Dubai';
    const city = comp.dataset.city || 'Abu Dhabi';

    const cityEl = comp.querySelector('.city');
    if (cityEl && cityEl.textContent !== city) cityEl.textContent = city;

    const hmEl   = comp.querySelector('.hm');
    const apEl   = comp.querySelector('.ampm');
    if (!hmEl || !apEl) return;

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).formatToParts(new Date());

    let hour    = parts.find(p => p.type === 'hour')?.value ?? '00';
    const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
    const ampm   = (parts.find(p => p.type === 'dayPeriod')?.value ?? 'AM').toUpperCase();

    // Drop leading zero on hour
    hour = String(parseInt(hour, 10));

    hmEl.textContent = `${hour}:${minute}`;
    apEl.textContent = ampm;
  }

  function renderAll(){ comps.forEach(renderOne); }

  let tick = null;
  function start(){ renderAll(); tick = setInterval(renderAll, 60 * 1000); } // update every minute
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
  // Prompts page has its own copy-triggered confetti — skip scroll-end confetti there
  if (document.body.classList.contains('prompts-page')) return;

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

// -------------- HAMBURGER MENU --------------
(function initHamburger() {
    function setup() {
        const btn = document.getElementById('hamburgerBtn');
        const menu = document.getElementById('hamburgerMenu');
        const caseLink = document.getElementById('hamCaseLink');
        if (!btn || !menu) return;

        const star = btn.querySelector('.hamburger-star-icon');
        const SPIN_CLASS = 'hamburger-star-spinning';
        const BOUNCE_MS = 520;
        const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
        let starAnimGen = 0;

        function rotationDegFromTransform(el) {
            const t = getComputedStyle(el).transform;
            if (!t || t === 'none') return 0;
            const m = new DOMMatrix(t);
            return (Math.atan2(m.m21, m.m11) * 180) / Math.PI;
        }

        function clearStarInlineMotion() {
            if (!star) return;
            star.style.animation = '';
            star.style.transition = '';
            star.style.transform = '';
        }

        function stopStarSpinWithBounce() {
            if (!star) return;
            starAnimGen += 1;
            const gen = starAnimGen;
            if (mqReduce.matches) {
                star.classList.remove(SPIN_CLASS);
                clearStarInlineMotion();
                return;
            }
            const angle = rotationDegFromTransform(star);
            star.classList.remove(SPIN_CLASS);
            star.style.animation = 'none';
            star.style.transform = `rotate(${angle}deg)`;
            void star.offsetWidth;
            star.style.transition = `transform ${BOUNCE_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
            requestAnimationFrame(() => {
                if (gen !== starAnimGen) return;
                star.style.transform = 'rotate(0deg)';
            });
            function onEnd(e) {
                star.removeEventListener('transitionend', onEnd);
                if (e.propertyName !== 'transform' || gen !== starAnimGen) return;
                clearStarInlineMotion();
            }
            star.addEventListener('transitionend', onEnd);
            setTimeout(() => {
                star.removeEventListener('transitionend', onEnd);
                if (gen !== starAnimGen) return;
                clearStarInlineMotion();
            }, BOUNCE_MS + 80);
        }

        function startStarSpinWithBounce() {
            if (!star) return;
            starAnimGen += 1;
            const gen = starAnimGen;
            if (mqReduce.matches) {
                clearStarInlineMotion();
                star.classList.add(SPIN_CLASS);
                return;
            }
            star.classList.remove(SPIN_CLASS);
            star.style.animation = 'none';
            star.style.transform = 'scale(0.78)';
            void star.offsetWidth;
            star.style.transition = `transform ${BOUNCE_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
            requestAnimationFrame(() => {
                if (gen !== starAnimGen) return;
                star.style.transform = 'scale(1)';
            });
            function onEnd(e) {
                star.removeEventListener('transitionend', onEnd);
                if (e.propertyName !== 'transform' || gen !== starAnimGen) return;
                clearStarInlineMotion();
                star.classList.add(SPIN_CLASS);
            }
            star.addEventListener('transitionend', onEnd);
            setTimeout(() => {
                star.removeEventListener('transitionend', onEnd);
                if (gen !== starAnimGen) return;
                clearStarInlineMotion();
                star.classList.add(SPIN_CLASS);
            }, BOUNCE_MS + 80);
        }

        if (star && btn.getAttribute('aria-expanded') === 'false') {
            star.classList.add(SPIN_CLASS);
        }

        function openMenu() {
            btn.setAttribute('aria-expanded', 'true');
            menu.setAttribute('aria-hidden', 'false');
            menu.classList.add('is-open');
            stopStarSpinWithBounce();
        }

        function closeMenu() {
            btn.setAttribute('aria-expanded', 'false');
            menu.setAttribute('aria-hidden', 'true');
            menu.classList.remove('is-open');
            startStarSpinWithBounce();
        }

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = btn.getAttribute('aria-expanded') === 'true';
            isOpen ? closeMenu() : openMenu();
        });

        document.addEventListener('click', (e) => {
            if (!btn.contains(e.target) && !menu.contains(e.target)) {
                closeMenu();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeMenu();
        });

        if (caseLink) {
            caseLink.addEventListener('click', () => closeMenu());
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup, { once: true });
    } else {
        setup();
    }
})();

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
