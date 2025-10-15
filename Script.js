// Rockets that precisely reach the pointer (click) position and explode there.
// Save as script.js

(() => {
  const canvas = document.getElementById("fireworks");
  const ctx = canvas.getContext("2d");
  let W, H, DPR;

  function resize() {
    DPR = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  const rockets = [];
  const particles = [];
  const colors = [
    "#ff4d4d", "#ffd166", "#06d6a0", "#118ab2", "#9b6bff", "#ff6bf5", "#ffffff"
  ];

  // physics
  const gravity = 0.12; // stronger gravity to feel natural
  const friction = 0.995;

  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));

  function hexToRgba(hex, alpha = 1) {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  class Particle {
    constructor(x, y, vx, vy, color, size, life, flicker = false) {
      this.x = x; this.y = y;
      this.vx = vx; this.vy = vy;
      this.color = color; this.size = size;
      this.life = life; this.age = 0;
      this.flicker = flicker;
      this.trail = []; this.maxTrail = 6;
    }
    update() {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrail) this.trail.shift();
      this.vx *= friction; this.vy *= friction;
      this.vy += gravity * 0.45;
      this.x += this.vx; this.y += this.vy;
      this.age++;
    }
    draw(ctx) {
      const alpha = Math.max(0, 1 - this.age / this.life);
      ctx.beginPath();
      const flick = this.flicker && Math.random() > 0.6 ? 0.6 : 1;
      ctx.fillStyle = hexToRgba(this.color, alpha * flick);
      ctx.arc(this.x, this.y, Math.max(0.6, this.size * alpha), 0, Math.PI*2);
      ctx.fill();

      // trail
      for (let i = 0; i < this.trail.length; i++) {
        const t = this.trail[i];
        ctx.beginPath();
        ctx.fillStyle = hexToRgba(this.color, alpha * (i/this.trail.length) * 0.5);
        ctx.arc(t.x, t.y, Math.max(0.3, this.size * 0.6), 0, Math.PI*2);
        ctx.fill();
      }
      // glow
      ctx.beginPath();
      ctx.fillStyle = hexToRgba(this.color, alpha * 0.12);
      ctx.arc(this.x, this.y, this.size * 4 * alpha, 0, Math.PI*2);
      ctx.fill();
    }
    isDead() { return this.age >= this.life; }
  }

  class Rocket {
    // startX, startY (bottom), targetX/Y (pointer). travelFrames determines initial vx, vy so it reaches target.
    constructor(startX, startY, targetX, targetY, color) {
      this.x = startX; this.y = startY;
      this.tx = targetX; this.ty = targetY;
      this.color = color;
      this.size = 3 + Math.random() * 1.6;
      this.trail = [];
      this.maxTrail = 10;
      this.exploded = false;

      // choose travel time (frames) — shorter for nearby clicks, longer for far ones
      const dist = Math.hypot(this.tx - this.x, this.ty - this.y);
      // base frames proportional to distance, clamp for variability
      const baseFrames = Math.min(Math.max(Math.round(dist / 6), 28), 120);
      // add small randomness
      this.frames = baseFrames + randInt(-8, 14);

      // Solve for initial velocities considering constant gravity:
      // y(t) = y0 + vy * t + 0.5 * g * t^2  => vy = (y_target - y0 - 0.5*g*t^2)/t
      // x(t) = x0 + vx * t => vx = (x_target - x0)/t
      // We'll use gravity variable 'gravity' (per frame).
      const t = this.frames;
      // add a tiny horizontal offset randomness so rocket is not perfectly straight
      const wobble = rand(-8, 8);
      const adjTx = this.tx + wobble;

      this.vx = (adjTx - this.x) / t;
      this.vy = (this.ty - this.y - 0.5 * gravity * t * t) / t;

      // Slight extra tilt randomness so each rocket is unique
      this.vx += rand(-0.4, 0.4);
      this.vy += rand(-0.6, 0.6);

      this.age = 0;
    }

    update() {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrail) this.trail.shift();

      this.x += this.vx;
      this.y += this.vy;
      // apply gravity to vy (so path curves naturally)
      this.vy += gravity * 0.45;

      this.age++;
      // explode exactly when we've reached or passed travel frames OR are within small distance of target
      const close = Math.hypot(this.x - this.tx, this.y - this.ty) < 6;
      if (this.age >= this.frames || close) {
        this.explode();
        this.exploded = true;
      }
    }

    draw(ctx) {
      // rocket head
      ctx.beginPath();
      ctx.fillStyle = this.color;
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();

      // bright tail/flare
      ctx.beginPath();
      ctx.fillStyle = hexToRgba('#fff', 0.9);
      ctx.arc(this.x - this.vx*1.6, this.y - this.vy*1.6, Math.max(0.8, this.size*0.8), 0, Math.PI*2);
      ctx.fill();

      // trail line
      ctx.beginPath();
      ctx.strokeStyle = hexToRgba(this.color, 0.6);
      ctx.lineWidth = 2;
      for (let i = 0; i < this.trail.length - 1; i++) {
        const p1 = this.trail[i];
        const p2 = this.trail[i+1];
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      }
      ctx.stroke();
    }

    explode() {
      // Larger explosion with variation
      const count = randInt(140, 240); // big explosion
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        // radial speed distribution (some fast, many medium)
        const speed = rand(0.8, 8) * (Math.random() < 0.28 ? rand(1.2,1.6) : 1);
        const vx = Math.cos(angle) * speed + rand(-0.6, 0.6);
        const vy = Math.sin(angle) * speed + rand(-0.6, 0.6);
        const color = colors[randInt(0, colors.length - 1)];
        const size = rand(0.9, 3.0);
        const life = randInt(60, 140);
        const flick = Math.random() < 0.33;
        particles.push(new Particle(this.x, this.y, vx, vy, color, size, life, flick));
      }

      // a few comet-like streaks
      const comets = randInt(8, 18);
      for (let i = 0; i < comets; i++) {
        const angle = (Math.random() * Math.PI * 2);
        const sp = rand(4.5, 10);
        particles.push(new Particle(this.x, this.y, Math.cos(angle) * sp, Math.sin(angle) * sp, '#fff', rand(1.6, 3.2), randInt(36, 80), false));
      }
    }
  }

  // background stars (mild)
  const stars = [];
  (function initStars(){
    const starCount = Math.floor((window.innerWidth * window.innerHeight) / 10000);
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight * 0.6,
        r: Math.random() * 1.2 + 0.2,
        a: Math.random() * 0.8 + 0.15,
        tw: Math.random() * 200 + 80
      });
    }
  })();

  function drawBackground() {
    // fade previous frame slightly to create trails
    ctx.fillStyle = 'rgba(3,3,12,0.22)';
    ctx.fillRect(0, 0, W, H);

    // stars
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const a = s.a * (0.6 + 0.4 * Math.sin((Date.now() / s.tw) + i));
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${a * 0.6})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    drawBackground();

    ctx.globalCompositeOperation = 'lighter';

    // rockets
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.update();
      r.draw(ctx);
      if (r.exploded) rockets.splice(i, 1);
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.update();
      p.draw(ctx);
      if (p.isDead()) particles.splice(i, 1);
    }

    ctx.globalCompositeOperation = 'source-over';
  }
  animate();

  // click handler: launch rocket from bottom center-ish to exact pointer
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const tx = e.clientX - rect.left;
    const ty = e.clientY - rect.top;
    // startX: allow start near bottom but slightly random
    const sx = Math.min(Math.max(tx + rand(-90, 90), 24), W - 24); // horizontal start near pointer +/- 90px
    const sy = H + rand(6, 18); // slightly below bottom for nicer entry
    const color = colors[randInt(0, colors.length - 1)];
    rockets.push(new Rocket(sx, sy, tx, ty, color));
  }, { passive: true });

  // support touch (tap)
  canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    if (!e.touches || !e.touches[0]) return;
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const tx = t.clientX - rect.left;
    const ty = t.clientY - rect.top;
    const sx = Math.min(Math.max(tx + rand(-90, 90), 24), W - 24);
    const sy = H + rand(6, 18);
    const color = colors[randInt(0, colors.length - 1)];
    rockets.push(new Rocket(sx, sy, tx, ty, color));
  }, { passive: false });

})();
