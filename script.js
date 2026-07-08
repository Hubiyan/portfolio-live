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


// -------------- CONFETTI (once when the footer enters view) --------------
(function () {
  var fired = false;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var footer = document.querySelector('footer.container');
  if (!footer || prefersReducedMotion) return;

  var burstMaxMs = 2200;
  var burstParticleCap = window.matchMedia('(max-width: 520px)').matches ? 36 : 58;

  function pageScrollHeight() {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    );
  }

  function isAtBottom(offset) {
    return (window.innerHeight + window.pageYOffset) >= pageScrollHeight() - (offset || 80);
  }

  function fireConfettiBurst(originX, originY) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var dpr = Math.min(2, window.devicePixelRatio || 1);

    var canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'presentation');
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '999999999',
    });
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    if (dpr !== 1) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    var particles = [];
    for (var i = 0; i < burstParticleCap; i += 1) {
      var angle = Math.random() * Math.PI * 2;
      var sp = 7 + Math.random() * 12;
      var speedScale = 0.45 + Math.random() * 0.55;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * sp * speedScale,
        vy: Math.sin(angle) * sp * speedScale,
        w: 3 + Math.random() * 6,
        h: 2 + Math.random() * 3,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.25,
        hue: 360 * Math.random(),
        life: 1,
        decay: 0.0075 + Math.random() * 0.0065,
      });
    }

    document.body.appendChild(canvas);
    var gravity = 0.32;
    var t0 = performance.now();

    function step(now) {
      var elapsed = now - t0;
      if (elapsed > burstMaxMs) {
        canvas.remove();
        return;
      }
      ctx.clearRect(0, 0, vw, vh);
      var alive = 0;
      for (var p = 0; p < particles.length; p += 1) {
        var c = particles[p];
        if (c.life <= 0) continue;
        alive += 1;
        c.vy += gravity;
        c.x += c.vx;
        c.y += c.vy;
        c.vx *= 0.99;
        c.vy *= 0.999;
        c.rot += c.vr;
        c.life -= c.decay;
        if (c.life <= 0) continue;
        var a = Math.max(0, Math.min(1, c.life));
        ctx.save();
        ctx.fillStyle = 'hsla(' + (c.hue % 360) + ', 90%, 65%, ' + a + ')';
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
        ctx.restore();
      }
      if (alive > 0) requestAnimationFrame(step);
      else canvas.remove();
    }
    requestAnimationFrame(step);
  }

  function fireConfettiAtCenter() {
    if (fired) return;
    fired = true;
    fireConfettiBurst(window.innerWidth / 2, window.innerHeight * 0.55);
  }

  /* Primary: footer entering the viewport (reliable on all screen sizes). */
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!fired && entry.isIntersecting && entry.intersectionRatio >= 0.25) {
          observer.disconnect();
          fireConfettiAtCenter();
        }
      });
    }, { threshold: [0, 0.25, 0.5] });
    observer.observe(footer);
  }

  /* Fallback: classic scroll-to-bottom check with correct document height. */
  function onScrollCheck() {
    if (!fired && isAtBottom()) fireConfettiAtCenter();
  }
  window.addEventListener('scroll', onScrollCheck, { passive: true });
  window.addEventListener('load', onScrollCheck);
  onScrollCheck();
})();

// -------------- HAMBURGER MENU (star-blue) --------------
(function initHamburger() {
  function initHamburgerWrap(wrap) {
    const btn = wrap.querySelector('.hamburger-btn');
    const menu = wrap.querySelector('.hamburger-menu');
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
      btn.setAttribute('aria-label', 'Close menu');
      menu.setAttribute('aria-hidden', 'false');
      menu.classList.add('is-open');
      menu.querySelectorAll('a').forEach(a => a.removeAttribute('tabindex'));
      stopStarSpinWithBounce();
    }

    function closeMenu() {
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Open menu');
      menu.setAttribute('aria-hidden', 'true');
      menu.classList.remove('is-open');
      menu.querySelectorAll('a').forEach(a => a.setAttribute('tabindex', '-1'));
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

    menu.querySelectorAll('.ham-link').forEach((link) => {
      link.addEventListener('click', () => closeMenu());
    });

    // Initialise: menu starts closed, so links must not be keyboard-reachable
    menu.querySelectorAll('a').forEach(a => a.setAttribute('tabindex', '-1'));
  }

  function setup() {
    document.querySelectorAll('.hamburger-wrap').forEach(initHamburgerWrap);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();

/* ===== Build Gradual Blur bands inside .my-nav ===== */
(function buildNavBlur() {
  const stack = document.getElementById('navBlurStack');
  if (!stack) return;

  const css = () => getComputedStyle(document.documentElement);
  const lerp = (a, b, t) => a + (b - a) * t;

  function render() {
    // kill effect entirely on mobile
    if (window.innerWidth <= 520) {
      stack.innerHTML = '';
      return;
    }

    const s = css();
    const L = parseInt(s.getPropertyValue('--nav-blur-layers')) || 10;
    const blurMin = parseFloat(s.getPropertyValue('--nav-blur-min')) || 1;
    const blurMax = parseFloat(s.getPropertyValue('--nav-blur-max')) || 14;
    const angle = (s.getPropertyValue('--nav-blur-angle') || '180deg').trim();
    const win = (s.getPropertyValue('--nav-band-window') || '10%').trim();
    const feather = (s.getPropertyValue('--nav-band-feather') || '10%').trim();

    stack.innerHTML = '';

    for (let i = 0; i < L; i++) {
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

      const t = (L === 1) ? 1 : (i / (L - 1));
      const blur = lerp(blurMin, blurMax, t).toFixed(2) + 'px';

      layer.style.webkitMaskImage = mask;
      layer.style.maskImage = mask;
      layer.style.webkitBackdropFilter = `blur(${blur})`;
      layer.style.backdropFilter = `blur(${blur})`;

      stack.appendChild(layer);
    }
  }

  const init = () => render();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('resize', render, { passive: true });
  window.addEventListener('orientationchange', render);
})();



