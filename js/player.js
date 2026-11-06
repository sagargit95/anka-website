/* ANKA video player: YouTube-style controls that hide 3 seconds after you stop touching them.
 *
 *   AnkaPlayer.open({ title, meta, description, watermark, src, iframe })
 *
 *   src    : direct video URL, or a function returning a Promise of one
 *   iframe : embed URL. Used when there is no src, or as the fallback if src cannot be played.
 */
(function () {
  'use strict';

  var HIDE_MS = 3000;
  var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  var canHover = !!(window.matchMedia && window.matchMedia('(hover:hover)').matches);
  var current = null;   // only one player at a time

  function svg(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>'; }
  var ICON = {
    play: svg('M8 5v14l11-7z'),
    pause: svg('M6 19h4V5H6v14zm8-14v14h4V5h-4z'),
    replay: svg('M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z'),
    volUp: svg('M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z'),
    volDown: svg('M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z'),
    volOff: svg('M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z'),
    fsIn: svg('M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z'),
    fsOut: svg('M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z')
  };

  function injectCss() {
    if (document.getElementById('ap-css')) return;
    var st = document.createElement('style'); st.id = 'ap-css';
    st.textContent = [
      '.ap-modal{position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,.92);display:flex;justify-content:center;align-items:flex-start;overflow-y:auto;padding:max(12px,env(safe-area-inset-top)) 12px 24px;-webkit-overflow-scrolling:touch}',
      '.ap-box{width:min(100%,1000px)}',
      '.ap-player{position:relative;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden;width:min(100%,calc((100dvh - 150px)*16/9));margin-inline:auto;color:#fff;font-family:Inter,system-ui,sans-serif;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}',
      '.ap-player button{-webkit-tap-highlight-color:transparent}',
      '.ap-video,.ap-iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000;object-fit:contain}',
      '.ap-shield{position:absolute;top:0;right:0;width:76px;height:64px;z-index:6;background:transparent}',
      '.ap-embed .ap-tap,.ap-embed .ap-top,.ap-embed .ap-center,.ap-embed .ap-bottom,.ap-embed .ap-seekfx{display:none}',
      '.ap-wm{position:absolute;z-index:2;pointer-events:none;color:#fff;opacity:.28;font:600 12px Inter,system-ui,sans-serif;text-shadow:0 0 3px #000;white-space:nowrap;transition:top 1.2s,left 1.2s;top:12%;left:8%}',
      '.ap-wait{display:none;position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border:4px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:ap-spin .8s linear infinite;z-index:2;pointer-events:none}',
      '.ap-loading .ap-wait{display:block}',
      '@keyframes ap-spin{to{transform:rotate(360deg)}}',
      '.ap-tap{position:absolute;inset:0;z-index:3}',
      '.ap-seekfx{position:absolute;top:0;bottom:0;width:34%;display:grid;place-items:center;z-index:3;pointer-events:none;opacity:0;font:700 15px Inter,system-ui,sans-serif;background:rgba(255,255,255,.14)}',
      '.ap-seekfx.ap-l{left:0;border-radius:0 100% 100% 0/0 50% 50% 0}',
      '.ap-seekfx.ap-r{right:0;border-radius:100% 0 0 100%/50% 0 0 50%}',
      '.ap-seekfx.on{animation:ap-fx .6s ease-out}',
      '@keyframes ap-fx{0%{opacity:0}20%{opacity:1}100%{opacity:0}}',
      '.ap-top,.ap-bottom,.ap-center{transition:opacity .25s}',
      '.ap-custom:not(.ap-ui) .ap-top,.ap-custom:not(.ap-ui) .ap-bottom,.ap-custom:not(.ap-ui) .ap-center{opacity:0;pointer-events:none}',
      '.ap-custom:not(.ap-ui){cursor:none}',
      '.ap-top{display:none;position:absolute;left:0;right:0;top:0;z-index:4;padding:max(10px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) 30px max(16px,env(safe-area-inset-left));background:linear-gradient(rgba(0,0,0,.7),transparent)}',
      '.ap-full .ap-top{display:block}',
      '.ap-ttl{display:block;font:600 15px Inter,system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ap-center{display:none;position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;background:rgba(0,0,0,.55);z-index:4;place-items:center}',
      '.ap-center svg{width:36px;height:36px;fill:#fff}',
      '.ap-paused .ap-center,.ap-ended .ap-center{display:grid}',
      '@media (pointer:coarse){.ap-custom .ap-center{display:grid}}',
      '.ap-msg{position:absolute;inset:0;z-index:5;display:grid;place-items:center;padding:1.2rem;text-align:center;font:500 .95rem/1.5 Inter,system-ui,sans-serif;background:rgba(0,0,0,.8)}',
      '.ap-msg[hidden]{display:none}',
      '.ap-bottom{position:absolute;left:0;right:0;bottom:0;z-index:4;padding:24px max(10px,env(safe-area-inset-right)) max(4px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));background:linear-gradient(transparent,rgba(0,0,0,.72))}',
      '.ap-prog{position:relative;height:26px;margin:0 6px;cursor:pointer;touch-action:none;outline:none}',
      '.ap-track{position:absolute;left:0;right:0;top:50%;height:3px;margin-top:-1.5px;border-radius:2px;background:rgba(255,255,255,.3);transition:height .15s,margin .15s}',
      '.ap-prog:hover .ap-track,.ap-scrub .ap-track{height:5px;margin-top:-2.5px}',
      '.ap-buf,.ap-fill{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:2px}',
      '.ap-buf{background:rgba(255,255,255,.4)}',
      '.ap-fill{background:linear-gradient(90deg,var(--c1,#8b6cff),var(--c2,#22d3ee))}',
      '.ap-dot{position:absolute;left:0;top:50%;width:13px;height:13px;margin:-6.5px 0 0 -6.5px;border-radius:50%;background:#fff;box-shadow:0 0 4px rgba(0,0,0,.5);transition:transform .15s}',
      '.ap-scrub .ap-dot{transform:scale(1.3)}',
      '.ap-row{display:flex;align-items:center;gap:2px;height:44px}',
      '.ap-b{width:40px;height:40px;display:grid;place-items:center;flex:none;padding:0;border-radius:50%;color:#fff;background:none;border:0;cursor:pointer}',
      '.ap-b:hover{background:rgba(255,255,255,.14)}',
      '.ap-b:focus-visible,.ap-prog:focus-visible{outline:2px solid var(--c2,#22d3ee);outline-offset:1px}',
      '.ap-b svg{width:24px;height:24px;fill:#fff}',
      '.ap-time{font:500 13px Inter,system-ui,sans-serif;margin-left:6px;white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.ap-sp{flex:1}',
      '.ap-volg{display:flex;align-items:center}',
      '.ap-volr{width:0;opacity:0;height:4px;margin:0;accent-color:#fff;cursor:pointer;transition:width .2s,opacity .2s}',
      '.ap-volg:hover .ap-volr,.ap-volr:focus-visible{width:72px;opacity:1;margin:0 8px 0 2px}',
      '.ap-spw{position:relative}',
      '.ap-b.ap-speed{width:auto;min-width:44px;padding:0 10px;border-radius:18px;font:600 13px Inter,system-ui,sans-serif}',
      '.ap-menu{display:none;position:absolute;right:0;bottom:48px;min-width:120px;padding:6px;border-radius:12px;background:rgba(18,18,26,.96);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 30px rgba(0,0,0,.5)}',
      '.ap-menu.open{display:block}',
      '.ap-mi{display:block;width:100%;text-align:left;padding:9px 12px 9px 28px;border-radius:8px;color:#fff;background:none;border:0;cursor:pointer;font:500 14px Inter,system-ui,sans-serif;position:relative}',
      '.ap-mi:hover{background:rgba(255,255,255,.12)}',
      '.ap-mi.on::before{content:"✓";position:absolute;left:9px}',
      '@media (pointer:coarse){.ap-pl,.ap-volg{display:none}.ap-time{margin-left:8px}}',
      '.ap-player:fullscreen{width:100%!important;height:100%!important;aspect-ratio:auto;border-radius:0;margin:0}',
      '.ap-player:-webkit-full-screen{width:100%!important;height:100%!important;aspect-ratio:auto;border-radius:0;margin:0}',
      '.ap-cssfull{position:fixed!important;inset:0;z-index:7000;width:100vw!important;height:100dvh!important;aspect-ratio:auto;border-radius:0;margin:0}',
      '.ap-under{color:#fff;padding:.9rem .2rem 0}',
      '.ap-under h3{font-size:1.15rem;line-height:1.35;margin:0 0 .3rem;color:#fff}',
      '.ap-under .ap-meta{color:#a9a9b3;font-size:.85rem}',
      '.ap-under p{margin:.3rem 0 0;color:#cfcfd6;font-size:.92rem;overflow-wrap:anywhere}',
      '@media (max-width:600px){.ap-modal{padding:env(safe-area-inset-top,0px) 0 24px}.ap-player{width:100%;border-radius:0}.ap-under{padding:.8rem 14px 0}.ap-under h3{font-size:1.02rem}}',
      '@media (max-height:480px) and (orientation:landscape){.ap-player{width:min(100%,calc((100dvh - 24px)*16/9))}.ap-under{display:none}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function fmt(s) {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') + m : m) + ':' + (sec < 10 ? '0' : '') + sec;
  }
  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }

  function open(opts) {
    if (current) return;
    injectCss();

    var video = null, iframe = null, raf = 0, hideT = 0, tapT = 0, lastTap = 0, wmT = 0, failT = 0;
    var scrubbing = false, scrubP = 0, pushed = false, closed = false, cssFull = false, lastType = 'mouse';

    // ---------- structure ----------
    var modal = el('div', 'ap-modal');
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', opts.title || 'Video');
    var box = el('div', 'ap-box');
    var player = el('div', 'ap-player ap-loading');
    player.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    player.innerHTML =
      '<div class="ap-wait"></div>' +
      '<div class="ap-seekfx ap-l"></div><div class="ap-seekfx ap-r"></div>' +
      '<div class="ap-tap"></div>' +
      '<div class="ap-top"><span class="ap-ttl"></span></div>' +
      '<button class="ap-center" type="button"></button>' +
      '<div class="ap-msg" hidden></div>' +
      '<div class="ap-bottom">' +
        '<div class="ap-prog" role="slider" aria-label="Seek" tabindex="0"><div class="ap-track"><i class="ap-buf"></i><i class="ap-fill"></i></div><i class="ap-dot"></i></div>' +
        '<div class="ap-row">' +
          '<button class="ap-b ap-pl" type="button"></button>' +
          '<div class="ap-volg"><button class="ap-b ap-mute" type="button"></button><input class="ap-volr" type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume"></div>' +
          '<span class="ap-time">0:00 / 0:00</span><span class="ap-sp"></span>' +
          '<div class="ap-spw"><button class="ap-b ap-speed" type="button" aria-label="Playback speed">1x</button><div class="ap-menu" role="menu"></div></div>' +
          '<button class="ap-b ap-fsb" type="button"></button>' +
        '</div>' +
      '</div>';
    var q = function (s) { return player.querySelector(s); };
    var tap = q('.ap-tap'), bottom = q('.ap-bottom'), center = q('.ap-center'), msg = q('.ap-msg'),
        prog = q('.ap-prog'), buf = q('.ap-buf'), fill = q('.ap-fill'), dot = q('.ap-dot'),
        plBtn = q('.ap-pl'), muteBtn = q('.ap-mute'), volr = q('.ap-volr'), timeEl = q('.ap-time'),
        speedBtn = q('.ap-speed'), menu = q('.ap-menu'), fsBtn = q('.ap-fsb'),
        fxL = q('.ap-seekfx.ap-l'), fxR = q('.ap-seekfx.ap-r');
    q('.ap-ttl').textContent = opts.title || '';

    // moving watermark with the student's name
    if (opts.watermark) {
      var wm = el('div', 'ap-wm'); wm.setAttribute('aria-hidden', 'true'); wm.textContent = opts.watermark;
      player.appendChild(wm);
      wmT = setInterval(function () { wm.style.top = (10 + Math.random() * 70) + '%'; wm.style.left = (4 + Math.random() * 45) + '%'; }, 6000);
    }

    var under = el('div', 'ap-under');
    var h = el('h3'); h.textContent = opts.title || ''; under.appendChild(h);
    if (opts.meta) { var mt = el('div', 'ap-meta'); mt.textContent = opts.meta; under.appendChild(mt); }
    if (opts.description) { var dp = el('p'); dp.textContent = opts.description; under.appendChild(dp); }
    box.appendChild(player); box.appendChild(under); modal.appendChild(box);

    // ---------- controls: show / auto-hide ----------
    function shouldAutoHide() {
      return !!video && !video.paused && !video.ended && !scrubbing && !menu.classList.contains('open') &&
        !(canHover && bottom.matches && bottom.matches(':hover'));
    }
    function showUI() {
      player.classList.add('ap-ui');
      clearTimeout(hideT);
      if (shouldAutoHide()) hideT = setTimeout(hideUI, HIDE_MS);
    }
    function hideUI() {
      if (!shouldAutoHide()) { hideT = 0; if (video && !video.paused) hideT = setTimeout(hideUI, HIDE_MS); return; }
      player.classList.remove('ap-ui');
    }
    function toggleUI() {
      if (player.classList.contains('ap-ui')) { if (shouldAutoHide()) { clearTimeout(hideT); player.classList.remove('ap-ui'); } }
      else showUI();
    }

    // ---------- state -> UI ----------
    function setPlayIcons() {
      var ended = !!video && video.ended, paused = !video || video.paused;
      var ic = ended ? ICON.replay : (paused ? ICON.play : ICON.pause);
      var lab = ended ? 'Replay' : (paused ? 'Play' : 'Pause');
      plBtn.innerHTML = ic; plBtn.setAttribute('aria-label', lab);
      center.innerHTML = ic; center.setAttribute('aria-label', lab);
      player.classList.toggle('ap-paused', paused && !ended);
      player.classList.toggle('ap-ended', ended);
    }
    function setVolIcon() {
      if (!video) return;
      var m = video.muted || video.volume === 0;
      muteBtn.innerHTML = m ? ICON.volOff : (video.volume < 0.5 ? ICON.volDown : ICON.volUp);
      muteBtn.setAttribute('aria-label', m ? 'Unmute' : 'Mute');
      volr.value = m ? 0 : video.volume;
    }
    function setRate() {
      var r = video ? video.playbackRate : 1;
      speedBtn.textContent = (r === 1 ? '1x' : r + 'x');
      Array.prototype.forEach.call(menu.children, function (b) { b.classList.toggle('on', +b.getAttribute('data-sp') === r); });
    }
    function paint() {
      if (!video) return;
      var d = video.duration || 0, t = video.currentTime || 0, p = d ? Math.min(100, t / d * 100) : 0;
      if (!scrubbing) {
        fill.style.width = p + '%'; dot.style.left = p + '%';
        timeEl.textContent = fmt(t) + ' / ' + fmt(d);
      }
      prog.setAttribute('aria-valuenow', Math.round(p));
    }
    function paintBuffer() {
      if (!video) return;
      var d = video.duration || 0, t = video.currentTime || 0, end = 0, b = video.buffered;
      try { for (var i = 0; i < b.length; i++) if (b.start(i) <= t + 0.5 && b.end(i) >= t) end = b.end(i); } catch (e) { }
      buf.style.width = (d ? Math.min(100, end / d * 100) : 0) + '%';
    }
    function loop() { paint(); if (video && !video.paused && !video.ended) raf = requestAnimationFrame(loop); }

    function togglePlay() {
      if (!video) return;
      if (video.ended) { video.currentTime = 0; }
      if (video.paused || video.ended) { var p = video.play(); if (p && p.catch) p.catch(function () { setPlayIcons(); showUI(); }); }
      else video.pause();
    }
    function seekBy(sec) {
      if (!video || !isFinite(video.duration)) return;
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + sec));
      paint(); paintBuffer();
      var fx = sec < 0 ? fxL : fxR;
      fx.textContent = (sec < 0 ? '« ' : '') + Math.abs(sec) + ' s' + (sec > 0 ? ' »' : '');
      fx.classList.remove('on'); void fx.offsetWidth; fx.classList.add('on');
    }

    // ---------- full screen ----------
    function isFs() { return document.fullscreenElement === player || document.webkitFullscreenElement === player; }
    function syncFs() {
      var on = isFs() || cssFull;
      player.classList.toggle('ap-full', on);
      fsBtn.innerHTML = on ? ICON.fsOut : ICON.fsIn;
      fsBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
    }
    function setCssFull(on) { cssFull = on; player.classList.toggle('ap-cssfull', on); syncFs(); }
    function lockLandscape() {
      try { if (video && video.videoWidth >= video.videoHeight && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () { }); } catch (e) { }
    }
    function unlockOrientation() { try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { } }
    function enterFs() {
      var req = player.requestFullscreen || player.webkitRequestFullscreen;
      if (req) {
        var r = null;
        try { r = req.call(player); } catch (e) { setCssFull(true); return; }
        if (r && r.then) r.then(function () { lockLandscape(); }, function () { setCssFull(true); });
        else lockLandscape();
      } else if (video && video.webkitEnterFullscreen) video.webkitEnterFullscreen();   // iPhone
      else setCssFull(true);
    }
    function exitFs() {
      if (cssFull) { setCssFull(false); return; }
      var ex = document.exitFullscreen || document.webkitExitFullscreen;
      if (isFs() && ex) { try { var r = ex.call(document); if (r && r.catch) r.catch(function () { }); } catch (e) { } }
      unlockOrientation();
    }
    function toggleFs() { if (isFs() || cssFull) exitFs(); else enterFs(); }
    function onFsChange() { syncFs(); if (!isFs()) unlockOrientation(); }

    // ---------- video element ----------
    function mountVideo(url) {
      video = document.createElement('video');
      video.className = 'ap-video';
      video.playsInline = true; video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', '');
      video.preload = 'auto'; video.controls = false;
      video.setAttribute('controlsList', 'nodownload noremoteplayback');
      video.setAttribute('disablePictureInPicture', ''); video.disableRemotePlayback = true;
      player.insertBefore(video, player.firstChild);
      player.classList.add('ap-custom', 'ap-ui', 'ap-loading');
      var on = function (ev, fn) { video.addEventListener(ev, function () { if (video) fn(); }); };
      on('loadedmetadata', function () { clearTimeout(failT); paint(); setRate(); setVolIcon(); });
      on('durationchange', paint);
      on('timeupdate', function () { paint(); paintBuffer(); });
      on('progress', paintBuffer);
      on('play', function () { setPlayIcons(); showUI(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); });
      on('playing', function () { player.classList.remove('ap-loading'); setPlayIcons(); showUI(); });
      on('pause', function () { setPlayIcons(); showUI(); });
      on('ended', function () { setPlayIcons(); paint(); showUI(); });
      on('waiting', function () { player.classList.add('ap-loading'); });
      on('canplay', function () { player.classList.remove('ap-loading'); });
      on('seeked', function () { player.classList.remove('ap-loading'); paintBuffer(); });
      on('volumechange', setVolIcon);
      on('ratechange', setRate);
      on('error', fail);
      setPlayIcons(); setVolIcon(); setRate(); syncFs();
      failT = setTimeout(function () { if (video && video.readyState < 1) fail(); }, 12000);
      video.src = url;
      var p = video.play();
      if (p && p.catch) p.catch(function () { player.classList.remove('ap-loading'); setPlayIcons(); showUI(); });
    }
    function unmountVideo() {
      clearTimeout(failT); cancelAnimationFrame(raf);
      var v = video; video = null;
      if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { } if (v.parentNode) v.parentNode.removeChild(v); }
      player.classList.remove('ap-custom', 'ap-ui', 'ap-loading', 'ap-paused', 'ap-ended');
    }
    function mountIframe(url) {
      player.classList.remove('ap-loading');
      iframe = el('iframe', 'ap-iframe');
      iframe.src = url; iframe.title = opts.title || 'Video';
      iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media'; iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'no-referrer';
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
      player.insertBefore(iframe, player.firstChild);
      var shield = el('div', 'ap-shield'); shield.setAttribute('aria-hidden', 'true');   // blocks the "open in new tab" button
      player.appendChild(shield);
      player.classList.add('ap-embed');
    }
    function showMsg(t) { player.classList.remove('ap-loading'); msg.textContent = t; msg.hidden = false; }
    function fail() {
      if (closed) return;
      unmountVideo();
      if (opts.iframe && !iframe) mountIframe(opts.iframe);
      else showMsg('This video could not be played. Please check your connection and try again, or message us on WhatsApp.');
    }

    // ---------- video area: tap / click ----------
    tap.addEventListener('pointerdown', function (e) { lastType = e.pointerType || 'mouse'; });
    tap.addEventListener('click', function () {
      if (menu.classList.contains('open')) { menu.classList.remove('open'); showUI(); return; }
      if (lastType === 'mouse') { togglePlay(); showUI(); }
    });
    tap.addEventListener('dblclick', function () { if (lastType === 'mouse') toggleFs(); });
    tap.addEventListener('pointerup', function (e) {
      if ((e.pointerType || 'mouse') === 'mouse') return;
      if (menu.classList.contains('open')) { menu.classList.remove('open'); showUI(); return; }
      var now = Date.now(), r = tap.getBoundingClientRect(), x = e.clientX - r.left;
      if (tapT && now - lastTap < 300) {            // double tap: left = back 10 s, right = forward 10 s, middle = play/pause
        clearTimeout(tapT); tapT = 0; lastTap = 0;
        if (x < r.width / 3) seekBy(-10); else if (x > r.width * 2 / 3) seekBy(10); else togglePlay();
        return;
      }
      lastTap = now;
      tapT = setTimeout(function () { tapT = 0; toggleUI(); }, 260);   // single tap: show / hide controls
    });
    player.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' && video) showUI(); });
    bottom.addEventListener('pointerdown', function () { if (video) showUI(); });

    // ---------- buttons ----------
    center.addEventListener('click', function () { togglePlay(); showUI(); });
    plBtn.addEventListener('click', togglePlay);
    muteBtn.addEventListener('click', function () { if (!video) return; video.muted = !video.muted; if (!video.muted && video.volume === 0) video.volume = 0.6; });
    volr.addEventListener('input', function () { if (!video) return; video.volume = +volr.value; video.muted = (+volr.value === 0); });
    fsBtn.addEventListener('click', function () { toggleFs(); showUI(); });
    speedBtn.addEventListener('click', function () { menu.classList.toggle('open'); showUI(); });
    SPEEDS.forEach(function (sp) {
      var b = el('button', 'ap-mi'); b.type = 'button'; b.setAttribute('role', 'menuitemradio'); b.setAttribute('data-sp', sp);
      b.textContent = sp === 1 ? 'Normal' : sp + 'x';
      b.addEventListener('click', function () { if (video) video.playbackRate = sp; menu.classList.remove('open'); setRate(); showUI(); });
      menu.appendChild(b);
    });

    // ---------- progress bar (mouse + touch scrubbing) ----------
    function posOf(e) { var r = prog.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1))); }
    function scrubTo(e) {
      scrubP = posOf(e);
      var d = (video && video.duration) || 0;
      fill.style.width = (scrubP * 100) + '%'; dot.style.left = (scrubP * 100) + '%';
      timeEl.textContent = fmt(scrubP * d) + ' / ' + fmt(d);
    }
    prog.addEventListener('pointerdown', function (e) {
      if (!video || !isFinite(video.duration)) return;
      scrubbing = true; prog.classList.add('ap-scrub');
      try { prog.setPointerCapture(e.pointerId); } catch (_) { }
      scrubTo(e); showUI();
    });
    prog.addEventListener('pointermove', function (e) { if (scrubbing) scrubTo(e); });
    function endScrub(e, commit) {
      if (!scrubbing) return;
      scrubbing = false; prog.classList.remove('ap-scrub');
      try { prog.releasePointerCapture(e.pointerId); } catch (_) { }
      if (commit && video) { video.currentTime = scrubP * video.duration; }
      paint(); showUI();
    }
    prog.addEventListener('pointerup', function (e) { endScrub(e, true); });
    prog.addEventListener('pointercancel', function (e) { endScrub(e, false); });

    // ---------- keyboard ----------
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var k = e.key;
      if (k === 'Escape') { if (cssFull) setCssFull(false); else if (!isFs()) close(); return; }
      if (!video) return;
      var used = true;
      if (k === ' ' || k === 'k' || k === 'K') togglePlay();
      else if (k === 'ArrowLeft') seekBy(-5);
      else if (k === 'ArrowRight') seekBy(5);
      else if (k === 'j' || k === 'J') seekBy(-10);
      else if (k === 'l' || k === 'L') seekBy(10);
      else if (k === 'f' || k === 'F') toggleFs();
      else if (k === 'm' || k === 'M') { video.muted = !video.muted; }
      else used = false;
      if (used) { e.preventDefault(); showUI(); }
    }

    // ---------- close ----------
    function onPop() { pushed = false; close(true); }
    function close(fromPop) {
      if (closed) return;
      closed = true; current = null;
      clearInterval(wmT); clearTimeout(hideT); clearTimeout(tapT); clearTimeout(failT); cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      window.removeEventListener('popstate', onPop);
      if (isFs()) { var ex = document.exitFullscreen || document.webkitExitFullscreen; try { var r = ex && ex.call(document); if (r && r.catch) r.catch(function () { }); } catch (e) { } }
      unlockOrientation();
      var v = video; video = null;
      if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { } }
      document.documentElement.style.overflow = '';
      if (modal.parentNode) modal.parentNode.removeChild(modal);
      // closed by tap / Esc: drop the history entry we added so the Back button stays in step
      if (pushed && fromPop !== true) { pushed = false; try { history.back(); } catch (e) { } }
    }
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    current = { close: close };

    // ---------- go ----------
    syncFs();
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.documentElement.style.overflow = 'hidden';
    // attach to <html>, not <body>, so no transform/animation on body can offset this fixed overlay
    document.documentElement.appendChild(modal);
    modal.scrollTop = 0;
    // no close button: tap outside the player, press Esc, or use the phone's Back button
    try { history.pushState({ ankaPlayer: 1 }, ''); pushed = true; window.addEventListener('popstate', onPop); } catch (e) { }

    if (opts.src) {
      var s = (typeof opts.src === 'function') ? opts.src() : opts.src;
      Promise.resolve(s).then(function (u) { if (closed) return; if (!u) throw new Error('no url'); mountVideo(u); })
        .catch(function () { if (!closed) fail(); });
    } else if (opts.iframe) mountIframe(opts.iframe);
    else showMsg('This video is not available.');
  }

  window.AnkaPlayer = { open: open };
})();
