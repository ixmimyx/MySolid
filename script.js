(function () {
  var root = document.getElementById("ampRoot");
  var $ = function (s) { return root.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var mmss = function (s) { return !isFinite(s) || s < 0 ? "0:00" : Math.floor(s / 60) + ":" + pad(Math.floor(s % 60)); };

  var days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var mons = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function tick() {
    var d = new Date();
    $("#ampTime").textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    $("#ampDate").textContent = days[d.getDay()] + " " + pad(d.getDate()) + " " + mons[d.getMonth()] + " " + d.getFullYear();
  }
  tick(); setInterval(tick, 1000);

  var THEMES = ["navy","steel","teal","olive","sage","brick","coffee","tan","charcoal"];
  var BW = ["black","white"];
  var app = $(".app"), darkBtn = $("#ampDark");

  var TCOL = ["bg","bg2","panel","card","card2","text","muted","accent","onAccent","border",
              "hover","glow","glow2","acc2","hi","lo","shine","drop","frame","frameShade","online"];
  TCOL.forEach(function (n) {
    try { CSS.registerProperty({name:"--" + n, syntax:"<color>", inherits:true, initialValue:"rgba(0,0,0,0)"}); } catch (e) {}
  });
  function setTheme(k, animate, remember) {

    if (animate === false) {
      root.style.transition = "none";
      root.setAttribute("data-theme", k);
      void root.offsetWidth;
      root.style.transition = "";
    } else {
      root.setAttribute("data-theme", k);
    }
    if (remember !== false) { try { localStorage.setItem("ampTheme", k); } catch (e) {} }
  }
  function saved() {

    var t = "black";
    try { t = localStorage.getItem("ampTheme") || t; } catch (e) {}
    return THEMES.indexOf(t) >= 0 ? t : "black";
  }

  var bw = "";
  try { var d = localStorage.getItem("ampDark"); bw = BW.indexOf(d) >= 0 ? d : ""; } catch (e) {}
  function syncDarkBtn() {
    darkBtn.classList.toggle("on", !!bw);
    darkBtn.innerHTML = "<i></i> " + (bw === "black" ? "Light" : "Dark");
  }

  var start = bw || saved();
  if (!bw && BW.indexOf(start) >= 0) bw = start;
  setTheme(start, false, false);
  syncDarkBtn();
  var switching = false;
  $("#ampClr").addEventListener("click", function () {
    if (switching) return;
    switching = true;
    setTimeout(function () { switching = false; }, 520);
    var base = bw ? saved() : root.getAttribute("data-theme");
    if (THEMES.indexOf(base) < 0) base = saved();

    if (bw) {
      bw = "";
      try { localStorage.setItem("ampDark", "0"); } catch (e) {}
      syncDarkBtn();
    }
    setTheme(THEMES[(THEMES.indexOf(base) + 1) % THEMES.length], true);
  });
  darkBtn.addEventListener("click", function () {
    if (switching) return;
    switching = true;
    setTimeout(function () { switching = false; }, 520);

    bw = (bw === "black") ? "white" : "black";
    try { localStorage.setItem("ampDark", bw); } catch (e) {}
    syncDarkBtn();
    setTheme(bw, true, false);
  });

  var stage = $(".stage"), wrap = $("#ampWrap");
  function fit() {
    var w = app.offsetWidth || 1010, h = app.offsetHeight || 1173;

    var k = (stage.clientWidth - 24) / w;
    if (window.innerWidth > 900) k = Math.min(k, (window.innerHeight * 1.35) / h);
    k = Math.max(.2, Math.min(k, 1.6));
    root.style.setProperty("--k", k.toFixed(4));
    wrap.style.height = Math.round(h * k) + "px";
  }
  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("load", fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(fit);
    ro.observe(stage); ro.observe(app);
  }

  var curView = "about";
  function swap(v) {
    $$(".view").forEach(function (s) {
      s.classList.remove("on");
      if (s.id === "ampV-" + v) { void s.offsetWidth; s.classList.add("on"); }
    });
    $$(".nav>button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-v") === v); });
    curView = v;
    fit();
    syncLTrack();
  }
  function show(v) {
    if (v === curView) { $$(".nav>button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-v") === v); }); return; }
    var d = $(".disp");
    d.classList.add("fade");
    setTimeout(function () { swap(v); d.classList.remove("fade"); }, 300);
  }
  $$(".nav>button").forEach(function (b) {
    b.addEventListener("click", function () { show(b.getAttribute("data-v")); });
  });

  var list = $("#ampList");
  var rows = $$("#ampList .tr");
  var order = rows.slice();
  var audio = new Audio();
  var idx = -1, shuffle = false, repeat = false, total = 0;
  var VOL = function () { var v = $("#ampVol"); return v ? Number(v.value) : .8; };
  function wireAudio(el) {
    el.addEventListener("timeupdate", function () {
      if (el !== audio || scrubbing) return;
      var t = el.duration || 0, f = t ? el.currentTime / t : 0;
      $("#ampBar").style.width = (f * 100) + "%";
      $("#ampNow").textContent = mmss(el.currentTime) + " / " + mmss(t);
      bars.forEach(function (b, n) { b.classList.toggle("past", (n / bars.length) < f); });
    });
    el.addEventListener("ended", function () { if (el === audio) { repeat ? play(rows[idx]) : step(1); } });
    el.addEventListener("play", function () { if (el === audio) { $("#ampWave").classList.add("live"); $("#ampDisc").classList.add("live"); $("#ampEqv").classList.add("live"); icon(); } });
    el.addEventListener("pause", function () { if (el === audio) { $("#ampWave").classList.remove("live"); $("#ampDisc").classList.remove("live"); $("#ampEqv").classList.remove("live"); icon(); } });
  }
  wireAudio(audio);

  rows.forEach(function (r, i) {
    r.style.setProperty("--i", i);
    r.querySelector(".num").textContent = pad(i + 1);
    r.addEventListener("click", function (e) { if (!e.target.closest(".src")) play(r); });
    r.querySelector(".src").addEventListener("click", function (e) { e.preventDefault(); play(r); });
    var probe = new Audio(); probe.preload = "metadata";
    probe.addEventListener("loadedmetadata", function () {
      r.querySelector(".du").textContent = mmss(probe.duration);
      r.setAttribute("data-sec", Math.round(probe.duration));
      total += Math.round(probe.duration);
      $("#ampTotal").textContent = Math.floor(total / 3600) + "h " + Math.round((total % 3600) / 60) + "m";
    });
    probe.src = r.querySelector(".src").href;
  });
  $("#ampCount").textContent = rows.length;
  $("#ampFr").textContent = $$(".fCard").length;

  function play(r) {
    if (!r) return;
    idx = rows.indexOf(r);
    var url = r.querySelector(".src").href;
    audio.volume = VOL();
    audio.src = url;
    audio.play().catch(function () {});
    var art = r.querySelector(".art").getAttribute("src");
    if (art) { $("#ampCover").setAttribute("src", art); } else { $("#ampCover").removeAttribute("src"); }
    $("#ampTitle").textContent = r.querySelector(".mt b").textContent;
    $("#ampArtist").textContent = r.querySelector(".mt small").textContent;
    rows.forEach(function (x) { x.classList.toggle("playing", x === r); });
    icon();
  }
  function current() { return rows; }
  function icon() {
    $("#ampPlay").innerHTML = audio.paused
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>';
  }
  function step(d) {
    var vis = current(); if (!vis.length) return;
    var i = vis.indexOf(rows[idx]);
    var n = shuffle ? Math.floor(Math.random() * vis.length) : (i < 0 ? 0 : (i + d + vis.length) % vis.length);
    play(vis[n]);
  }

  $("#ampPlay").addEventListener("click", function () {
    if (idx < 0) { play(current()[0]); return; }
    audio.paused ? audio.play() : audio.pause();
  });
  $("#ampPrev").addEventListener("click", function () { step(-1); });
  $("#ampNext").addEventListener("click", function () { step(1); });
  $("#ampShuf").addEventListener("click", function () { shuffle = !shuffle; this.classList.toggle("on", shuffle); });
  $("#ampRep").addEventListener("click", function () { repeat = !repeat; this.classList.toggle("on", repeat); });
  $("#ampRand").addEventListener("click", function () { var v = current(); play(v[Math.floor(Math.random() * v.length)]); });
  $("#ampStop").addEventListener("click", function () {
    if (!audio.paused) { audio.pause(); audio.currentTime = 0; }
    icon();
  });
  $("#ampVol").addEventListener("input", function () {
    audio.volume = Number(this.value);
  });

  var bars = [];
  (function () {
    var w = $("#ampWave"), seed = 7;
    for (var i = 0; i < 64; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      var b = document.createElement("b");
      var base = 22 + (seed / 233280) * 78;
      var taper = 0.55 + 0.45 * Math.sin((i / 63) * Math.PI);
      b.style.setProperty("--h", Math.round(base * taper) + "%");
      b.style.animationDelay = (i % 8) * 0.09 + "s";
      w.appendChild(b); bars.push(b);
    }
  })();

  var scrubbing = false;
  function fracAt(e, box) {
    var r = box.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  }
  function paintSeek(f) {
    var d = audio.duration || 0;
    $("#ampBar").style.width = (f * 100) + "%";
    bars.forEach(function (b, n) { b.classList.toggle("past", (n / bars.length) < f); });
    $("#ampNow").textContent = mmss(f * d) + " / " + mmss(d);
  }
  function bindSeek(box) {
    box.addEventListener("pointerdown", function (e) {
      if (idx < 0 || !(audio.duration > 0)) return;
      e.preventDefault();
      try { box.setPointerCapture(e.pointerId); } catch (err) {}
      scrubbing = true;
      var jump = function (ev) { audio.currentTime = fracAt(ev, box) * audio.duration; };
      paintSeek(fracAt(e, box)); jump(e);
      var move = function (ev) { paintSeek(fracAt(ev, box)); };
      var end = function (ev) {
        box.removeEventListener("pointermove", move);
        box.removeEventListener("pointerup", end);
        box.removeEventListener("pointercancel", end);
        jump(ev);
        setTimeout(function () { scrubbing = false; }, 260);
      };
      box.addEventListener("pointermove", move);
      box.addEventListener("pointerup", end);
      box.addEventListener("pointercancel", end);
    });
  }
  bindSeek($(".np .bar"));
  bindSeek($("#ampWave"));

  var asc = {};
  $$("[data-sort]").forEach(function (b) {
    b.addEventListener("click", function () {
      var k = b.getAttribute("data-sort");
      $$("[data-sort]").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      asc[k] = !asc[k];
      var arr = order.slice();
      if (k === "title") arr.sort(function (a, c) {
        var t = a.querySelector(".mt b").textContent.localeCompare(c.querySelector(".mt b").textContent);
        return asc[k] ? t : -t;
      });
      else if (k === "dur") arr.sort(function (a, c) {
        var t = (Number(a.getAttribute("data-sec")) || 0) - (Number(c.getAttribute("data-sec")) || 0);
        return asc[k] ? t : -t;
      });
      arr.forEach(function (r, i) { list.appendChild(r); r.querySelector(".num").textContent = pad(i + 1); });
      rows = arr;
    });
  });

  var ltrack = $("#ampLTrack"), lthumb = $("#ampLTrack i");
  function syncLTrack() {
    var full = list.scrollHeight - list.clientHeight;
    if (full <= 4) { ltrack.classList.remove("show"); return; }
    ltrack.classList.add("show");
    var th = Math.max(28, ltrack.clientHeight * (list.clientHeight / list.scrollHeight));
    var p = Math.max(0, Math.min(1, list.scrollTop / full));
    lthumb.style.height = th + "px";
    lthumb.style.transform = "translateY(" + p * (ltrack.clientHeight - th) + "px)";
  }
  list.addEventListener("scroll", syncLTrack);
  window.addEventListener("resize", syncLTrack);
  new ResizeObserver(syncLTrack).observe(list);
  syncLTrack();

  var tiles = $$("#ampGrid .tile");
  tiles.forEach(function (t, i) {
    t.style.setProperty("--i", i);
    var vid = t.querySelector("video"), img = t.querySelector("img");
    if (vid) {
      t.addEventListener("click", function () { vid.paused ? vid.play().catch(function(){}) : vid.pause(); });
      t.addEventListener("mouseenter", function () { vid.play().catch(function(){}); });
      t.addEventListener("mouseleave", function () { vid.pause(); });
    } else if (img) {
      img.addEventListener("click", function () {
        $("#ampZoom").querySelector("img").src = img.getAttribute("data-full") || img.src;
        $("#ampZoom").classList.add("on");
      });
    }
  });

  var reels = $$("#ampGrid .rl");
  reels.forEach(function (c) {
    var yt = c.getAttribute("data-yt");
    if (yt) {
      c.addEventListener("click", function () {
        var z = $("#ampZoom"), zy = $("#ampZoomY");
        z.classList.remove("on"); z.classList.remove("vid");
        zy.src = "https://www.youtube-nocookie.com/embed/" + yt + "?autoplay=1&rel=0";
        z.classList.add("yt");
        void z.offsetWidth;
        z.classList.add("on");
      });
      return;
    }
    var v = c.querySelector("video");
    if (!v) return;
    c.addEventListener("mouseenter", function () { v.play().catch(function () {}); });
    c.addEventListener("mouseleave", function () { v.pause(); });
    v.addEventListener("pause", function () { v.currentTime = 0; });
    c.addEventListener("click", function () {
      var z = $("#ampZoom"), zv = $("#ampZoomV");
      v.pause();
      zv.src = v.getAttribute("src");
      zv.poster = v.getAttribute("poster") || "";
      zv.muted = false;
      z.classList.remove("on");
      z.classList.add("vid");
      void z.offsetWidth;
      z.classList.add("on");
      zv.play().catch(function () { zv.muted = true; zv.play().catch(function () {}); });
    });
  });
  function closeZoom() {
    var z = $("#ampZoom"), zv = $("#ampZoomV"), zy = $("#ampZoomY");
    zv.pause();
    z.classList.remove("on"); z.classList.remove("vid"); z.classList.remove("yt");
    zv.removeAttribute("src"); zv.load();
    zy.src = "about:blank";
  }
  $("#ampZoom").addEventListener("click", function (e) {
    var t = e.target.tagName;
    if (t === "IMG" || t === "VIDEO" || t === "IFRAME") return;
    closeZoom();
  });

  $$("#ampRoot .picwrap img, #ampRoot .me .av img").forEach(function (img) {
    img.addEventListener("click", function () {
      $("#ampZoom").querySelector("img").src = img.getAttribute("data-full") || img.src;
      $("#ampZoom").classList.add("on");
    });
  });
  $$("[data-f]").forEach(function (b) {
    b.addEventListener("click", function () {
      $$("[data-f]").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      var f = b.getAttribute("data-f");
      tiles.forEach(function (t) {
        var isReel = !!t.querySelector("video");
        t.style.display = (f === "all" || (f === "reel") === isReel) ? "" : "none";
      });
      var tray = $("#ampGrid .reels");
      if (tray) tray.style.display = (f === "photo") ? "none" : "";
    });
  });

  $$(".soc a").forEach(function (a) {
    var link = a.getAttribute("href");
    if (!link) {
      a.classList.add("wait");
      a.addEventListener("click", function (e) { e.preventDefault(); });
      return;
    }
    a.target = "_blank";
    a.rel = "noopener";
  });

  (function () {
    var box = $("#ampSnow"), stage = $(".stage");
    var n = box.hasAttribute("data-count") ? Math.max(0, Number(box.getAttribute("data-count")) || 0) : 40;
    var base = Number(box.getAttribute("data-speed")) || 16;
    function size() { box.style.setProperty("--dist", (stage.offsetHeight + 60) + "px"); }
    for (var i = 0; i < n; i++) {
      var f = document.createElement("i");
      var big = i % 4 === 0;
      f.style.setProperty("--x", (Math.random() * 100).toFixed(2) + "%");
      f.style.setProperty("--sz", (big ? 7 + Math.random() * 7 : 2.5 + Math.random() * 3.5).toFixed(1) + "px");
      f.style.setProperty("--o", (big ? 0.10 + Math.random() * 0.12 : 0.28 + Math.random() * 0.42).toFixed(2));
      f.style.setProperty("--bl", (big ? 2 + Math.random() * 2.5 : 0.2) + "px");
      f.style.setProperty("--d", (base * (0.6 + Math.random() * 1.1)).toFixed(1) + "s");
      f.style.setProperty("--dl", (-Math.random() * base * 2).toFixed(1) + "s");
      f.style.setProperty("--sw", (8 + Math.random() * 26).toFixed(0) + "px");
      f.style.setProperty("--c", i % 3 === 0 ? "var(--accent)" : "var(--text)");
      box.appendChild(f);
    }
    size();
    window.addEventListener("resize", size);
  })();

  show("about");
  fit();
})();
