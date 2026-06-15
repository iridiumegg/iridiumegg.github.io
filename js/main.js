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
        { yPercent: 0, duration: 1.25 }, 0)
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
     TALENT DNA — CliftonStrengths 34 helix
     ════════════════════════════════════════ */
  function initStrengths() {
    var canvas = document.getElementById('dnaHelix');
    var metersEl = document.getElementById('dnaMeters');
    var readoutEl = document.getElementById('dnaReadout');
    if (!canvas || !metersEl || !readoutEl) return;

    var DOMAINS = {
      EX: { name: 'Executing',             color: '#00c8a0', blurb: 'Makes things happen' },
      ST: { name: 'Strategic Thinking',    color: '#0078ff', blurb: 'Sharpens the decision' },
      IN: { name: 'Influencing',           color: '#f5a623', blurb: 'Rallies others' },
      RB: { name: 'Relationship Building',  color: '#9b6dff', blurb: 'Holds the team together' }
    };

    // rank order = array order (index 0 = #1 strongest)
    var THEMES = [
      { n: 'Strategic',        d: 'ST', b: 'Spots patterns and obstacles others miss, maps several routes forward, then commits to the most effective one.' },
      { n: 'Achiever',         d: 'EX', b: 'Relentless drive and stamina — needs measurable progress every day and takes deep satisfaction in finishing.' },
      { n: 'Arranger',         d: 'EX', b: 'Aligns people, schedules, and resources on the fly; thrives juggling many moving parts toward the best result.' },
      { n: 'Ideation',         d: 'ST', b: 'Fascinated by ideas and the connections between them — a creative engine that reframes problems from new angles.' },
      { n: 'Belief',           d: 'EX', b: 'Anchored by unchanging core values; brings honesty, conviction, and a strong sense of purpose to the work.' },
      { n: 'Responsibility',   d: 'EX', b: 'Takes psychological ownership of every commitment — dependable, and a person of his word.' },
      { n: 'Analytical',       d: 'ST', b: 'Searches for causes and evidence, pressure-testing ideas until the logic holds up and reality is clear.' },
      { n: 'Developer',        d: 'RB', b: 'Sees raw potential in people and invests in it, noticing and encouraging every small sign of progress.' },
      { n: 'Learner',          d: 'ST', b: 'Driven by the process of learning itself — quick to absorb new technology and stay on the cutting edge.' },
      { n: 'Futuristic',       d: 'ST', b: 'Vividly imagines what could be and uses that vision to energize and pull others toward a better tomorrow.' },
      { n: 'Focus',            d: 'EX', b: 'Sets a direction and follows through, correcting course as needed to stay on track.' },
      { n: 'Significance',     d: 'IN', b: 'Wants the work to matter and make a visible, lasting impact.' },
      { n: 'Woo',              d: 'IN', b: 'Enjoys meeting new people and winning them over.' },
      { n: 'Positivity',       d: 'RB', b: 'Brings contagious energy and optimism that lifts a team.' },
      { n: 'Discipline',       d: 'EX', b: 'Creates order and predictability through routine and structure.' },
      { n: 'Communication',    d: 'IN', b: 'Turns thoughts into clear words — a natural explainer and presenter.' },
      { n: 'Maximizer',        d: 'IN', b: 'Pushes good toward great; never settles for "good enough".' },
      { n: 'Consistency',      d: 'EX', b: 'Treats people fairly with clear, repeatable rules everyone can follow.' },
      { n: 'Relator',          d: 'RB', b: 'Does his best work alongside people he knows and trusts.' },
      { n: 'Includer',         d: 'RB', b: 'Notices who is left out and makes the effort to bring them in.' },
      { n: 'Restorative',      d: 'EX', b: 'Drawn to broken things — figures out what is wrong and resolves it.' },
      { n: 'Self-Assurance',   d: 'IN', b: 'Trusts his own judgment and inner compass under pressure.' },
      { n: 'Empathy',          d: 'RB', b: 'Senses what others are feeling, often before they say it.' },
      { n: 'Individualization', d: 'RB', b: 'Reads each person’s unique qualities and fits them together productively.' },
      { n: 'Input',            d: 'ST', b: 'Collects information, tools, and resources worth keeping for later.' },
      { n: 'Command',          d: 'IN', b: 'Takes control and makes the call when a situation needs one.' },
      { n: 'Intellection',     d: 'ST', b: 'Enjoys deep, introspective thinking and intellectual discussion.' },
      { n: 'Competition',      d: 'IN', b: 'Measures progress against others and plays to win.' },
      { n: 'Context',          d: 'ST', b: 'Understands the present by studying how it came to be.' },
      { n: 'Harmony',          d: 'RB', b: 'Looks for consensus and practical common ground over friction.' },
      { n: 'Deliberative',     d: 'EX', b: 'Weighs risk carefully and moves forward with serious care.' },
      { n: 'Connectedness',    d: 'RB', b: 'Sees the links between things — few events are coincidences.' },
      { n: 'Activator',        d: 'IN', b: 'Turns talk into action and wants to start now, not later.' },
      { n: 'Adaptability',     d: 'RB', b: 'Goes with the flow and takes things as they come, one day at a time.' }
    ];
    var N = THEMES.length;

    /* — domain meters (weighted by rank, doubling as the legend) — */
    var scores = { EX: 0, ST: 0, IN: 0, RB: 0 };
    var counts = { EX: 0, ST: 0, IN: 0, RB: 0 };
    var totalW = 0;
    THEMES.forEach(function (t, i) {
      var w = N - i;            // #1 weighs 34 … #34 weighs 1
      scores[t.d] += w;
      counts[t.d] += 1;
      totalW += w;
    });
    var order = Object.keys(DOMAINS).sort(function (a, b) { return scores[b] - scores[a]; });

    order.forEach(function (k) {
      var dom = DOMAINS[k];
      var pct = Math.round(scores[k] / totalW * 100);
      var row = document.createElement('div');
      row.className = 'dna-meter';
      row.setAttribute('data-domain', k);
      row.innerHTML =
        '<div class="dna-meter-top">' +
          '<span class="dna-meter-name"><i style="background:' + dom.color + '"></i>' + dom.name + '</span>' +
          '<span class="dna-meter-pct">' + pct + '%</span>' +
        '</div>' +
        '<div class="dna-meter-track"><span class="dna-meter-fill" data-pct="' + pct + '" style="background:' + dom.color + '"></span></div>' +
        '<p class="dna-meter-desc">' + dom.blurb + ' · ' + counts[k] + ' themes</p>';
      metersEl.appendChild(row);
    });
    var meterFills = metersEl.querySelectorAll('.dna-meter-fill');

    function fillMeters(animate) {
      meterFills.forEach(function (f) {
        var pct = f.getAttribute('data-pct') + '%';
        if (animate && hasGsap) gsap.fromTo(f, { width: '0%' }, { width: pct, duration: 1.1, ease: 'power3.out' });
        else f.style.width = pct;
      });
    }
    if (!reducedMotion && hasGsap && hasST) {
      ScrollTrigger.create({ trigger: metersEl, start: 'top 85%', once: true, onEnter: function () { fillMeters(true); } });
    } else {
      fillMeters(false);
    }

    /* — domain → strand highlight on meter hover — */
    var activeDomain = null;
    metersEl.querySelectorAll('.dna-meter').forEach(function (row) {
      var k = row.getAttribute('data-domain');
      row.addEventListener('mouseenter', function () {
        activeDomain = k;
        metersEl.classList.add('dimmed');
        row.classList.add('active');
        if (!running) draw(lastT);
      });
      row.addEventListener('mouseleave', function () {
        activeDomain = null;
        metersEl.classList.remove('dimmed');
        row.classList.remove('active');
        if (!running) draw(lastT);
      });
    });

    /* — readout card — */
    var current = -1;
    function renderReadout(i) {
      if (i === current) return;
      current = i;
      var t = THEMES[i], dom = DOMAINS[t.d];
      readoutEl.innerHTML =
        '<div class="dna-rank" style="color:' + dom.color + '"><span class="dna-rk-hash">#</span>' + (i + 1) + '</div>' +
        '<div class="dna-rd-body">' +
          '<div class="dna-rd-head">' +
            '<span class="dna-rd-name">' + t.n + '</span>' +
            '<span class="dna-pill" style="color:' + dom.color + ';border-color:' + dom.color + '">' + dom.name + '</span>' +
          '</div>' +
          '<p class="dna-rd-desc">' + t.b + '</p>' +
        '</div>';
      if (hasGsap && !reducedMotion) gsap.fromTo(readoutEl.querySelector('.dna-rd-body'), { opacity: .25, x: 8 }, { opacity: 1, x: 0, duration: .35, ease: 'power2.out' });
    }

    /* — canvas double helix — */
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;
    var nodes = [];          // front (interactive) node screen positions
    var selIndex = 0;        // locked selection
    var hoverIndex = null;
    var lastT = 0;
    var running = false;

    function resize() {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!running) draw(lastT);
    }

    function hexA(hex, a) {
      var n = parseInt(hex.slice(1), 16);
      return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
    }

    function draw(time) {
      lastT = time;
      ctx.clearRect(0, 0, W, H);
      var top = 54, bot = H - 40;
      var cx = W * 0.5;
      var amp = Math.min(W * 0.30, 145);
      var turns = 2.35;
      nodes.length = 0;

      var pts = [];
      for (var i = 0; i < N; i++) {
        var tt = i / (N - 1);
        var y = top + tt * (bot - top);
        var ang = tt * turns * Math.PI * 2 + time;
        var fz = Math.sin(ang);                 // front depth -1..1
        var fx = cx + amp * Math.cos(ang);
        var bx = cx - amp * Math.cos(ang);
        var bz = -fz;
        pts.push({ i: i, y: y, fx: fx, bx: bx, fz: fz, bz: bz, d: THEMES[i].d });
      }

      // backbones (continuous strands)
      function strand(key, zkey, base) {
        ctx.beginPath();
        for (var j = 0; j < pts.length; j++) {
          var p = pts[j];
          if (j === 0) ctx.moveTo(p[key], p.y); else ctx.lineTo(p[key], p.y);
        }
        ctx.strokeStyle = base;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      strand('bx', 'bz', 'rgba(120,140,160,.16)');
      strand('fx', 'fz', 'rgba(150,170,190,.28)');

      // rungs + back nodes
      for (var r = 0; r < pts.length; r++) {
        var p2 = pts[r];
        var col = DOMAINS[p2.d].color;
        var dim = activeDomain && activeDomain !== p2.d;
        var depth = (p2.fz + 1) / 2;            // 0..1
        var ra = (0.10 + 0.18 * depth) * (dim ? 0.22 : 1);
        ctx.beginPath();
        ctx.moveTo(p2.fx, p2.y);
        ctx.lineTo(p2.bx, p2.y);
        ctx.strokeStyle = hexA(col, ra);
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // back node (small, dim)
        var bdepth = (p2.bz + 1) / 2;
        ctx.beginPath();
        ctx.arc(p2.bx, p2.y, 1.6 + 1.2 * bdepth, 0, Math.PI * 2);
        ctx.fillStyle = hexA(col, (0.25 + 0.3 * bdepth) * (dim ? 0.2 : 1));
        ctx.fill();
      }

      // front nodes (the data points) — draw last so they sit on top
      for (var f = 0; f < pts.length; f++) {
        var p3 = pts[f];
        var dom = DOMAINS[p3.d];
        var top10 = p3.i < 10;
        var dpt = (p3.fz + 1) / 2;
        var dimmed = activeDomain && activeDomain !== p3.d;
        var rad = (top10 ? 5.4 : 3.2) * (0.72 + 0.28 * dpt);
        var isCur = (hoverIndex === p3.i) || (hoverIndex === null && selIndex === p3.i);
        var alpha = (0.4 + 0.6 * dpt) * (dimmed ? 0.18 : 1);

        nodes.push({ i: p3.i, x: p3.fx, y: p3.y, r: rad });

        if (top10 && !dimmed) { ctx.shadowColor = dom.color; ctx.shadowBlur = 12 * dpt + 4; }
        else { ctx.shadowBlur = 0; }

        ctx.beginPath();
        ctx.arc(p3.fx, p3.y, isCur ? rad + 2.4 : rad, 0, Math.PI * 2);
        ctx.fillStyle = hexA(dom.color, isCur ? 1 : alpha);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (isCur) {
          ctx.beginPath();
          ctx.arc(p3.fx, p3.y, rad + 7, 0, Math.PI * 2);
          ctx.strokeStyle = hexA(dom.color, 0.9);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    var clock = (typeof THREE !== 'undefined') ? new THREE.Clock() : null;
    var t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    function loop() {
      if (!running) return;
      var time = clock ? clock.getElapsedTime() : ((performance.now() - t0) / 1000);
      draw(time * 0.32);
      requestAnimationFrame(loop);
    }
    function start() {
      if (running || reducedMotion) return;
      running = true;
      if (clock) clock.start();
      requestAnimationFrame(loop);
    }
    function stop() { running = false; }

    /* — pointer interaction — */
    var hint = document.getElementById('dnaHint');
    function pick(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      var x = clientX - rect.left, y = clientY - rect.top;
      var best = null, bestD = 1e9;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var dx = n.x - x, dy = n.y - y, dd = dx * dx + dy * dy;
        var hit = Math.max(n.r + 7, 13);
        if (dd < hit * hit && dd < bestD) { bestD = dd; best = n.i; }
      }
      return best;
    }
    if (!isCoarse) {
      canvas.addEventListener('mousemove', function (e) {
        var hit = pick(e.clientX, e.clientY);
        hoverIndex = hit;
        canvas.style.cursor = hit !== null ? 'pointer' : 'default';
        if (hit !== null) { renderReadout(hit); if (hint) hint.classList.add('gone'); }
        else renderReadout(selIndex);
        if (!running) draw(lastT);
      });
      canvas.addEventListener('mouseleave', function () {
        hoverIndex = null;
        renderReadout(selIndex);
        if (!running) draw(lastT);
      });
      canvas.addEventListener('click', function (e) {
        var hit = pick(e.clientX, e.clientY);
        if (hit !== null) { selIndex = hit; renderReadout(hit); }
      });
    } else {
      canvas.addEventListener('touchstart', function (e) {
        var tch = e.touches[0];
        if (!tch) return;
        var hit = pick(tch.clientX, tch.clientY);
        if (hit !== null) {
          selIndex = hit; hoverIndex = null; renderReadout(hit);
          if (hint) hint.classList.add('gone');
          if (!running) draw(lastT);
        }
      }, { passive: true });
    }

    window.addEventListener('resize', resize);

    // run only while the section is on screen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { en.isIntersecting ? start() : stop(); });
      }, { threshold: 0.08 }).observe(canvas);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') stop();
      else start();
    });

    // boot
    resize();
    renderReadout(0);
    if (reducedMotion) draw(0.6); else start();
  }

  /* ════════════════════════════════════════
     NAV STATE
     ════════════════════════════════════════ */
  var nav = document.getElementById('nav');
  function onScroll() {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var sections = ['work', 'experience', 'capabilities', 'dna', 'contact']
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
  initStrengths();

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
