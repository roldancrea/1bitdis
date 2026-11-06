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

  // Lía vista de espaldas (para escenas en perspectiva)
  const GIRL_BACK = [
    "..###..",
    ".#####.",
    "#######",
    "#######",
    "#######",
    ".##.##.",
    "..###..",
    ".#####.",
    "#.###.#",
    "#.###.#",
    ".#####.",
    "#######",
    "..#.#..",
    "..#.#..",
  ];
  const girlBack = (x, y) => { rect(x - 1, y - 1, 9, 16, 0); sprite(GIRL_BACK, x, y); };

  // triángulo relleno (punta arriba): copas de pino, tejados
  const tri = (cx, top, h, halfW, v = 1) => {
    for (let j = 0; j <= h; j++) {
      const hw = Math.round(halfW * j / h);
      for (let i = -hw; i <= hw; i++) px(cx + i, top + j, v);
    }
  };

  const pine = (cx, base, h, solid) => {
    const w = h * 0.32;
    for (let k = 0; k < 3; k++) { // tres pisos de ramas
      const top = base - h + k * h * 0.25;
      if (solid) tri(cx, top, h * 0.4, w * (0.6 + k * 0.2));
      else for (let j = 0; j <= h * 0.4; j++) {
        const hw = Math.round(w * (0.6 + k * 0.2) * j / (h * 0.4));
        for (let i = -hw; i <= hw; i++) if (0.45 > bayer(cx + i, top + j)) px(cx + i, top + j);
      }
    }
    rect(cx - 1, base - 3, 2, 3);
  };

  const smoke = (x, y, t) => {
    for (let i = 0; i < 6; i++) {
      const k = (t * 0.6 + i / 6) % 1; // cada voluta sube y se deshace
      const sx = x + Math.sin(k * 6 + i) * 3 + k * 6;
      const sy = y - k * 18;
      const r = 1 + Math.round(k * 2);
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++)
        if (a * a + b * b <= r * r && (1 - k) * 0.9 > bayer(sx + a, sy + b)) px(sx + a, sy + b);
    }
  };

  // cabaña de troncos vista de frente. (cx, base) = centro del suelo; s = escala
  const cabin = (cx, base, s, lit, t) => {
    const w = Math.round(34 * s), h = Math.round(20 * s);
    const x0 = cx - (w >> 1), y0 = base - h;
    // chimenea (detrás del tejado)
    const chx = cx + Math.round(9 * s);
    rect(chx, y0 - Math.round(14 * s), Math.max(2, Math.round(4 * s)), Math.round(10 * s));
    smoke(chx + Math.round(2 * s) - 1, y0 - Math.round(15 * s), t);
    // muros de troncos
    rect(x0, y0, w, h);
    for (let y = y0 + 2; y < base; y += Math.max(2, Math.round(3 * s))) {
      line(x0 + 1, y, x0 + w - 2, y, 0);
      px(x0, y, 0); px(x0 + w - 1, y, 0); // puntas de los troncos
    }
    // tejado
    const roofH = Math.round(16 * s), over = Math.round(4 * s);
    tri(cx, y0 - roofH, roofH, (w >> 1) + over);
    for (let j = 3; j < roofH; j += Math.max(2, Math.round(3 * s))) { // tejas
      const hw = Math.round(((w >> 1) + over) * j / roofH);
      for (let i = -hw + 1; i < hw; i++) if ((i + j * 2) % 6 === 0) px(cx + i, y0 - roofH + j, 0);
      line(cx - hw + 1, y0 - roofH + j, cx + hw - 1, y0 - roofH + j, 0);
      for (let i = -hw + 1; i < hw; i += 4) px(cx + i + (j & 2), y0 - roofH + j, 1);
    }
    // ventana
    const ww = Math.round(9 * s), wh = Math.round(8 * s);
    const wx = x0 + Math.round(5 * s), wy = y0 + Math.round(5 * s);
    rect(wx - 1, wy - 1, ww + 2, wh + 2, 0);
    if (lit) {
      rect(wx, wy, ww, wh);
      line(wx + (ww >> 1), wy, wx + (ww >> 1), wy + wh - 1, 0);
      line(wx, wy + (wh >> 1), wx + ww - 1, wy + (wh >> 1), 0);
      if (Math.sin(t * 7) > 0.6) px(wx + 1, wy + 1, 0); // parpadeo de la llama
    } else {
      line(wx + (ww >> 1), wy, wx + (ww >> 1), wy + wh - 1);
      line(wx, wy + (wh >> 1), wx + ww - 1, wy + (wh >> 1));
    }
    rect(wx - 2, wy + wh + 1, ww + 4, 1); // alféizar
    // puerta
    const dw = Math.round(8 * s), dh = Math.round(13 * s);
    const dx = x0 + w - Math.round(14 * s), dy = base - dh;
    rect(dx - 1, dy - 1, dw + 2, dh + 1, 0);
    rect(dx, dy, dw, dh);
    for (let i = dx + 2; i < dx + dw - 1; i += 3) line(i, dy + 1, i, base - 1, 0); // tablones
    px(dx + dw - 2, dy + (dh >> 1), 0); // pomo
    // escalón
    line(dx - 2, base, dx + dw + 1, base);
  };

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
      // Perspectiva frontal: el puente se aleja hacia el punto de fuga (64, HZ)
      const HZ = 40, F = 56;           // horizonte y "distancia focal"
      const Z_FAR = 9;                 // donde termina el puente
      const yAt = z => HZ + F / z;     // altura en pantalla del tablero a distancia z
      const hwAt = z => 34 / z;        // medio ancho del puente
      const ropeAt = z => HZ + 28 / z; // altura del pasamanos

      disc(22, 12, 5); disc(24, 11, 4, 0); // luna menguante
      // pinos del otro lado, lejos (tramados) y cerca (sólidos)
      [[8, 46, 20], [18, 47, 26], [104, 46, 22], [116, 47, 28], [124, 46, 18]].forEach(([x, b, h]) => pine(x, b, h, false));
      [[34, 48, 24], [92, 48, 26]].forEach(([x, b, h]) => pine(x, b, h, true));
      // borde del acantilado lejano
      const r = rng(12);
      for (let x = 0; x < W; x++) { const e = 47 + (r() * 2 | 0); line(x, 46, x, e); }
      cabin(64, 46, 0.72, true, t);

      // tablones: espaciado uniforme en el mundo, que en pantalla se aprieta al fondo
      const r2 = rng(5);
      for (let z = 1; z <= Z_FAR; z += 0.32) {
        const y = Math.round(yAt(z)), hw = Math.round(hwAt(z));
        const thick = Math.max(1, Math.round(3 / z));
        const missing = z > 1.8 && z < 6 && r2() > 0.86; // algunos tablones faltan
        if (missing) continue;
        for (let k = 0; k < thick; k++) line(64 - hw, y - k, 64 + hw, y - k);
        if (z < 3) px(64 - hw + 3 + (r2() * (hw * 2 - 6) | 0), y, 0); // vetas
      }
      // vigas laterales del tablero
      line(64 - hwAt(1), yAt(1), 64 - hwAt(Z_FAR), yAt(Z_FAR));
      line(64 + hwAt(1), yAt(1), 64 + hwAt(Z_FAR), yAt(Z_FAR));

      // postes y pasamanos de cuerda, que se combean entre postes
      const posts = [1, 1.6, 2.4, 3.6, 5.4, Z_FAR];
      posts.forEach((z, i) => {
        const w = Math.max(1, Math.round(3.5 / z));
        [-1, 1].forEach(side => {
          const x = Math.round(64 + side * hwAt(z));
          rect(side < 0 ? x - w + 1 : x, Math.round(ropeAt(z)), w, Math.round(yAt(z) - ropeAt(z)) + 1);
          if (i === 0) return;
          const z0 = posts[i - 1];
          for (let s = 0; s <= 1; s += 0.02) {
            const zz = z0 + (z - z0) * s;
            const sag = Math.sin(s * Math.PI) * 6 / zz;
            const rx = 64 + side * hwAt(zz), ry = ropeAt(zz) + sag;
            px(rx, ry);
            if (zz < 2.4) px(rx, ry + 1);
            // cuerdas verticales entre pasamanos y tablero
            if (Math.abs(s - 0.5) < 0.011 || Math.abs(s - 0.25) < 0.011 || Math.abs(s - 0.75) < 0.011)
              for (let y = ry; y < yAt(zz); y += 2) px(rx, y);
          }
        });
      });

      // barranco: paredes de roca tramadas a ambos lados en primer plano
      for (let y = 60; y < H; y++) {
        const edge = (y - 60) * 0.35;
        dither(0, y, Math.max(0, 8 - edge), 1, 0.6);
        dither(W - Math.max(0, 8 - edge), y, 8, 1, 0.6);
      }

      girlBack(61, 74);
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
      disc(108, 12, 5);
      [[6, 82, 40], [20, 80, 30], [112, 82, 44], [124, 80, 30]].forEach(([x, b, h]) => pine(x, b, h, false));
      groundLine(84, 2);
      cabin(64, 84, 2.1, f.farol, t);
      // senda de piedras hasta la puerta
      [[74, 88], [71, 91], [76, 94]].forEach(([x, y]) => { rect(x, y, 4, 2); px(x + 1, y, 0); });
      wisps(t, 64, 26, 2, 54);
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
  const LANTERN_POS = { claro: { x: 54, y: 68 }, fuegos: { x: 72, y: 72 }, cabana: { x: 48, y: 60 } };

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
