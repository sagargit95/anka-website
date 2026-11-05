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
  var fl = $('[data-auth-footer]');
  if (fl && hasFlag()) { fl.textContent = 'My account'; fl.setAttribute('href', 'account.html'); }
  if (link && (page === 'login' || page === 'register' || page === 'account')) link.setAttribute('aria-current', 'page');

  if (page !== 'register' && page !== 'login' && page !== 'account') return;

  var user = null;
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

  // Get active session from Supabase
  async function boot() {
    if (!sb) {
      console.error('Supabase client not initialized. Check js/config.js');
      return;
    }
    var res = await sb.auth.getUser();
    if (res.data && res.data.user) {
      var meta = res.data.user.user_metadata || {};
      user = {
        id: res.data.user.id,
        email: res.data.user.email,
        name: meta.full_name || meta.name || 'Student',
        phone: meta.phone || '',
        level: meta.level || '9-10'
      };
      flag(true);
    } else {
      user = null;
      flag(false);
    }
  }

  function initRegister() {
    if (user) { location.replace('account.html'); return; }
    var f = $('#regForm'), box = $('#formMsg'), btn = $('button[type=submit]', f);
    if (!f) return;

    f.addEventListener('submit', async function (e) {
      e.preventDefault(); say(box, '', ''); fieldErrors(f, null);
      var d = {
        name: f.name.value,
        phone: f.phone.value,
        email: f.email.value,
        password: f.password.value,
        level: f.level.value,
        website: f.website ? f.website.value : '' // Honeypot anti-spam
      };

      // Honeypot check
      if (d.website) return;

      var local = {};
      if (d.name.trim().length < 2) local.name = 'Please enter your name.';
      if (!/^\d{7,15}$/.test(d.phone.replace(/[\s\-+()]/g, ''))) local.phone = 'Enter a valid phone / WhatsApp number.';
      if (!/^\S+@\S+\.\S+$/.test(d.email)) local.email = 'Enter a valid email address.';
      if (d.password.length < 8) local.password = 'Use at least 8 characters.';
      if (Object.keys(local).length) { fieldErrors(f, local); return; }

      busy(btn, true, 'Create account');

      var res = await sb.auth.signUp({
        email: d.email,
        password: d.password,
        options: {
          data: {
            full_name: d.name.trim(),
            phone: d.phone.trim(),
            level: d.level
          }
        }
      });

      busy(btn, false, 'Create account');

      if (res.error) {
        say(box, 'bad', res.error.message || 'Could not create the account.');
        return;
      }

      flag(true);
      location.href = 'account.html';
    });
  }

  function initLogin() {
    if (user) { location.replace('account.html'); return; }
    var f = $('#loginForm'), box = $('#formMsg'), btn = $('button[type=submit]', f);
    if (!f) return;

    f.addEventListener('submit', async function (e) {
      e.preventDefault(); say(box, '', ''); fieldErrors(f, null);
      if (!f.email.value.trim() || !f.password.value) {
        say(box, 'bad', 'Enter your email and password.');
        return;
      }

      busy(btn, true, 'Log in');

      var res = await sb.auth.signInWithPassword({
        email: f.email.value.trim(),
        password: f.password.value
      });

      busy(btn, false, 'Log in');

      if (res.error) {
        say(box, 'bad', res.error.message || 'Invalid email or password.');
        return;
      }

      flag(true);
      location.href = 'account.html';
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
    if (!user) { flag(false); location.replace('login.html'); return; }
    var helloEl = $('#hello'); if (helloEl) helloEl.textContent = 'Hello, ' + user.name.split(' ')[0] + ' 👋';
    var whoEl = $('#who'); if (whoEl) whoEl.textContent = 'Book a class below and we’ll confirm it by phone or WhatsApp within 24 hours.';
    var profEl = $('#profile'); if (profEl) profEl.textContent = user.name + ' · ' + user.phone + ' · ' + user.email + ' · ' + user.level;
    var acctEl = $('#acct'); if (acctEl) acctEl.hidden = false;

    var f = $('#bookForm'), box = $('#bookMsg'), btn = $('button[type=submit]', f);
    if (f) {
      for (var i = 0; i < f.level.options.length; i++) if (f.level.options[i].value === user.level) f.level.selectedIndex = i;

      f.addEventListener('submit', async function (e) {
        e.preventDefault(); say(box, '', '');
        var subs = Array.prototype.map.call(f.querySelectorAll('input[name=subjects]:checked'), function (x) { return x.value; });
        if (!subs.length) { say(box, 'bad', 'Choose at least one subject.'); return; }

        busy(btn, true, 'Submit booking');

        var bookingData = {
          user_id: user.id,
          type: f.querySelector('input[name=type]:checked').value,
          level: f.level.value,
          mode: f.querySelector('input[name=mode]:checked').value,
          time: f.time.value,
          subjects: subs,
          note: f.note.value,
          status: 'pending'
        };

        var res = await sb.from('bookings').insert([bookingData]);
        busy(btn, false, 'Submit booking');

        if (!res.error) {
          say(box, 'ok', 'Booking received! We’ll confirm it by phone or WhatsApp within 24 hours.');
          f.note.value = '';
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
  }

  boot().then(function () {
    if (page === 'register') initRegister();
    else if (page === 'login') initLogin();
    else if (page === 'account') initAccount();
  });
})();
async function loadRecordedClasses() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  const statusMsg = document.getElementById('recordingStatusMessage');
  const videoGrid = document.getElementById('videoGrid');

  // 1. Fetch recordings (RLS will automatically block this if not approved)
  const { data: recordings, error } = await supabaseClient
    .from('class_recordings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !recordings || recordings.length === 0) {
    // If blocked or empty
    const { data: access } = await supabaseClient
      .from('student_access')
      .select('is_allowed')
      .eq('user_id', user.id)
      .single();

    if (access && !access.is_allowed) {
      statusMsg.innerHTML = `
        <div class="alert" style="border: 1px solid var(--c3); background: rgba(251, 191, 36, 0.1);">
          🔒 <strong>Access Pending Approval:</strong> Your account is registered, but recorded classes require admin authorization. Please contact your teacher or wait for approval.
        </div>`;
    } else {
      statusMsg.innerText = "No class recordings have been uploaded yet.";
    }
    return;
  }

  // 2. If approved, render the video player embeds
  statusMsg.style.display = 'none';
  videoGrid.style.display = 'grid';
  videoGrid.innerHTML = '';

  recordings.forEach(rec => {
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `
    <div class="pill" style="margin-bottom: 0.5rem;">${rec.class_grade} · ${rec.subject}</div>
    <h3 class="h3">${rec.title}</h3>
    
    <div class="video-secure-wrap" oncontextmenu="return false;">
      <!-- Transparent click barrier covering the top-right Drive popout button -->
      <div class="video-shield-top" title="Playback only"></div>
      
      <!-- Sandboxed Drive preview player -->
      <iframe 
        src="https://drive.google.com/file/d/${rec.drive_file_id}/preview" 
        sandbox="allow-scripts allow-same-origin"
        allow="autoplay; encrypted-media" 
        allowfullscreen>
      </iframe>
    </div>
  `;
  videoGrid.appendChild(card);
});
