/* ANKA by SAGAR — site behaviour: theme, nav, reveal, cursor, palette, calculator, math challenge, contact form */
(function () {
  'use strict';
  var C = window.ANKA || { prices: { levels: {}, discounts: {}, weeksPerMonth: 4 } };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hoverOK = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var rs = function (n) { return 'Rs. ' + Math.round(n).toLocaleString('en-IN'); };

  /* ---------- contact details from config.js ---------- */
  var wa = function (text) { return 'https://wa.me/' + (C.whatsapp || '') + (text ? '?text=' + encodeURIComponent(text) : ''); };
  $$('[data-wa]').forEach(function (a) { a.href = wa(a.getAttribute('data-text') || 'Hello ANKA, I want to know about online classes.'); a.target = '_blank'; a.rel = 'noopener'; });
  $$('[data-phone]').forEach(function (a) { if (C.phone) { a.href = 'tel:' + C.phone.replace(/\s/g, ''); var s = $('span', a) || a; if (s.hasAttribute('data-fill') || s === a) s.textContent = C.phone; } });
  $$('[data-email]').forEach(function (a) { if (C.email) { a.href = 'mailto:' + C.email; var s = $('span', a) || a; if (s.hasAttribute('data-fill') || s === a) s.textContent = C.email; } });
  $$('[data-fill="phone"]').forEach(function (n) { n.textContent = C.phone; });
  $$('[data-fill="email"]').forEach(function (n) { n.textContent = C.email; });
  var levels = (C.prices && C.prices.levels) || {};
  var minGroup = Math.min.apply(null, Object.keys(levels).map(function (k) { return levels[k].group; }));
  $$('[data-price-from]').forEach(function (n) { if (isFinite(minGroup)) n.textContent = minGroup.toLocaleString('en-IN'); });

  /* ---------- theme ---------- */
  function setTheme(t, persist) {
    root.setAttribute('data-theme', t);
    if (persist) store.set('anka-theme', t);
    $$('.theme-toggle').forEach(function (b) { b.setAttribute('aria-pressed', t === 'light'); });
    document.dispatchEvent(new CustomEvent('anka:theme', { detail: t }));
  }
  function toggleTheme() { setTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light', true); }
  $$('.theme-toggle').forEach(function (b) { b.addEventListener('click', toggleTheme); });
  setTheme(root.getAttribute('data-theme') || 'dark', false);

  /* ---------- header: mobile menu, hide on scroll, progress bar ---------- */
  var header = $('.site-header'), menuBtn = $('#menuBtn'), bar = $('.progress');
  function closeMenu() { header.classList.remove('menu-open'); document.body.style.overflow = ''; menuBtn.setAttribute('aria-expanded', 'false'); }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      var open = header.classList.toggle('menu-open');
      menuBtn.setAttribute('aria-expanded', open); document.body.style.overflow = open ? 'hidden' : '';
    });
    $$('.nav-links a').forEach(function (a) { a.addEventListener('click', closeMenu); });
  }
  var lastY = 0, ticking = false;
  function onScroll() {
    var y = window.scrollY, max = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    if (header && !header.classList.contains('menu-open')) header.classList.toggle('hide', y > lastY && y > 240);
    lastY = y; ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ---------- scroll reveal ---------- */
  var rev = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    rev.forEach(function (el, i) { el.style.setProperty('--d', ((i % 4) * .08) + 's'); io.observe(el); });
  } else rev.forEach(function (el) { el.classList.add('in'); });

  /* ---------- card spotlight + magnetic buttons ---------- */
  if (hoverOK) {
    $$('.card').forEach(function (c) {
      c.addEventListener('pointermove', function (e) { var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
    });
    if (!reduce) $$('[data-magnetic]').forEach(function (b) {
      b.addEventListener('pointermove', function (e) { var r = b.getBoundingClientRect(); b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * .22) + 'px,' + ((e.clientY - r.top - r.height / 2) * .3) + 'px)'; });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
    /* custom cursor ring */
    var cur = document.createElement('div'); cur.className = 'cursor'; cur.setAttribute('aria-hidden', 'true'); document.body.appendChild(cur);
    var cx = 0, cy = 0, tx = 0, ty = 0;
    window.addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; cur.classList.add('on'); });
    document.addEventListener('pointerleave', function () { cur.classList.remove('on'); });
    document.addEventListener('pointerover', function (e) { cur.classList.toggle('big', !!e.target.closest('a,button,.chip,summary,.chip-check,.scene-wrap')); });
    (function loop() { cx += (tx - cx) * .18; cy += (ty - cy) * .18; cur.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)'; requestAnimationFrame(loop); })();
  }

  /* ---------- page transitions ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    var h = a.getAttribute('href'); if (!h || h.charAt(0) === '#' || a.target === '_blank' || /^(mailto:|tel:|https?:)/.test(h) || a.hasAttribute('download')) return;
    if (reduce) return;
    e.preventDefault(); document.body.classList.add('leaving'); setTimeout(function () { location.href = a.href; }, 200);
  });
  window.addEventListener('pageshow', function () { document.body.classList.remove('leaving'); });

  /* ---------- rotating hero word ---------- */
  var rotor = $('#rotor');
  if (rotor && !reduce) {
    var words = ['see', 'touch', 'rotate', 'explore'], wi = 0;
    setInterval(function () { rotor.classList.add('swap'); setTimeout(function () { wi = (wi + 1) % words.length; rotor.textContent = words[wi]; rotor.classList.remove('swap'); }, 300); }, 2600);
  }

  /* ---------- demo equation card (home) ---------- */
  var eqd = $('#eqDemo');
  if (eqd && !reduce) {
    var qs = ['7 × 8', '144 ÷ 12', '15% of 80', '13²', '48 + 79', '9 × 11', '√81', '250 − 87'];
    var qi = 0; setInterval(function () { eqd.classList.add('swap'); setTimeout(function () { qi = (qi + 1) % qs.length; eqd.textContent = qs[qi]; eqd.classList.remove('swap'); }, 300); }, 2200);
  }

  /* ---------- course filter ---------- */
  var fchips = $$('[data-filter]');
  if (fchips.length) fchips.forEach(function (c) {
    c.addEventListener('click', function () {
      fchips.forEach(function (x) { x.setAttribute('aria-pressed', x === c); });
      var f = c.getAttribute('data-filter');
      $$('.course').forEach(function (card) { card.hidden = !(f === 'all' || card.getAttribute('data-levels').split(' ').indexOf(f) > -1); });
    });
  });

  /* ---------- command palette (Ctrl/Cmd + K) ---------- */
  var items = [
    { t: 'Home', h: 'index.html', k: 'page' }, { t: 'Courses', h: 'courses.html', k: 'page' }, { t: 'Fees & calculator', h: 'fees.html', k: 'page' },
    { t: '60-second Math Challenge', h: 'challenge.html', k: 'page' }, { t: 'About ANKA', h: 'about.html', k: 'page' }, { t: 'Contact / Book a free demo', h: 'contact.html', k: 'page' },
    { t: 'Chat on WhatsApp', a: function () { window.open(wa('Hello ANKA, I want to know about online classes.'), '_blank'); }, k: 'action' },
    { t: 'Toggle light / dark theme', a: toggleTheme, k: 'action' }
  ];
  var pal, pin, plist, psel = 0, shown = [];
  function buildPalette() {
    pal = document.createElement('div'); pal.className = 'palette'; pal.setAttribute('role', 'dialog'); pal.setAttribute('aria-label', 'Quick menu');
    pal.innerHTML = '<div class="pal-box"><input type="text" placeholder="Jump to a page or action…" aria-label="Search"><div class="pal-list" role="listbox"></div></div>';
    document.body.appendChild(pal); pin = $('input', pal); plist = $('.pal-list', pal);
    pal.addEventListener('click', function (e) { if (e.target === pal) closePal(); });
    pin.addEventListener('input', render);
    pin.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { psel = Math.min(psel + 1, shown.length - 1); e.preventDefault(); mark(); }
      else if (e.key === 'ArrowUp') { psel = Math.max(psel - 1, 0); e.preventDefault(); mark(); }
      else if (e.key === 'Enter' && shown[psel]) choose(shown[psel]);
    });
  }
  function render() {
    var q = pin.value.trim().toLowerCase(); shown = items.filter(function (i) { return i.t.toLowerCase().indexOf(q) > -1; }); psel = 0;
    plist.innerHTML = shown.length ? '' : '<p class="pal-empty">Nothing found.</p>';
    shown.forEach(function (it, i) { var b = document.createElement('button'); b.type = 'button'; b.innerHTML = '<span>' + it.t + '</span><small>' + (it.k === 'page' ? 'Go to page' : 'Action') + '</small>'; b.addEventListener('click', function () { choose(it); }); b.addEventListener('pointermove', function () { psel = i; mark(); }); plist.appendChild(b); });
    mark();
  }
  function mark() { $$('button', plist).forEach(function (b, i) { b.classList.toggle('sel', i === psel); }); }
  function choose(it) { closePal(); if (it.a) it.a(); else location.href = it.h; }
  function openPal() { if (!pal) buildPalette(); pal.classList.add('open'); pin.value = ''; render(); pin.focus(); }
  function closePal() { if (pal) pal.classList.remove('open'); }
  var pb = $('#paletteBtn'); if (pb) pb.addEventListener('click', openPal);
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal && pal.classList.contains('open') ? closePal() : openPal(); }
    else if (e.key === 'Escape') { closePal(); closeMenu && closeMenu(); }
  });

  /* ---------- fee calculator ---------- */
  var calc = $('#calc');
  if (calc) {
    var st = { level: '9-10', mode: 'group', subjects: 2, cpw: 2 };
    var selL = $('#cLevel'), rS = $('#cSubjects'), rC = $('#cClasses'), oS = $('#oSubjects'), oC = $('#oClasses');
    var big = $('#cTotal'), save = $('#cSave'), note = $('#cNote'), book = $('#cBook'), shown2 = 0, raf;
    Object.keys(levels).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = levels[k].label; selL.appendChild(o); });
    selL.value = st.level;
    function discFor(n) { var d = 0, ds = C.prices.discounts || {}; Object.keys(ds).forEach(function (k) { if (n >= +k) d = Math.max(d, ds[k]); }); return d; }
    function animate(to) { cancelAnimationFrame(raf); var from = shown2, t0 = performance.now(); (function s(t) { var p = Math.min((t - t0) / 450, 1), e = 1 - Math.pow(1 - p, 3); shown2 = from + (to - from) * e; big.textContent = rs(shown2); if (p < 1) raf = requestAnimationFrame(s); })(t0); }
    function calcUpdate() {
      var L = levels[st.level], total, label;
      $$('.mode-only').forEach(function (n) { n.hidden = n.getAttribute('data-mode') !== st.mode; });
      if (st.mode === 'group') {
        var base = L.group * st.subjects, d = discFor(st.subjects), after = base * (1 - d / 100);
        total = after; save.textContent = d ? 'You save ' + rs(base - after) + ' (' + d + '% combo discount)' : 'Add more subjects for a combo discount';
        note.textContent = st.subjects + ' subject' + (st.subjects > 1 ? 's' : '') + ' · ' + L.label + ' · group batches';
        label = 'Group batch, ' + st.subjects + ' subject(s)';
      } else {
        total = L.one * st.cpw * (C.prices.weeksPerMonth || 4); save.textContent = rs(L.one) + ' per class';
        note.textContent = st.cpw + ' class' + (st.cpw > 1 ? 'es' : '') + ' per week · ' + L.label + ' · one-to-one';
        label = 'One-to-one, ' + st.cpw + ' class(es) per week';
      }
      animate(total); book.href = 'contact.html?level=' + encodeURIComponent(L.label) + '&plan=' + encodeURIComponent(label + ' — estimate ' + rs(total) + '/month');
    }
    selL.addEventListener('change', function () { st.level = selL.value; calcUpdate(); });
    rS.addEventListener('input', function () { st.subjects = +rS.value; oS.textContent = rS.value; calcUpdate(); });
    rC.addEventListener('input', function () { st.cpw = +rC.value; oC.textContent = rC.value; calcUpdate(); });
    $$('#modeSeg button').forEach(function (b) { b.addEventListener('click', function () { st.mode = b.getAttribute('data-mode'); $$('#modeSeg button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); calcUpdate(); }); });
    calcUpdate();
  }

  /* ---------- 60-second math challenge ---------- */
  var game = $('#game');
  if (game) {
    var stage = $('#gStage'), lvl = 'easy', score = 0, streak = 0, right = 0, tried = 0, ans = 0, left = 60, timer = null;
    var $q = $('#gQ'), $in = $('#gIn'), $fb = $('#gFb'), $bar = $('#gBar'), $sc = $('#gScore'), $st = $('#gStreak'), $be = $('#gBest'), $tm = $('#gTime');
    var rnd = function (a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; };
    var GEN = {
      easy: function () {
        var t = rnd(0, 3), a, b;
        if (t === 0) { a = rnd(5, 60); b = rnd(5, 40); return [a + ' + ' + b, a + b]; }
        if (t === 1) { a = rnd(30, 99); b = rnd(5, a - 1); return [a + ' − ' + b, a - b]; }
        if (t === 2) { a = rnd(2, 10); b = rnd(2, 10); return [a + ' × ' + b, a * b]; }
        b = rnd(2, 9); a = b * rnd(2, 10); return [a + ' ÷ ' + b, a / b];
      },
      medium: function () {
        var t = rnd(0, 3), a, b;
        if (t === 0) { a = rnd(11, 19); b = rnd(3, 12); return [a + ' × ' + b, a * b]; }
        if (t === 1) { a = rnd(2, 20); return [a + '²', a * a]; }
        if (t === 2) { var p = [5, 10, 15, 20, 25, 50][rnd(0, 5)], n = rnd(2, 20) * 20; return [p + '% of ' + n, n * p / 100]; }
        a = rnd(100, 500); b = rnd(20, 99); return [a + ' + ' + b, a + b];
      },
      hard: function () {
        var t = rnd(0, 4), a, b, c;
        if (t === 0) { a = rnd(12, 30); return [a + '²', a * a]; }
        if (t === 1) { a = rnd(12, 99); return [a + ' × 11', a * 11]; }
        if (t === 2) { a = rnd(6, 15); b = rnd(6, 15); c = rnd(10, 99); return ['(' + a + ' × ' + b + ') + ' + c, a * b + c]; }
        if (t === 3) { a = rnd(21, 99); b = rnd(3, 9); return [a + ' × ' + b, a * b]; }
        b = rnd(4, 15); a = rnd(4, 15); return ['? × ' + b + ' = ' + (a * b), a];
      }
    };
    function bestKey() { return 'anka-best-' + lvl; }
    function showBest() { $be.textContent = store.get(bestKey()) || 0; }
    function hud() { $sc.textContent = score; $st.textContent = streak; }
    function nextQ() { var g = GEN[lvl](); $q.textContent = g[0]; ans = g[1]; $in.value = ''; $in.focus(); }
    function end() {
      clearInterval(timer); stage.setAttribute('data-state', 'done');
      var prev = +store.get(bestKey()) || 0, nb = score > prev; if (nb) store.set(bestKey(), score); showBest();
      $('#gFinal').textContent = score;
      $('#gSummary').innerHTML = right + ' correct out of ' + tried + ' · accuracy ' + (tried ? Math.round(right / tried * 100) : 0) + '% · level: ' + lvl + (nb && score > 0 ? ' <span class="new-best">· new personal best!</span>' : '');
      $('#gShare').href = wa('I scored ' + score + ' in the ANKA 60-second math challenge (' + lvl + ' level). Can you beat me?');
    }
    function start() {
      score = 0; streak = 0; right = 0; tried = 0; left = 60; hud(); $fb.textContent = ''; $fb.className = 'g-fb'; $tm.textContent = 60; $bar.style.transform = 'scaleX(1)';
      stage.setAttribute('data-state', 'play'); nextQ();
      clearInterval(timer); var t0 = performance.now();
      timer = setInterval(function () { left = Math.max(0, 60 - (performance.now() - t0) / 1000); $tm.textContent = Math.ceil(left); $bar.style.transform = 'scaleX(' + (left / 60) + ')'; if (left <= 0) end(); }, 100);
    }
    function submit(skip) {
      if (stage.getAttribute('data-state') !== 'play') return;
      var v = $in.value.trim(); if (!skip && v === '') return;
      tried++; var ok = !skip && Number(v) === ans;
      if (ok) { right++; score += 10 + Math.min(streak, 10) * 2; streak++; $fb.textContent = streak > 2 ? '🔥 ' + streak + ' in a row!' : 'Correct!'; $fb.className = 'g-fb ok'; }
      else { streak = 0; $fb.textContent = skip ? 'Skipped — answer was ' + ans : 'Not quite — answer was ' + ans; $fb.className = 'g-fb bad'; $q.classList.remove('shake'); void $q.offsetWidth; $q.classList.add('shake'); }
      hud(); nextQ();
    }
    $$('#lvlSeg button').forEach(function (b) { b.addEventListener('click', function () { lvl = b.getAttribute('data-level'); $$('#lvlSeg button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); showBest(); }); });
    $$('[data-start]').forEach(function (b) { b.addEventListener('click', start); });
    $('#gCheck').addEventListener('click', function () { submit(false); });
    $('#gSkip').addEventListener('click', function () { submit(true); });
    $in.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(false); } });
    showBest(); stage.setAttribute('data-state', 'idle');
  }

  /* ---------- contact form ---------- */
  var form = $('#contactForm');
  if (form) {
    var q = new URLSearchParams(location.search), msg = $('#message'), box = $('#formMsg');
    if (q.get('plan') && msg) msg.value = 'Plan I am interested in: ' + q.get('plan') + '\n';
    if (q.get('level')) { var sel = $('#level'); $$('option', sel).forEach(function (o) { if (o.value === q.get('level')) sel.value = o.value; }); }
    if (q.get('sent') === '1') box.innerHTML = '<div class="alert ok" role="status">Thank you! Your request is in. We will contact you within 24 hours.</div>';
    if (q.get('sent') === '0') box.innerHTML = '<div class="alert bad" role="alert">We could not send that. Please use the WhatsApp button instead.</div>';
    function val() {
      var ok = true, name = $('#name'), phone = $('#phone');
      $('#nameErr').textContent = ''; $('#phoneErr').textContent = '';
      if (name.value.trim().length < 2) { $('#nameErr').textContent = 'Please enter your name.'; ok = false; }
      var digits = phone.value.replace(/[\s\-+()]/g, '');
      if (!/^\d{7,15}$/.test(digits)) { $('#phoneErr').textContent = 'Enter a valid phone / WhatsApp number.'; ok = false; }
      return ok;
    }
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!val()) { var f = $('.err:not(:empty)', form); if (f) f.previousElementSibling.focus(); return; }
      var hp = form.elements['website'];
      var okMsg = '<div class="alert ok" role="status">Thank you! Your request is in. We will contact you within 24 hours.</div>';
      var badMsg = '<div class="alert bad" role="alert">We could not send that. Please use the WhatsApp button instead.</div>';
      if (hp && hp.value) { box.innerHTML = okMsg; return; }                       // spam bot: pretend success
      var last = 0; try { last = +localStorage.getItem('anka-inq') || 0; } catch (x) { }
      if (Date.now() - last < 60000) { box.innerHTML = '<div class="alert bad" role="alert">Please wait a minute before sending another request.</div>'; return; }
      var sb = window.supabaseClient;
      if (!sb) { box.innerHTML = badMsg; return; }
      var btn = $('button[type=submit]', form), label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending…';
      var row = {
        name: $('#name').value.trim(),
        phone: $('#phone').value.trim(),
        level: $('#level').value,
        preferred_time: $('#time').value,
        subjects: $$('input[name="subjects[]"]:checked', form).map(function (i) { return i.value; }),
        message: msg.value.trim()
      };
      var res;
      try { res = await sb.from('inquiries').insert(row); } catch (err) { res = { error: err }; }
      btn.disabled = false; btn.textContent = label;
      if (res.error) { box.innerHTML = badMsg; return; }
      try { localStorage.setItem('anka-inq', String(Date.now())); } catch (x) { }
      form.reset(); box.innerHTML = okMsg;
      if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $('#waSend').addEventListener('click', function () {
      if (!val()) return;
      var subs = $$('input[name="subjects[]"]:checked', form).map(function (i) { return i.value; }).join(', ');
      var t = 'Hello ANKA! I would like a free demo class.\nName: ' + $('#name').value + '\nPhone: ' + $('#phone').value + '\nClass: ' + $('#level').value + '\nSubjects: ' + (subs || '-') + '\nPreferred time: ' + $('#time').value + (msg.value.trim() ? '\nNote: ' + msg.value.trim() : '');
      window.open(wa(t), '_blank');
    });
  }

  /* ---------- footer year ---------- */
  $$('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });
})();
