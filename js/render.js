/*
 * RENDER 1-BIT
 * Dibujamos en un buffer de 128x96 píxeles donde cada píxel es 0 (morado) o 1 (verde).
 * Encima, una niebla animada hecha con tramado ordenado (Bayer 4x4).
 */
const Render = (() => {
  const W = 128, H = 96;
  const BG = [0x1c, 0x0a, 0x2b];
  const FG = [0x8c, 0xff, 0x6a];

  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(W, H);
  const art = new Uint8Array(W * H);

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

  // ---------- primitivas ----------
  const px = (x, y, v = 1) => {
    x |= 0; y |= 0;
    if (x >= 0 && y >= 0 && x < W && y < H) art[y * W + x] = v;
  };
  const rect = (x, y, w, h, v = 1) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, v);
  };
  const dither = (x, y, w, h, d) => { // rectángulo tramado con densidad d (0..1)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++)
      if (d > bayer(x + i, y + j)) px(x + i, y + j, 1);
  };
  const line = (x0, y0, x1, y1, v = 1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) px(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), v);
  };
  const disc = (cx, cy, r, v = 1) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) px(cx + x, cy + y, v);
  };
  const sprite = (rows, x, y) => {
    rows.forEach((row, j) => [...row].forEach((c, i) => {
      if (c === "#") px(x + i, y + j, 1);
      else if (c === "o") px(x + i, y + j, 0);
    }));
  };
  // números pseudoaleatorios con semilla, para que cada escena sea siempre igual
  const rng = seed => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ---------- elementos ----------
  const GIRL = [
    "..###..",
    ".#####.",
    "##ooo##",
    "##ooo##",
    ".#ooo#.",
    "..#o#..",
    "..###..",
    ".#####.",
    "#.###.#",
    "#.###.#",
    ".#####.",
    "#######",
    "..#.#..",
    "..#.#..",
  ];
  const girl = (x, y) => { rect(x - 1, y - 1, 9, 16, 0); sprite(GIRL, x, y); };

  const lantern = (x, y, lit, t) => {
    rect(x, y, 3, 1); rect(x - 1, y + 1, 5, 4);
    if (lit) {
      rect(x, y + 2, 3, 2, 0);
      px(x + 1, y + 2 + (Math.sin(t * 8) > 0 ? 0 : 1), 1);
    }
  };

  const tree = (x, ground, w, top, r, near) => {
    if (near) rect(x, top, w, ground - top);
    else dither(x, top, w, ground - top, 0.5);
    // ramas
    for (let k = 0; k < 3; k++) {
      const by = top + 6 + r() * (ground - top - 20);
      const dir = r() > 0.5 ? 1 : -1;
      const len = 4 + r() * 8;
      const sx = dir > 0 ? x + w : x - 1;
      line(sx, by, sx + dir * len, by - len * 0.6);
    }
  };

  const forest = (seed, count, ground) => {
    const r = rng(seed);
    for (let i = 0; i < count; i++) { // árboles lejanos
      tree(r() * W, ground - 4, 2 + (r() * 2 | 0), 0, r, false);
    }
    for (let i = 0; i < count / 2; i++) { // árboles cercanos
      const x = r() * W;
      if (x > 50 && x < 74) continue; // deja hueco para la niña
      tree(x, ground + 2, 3 + (r() * 4 | 0), 0, r, true);
    }
  };

  const groundLine = (y, seed) => {
    const r = rng(seed);
    for (let x = 0; x < W; x++) {
      px(x, y);
      if (r() > 0.7) px(x, y - 1); // hierba
      if (r() > 0.85) px(x, y - 2);
    }
  };

  const wisps = (t, cx, cy, n, spread) => {
    for (let i = 0; i < n; i++) {
      const a = t * (0.5 + i * 0.13) + i * 2.1;
      const x = cx + Math.cos(a) * spread * (0.6 + 0.4 * Math.sin(i));
      const y = cy + Math.sin(a * 1.3) * spread * 0.4;
      rect(x, y, 2, 2);
      if (Math.sin(t * 5 + i) > 0.3) px(x - 1, y + 2);
    }
  };

  // ---------- ilustraciones ----------
  const ARTS = {
    claro(t, f) {
      disc(100, 16, 7); disc(103, 14, 6, 0); // luna
      forest(7, 14, 72);
      groundLine(72, 3);
      girl(60, 57);
      lantern(52, 66, f.farol, t);
    },
    bosque(t) {
      forest(21, 26, 78);
      groundLine(78, 9);
      girl(60, 63);
    },
    fuegos(t, f) {
      forest(33, 16, 76);
      groundLine(76, 4);
      wisps(t, 64, 40, 7, 34);
      girl(60, 61);
      lantern(70, 70, f.farol, t);
    },
    puente(t) {
      groundLine(60, 5);
      rect(0, 61, 30, 35, 0); rect(98, 61, 30, 35, 0);
      dither(0, 61, 30, 35, 0.25); dither(98, 61, 30, 35, 0.25);
      rect(30, 61, 68, 35, 0); // barranco
      // cuerdas y tablas
      for (let x = 30; x <= 98; x++) {
        const s = Math.sin((x - 30) / 68 * Math.PI) * 6;
        px(x, 50 + s);
        if (x % 3 === 0) { px(x, 60 + s); px(x, 61 + s); }
        if (x % 10 === 0) line(x, 50 + s, x, 60 + s);
      }
      // cabaña al fondo
      rect(104, 44, 16, 12); rect(105, 45, 14, 10, 0);
      line(102, 44, 112, 36); line(112, 36, 122, 44);
      rect(108, 48, 4, 4);
      girl(14, 45);
    },
    lago(t) {
      disc(64, 14, 6);
      forest(55, 10, 50);
      groundLine(50, 8);
      rect(0, 52, W, 44, 0);
      for (let y = 55; y < 96; y += 5) { // ondas
        const off = (t * 6 + y * 3) % 12;
        for (let x = -12; x < W; x += 12) line(x + off, y, x + off + 3, y);
      }
      // reflejo de la luna temblando
      for (let k = 0; k < 6; k++) {
        const w = 8 - k + Math.round(Math.sin(t * 3 + k) * 2);
        line(64 - w / 2, 58 + k * 3, 64 + w / 2, 58 + k * 3);
      }
      girl(44, 36);
    },
    cabana(t, f) {
      groundLine(80, 2);
      rect(28, 40, 72, 40); rect(30, 42, 68, 38, 0); // muros
      line(22, 40, 64, 14); line(64, 14, 106, 40); line(23, 40, 64, 15); line(64, 15, 105, 40);
      rect(40, 52, 16, 14); rect(42, 54, 12, 10, 0); // ventana
      rect(47, 54, 2, 10); rect(42, 58, 12, 2);
      if (f.farol) { rect(43, 55, 4, 3); rect(49, 55, 4, 3); }
      rect(70, 54, 14, 26); rect(72, 56, 10, 24, 0); px(80, 68); // puerta
      wisps(t, 64, 30, 2, 50);
    },
    oscuro(t) {
      // casi nada: solo ojos que buscan y un brillo lejano
      for (let i = 0; i < 4; i++) {
        const x = 20 + i * 28 + Math.sin(t + i) * 6;
        if (Math.sin(t * 1.7 + i * 2) > -0.6) { px(x, 30 + i * 5); px(x + 4, 30 + i * 5); }
      }
      if (Math.sin(t * 2) > 0) dither(0, 88, W, 8, 0.12);
      sprite(GIRL.map(r => r.replace(/o/g, ".")), 60, 60);
    },
    luz(t) {
      const r = 30 + Math.sin(t) * 3;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - 64, y - 48) / (r * 2);
        if (1 - d > bayer(x, y)) px(x, y);
      }
      girl(60, 41);
    },
    niebla(t) {
      dither(0, 0, W, H, 0.3);
      girl(60, 50);
    },
  };

  // ---------- niebla ----------
  function fog(t, level, clear) {
    for (let y = 0; y < H; y++) {
      const low = y / H; // más niebla abajo
      for (let x = 0; x < W; x++) {
        let n = Math.sin(x * 0.06 + t * 0.35) * Math.cos(y * 0.09 - t * 0.25)
              + 0.6 * Math.sin((x + y) * 0.045 - t * 0.6)
              + 0.4 * Math.sin(x * 0.17 - y * 0.05 + t * 0.9);
        let d = level * (0.12 + 0.45 * low * low + 0.16 * n);
        if (clear) { // el farol aparta la niebla
          const dist = Math.hypot(x - clear.x, (y - clear.y) * 1.3);
          d *= Math.min(1, dist / clear.r);
        }
        if (d > bayer(x, y)) art[y * W + x] = 1;
      }
    }
  }

  // ---------- bucle ----------
  let current = null, flags = {}, start = performance.now(), last = 0;
  const LANTERN_POS = { claro: { x: 54, y: 68 }, fuegos: { x: 72, y: 72 } };

  function draw(now) {
    requestAnimationFrame(draw);
    if (now - last < 50) return; // ~20 fps: suficiente y ahorra batería
    last = now;
    if (!current) return;
    const t = (now - start) / 1000;
    art.fill(0);
    (ARTS[current.art] || ARTS.niebla)(t, flags);
    const lp = flags.farol && LANTERN_POS[current.art];
    fog(t, current.fog ?? 0.5, lp ? { ...lp, r: 26 } : null);
    const d = img.data;
    for (let i = 0; i < art.length; i++) {
      const c = art[i] ? FG : BG;
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  requestAnimationFrame(draw);

  return {
    show(scene, f) { current = scene; flags = f; },
  };
})();
