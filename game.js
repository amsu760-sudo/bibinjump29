(() => {
  "use strict";

  // ---------- config (edit freely) ----------
  const W = 360, H = 640;
  const GROUND_H = 90;
  const GRAVITY = 1500, FLAP = -430, SPEED = 150;
  const PIPE_W = 64, GAP = 158, PIPE_EVERY = 205;
  const BIRD_W = 70;
  const UNLOCKS = [
    { score: 5,  src: "assets/photo1.jpg" },
    { score: 12, src: "assets/photo2.jpg" },
  ];
  const ROASTS = [
    "AYYO! 😭",
    "POTTA MYRE!",
    "PIPE ADICHU POYI",
    "KALI PADIKK MYRE",
    "ITHOKKE ENTHU?",
    "NEE OOMBI MYRE",
    "WING ONDU, KARYAM ILLA",
    "PINNEYUM THOTTU!",
  ];

  // ---------- elements ----------
  const $ = (id) => document.getElementById(id);
  const canvas = $("game"), ctx = canvas.getContext("2d");
  const wrap = $("wrap");
  const startEl = $("start"), overEl = $("over"), hud = $("hud");
  const scoreEl = $("score"), toast = $("toast"), gallery = $("gallery");
  const lightbox = $("lightbox");

  // crisp rendering on retina
  const DPR = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.scale(DPR, DPR);

  // ---------- assets ----------
  const birdImg = new Image(); birdImg.src = "assets/bird.png";
  const overSound = new Audio("assets/gameover.mp3");
  overSound.preload = "auto";

  // tiny flap blip via WebAudio
  let actx = null;
  function blip() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(520, actx.currentTime);
      o.frequency.exponentialRampToValueAtTime(900, actx.currentTime + 0.08);
      g.gain.setValueAtTime(0.06, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.1);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + 0.1);
    } catch (e) {}
  }

  // ---------- storage (safe) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  let best = store.get("fb_best", 0);
  let unlocked = store.get("fb_unlocked", []);

  // ---------- state ----------
  let state = "ready"; // ready | playing | dead
  let bird, pipes, clouds, score, groundX, lastPipeX, deadAt, bob;

  function reset() {
    bird = { x: 100, y: H / 2 + 20, vy: 0, rot: 0 };
    pipes = []; score = 0; groundX = 0; lastPipeX = W + 120; bob = 0;
    if (!clouds) {
      clouds = Array.from({ length: 5 }, (_, i) => ({
        x: Math.random() * W, y: 40 + Math.random() * 260, s: 0.6 + Math.random() * 0.8,
      }));
    }
    scoreEl.textContent = "0";
  }

  function spawnPipe(x) {
    const min = 90, max = H - GROUND_H - GAP - 90;
    pipes.push({ x, top: min + Math.random() * (max - min), passed: false });
  }

  function flap() {
    bird.vy = FLAP;
    blip();
  }

  function start() {
    state = "playing";
    startEl.hidden = true; hud.hidden = false;
    flap();
  }

  function die() {
    if (state === "dead") return;
    state = "dead"; deadAt = performance.now();
    wrap.classList.remove("shake"); void wrap.offsetWidth; wrap.classList.add("shake");
    try { overSound.currentTime = 0; overSound.play().catch(() => {}); } catch (e) {}
    if (score > best) { best = score; store.set("fb_best", best); }
    $("finalScore").textContent = score;
    $("bestScore").textContent = best;
    $("overMsg").textContent = ROASTS[Math.floor(Math.random() * ROASTS.length)];
    renderGallery();
    hud.hidden = true; toast.hidden = true;
    setTimeout(() => { if (state === "dead") overEl.hidden = false; }, 550);
  }

  function retry() {
    try { overSound.pause(); overSound.currentTime = 0; } catch (e) {}
    overEl.hidden = true; lightbox.hidden = true;
    reset();
    state = "ready";
    startEl.hidden = false;
  }

  // ---------- unlocks ----------
  function renderGallery() {
    gallery.innerHTML = "";
    UNLOCKS.forEach((u, i) => {
      const d = document.createElement("div");
      if (unlocked.includes(i)) {
        d.className = "thumb";
        d.innerHTML = '<img alt="unlocked photo">';
        d.firstChild.src = u.src;
        d.onclick = (e) => { e.stopPropagation(); lightbox.querySelector("img").src = u.src; lightbox.hidden = false; };
      } else {
        d.className = "thumb locked";
        d.innerHTML = "🔒<br>SCORE<br>" + u.score;
      }
      gallery.appendChild(d);
    });
  }

  function checkUnlock() {
    UNLOCKS.forEach((u, i) => {
      if (score >= u.score && !unlocked.includes(i)) {
        unlocked.push(i); store.set("fb_unlocked", unlocked);
        toast.textContent = "📸 UGLY PHOTO " + (i + 1) + " UNLOCKED! (see after you die)";
        toast.hidden = false;
        toast.style.animation = "none"; void toast.offsetWidth; toast.style.animation = "";
        setTimeout(() => { toast.hidden = true; }, 2200);
      }
    });
  }

  // ---------- update ----------
  function update(dt) {
    clouds.forEach((c) => { c.x -= 12 * c.s * dt; if (c.x < -80) { c.x = W + 40; c.y = 40 + Math.random() * 260; } });

    if (state === "ready") {
      bob += dt * 5;
      bird.y = H / 2 + 20 + Math.sin(bob) * 8;
      groundX = (groundX - SPEED * dt) % 24;
      return;
    }

    if (state === "playing") {
      groundX = (groundX - SPEED * dt) % 24;
      bird.vy += GRAVITY * dt;
      bird.y += bird.vy * dt;
      bird.rot = Math.max(-0.45, Math.min(1.2, bird.vy / 650));

      lastPipeX -= SPEED * dt;
      if (lastPipeX <= W + PIPE_W) { spawnPipe(W + PIPE_W); lastPipeX = W + PIPE_W + PIPE_EVERY; }
      pipes.forEach((p) => { p.x -= SPEED * dt; });
      pipes = pipes.filter((p) => p.x > -PIPE_W - 10);

      // score
      pipes.forEach((p) => {
        if (!p.passed && p.x + PIPE_W < bird.x - 10) { p.passed = true; score++; scoreEl.textContent = score; checkUnlock(); }
      });

      // collisions (circle on the face vs rects)
      const cx = bird.x + 4, cy = bird.y, r = 17;
      if (cy + r >= H - GROUND_H) { bird.y = H - GROUND_H - r; die(); }
      if (cy - r < -60) { bird.y = -60 + r; bird.vy = 0; }
      for (const p of pipes) {
        if (hitRect(cx, cy, r, p.x, 0, PIPE_W, p.top) || hitRect(cx, cy, r, p.x, p.top + GAP, PIPE_W, H)) { die(); break; }
      }
    } else if (state === "dead") {
      // fall to the ground, spinning
      if (bird.y < H - GROUND_H - 17) {
        bird.vy += GRAVITY * dt; bird.y += bird.vy * dt; bird.rot = Math.min(bird.rot + 6 * dt, 1.6);
        if (bird.y > H - GROUND_H - 17) bird.y = H - GROUND_H - 17;
      }
    }
  }

  function hitRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw)), ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  // ---------- draw ----------
  function drawCloud(c) {
    ctx.fillStyle = "rgba(255,255,255,.9)";
    const u = 14 * c.s;
    ctx.fillRect(c.x, c.y + u, u * 5, u * 1.4);
    ctx.fillRect(c.x + u, c.y, u * 2, u * 2.4);
    ctx.fillRect(c.x + u * 2.6, c.y + u * 0.4, u * 2, u * 2);
  }

  function drawPipe(x, y, w, h, capAtBottom) {
    if (h <= 0) return;
    ctx.fillStyle = "#000"; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = "#5ac02c"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#9ce659"; ctx.fillRect(x + 4, y, 8, h);
    ctx.fillStyle = "#3d8f1c"; ctx.fillRect(x + w - 12, y, 8, h);
    // cap
    const ch = 26, cy = capAtBottom ? y + h - ch : y;
    ctx.fillStyle = "#000"; ctx.fillRect(x - 6, cy - 2, w + 12, ch + 4);
    ctx.fillStyle = "#5ac02c"; ctx.fillRect(x - 4, cy, w + 8, ch);
    ctx.fillStyle = "#9ce659"; ctx.fillRect(x, cy, 8, ch);
    ctx.fillStyle = "#3d8f1c"; ctx.fillRect(x + w - 8, cy, 8, ch);
  }

  function draw() {
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#4ec0ca"); g.addColorStop(1, "#b8ecf0");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    clouds.forEach(drawCloud);

    // distant city/hills strip
    ctx.fillStyle = "#8fd8a0";
    for (let i = 0; i < 12; i++) {
      const h = 30 + ((i * 37) % 40);
      ctx.fillRect(i * 32, H - GROUND_H - h, 32, h);
    }

    pipes.forEach((p) => {
      drawPipe(p.x, 0, PIPE_W, p.top, true);
      drawPipe(p.x, p.top + GAP, PIPE_W, H - GROUND_H - (p.top + GAP), false);
    });

    // ground
    ctx.fillStyle = "#ded895"; ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
    ctx.fillStyle = "#000"; ctx.fillRect(0, H - GROUND_H, W, 3);
    ctx.fillStyle = "#73bf2e"; ctx.fillRect(0, H - GROUND_H + 3, W, 14);
    ctx.fillStyle = "#9ce659";
    for (let x = groundX - 24; x < W + 24; x += 24) {
      ctx.beginPath(); ctx.moveTo(x, H - GROUND_H + 3); ctx.lineTo(x + 12, H - GROUND_H + 3);
      ctx.lineTo(x + 24, H - GROUND_H + 17); ctx.lineTo(x + 12, H - GROUND_H + 17); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "#c9b96a"; ctx.fillRect(0, H - GROUND_H + 17, W, 4);

    // the legend himself
    if (birdImg.complete && birdImg.naturalWidth) {
      const bw = BIRD_W, bh = BIRD_W * birdImg.naturalHeight / birdImg.naturalWidth;
      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.rotate(bird.rot);
      // wing flaps a bit with a squash
      const sq = state === "playing" && bird.vy < 0 ? 1.06 : 1;
      ctx.scale(sq, 1 / sq);
      ctx.drawImage(birdImg, -bw / 2, -bh / 2, bw, bh);
      ctx.restore();
    } else {
      ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(bird.x, bird.y, 17, 0, 7); ctx.fill();
    }
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    update(dt); draw();
    requestAnimationFrame(frame);
  }

  // ---------- input ----------
  function press(e) {
    if (e) e.preventDefault();
    if (!lightbox.hidden) { lightbox.hidden = true; return; }
    if (state === "ready") start();
    else if (state === "playing") flap();
    else if (state === "dead" && overEl.hidden === false && performance.now() - deadAt > 900) { /* use the button */ }
  }

  wrap.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#over") || e.target.closest("#lightbox")) return;
    press(e);
  });
  lightbox.addEventListener("pointerdown", (e) => { e.stopPropagation(); lightbox.hidden = true; });
  $("retry").addEventListener("click", retry);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      if (state === "dead") { if (!overEl.hidden && performance.now() - deadAt > 900) retry(); }
      else press();
    } else if (e.code === "Enter" && state === "dead" && !overEl.hidden) retry();
  });

  reset();
  requestAnimationFrame(frame);
})();
