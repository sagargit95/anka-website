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
    if (!window.AnkaPlayer) { say(box, 'bad', 'The video player did not load. Please refresh the page.'); return; }
    var opts = {
      title: v.title,
      meta: [v.subject, ago(v.created_at)].filter(Boolean).join(' \u00b7 '),
      description: v.description || '',
      watermark: (user.name || 'Student') + ' \u00b7 ' + (user.email || '')
    };
    if (v.embed_url) {
      opts.iframe = toEmbed(v.embed_url);
      // Google Drive: play it in our own player (YouTube-style controls). If Drive will not stream the
      // file directly, the player falls back to Drive's embedded player automatically.
      var id = driveId(v.embed_url);
      if (id) opts.src = 'https://drive.usercontent.google.com/download?id=' + id + '&export=download&confirm=t';
    } else if (v.file_path) {
      opts.src = function () {
        return sb.storage.from('videos').createSignedUrl(v.file_path, 3600).then(function (sg) {
          if (sg.error || !sg.data) throw new Error('signed url');
          return sg.data.signedUrl;
        });
      };
    }
    window.AnkaPlayer.open(opts);
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
