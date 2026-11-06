/* ANKA student accounts: register, login, bookings. Powered by Supabase */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var page = document.body.getAttribute('data-page');
  var KEY = 'anka-in';

  function flag(on) { try { on ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch (e) { } }
  function hasFlag() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }

  // Header/Footer links for visitor vs student
  var link = $('[data-auth-link]');
  if (link && hasFlag()) { link.textContent = 'My account'; link.setAttribute('href', 'account.html'); }
  if (link && hasFlag() && !$('[data-videos-link]')) {
    var li = document.createElement('li'), va = document.createElement('a');
    va.href = 'videos.html'; va.textContent = 'Videos'; va.setAttribute('data-videos-link', '');
    if (page === 'videos') va.setAttribute('aria-current', 'page');
    li.appendChild(va); link.parentNode.parentNode.insertBefore(li, link.parentNode);
  }
  var fl = $('[data-auth-footer]');
  if (fl && hasFlag()) { fl.textContent = 'My account'; fl.setAttribute('href', 'account.html'); }
  if (link && (page === 'login' || page === 'register' || page === 'account' || page === 'videos')) link.setAttribute('aria-current', 'page');

  if (page !== 'register' && page !== 'login' && page !== 'account' && page !== 'videos') return;

  var user = null, bootFailed = false;
  var sb = window.supabaseClient;

  function say(el, type, text) {
    if (!el) return;
    el.textContent = '';
    if (!text) return;
    var d = document.createElement('div');
    d.className = 'alert ' + type; d.setAttribute('role', 'status'); d.textContent = text;
    el.appendChild(d);
  }

  function fieldErrors(form, fields) {
    ['name', 'phone', 'email', 'password', 'level'].forEach(function (k) {
      var e = $('#' + k + 'Err', form); if (e) e.textContent = (fields && fields[k]) || '';
    });
  }

  function busy(btn, on, label) {
    if (!btn) return;
    btn.disabled = on;
    if (label) btn.textContent = on ? 'Please wait…' : label;
  }

  // Create the Supabase client here if config.js could not (e.g. library loaded late)
  if (!sb && window.supabase && window.supabase.createClient && typeof SUPABASE_URL !== 'undefined') {
    try { sb = window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch (e) { }
  }

  var NO_SERVER = 'Cannot reach the server. Check your internet connection and reload the page. If it keeps happening, message us on WhatsApp.';

  // Turn Supabase's technical errors into plain language
  function friendly(err, fallback) {
    var m = ((err && err.message) || '').toLowerCase();
    if (m.indexOf('invalid login') > -1) return 'Wrong email or password. Please try again.';
    if (m.indexOf('not confirmed') > -1) return 'Please confirm your email first. Open the confirmation email we sent you, then log in.';
    if (m.indexOf('already registered') > -1 || m.indexOf('already been registered') > -1) return 'This email is already registered. Please log in instead.';
    if (m.indexOf('rate limit') > -1 || m.indexOf('too many') > -1) return 'Too many attempts. Please wait a few minutes and try again.';
    if (m.indexOf('password') > -1 && m.indexOf('least') > -1) return 'Password is too short. Use at least 8 characters.';
    if (m.indexOf('failed to fetch') > -1 || m.indexOf('network') > -1) return NO_SERVER;
    return (err && err.message) || fallback;
  }

  // Get active session (read locally, no network call needed)
  async function boot() {
    if (!sb) { console.error('Supabase client not initialized. Check js/config.js'); return; }
    try {
      var res = await Promise.race([
        sb.auth.getSession(),
        new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, 8000); })
      ]);
      var u = res && res.data && res.data.session && res.data.session.user;
      if (u) {
        var meta = u.user_metadata || {};
        user = {
          id: u.id,
          email: u.email,
          name: meta.full_name || meta.name || 'Student',
          phone: meta.phone || '',
          level: meta.level || '9-10'
        };
        flag(true);
      } else {
        user = null;
        flag(false);
      }
    } catch (e) {
      console.warn('Session check failed:', e);
      user = null; bootFailed = true;
    }
  }

  function initRegister() {
    if (user) { location.replace('account.html'); return; }
    var f = $('#regForm'), box = $('#formMsg'), btn = f && $('button[type=submit]', f);
    if (!f) return;

    f.addEventListener('submit', async function (e) {
      e.preventDefault(); say(box, '', ''); fieldErrors(f, null);
      var d = {
        name: f.elements['name'].value,
        phone: f.elements['phone'].value,
        email: f.elements['email'].value.trim(),
        password: f.elements['password'].value,
        level: f.elements['level'].value,
        website: f.elements['website'] ? f.elements['website'].value : '' // Honeypot anti-spam
      };

      if (d.website) return; // bot

      var local = {};
      if (d.name.trim().length < 2) local.name = 'Please enter your name.';
      if (!/^\d{7,15}$/.test(d.phone.replace(/[\s\-+()]/g, ''))) local.phone = 'Enter a valid phone / WhatsApp number.';
      if (!/^\S+@\S+\.\S+$/.test(d.email)) local.email = 'Enter a valid email address.';
      if (d.password.length < 8) local.password = 'Use at least 8 characters.';
      if (Object.keys(local).length) { fieldErrors(f, local); return; }

      if (!sb) { say(box, 'bad', NO_SERVER); return; }

      busy(btn, true, 'Create account');
      var res;
      try {
        res = await sb.auth.signUp({
          email: d.email,
          password: d.password,
          options: {
            emailRedirectTo: new URL('login.html', location.href).href,
            data: { full_name: d.name.trim(), phone: d.phone.trim(), level: d.level }
          }
        });
      } catch (err) {
        res = { error: err };
      }
      busy(btn, false, 'Create account');

      if (res.error) { say(box, 'bad', friendly(res.error, 'Could not create the account.')); return; }

      var u = res.data && res.data.user;
      // Email already registered (Supabase hides this when confirmation is on)
      if (u && u.identities && u.identities.length === 0) {
        say(box, 'bad', 'This email is already registered. Please log in instead.');
        return;
      }
      // Email confirmation is ON: no session yet, student must confirm first
      if (!res.data || !res.data.session) {
        flag(false);
        f.reset();
        say(box, 'ok', 'Account created! We sent a confirmation link to ' + d.email + '. Open it, then come back and log in.');
        return;
      }
      flag(true);
      location.href = 'account.html';
    });
  }

  function initLogin() {
    if (user) { location.replace('account.html'); return; }
    var f = $('#loginForm'), box = $('#formMsg'), btn = f && $('button[type=submit]', f);
    if (!f) return;

    f.addEventListener('submit', async function (e) {
      e.preventDefault(); say(box, '', ''); fieldErrors(f, null);
      var email = f.elements['email'].value.trim(), pass = f.elements['password'].value;
      if (!email || !pass) { say(box, 'bad', 'Enter your email and password.'); return; }
      if (!sb) { say(box, 'bad', NO_SERVER); return; }

      busy(btn, true, 'Log in');
      var res;
      try {
        res = await sb.auth.signInWithPassword({ email: email, password: pass });
      } catch (err) {
        res = { error: err };
      }
      busy(btn, false, 'Log in');

      if (res.error) { say(box, 'bad', friendly(res.error, 'Invalid email or password.')); return; }

      flag(true);
      var next = new URLSearchParams(location.search).get('next');
      location.href = (next && /^[a-z0-9_-]+\.html$/i.test(next)) ? next : 'account.html';
    });
  }

  // Turn a normal share link into an embeddable one (Google Drive, YouTube)
  function toEmbed(url) {
    url = (url || '').trim();
    var m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/) || url.match(/drive\.google\.com\/(?:open|uc)\?[^#]*id=([\w-]+)/);
    if (m) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
    m = url.match(/(?:youtube\.com\/watch\?[^#]*v=|youtu\.be\/)([\w-]{11})/);
    if (m) return 'https://www.youtube-nocookie.com/embed/' + m[1];
    return url;
  }

  // ---------- Members-only videos ----------
  async function initVideos() {
    if (!user) { flag(false); location.replace('login.html?next=videos.html'); return; }
    return loadVideos();
  }

  // ---------- YouTube-style video list ----------
  function injectVideoCss() {
    if (document.getElementById('ytcss')) return;
    var st = document.createElement('style'); st.id = 'ytcss';
    st.textContent = [
      '.yt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,270px),1fr));gap:1.6rem 1rem}',
      '.yt-card{display:block;width:100%;text-align:left;background:none;border:0;padding:0;color:inherit;cursor:pointer;font:inherit}',
      '.yt-thumb{position:relative;aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,color-mix(in srgb,var(--c1) 45%,#000),color-mix(in srgb,var(--c2) 30%,#000));display:grid;place-items:center}',
      '.yt-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .35s ease}',
      '.yt-card:hover .yt-thumb img,.yt-card:focus-visible .yt-thumb img{transform:scale(1.05)}',
      '.yt-play{position:relative;z-index:1;width:54px;height:54px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;display:grid;place-items:center;font-size:1.3rem;padding-left:4px;transition:transform .2s,background .2s}',
      '.yt-card:hover .yt-play{transform:scale(1.12);background:rgba(0,0,0,.8)}',
      '.yt-chip{position:absolute;z-index:1;right:8px;bottom:8px;background:rgba(0,0,0,.78);color:#fff;font-size:.72rem;font-weight:600;padding:2px 7px;border-radius:6px}',
      '.yt-info{padding:.7rem .15rem 0}',
      '.yt-title{font-weight:600;font-size:1rem;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}',
      '.yt-meta{color:var(--muted);font-size:.85rem;margin-top:.25rem}',
      '@media (max-width:600px){.yt-grid{grid-template-columns:minmax(0,1fr);gap:1.4rem}.yt-thumb{border-radius:12px}}',
      '.yt-modal{position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,.88);display:flex;justify-content:center;align-items:flex-start;overflow-y:auto;padding:max(12px,env(safe-area-inset-top)) 12px 24px}',
      '.yt-box{width:min(100%,1000px)}',
      '.yt-player{position:relative;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden;width:min(100%,calc((100dvh - 150px)*16/9));margin-inline:auto}',
      '.yt-player iframe,.yt-player video{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000}',
      '.yt-player.vid-full{position:fixed;inset:0;z-index:7000;aspect-ratio:auto;width:100vw;height:100dvh;border-radius:0;margin:0}',
      '.yt-fs{position:absolute;right:10px;bottom:10px;z-index:5;width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:rgba(0,0,0,.6);color:#fff;border:1px solid rgba(255,255,255,.28);cursor:pointer;padding:0;transition:background .2s,transform .2s}',
      '.yt-fs:hover{background:rgba(0,0,0,.85);transform:scale(1.08)}',
      '.yt-fs:focus-visible{outline:2px solid var(--c2);outline-offset:2px}',
      '.yt-under{color:#fff;padding:.9rem .2rem 0}',
      '.yt-under h3{font-size:1.15rem;line-height:1.35;margin:0 0 .3rem;color:#fff}',
      '.yt-under p{margin:.3rem 0 0;color:#cfcfd6;font-size:.92rem;overflow-wrap:anywhere}',
      '.yt-actions{display:flex;gap:.6rem;margin-top:.8rem;flex-wrap:wrap}',
      '@media (max-height:480px) and (orientation:landscape){.yt-player{width:min(100%,calc((100dvh - 24px)*16/9))}.yt-under{display:none}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function driveId(url) {
    var m = (url || '').match(/drive\.google\.com\/file\/d\/([\w-]+)/) || (url || '').match(/drive\.google\.com\/(?:open|uc)\?[^#]*id=([\w-]+)/);
    return m ? m[1] : '';
  }
  function thumbFor(v) {
    var id = driveId(v.embed_url);
    if (id) return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w640';
    var m = (v.embed_url || '').match(/(?:youtube\.com\/watch\?[^#]*v=|youtu\.be\/)([\w-]{11})/);
    return m ? 'https://i.ytimg.com/vi/' + m[1] + '/hqdefault.jpg' : '';
  }
  function ago(d) {
    var t = Date.parse(d); if (!t) return '';
    var m = Math.floor((Date.now() - t) / 60000);
    if (m < 60) return 'Just now';
    var h = Math.floor(m / 60); if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    var dd = Math.floor(h / 24); if (dd < 30) return dd + (dd === 1 ? ' day ago' : ' days ago');
    var mo = Math.floor(dd / 30); if (mo < 12) return mo + (mo === 1 ? ' month ago' : ' months ago');
    var y = Math.floor(mo / 12); return y + (y === 1 ? ' year ago' : ' years ago');
  }

  function openPlayer(v, box) {
    var wmTimer = null;
    var modal = document.createElement('div'); modal.className = 'yt-modal';
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', v.title);
    var wrap = document.createElement('div'); wrap.className = 'yt-box';
    var frame = document.createElement('div'); frame.className = 'yt-player';
    frame.style.userSelect = 'none';
    frame.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    function close() {
      clearInterval(wmTimer);
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () { });
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.documentElement.style.overflow = '';
      modal.remove();
    }
    function onKey(e) { if (e.key === 'Escape') { if (frame.classList.contains('vid-full')) exitFull(); else close(); } }
    function exitFull() {
      frame.classList.remove('vid-full'); setFs(false);
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () { });
    }
    function onFsChange() { if (!document.fullscreenElement) { frame.classList.remove('vid-full'); setFs(false); } }
    var ICON_ENTER = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>';
    var ICON_EXIT = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/></svg>';
    function setFs(on) {
      fs.innerHTML = on ? ICON_EXIT : ICON_ENTER;
      var t = on ? 'Exit full screen' : 'Full screen';
      fs.setAttribute('aria-label', t); fs.title = t;
    }

    // player
    if (v.embed_url) {
      var fr = document.createElement('iframe');
      fr.src = toEmbed(v.embed_url); fr.title = v.title;
      fr.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media'; fr.allowFullscreen = true;
      fr.referrerPolicy = 'no-referrer';
      fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
      frame.appendChild(fr);
      var shield = document.createElement('div'); shield.setAttribute('aria-hidden', 'true');
      shield.style.cssText = 'position:absolute;top:0;right:0;width:76px;height:64px;z-index:3;background:transparent';
      frame.appendChild(shield);
    } else {
      sb.storage.from('videos').createSignedUrl(v.file_path, 3600).then(function (sg) {
        if (sg.error || !sg.data) { say(box, 'bad', 'Could not open this video. Please log in again.'); close(); return; }
        var vd = document.createElement('video');
        vd.src = sg.data.signedUrl; vd.controls = true; vd.autoplay = true; vd.playsInline = true;
        vd.setAttribute('controlsList', 'nodownload'); vd.setAttribute('disablePictureInPicture', '');
        frame.insertBefore(vd, frame.firstChild);
      });
    }
    // moving watermark with the student's name
    var wm = document.createElement('div'); wm.setAttribute('aria-hidden', 'true');
    wm.textContent = (user.name || 'Student') + ' · ' + (user.email || '');
    wm.style.cssText = 'position:absolute;z-index:4;pointer-events:none;color:#fff;opacity:.28;font:600 12px Inter,system-ui,sans-serif;text-shadow:0 0 3px #000;white-space:nowrap;transition:top 1.2s,left 1.2s;top:12%;left:8%';
    frame.appendChild(wm);
    wmTimer = setInterval(function () { wm.style.top = (10 + Math.random() * 70) + '%'; wm.style.left = (4 + Math.random() * 45) + '%'; }, 6000);

    // text under the player
    var under = document.createElement('div'); under.className = 'yt-under';
    var h = document.createElement('h3'); h.textContent = v.title; under.appendChild(h);
    var meta = [v.subject, ago(v.created_at)].filter(Boolean).join(' · ');
    if (meta) { var mt = document.createElement('div'); mt.style.cssText = 'color:#a9a9b3;font-size:.85rem'; mt.textContent = meta; under.appendChild(mt); }
    if (v.description) { var dp = document.createElement('p'); dp.textContent = v.description; under.appendChild(dp); }

    // full screen button, bottom-right corner of the player (no close button: tap outside the player or press Esc)
    var fs = document.createElement('button'); fs.type = 'button'; fs.className = 'yt-fs';
    setFs(false);
    fs.addEventListener('click', function () {
      if (frame.classList.contains('vid-full') || document.fullscreenElement === frame) { exitFull(); return; }
      var req = frame.requestFullscreen || frame.webkitRequestFullscreen;
      if (req) { try { var r = req.call(frame); if (r && r.catch) r.catch(function () { frame.classList.add('vid-full'); setFs(true); }); setFs(true); return; } catch (e) { } }
      frame.classList.add('vid-full'); setFs(true);
    });
    document.addEventListener('fullscreenchange', onFsChange);
    frame.appendChild(fs);

    wrap.appendChild(frame); wrap.appendChild(under); modal.appendChild(wrap);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    // Attach to <html>, not <body>, so no transform/animation on body can offset this fixed overlay
    document.documentElement.appendChild(modal);
    modal.scrollTop = 0;
    fs.focus({ preventScroll: true });
  }

  async function loadVideos() {
    var box = $('#vidMsg'), list = $('#vidList');
    if (!list) return;
    list.textContent = '';
    if (!sb) { say(box, 'bad', NO_SERVER); return; }
    injectVideoCss();

    var res = await sb.from('videos').select('*').eq('published', true).order('created_at', { ascending: false });
    if (res.error) { say(box, 'bad', 'Could not load videos. ' + (res.error.message || '')); return; }
    if (!res.data || !res.data.length) {
      var p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Recorded classes for your subjects appear here once your enrolment is confirmed. Book a class below, and we will confirm it within 24 hours.'; list.appendChild(p); return;
    }

    list.className = 'yt-grid';
    res.data.forEach(function (v) {
      var card = document.createElement('button'); card.type = 'button'; card.className = 'yt-card';
      card.setAttribute('aria-label', 'Play ' + v.title);
      var th = document.createElement('div'); th.className = 'yt-thumb';
      var src = thumbFor(v);
      if (src) {
        var im = document.createElement('img'); im.src = src; im.alt = ''; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer';
        im.addEventListener('error', function () { im.remove(); });
        th.appendChild(im);
      }
      var pl = document.createElement('span'); pl.className = 'yt-play'; pl.textContent = '▶'; th.appendChild(pl);
      if (v.subject) { var ch = document.createElement('span'); ch.className = 'yt-chip'; ch.textContent = v.subject; th.appendChild(ch); }
      var info = document.createElement('div'); info.className = 'yt-info';
      var t = document.createElement('div'); t.className = 'yt-title'; t.textContent = v.title;
      var m = document.createElement('div'); m.className = 'yt-meta'; m.textContent = [v.subject, ago(v.created_at)].filter(Boolean).join(' · ');
      info.appendChild(t); info.appendChild(m);
      card.appendChild(th); card.appendChild(info);
      card.addEventListener('click', function () { openPlayer(v, box); });
      list.appendChild(card);
    });
  }

  var TYPES = { demo: 'Free demo', enrol: 'Enrolment' }, MODES = { group: 'Group batch', one: 'One-to-one' };

  function renderBookings(list) {
    var wrap = $('#bookings');
    if (!wrap) return;
    wrap.textContent = '';
    if (!list.length) {
      var p = document.createElement('p'); p.className = 'muted';
      p.textContent = 'No bookings yet. Use the form to book your first class.'; wrap.appendChild(p); return;
    }
    list.forEach(function (b) {
      var el = document.createElement('div'); el.className = 'bk';
      var top = document.createElement('div'); top.className = 'bk-top';
      var t = document.createElement('b'); t.textContent = (TYPES[b.type] || b.type) + ' · ' + (Array.isArray(b.subjects) ? b.subjects.join(', ') : b.subjects);
      var s = document.createElement('span'); s.className = 'b-pill st-' + b.status; s.textContent = b.status.charAt(0).toUpperCase() + b.status.slice(1);
      top.appendChild(t); top.appendChild(s); el.appendChild(top);
      var m = document.createElement('div'); m.className = 'muted bk-meta';
      m.textContent = [b.level, MODES[b.mode] || b.mode, b.time, (b.created_at || '').slice(0, 16)].join(' · ');
      el.appendChild(m);

      if (b.status === 'pending') {
        var c = document.createElement('button'); c.type = 'button'; c.className = 'link-btn'; c.textContent = 'Cancel booking';
        c.addEventListener('click', async function () {
          if (!confirm('Cancel this booking?')) return;
          var res = await sb.from('bookings').update({ status: 'cancelled' }).eq('id', b.id);
          say($('#bookMsg'), !res.error ? 'ok' : 'bad', !res.error ? 'Booking cancelled.' : (res.error.message || 'Could not cancel.'));
          loadBookings();
        });
        el.appendChild(c);
      }
      wrap.appendChild(el);
    });
  }

  async function loadBookings() {
    if (!user) return;
    var res = await sb.from('bookings').select('*').order('created_at', { ascending: false });
    if (res.error) {
      console.warn('Could not fetch bookings:', res.error.message);
      renderBookings([]);
      return;
    }
    renderBookings(res.data || []);
  }

  function initAccount() {
    if (!user && bootFailed) {
      var w = $('#who'); if (w) w.textContent = NO_SERVER;
      var vl = $('#vidList'); if (vl) vl.textContent = '';
      return;
    }
    if (!user) { flag(false); location.replace('login.html'); return; }
    var helloEl = $('#hello'); if (helloEl) helloEl.textContent = 'Hello, ' + user.name.split(' ')[0] + ' 👋';
    var whoEl = $('#who'); if (whoEl) whoEl.textContent = 'Book a class below and we’ll confirm it by phone or WhatsApp within 24 hours.';
    var profEl = $('#profile'); if (profEl) profEl.textContent = user.name + ' · ' + user.phone + ' · ' + user.email + ' · ' + user.level;
    var acctEl = $('#acct'); if (acctEl) acctEl.hidden = false;

    var f = $('#bookForm'), box = $('#bookMsg'), btn = $('button[type=submit]', f);
    if (f) {
      for (var i = 0; i < f.elements['level'].options.length; i++) if (f.elements['level'].options[i].value === user.level) f.elements['level'].selectedIndex = i;

      f.addEventListener('submit', async function (e) {
        e.preventDefault(); say(box, '', '');
        var subs = Array.prototype.map.call(f.querySelectorAll('input[name=subjects]:checked'), function (x) { return x.value; });
        if (!subs.length) { say(box, 'bad', 'Choose at least one subject.'); return; }

        busy(btn, true, 'Submit booking');

        var bookingData = {
          user_id: user.id,
          type: f.querySelector('input[name=type]:checked').value,
          level: f.elements['level'].value,
          mode: f.querySelector('input[name=mode]:checked').value,
          time: f.elements['time'].value,
          subjects: subs,
          note: f.elements['note'].value,
          status: 'pending'
        };

        var res = await sb.from('bookings').insert([bookingData]);
        busy(btn, false, 'Submit booking');

        if (!res.error) {
          say(box, 'ok', 'Booking received! We’ll confirm it by phone or WhatsApp within 24 hours.');
          f.elements['note'].value = '';
          Array.prototype.forEach.call(f.querySelectorAll('input[name=subjects]'), function (x) { x.checked = false; });
          loadBookings();
        } else {
          say(box, 'bad', res.error.message || 'Could not save the booking.');
        }
      });
    }

    var logoutBtn = $('#logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async function () {
        await sb.auth.signOut();
        flag(false);
        location.href = 'index.html';
      });
    }

    loadBookings();
    loadVideos();
  }

  boot().catch(function () { }).then(function () {
    if (page === 'register') initRegister();
    else if (page === 'login') initLogin();
    else if (page === 'account') initAccount();
    else if (page === 'videos') initVideos();
  });
})();
