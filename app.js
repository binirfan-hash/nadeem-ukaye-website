/* ============================================================
   ARGUS motion engine — ported from vishruthvijay.com
   - Lenis smooth scroll (1.05s, wheel 0.9, touch 1.6)
   - GSAP ScrollTrigger reveals (y26 / 0.85s power3 / stagger .07)
   - Custom cursor (dot 1:1, ring lerp 0.16, hover grow, magnet)
   - Magnetic buttons (clamped 10px, 25%/30% pull)
   - Scroll progress bar + header state
   - Hero title char intro (power3.out, 0.8s, stagger 0.028)
   - WebGL interference field (sage tint, edge vignette)
   - Full reduced-motion + touch + CDN-failure fallbacks
   ============================================================ */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var noMotion = reduceMotion || !finePointer;
  if (noMotion) root.classList.add('no-motion');

  /* ---------- fallback path: everything visible, native scroll ---------- */
  function staticMode() {
    doc.querySelectorAll('[data-reveal]').forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    root.classList.add('is-ready');
    updateScrollUI();
    window.addEventListener('scroll', updateScrollUI, { passive: true });
  }

  /* ---------- scroll-linked UI: progress bar + header ---------- */
  function updateScrollUI() {
    var bar = doc.getElementById('pbar');
    var hdr = doc.getElementById('hdr');
    var h = root.scrollHeight - window.innerHeight;
    var p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
    if (bar) bar.style.transform = 'scaleX(' + p + ')';
    if (hdr) hdr.classList.toggle('is-scrolled', window.scrollY > 24);
  }

  if (reduceMotion || !window.gsap) {
    staticMode();
    return;
  }

  var gsap = window.gsap;
  var hasST = !!window.ScrollTrigger;
  if (hasST) gsap.registerPlugin(window.ScrollTrigger);

  /* ---------- 1. Lenis smooth scroll ---------- */
  if (window.Lenis) {
    var lenis = new window.Lenis({
      duration: 1.05,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      wheelMultiplier: 0.9,
      touchMultiplier: 1.6,
      smoothWheel: true
    });
    lenis.on('scroll', function () { if (hasST) window.ScrollTrigger.update(); });
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- 2. Hero title: word wrap + char split (masked) ---------- */
  (function () {
    var titles = Array.prototype.slice.call(doc.querySelectorAll('#heroTitle, [data-split]'));
    if (!titles.length) return;
    titles.forEach(function (title) {
      var text = title.textContent.trim();
      title.setAttribute('aria-label', title.getAttribute('aria-label') || text);
      title.textContent = '';
      text.split(/\s+/).forEach(function (w, i) {
        if (i > 0) title.appendChild(doc.createTextNode(' '));
        var wordSpan = doc.createElement('span');
        wordSpan.className = 'word';
        Array.from(w).forEach(function (ch) {
          var c = doc.createElement('span');
          c.className = 'ch';
          c.textContent = ch;
          wordSpan.appendChild(c);
        });
        title.appendChild(wordSpan);
      });
    });
  })();

  /* ---------- 3. Reveal system ---------- */
  (function () {
    var els = Array.prototype.slice.call(doc.querySelectorAll('[data-reveal]'));
    if (!els.length) { root.classList.add('is-ready'); return; }

    if (!hasST) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            gsap.to(en.target, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
            io.unobserve(en.target);
          }
        });
      }, { rootMargin: '10% 0px 10% 0px', threshold: 0 });
      els.forEach(function (el) { gsap.set(el, { y: 26 }); io.observe(el); });
      root.classList.add('is-ready');
      return;
    }

    doc.querySelectorAll('[data-reveal-group]').forEach(function (group) {
      var kids = Array.from(group.querySelectorAll('[data-reveal]'));
      if (!kids.length) return;
      var tl = gsap.timeline({ scrollTrigger: { trigger: group, start: 'top 84%' } });
      tl.set(kids, { y: 26 });
      tl.to(kids, { opacity: 1, y: 0, duration: 0.8, stagger: 0.07, ease: 'power3.out' });
    });

    els.filter(function (el) { return !el.closest('[data-reveal-group]'); })
      .forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) {
          gsap.set(el, { opacity: 1, y: 0 });
          return;
        }
        gsap.set(el, { y: 26 });
        gsap.to(el, {
          opacity: 1, y: 0, duration: 0.85, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 84%' }
        });
      });
    root.classList.add('is-ready');
  })();

  /* ---------- 4. Hero intro: chars rise from masks, field fades in ---------- */
  (function () {
    var chars = doc.querySelectorAll('#heroTitle .ch, .phero__title .ch');
    gsap.set('#shaderField', { opacity: 0 });
    gsap.set('.bloom', { opacity: 0 });
    if (!chars.length) return;
    gsap.set(chars, { yPercent: 115 });
    var tl = gsap.timeline({ delay: 0.15 });
    tl.to(chars, { yPercent: 0, duration: 0.8, ease: 'power3.out', stagger: 0.028 });
    tl.to('#shaderField', { opacity: 0.3, duration: 1.4, ease: 'power2.out' }, '<');
    tl.to('.bloom', { opacity: 0.14, duration: 1.6, stagger: 0.2 }, '<');
  })();

  /* ---------- 5. Custom cursor + magnetic pull ---------- */
  (function () {
    if (!finePointer || reduceMotion) return;
    var dot = doc.createElement('div');
    dot.className = 'cur cur--dot';
    dot.setAttribute('aria-hidden', 'true');
    var ring = doc.createElement('div');
    ring.className = 'cur cur--ring';
    ring.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(dot);
    doc.body.appendChild(ring);
    root.classList.add('has-cursor');

    var INTERACTIVE = 'a, button, [role="tab"], input, .svc-row';
    var MAGNETIC = '.btn, .hdr__cta, .arrow-link';

    var mouse = { x: innerWidth / 2, y: innerHeight / 2 };
    var ringPos = { x: mouse.x, y: mouse.y };
    var overInteractive = false;
    var magnetEl = null;
    var lastMagnet = null;

    window.addEventListener('pointermove', function (e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      var t = e.target;
      overInteractive = !!(t && t.closest && t.closest(INTERACTIVE));
      magnetEl = (t && t.closest && t.closest(MAGNETIC)) || null;
    }, { passive: true });

    doc.addEventListener('pointerleave', function () {
      if (lastMagnet) { lastMagnet.style.translate = ''; lastMagnet = null; }
    });

    (function loop() {
      requestAnimationFrame(loop);
      dot.style.transform = 'translate3d(' + mouse.x + 'px,' + mouse.y + 'px,0) translate(-50%,-50%)';
      ringPos.x += (mouse.x - ringPos.x) * 0.16;
      ringPos.y += (mouse.y - ringPos.y) * 0.16;
      ring.style.transform = 'translate3d(' + ringPos.x + 'px,' + ringPos.y + 'px,0) translate(-50%,-50%)';
      ring.dataset.over = String(overInteractive);
      if (magnetEl !== lastMagnet) {
        if (lastMagnet) lastMagnet.style.translate = '';
        lastMagnet = magnetEl;
      }
      if (magnetEl) {
        var b = magnetEl.getBoundingClientRect();
        var dx = mouse.x - (b.left + b.width / 2);
        var dy = mouse.y - (b.top + b.height / 2);
        var kx = Math.max(-10, Math.min(10, dx * 0.25));
        var ky = Math.max(-10, Math.min(10, dy * 0.3));
        magnetEl.style.translate = kx + 'px ' + ky + 'px';
      }
    })();
  })();

  /* ---------- 6. Progress bar + header driven by GSAP ticker ---------- */
  gsap.ticker.add(updateScrollUI);

  /* ---------- 6b. Layout hardening: refresh triggers after fonts/load ---------- */
  if (hasST) {
    var refresh = function () { window.ScrollTrigger.refresh(); };
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(refresh);
    window.addEventListener('load', refresh);
    setTimeout(refresh, 400);
  }

  /* ---------- 7. WebGL interference field ---------- */
  (function () {
    var host = doc.getElementById('shaderField');
    if (!host || noMotion || !window.THREE) return;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    } catch (e) { return; }

    var frag = [
      'precision highp float;',
      'uniform vec2 uResolution;',
      'uniform float uTime;',
      'uniform vec3 uTint;',
      'void main() {',
      '  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);',
      '  float t = uTime * 0.05;',
      '  float lineWidth = 0.002;',
      '  float v = 0.0;',
      '  for (int j = 0; j < 3; j++) {',
      '    for (int i = 0; i < 5; i++) {',
      '      v += lineWidth * float(i * i) / abs(fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0 - length(uv) + mod(uv.x + uv.y, 0.2));',
      '    }',
      '  }',
      '  float vignette = smoothstep(1.9, 0.25, length(uv));',
      '  gl_FragColor = vec4(uTint * v * vignette, 1.0);',
      '}'
    ].join('\n');

    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    camera.position.z = 1;
    var uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTint: { value: new THREE.Color('#8fa68e') }
    };
    var material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: 'void main() { gl_Position = vec4(position, 1.0); }',
      fragmentShader: frag
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    host.appendChild(renderer.domElement);

    function size() {
      var w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height);
    }
    size();
    if (window.ResizeObserver) new ResizeObserver(size).observe(host);

    var visible = true;
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
      }, { threshold: 0 }).observe(host);
    }

    var clock = new THREE.Clock();
    var raf = 0;
    var running = false;
    function tick() {
      raf = requestAnimationFrame(tick);
      var dt = Math.min(clock.getDelta(), 0.05);
      if (visible) {
        uniforms.uTime.value += dt * 6.5;
        renderer.render(scene, camera);
      }
    }
    function start() { if (!running) { running = true; tick(); } }
    function stop() { running = false; cancelAnimationFrame(raf); }
    start();

    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) stop(); else start();
    });
  })();

  /* ---------- 8. Feedback: stars + submit + wall ---------- */
  (function () {
    var form = doc.getElementById('fbForm');
    if (!form) return;

    // Star rating
    var stars = Array.prototype.slice.call(doc.querySelectorAll('#fbStars .star'));
    var ratingInput = doc.getElementById('fbRating');
    var current = 0;
    function paint(n) {
      stars.forEach(function (s, i) { s.classList.toggle('is-on', i < n); });
    }
    stars.forEach(function (s) {
      s.addEventListener('click', function () {
        current = parseInt(s.getAttribute('data-v'), 10) || 0;
        ratingInput.value = String(current);
        paint(current);
      });
      s.addEventListener('mouseenter', function () { paint(parseInt(s.getAttribute('data-v'), 10)); });
    });
    doc.getElementById('fbStars').addEventListener('mouseleave', function () { paint(current); });

    // Public feedback feed (GitHub gist — free, CORS-enabled public read)
    var WALL_URL = 'https://gist.githubusercontent.com/binirfan-hash/c8a73b02b2372b9ea7631ebebe46857a/raw/feedback.json';
    // Submissions go to Nadeem's email via FormSubmit (free, no backend needed)
    var SUBMIT_URL = 'https://formsubmit.co/ajax/drukaye@gmail.com';

    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function starRow(n) {
      var out = '';
      for (var i = 0; i < 5; i++) out += i < n ? '★' : '☆';
      return out;
    }

    function renderWall(items) {
      var wall = doc.getElementById('fbWall');
      if (!wall || !items || !items.length) return;
      var html = '';
      items.slice().reverse().forEach(function (it) {
        var who = it.name || 'Anonymous';
        var role = it.role ? ' · ' + it.role : '';
        html += '<article class="fb-card">'
          + '<div class="fb-card__stars">' + starRow(parseInt(it.rating, 10) || 0) + '</div>'
          + '<p class="fb-card__text">' + esc(it.message) + '</p>'
          + '<p class="fb-card__meta">' + esc(who) + esc(role) + '</p>'
          + '</article>';
      });
      wall.innerHTML = html;
    }

    // Load existing feedback for the wall (cache-busted so new entries appear fast)
    fetch(WALL_URL + '?t=' + Date.now(), { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && Array.isArray(data.feedback)) {
          window.__fbCache = data.feedback;
          renderWall(data.feedback);
        }
      })
      .catch(function () {});

    // Submit
    var note = doc.getElementById('fbNote');
    function say(msg, isErr) {
      note.textContent = msg;
      note.classList.toggle('is-err', !!isErr);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = doc.getElementById('fbMsg').value.trim();
      if (!msg) { say('Add a few words of feedback first.', true); return; }
      if (!current) { say('Tap the stars to rate it.', true); return; }

      var entry = {
        name: doc.getElementById('fbName').value.trim(),
        role: doc.getElementById('fbRole').value.trim(),
        rating: current,
        message: msg,
        date: new Date().toISOString()
      };

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      say('Sending…', false);

      // Deliver to Nadeem's inbox; then optimistically add to the wall
      fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: 'Tool feedback: ' + current + '/5 stars',
          _template: 'box',
          _cc: 'nadeembinirfan@gmail.com',
          Rating: current + ' / 5',
          Name: entry.name || 'Anonymous',
          Role: entry.role || '-',
          Message: entry.message,
          Date: entry.date
        })
      }).then(function (r) {
        if (!r.ok) throw new Error('bad status ' + r.status);
        window.__fbCache = (window.__fbCache || []).concat([entry]);
        say('Thank you — received. It will appear on the wall shortly.', false);
        form.reset();
        current = 0; ratingInput.value = ''; paint(0);
        renderWall(window.__fbCache);
      }).catch(function () {
        // Fallback: open a pre-filled email so nothing is lost
        var body = 'Rating: ' + current + '/5\nName: ' + (entry.name || 'Anonymous')
          + '\nRole: ' + (entry.role || '-') + '\n\n' + entry.message;
        window.location.href = 'mailto:drukaye@gmail.com?subject='
          + encodeURIComponent('Tool feedback: ' + current + '/5') + '&body=' + encodeURIComponent(body);
        say('Opening your email app — send to finish.', false);
        btn.disabled = false;
      });
    });
  })();

  /* ---------- 9. Mobile nav drawer ---------- */
  (function () {
    var burger = doc.getElementById('navBurger');
    var drawer = doc.getElementById('mobileNav');
    if (!burger || !drawer) return;
    burger.addEventListener('click', function () {
      var open = drawer.classList.toggle('is-open');
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
    });
    drawer.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        drawer.classList.remove('is-open');
        burger.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  })();

})();