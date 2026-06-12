(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isCoarse = window.matchMedia('(pointer: coarse)').matches;
  var hasGsap = typeof gsap !== 'undefined';
  var hasST = typeof ScrollTrigger !== 'undefined';
  if (hasGsap && hasST) gsap.registerPlugin(ScrollTrigger);

  /* ════════════════════════════════════════
     3D SCENE — wireframe "digital twin" tower
     ════════════════════════════════════════ */
  var scrollProgress = 0;
  var mouseX = 0, mouseY = 0;

  function initScene() {
    if (typeof THREE === 'undefined') return null;
    var canvas = document.getElementById('scene');
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) {
      canvas.style.display = 'none';
      return null;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarse ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0d0f12, 9, 26);

    var camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(4.4, 3.4, 9);

    var group = new THREE.Group();
    scene.add(group);

    var teal = new THREE.Color(0x00c8a0);
    var blue = new THREE.Color(0x0078ff);
    var grayline = new THREE.Color(0x2a3340);

    /* — Tower: stacked floor outlines + columns + node points — */
    var floors = isCoarse ? 12 : 16;
    var W = 3.0, D = 2.1, H = 0.52;
    var linePos = [];
    var nodePos = [];
    var nodeCol = [];

    function pushLine(ax, ay, az, bx, by, bz) {
      linePos.push(ax, ay, az, bx, by, bz);
    }
    var corners = [[-W/2,-D/2],[W/2,-D/2],[W/2,D/2],[-W/2,D/2]];
    for (var f = 0; f <= floors; f++) {
      var y = f * H;
      // floor outline
      for (var c = 0; c < 4; c++) {
        var a = corners[c], b = corners[(c+1)%4];
        pushLine(a[0], y, a[1], b[0], y, b[1]);
      }
      // perimeter node points
      var segs = 5;
      for (var c2 = 0; c2 < 4; c2++) {
        var p = corners[c2], q = corners[(c2+1)%4];
        for (var s = 0; s < segs; s++) {
          var t = s / segs;
          nodePos.push(p[0]+(q[0]-p[0])*t, y, p[1]+(q[1]-p[1])*t);
          var col = Math.random() < 0.12 ? blue : (Math.random() < 0.5 ? teal : grayline);
          nodeCol.push(col.r, col.g, col.b);
        }
      }
    }
    // vertical columns at corners + midpoints
    var verts = corners.concat([[0,-D/2],[0,D/2],[-W/2,0],[W/2,0]]);
    verts.forEach(function (v) {
      pushLine(v[0], 0, v[1], v[0], floors * H, v[1]);
    });
    // roof plant + spire
    pushLine(0, floors*H, 0, 0, floors*H + 1.1, 0);

    var lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    var lineMat = new THREE.LineBasicMaterial({ color: 0x22d3b0, transparent: true, opacity: 0.22 });
    group.add(new THREE.LineSegments(lineGeo, lineMat));

    var nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.Float32BufferAttribute(nodePos, 3));
    nodeGeo.setAttribute('color', new THREE.Float32BufferAttribute(nodeCol, 3));
    var nodeMat = new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true });
    group.add(new THREE.Points(nodeGeo, nodeMat));

    /* — Sensor beacons: brighter pulsing points on the tower — */
    var beaconPos = [];
    for (var bI = 0; bI < 9; bI++) {
      var bf = 1 + Math.floor(Math.random() * (floors - 1));
      var side = corners[Math.floor(Math.random() * 4)];
      beaconPos.push(side[0] * (0.4 + Math.random() * 0.6), bf * H, side[1] * (0.4 + Math.random() * 0.6));
    }
    var beaconGeo = new THREE.BufferGeometry();
    beaconGeo.setAttribute('position', new THREE.Float32BufferAttribute(beaconPos, 3));
    var beaconMat = new THREE.PointsMaterial({ color: 0x00c8a0, size: 0.16, transparent: true, opacity: 0.95, sizeAttenuation: true });
    group.add(new THREE.Points(beaconGeo, beaconMat));

    /* — Ground grid — */
    var gridPos = [];
    var G = 14, GS = 1.0;
    for (var g = -G; g <= G; g++) {
      gridPos.push(-G*GS, 0, g*GS,  G*GS, 0, g*GS);
      gridPos.push(g*GS, 0, -G*GS,  g*GS, 0, G*GS);
    }
    var gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPos, 3));
    var gridMat = new THREE.LineBasicMaterial({ color: 0x1e2329, transparent: true, opacity: 0.55 });
    group.add(new THREE.LineSegments(gridGeo, gridMat));

    /* — Ambient particle field — */
    var dustCount = isCoarse ? 320 : 700;
    var dustPos = new Float32Array(dustCount * 3);
    for (var d = 0; d < dustCount; d++) {
      dustPos[d*3]   = (Math.random() - 0.5) * 26;
      dustPos[d*3+1] = Math.random() * 12;
      dustPos[d*3+2] = (Math.random() - 0.5) * 26;
    }
    var dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    var dustMat = new THREE.PointsMaterial({ color: 0x3a8a78, size: 0.035, transparent: true, opacity: 0.55, sizeAttenuation: true });
    var dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    group.position.y = 0;
    var lookAt = new THREE.Vector3(0, floors * H * 0.42, 0);

    var clock = new THREE.Clock();
    var running = true;

    function render() {
      if (!running) return;
      var t = clock.getElapsedTime();

      // continuous slow rotation + scroll-driven orbit
      group.rotation.y = t * 0.06 + scrollProgress * Math.PI * 1.5;

      // camera: rises and pulls in as you scroll, mouse parallax on top
      var camY = 3.4 + scrollProgress * 4.2;
      var camZ = 9 - scrollProgress * 2.2;
      var camX = 4.4 - scrollProgress * 1.4;
      camera.position.x += (camX + mouseX * 0.7 - camera.position.x) * 0.05;
      camera.position.y += (camY + mouseY * -0.5 - camera.position.y) * 0.05;
      camera.position.z += (camZ - camera.position.z) * 0.05;
      camera.lookAt(lookAt);

      // pulse beacons + drift dust
      beaconMat.size = 0.13 + Math.sin(t * 2.4) * 0.05;
      beaconMat.opacity = 0.65 + Math.sin(t * 2.4) * 0.3;
      dust.rotation.y = t * 0.012;

      renderer.render(scene, camera);
      if (!reducedMotion) requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

    document.addEventListener('visibilitychange', function () {
      running = document.visibilityState === 'visible';
      if (running && !reducedMotion) requestAnimationFrame(render);
    });

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (reducedMotion) renderer.render(scene, camera);
    });

    if (!isCoarse) {
      window.addEventListener('mousemove', function (e) {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }

    return renderer;
  }

  /* ════════════════════════════════════════
     SMOOTH SCROLL (Lenis) + ScrollTrigger sync
     ════════════════════════════════════════ */
  var lenis = null;
  if (!reducedMotion && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    if (hasGsap && hasST) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(time) { lenis.raf(time); requestAnimationFrame(raf); })(0);
    }
  }

  /* global scroll progress for the 3D camera */
  function trackProgress() {
    var docH = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = docH > 0 ? Math.min(1, Math.max(0, window.scrollY / docH)) : 0;
  }
  window.addEventListener('scroll', trackProgress, { passive: true });
  trackProgress();

  /* ════════════════════════════════════════
     ANCHOR NAVIGATION
     ════════════════════════════════════════ */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -70 });
      else target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  });

  /* ════════════════════════════════════════
     LOADER + INTRO TIMELINE
     ════════════════════════════════════════ */
  var loader = document.getElementById('loader');
  var pctEl = document.getElementById('loaderPct');
  var barEl = document.getElementById('loaderBar');

  function heroIntro() {
    if (!hasGsap) return;
    var tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.fromTo('.hero-name .line',
        { yPercent: 115 },
        { yPercent: 0, duration: 1.25, stagger: 0.14 }, 0)
      .fromTo('.hero-meta-row > *',
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, stagger: 0.1 }, 0.35)
      .fromTo('.hero-bottom > *',
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, stagger: 0.12 }, 0.55)
      .fromTo('.nav',
        { y: -30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8 }, 0.5);
  }

  function dismissLoader() {
    if (hasGsap) {
      gsap.to(loader, {
        opacity: 0, duration: 0.55, ease: 'power2.inOut',
        onComplete: function () { loader.style.display = 'none'; heroIntro(); }
      });
    } else {
      loader.style.display = 'none';
    }
  }

  if (reducedMotion || !hasGsap) {
    loader.style.display = 'none';
  } else {
    var counter = { v: 0 };
    gsap.set('.hero-name .line', { yPercent: 115 });
    gsap.set(['.hero-meta-row > *', '.hero-bottom > *'], { opacity: 0 });
    gsap.to(counter, {
      v: 100, duration: 1.35, ease: 'power2.inOut',
      onUpdate: function () {
        var v = Math.round(counter.v);
        pctEl.textContent = v + '%';
        barEl.style.width = v + '%';
      },
      onComplete: dismissLoader
    });
  }

  /* ════════════════════════════════════════
     SCROLL REVEALS
     ════════════════════════════════════════ */
  if (!reducedMotion && hasGsap && hasST) {
    gsap.utils.toArray('[data-reveal]').forEach(function (el) {
      if (el.closest('.hero')) return; // hero handled by intro
      gsap.fromTo(el,
        { y: 42, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 1.05, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        });
    });

    // big section titles drift sideways with scroll
    gsap.utils.toArray('[data-shift]').forEach(function (el) {
      gsap.fromTo(el, { x: 60 }, {
        x: -20, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1.2 }
      });
    });

    // photo parallax inside project frames
    gsap.utils.toArray('[data-parallax]').forEach(function (img) {
      gsap.fromTo(img, { yPercent: -6 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: img.closest('.project-visual'), start: 'top bottom', end: 'bottom top', scrub: 0.8 }
      });
    });

    // project visuals scale in
    gsap.utils.toArray('.project-visual').forEach(function (el) {
      gsap.fromTo(el, { scale: 0.94, opacity: 0.001 }, {
        scale: 1, opacity: 1, duration: 1.2, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
      });
    });

    // contact headline pop
    var contactLine = document.querySelector('.contact-big .line');
    if (contactLine) {
      gsap.fromTo(contactLine, { yPercent: 110 }, {
        yPercent: 0, duration: 1.2, ease: 'power4.out',
        scrollTrigger: { trigger: '.contact-big', start: 'top 90%', once: true }
      });
    }
  }

  /* ════════════════════════════════════════
     3D TILT on project cards (fine pointers)
     ════════════════════════════════════════ */
  if (!reducedMotion && !isCoarse && hasGsap) {
    document.querySelectorAll('[data-tilt]').forEach(function (card) {
      var qx = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3.out' });
      var qy = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3.out' });
      gsap.set(card, { transformPerspective: 900 });
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        qx(((e.clientX - r.left) / r.width - 0.5) * 7);
        qy(((e.clientY - r.top) / r.height - 0.5) * -7);
      });
      card.addEventListener('mouseleave', function () { qx(0); qy(0); });
    });
  }

  /* ════════════════════════════════════════
     MAGNETIC ELEMENTS
     ════════════════════════════════════════ */
  if (!reducedMotion && !isCoarse && hasGsap) {
    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      var qx = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
      var qy = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        qx((e.clientX - (r.left + r.width / 2)) * 0.25);
        qy((e.clientY - (r.top + r.height / 2)) * 0.25);
      });
      el.addEventListener('mouseleave', function () { qx(0); qy(0); });
    });
  }

  /* ════════════════════════════════════════
     CUSTOM CURSOR
     ════════════════════════════════════════ */
  if (!reducedMotion && !isCoarse && hasGsap) {
    var dot = document.getElementById('cursorDot');
    var ring = document.getElementById('cursorRing');
    var dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power2.out' });
    var dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power2.out' });
    var rx = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power2.out' });
    var ry = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power2.out' });
    gsap.set([dot, ring], { xPercent: -50, yPercent: -50 });
    window.addEventListener('mousemove', function (e) {
      dx(e.clientX); dy(e.clientY);
      rx(e.clientX); ry(e.clientY);
    }, { passive: true });
    document.querySelectorAll('a, .work-card, .chip').forEach(function (el) {
      el.addEventListener('mouseenter', function () { ring.classList.add('is-hover'); });
      el.addEventListener('mouseleave', function () { ring.classList.remove('is-hover'); });
    });
  }

  /* ════════════════════════════════════════
     SKILL PIPS
     ════════════════════════════════════════ */
  document.querySelectorAll('.pips').forEach(function (bar) {
    var level = parseInt(bar.getAttribute('data-level'), 10) || 0;
    for (var i = 0; i < 5; i++) {
      var pip = document.createElement('i');
      if (i < level) pip.className = 'on';
      bar.appendChild(pip);
    }
  });

  /* ════════════════════════════════════════
     NAV STATE
     ════════════════════════════════════════ */
  var nav = document.getElementById('nav');
  function onScroll() {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var sections = ['work', 'experience', 'capabilities', 'contact']
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);
  var navLinks = document.querySelectorAll('[data-nav]');
  if ('IntersectionObserver' in window) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(function (s) { sectionObserver.observe(s); });
  }

  /* ════════════════════════════════════════
     BOOT
     ════════════════════════════════════════ */
  initScene();

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
