/* ANKA by SAGAR — interactive 3D Platonic solid explorer (three.js) */
(function () {
  'use strict';
  var canvas = document.getElementById('scene');
  if (!canvas) return;
  var wrap = canvas.closest('.scene-wrap') || canvas.parentElement;

  function boot() {
    if (!window.THREE) { wrap.classList.add('no-webgl'); return; }
    var T = window.THREE;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) { wrap.classList.add('no-webgl'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 7.2);
    var rig = new T.Group(); scene.add(rig);     // pointer + scroll parallax
    var obj = new T.Group(); rig.add(obj);       // drag rotation + shape swap

    /* ---------- colours follow the CSS theme ---------- */
    var cols = {};
    function readColors() {
      var cs = getComputedStyle(document.documentElement);
      ['--c1', '--c2', '--c3'].forEach(function (n, i) {
        cols['c' + (i + 1)] = new T.Color((cs.getPropertyValue(n) || '#8b6cff').trim());
      });
      cols.light = document.documentElement.getAttribute('data-theme') === 'light';
    }
    readColors();

    function dotTexture() {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, '#fff'); grd.addColorStop(.45, '#fff'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      return new T.CanvasTexture(c);
    }
    var dot = dotTexture();

    var faceMat = new T.MeshPhongMaterial({ color: cols.c1, transparent: true, opacity: .2, flatShading: true, shininess: 90, side: T.DoubleSide, depthWrite: false });
    var lineMat = new T.LineBasicMaterial({ color: cols.c2 });
    var innerMat = new T.LineBasicMaterial({ color: cols.c1, transparent: true, opacity: .7 });
    var pointMat = new T.PointsMaterial({ size: .2, map: dot, transparent: true, depthWrite: false, color: cols.c3, alphaTest: .02 });
    var starMat = new T.PointsMaterial({ size: .045, map: dot, transparent: true, depthWrite: false, color: cols.c2, opacity: .8, alphaTest: .02 });

    function applyColors() {
      faceMat.color.copy(cols.c1); faceMat.opacity = cols.light ? .16 : .2;
      lineMat.color.copy(cols.c2); innerMat.color.copy(cols.c1);
      pointMat.color.copy(cols.c3); starMat.color.copy(cols.c2);
      key.color.copy(cols.c2); fill.color.copy(cols.c1);
    }

    var amb = new T.AmbientLight(0xffffff, .55); scene.add(amb);
    var key = new T.PointLight(0x22d3ee, 1.6, 0); key.position.set(4, 3, 5); scene.add(key);
    var fill = new T.PointLight(0x8b6cff, 1.4, 0); fill.position.set(-4, -2, 3); scene.add(fill);
    var hover = new T.PointLight(0xffffff, .9, 14); hover.position.set(0, 0, 4); scene.add(hover);

    /* ---------- starfield ---------- */
    var starGeo = new T.BufferGeometry(), sp = new Float32Array(420 * 3);
    for (var i = 0; i < 420; i++) {
      var r = 6 + Math.random() * 9, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      sp[i * 3] = r * Math.sin(ph) * Math.cos(th); sp[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); sp[i * 3 + 2] = r * Math.cos(ph) - 4;
    }
    starGeo.setAttribute('position', new T.BufferAttribute(sp, 3));
    var stars = new T.Points(starGeo, starMat); scene.add(stars);

    /* ---------- the five Platonic solids ---------- */
    var SHAPES = [
      { name: 'Tetrahedron',  short: 'Tetra',  V: 4,  E: 6,  F: 4,  make: function () { return new T.TetrahedronGeometry(1.95, 0); }, dual: 0 },
      { name: 'Cube',         short: 'Cube',   V: 8,  E: 12, F: 6,  make: function () { return new T.BoxGeometry(2.25, 2.25, 2.25); }, dual: 2 },
      { name: 'Octahedron',   short: 'Octa',   V: 6,  E: 12, F: 8,  make: function () { return new T.OctahedronGeometry(1.95, 0); }, dual: 1 },
      { name: 'Dodecahedron', short: 'Dodeca', V: 20, E: 30, F: 12, make: function () { return new T.DodecahedronGeometry(1.75, 0); }, dual: 4 },
      { name: 'Icosahedron',  short: 'Icosa',  V: 12, E: 30, F: 20, make: function () { return new T.IcosahedronGeometry(1.85, 0); }, dual: 3 }
    ];
    var cur = 4;

    function uniqueVerts(geo) {
      var p = geo.attributes.position, seen = {}, out = [];
      for (var i = 0; i < p.count; i++) {
        var k = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);
        if (!seen[k]) { seen[k] = 1; out.push(p.getX(i), p.getY(i), p.getZ(i)); }
      }
      return new T.BufferAttribute(new Float32Array(out), 3);
    }
    function clearObj() {
      while (obj.children.length) {
        var c = obj.children.pop(); obj.remove(c);
        if (c.geometry) c.geometry.dispose();
      }
    }
    function build(i) {
      clearObj();
      var s = SHAPES[i], g = s.make();
      obj.add(new T.Mesh(g, faceMat));
      obj.add(new T.LineSegments(new T.EdgesGeometry(g), lineMat));
      var pg = new T.BufferGeometry(); pg.setAttribute('position', uniqueVerts(g));
      obj.add(new T.Points(pg, pointMat));
      // inner dual solid, drawn as wire only
      var ig = SHAPES[s.dual].make(), inner = new T.LineSegments(new T.EdgesGeometry(ig), innerMat);
      inner.scale.setScalar(.48); inner.rotation.set(.4, .6, 0); inner.userData.inner = true;
      obj.add(inner);
    }
    build(cur);

    /* ---------- UI: chips + Euler readout ---------- */
    var ui = document.getElementById('shape-ui'), eu = document.getElementById('euler'), nm = document.getElementById('shape-name');
    var chipEls = [];
    function updateUI() {
      var s = SHAPES[cur];
      if (nm) nm.textContent = s.name;
      if (eu) eu.innerHTML = 'Euler: <b>V − E + F</b> = ' + s.V + ' − ' + s.E + ' + ' + s.F + ' <span class="eq">= 2</span>';
      chipEls.forEach(function (c, i) { c.setAttribute('aria-pressed', i === cur ? 'true' : 'false'); });
    }
    if (ui) {
      SHAPES.forEach(function (s, i) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.textContent = s.short;
        b.setAttribute('aria-label', 'Show ' + s.name); b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () { go(i); });
        ui.appendChild(b); chipEls.push(b);
      });
    }
    updateUI();

    /* ---------- shape swap animation ---------- */
    var scale = 1, phase = 'idle', pending = cur;
    function go(i) { if (i === cur && phase === 'idle') return; pending = (i + SHAPES.length) % SHAPES.length; phase = 'out'; }
    function easeOutBack(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

    /* ---------- interaction ---------- */
    var pointer = { x: 0, y: 0 }, drag = false, last = { x: 0, y: 0 }, vel = { x: 0, y: 0 }, moved = 0;
    obj.rotation.set(.35, .5, 0);
    canvas.addEventListener('pointerdown', function (e) {
      drag = true; moved = 0; last.x = e.clientX; last.y = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      wrap.classList.add('grabbing');
    });
    function endDrag(e) { if (!drag) return; drag = false; wrap.classList.remove('grabbing'); try { canvas.releasePointerCapture(e.pointerId); } catch (_) {} }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    window.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      if (drag) {
        var dx = e.clientX - last.x, dy = e.clientY - last.y;
        last.x = e.clientX; last.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
        vel.y = dx * .006; vel.x = dy * .006;
        obj.rotation.y += vel.y; obj.rotation.x += vel.x;
      }
    });
    canvas.addEventListener('dblclick', function () { go(cur + 1); });
    canvas.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(cur + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
    });

    /* ---------- sizing / visibility ---------- */
    function resize() {
      var w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap); else window.addEventListener('resize', resize);
    resize();

    var running = false, visible = true, clock = new T.Clock(), t = 0;
    function frame() {
      if (!running) return;
      requestAnimationFrame(frame);
      var dt = Math.min(clock.getDelta(), .05); t += dt;

      if (phase === 'out') { scale -= dt * 5; if (scale <= 0) { scale = 0; cur = pending; build(cur); updateUI(); phase = 'in'; } }
      else if (phase === 'in') { scale += dt * 3.2; if (scale >= 1) { scale = 1; phase = 'idle'; } }
      obj.scale.setScalar(phase === 'in' ? Math.max(.0001, easeOutBack(scale)) : Math.max(.0001, scale));

      if (!drag) {
        obj.rotation.y += vel.y + (reduce ? 0 : .0045);
        obj.rotation.x += vel.x + (reduce ? 0 : .0016);
        vel.x *= .94; vel.y *= .94;
      }
      obj.children.forEach(function (c) { if (c.userData.inner) { c.rotation.y -= dt * .9; c.rotation.z += dt * .4; } });
      rig.rotation.y += (pointer.x * .35 - rig.rotation.y) * .05;
      rig.rotation.x += (-pointer.y * .25 - rig.rotation.x) * .05;
      var sy = Math.min(window.scrollY, 900);
      rig.position.y += (sy * .0016 - rig.position.y) * .08;
      pointMat.size = .2 + Math.sin(t * 2.4) * .025;
      stars.rotation.y += dt * .015; stars.rotation.x += dt * .005;
      hover.position.x += (pointer.x * 5 - hover.position.x) * .08;
      hover.position.y += (pointer.y * 4 - hover.position.y) * .08;
      renderer.render(scene, camera);
    }
    function start() { if (!running && visible && !document.hidden) { running = true; clock.getDelta(); frame(); } }
    function stop() { running = false; }
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; visible ? start() : stop(); }, { threshold: 0 }).observe(wrap);
    }
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); stop(); wrap.classList.add('no-webgl'); });
    document.addEventListener('anka:theme', function () { readColors(); applyColors(); });
    applyColors(); start();
  }

  if (window.THREE) boot();
  else {
    var s = document.createElement('script');       // CDN fallback if the local copy is missing
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = boot; s.onerror = function () { wrap.classList.add('no-webgl'); };
    document.head.appendChild(s);
  }
})();
