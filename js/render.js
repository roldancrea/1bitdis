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


  // invierte un píxel: los mosquitos se ven tanto sobre verde como sobre morado
  const inv = (x, y) => {
    x |= 0; y |= 0;
    if (x >= 0 && y >= 0 && x < W && y < H) art[y * W + x] ^= 1;
  };

  // halo de luz tramado: solo ilumina el fondo (lo morado)
  const glow = (cx, cy, R, strength, t, box) => {
    const flick = 0.92 + 0.08 * Math.sin(t * 9) * Math.sin(t * 4.3);
    for (let y = Math.max(0, cy - R | 0); y < Math.min(H, cy + R); y++)
      for (let x = Math.max(0, cx - R | 0); x < Math.min(W, cx + R); x++) {
        if (box && (x < box[0] || y < box[1] || x > box[2] || y > box[3])) continue;
        const d = Math.hypot(x - cx, (y - cy) * 1.1) / R;
        if (d < 1 && art[y * W + x] === 0 && strength * flick * Math.pow(1 - d, 1.6) > bayer(x, y))
          art[y * W + x] = 1;
      }
  };

  // candil grande (primer plano). (cx, base) = centro de la base
  const bigCandil = (cx, base, lit, t) => {
    rect(cx - 8, base - 26, 17, 27, 0);                 // contorno morado para separarlo del fondo
    disc(cx, base - 22, 3); disc(cx, base - 22, 1, 0);  // asa
    rect(cx - 1, base - 19, 3, 3);                      // cuello
    for (let j = 0; j < 4; j++) rect(cx - 1 - j, base - 16 + j, 3 + 2 * j, 1); // sombrerete
    rect(cx - 6, base - 12, 13, 1);                     // aro superior
    rect(cx - 6, base - 12, 1, 10); rect(cx + 6, base - 12, 1, 10); // varillas del cristal
    rect(cx - 6, base - 3, 13, 3);                      // base
    line(cx - 4, base - 2, cx + 4, base - 2, 0);
    px(cx - 6, base - 1, 0); px(cx + 6, base - 1, 0);
    if (lit) { // llama que tiembla
      const h = 6 + Math.round(Math.sin(t * 11) + Math.sin(t * 6.7));
      const sway = Math.round(Math.sin(t * 5) * 0.8);
      for (let j = 0; j < h; j++) {
        const k = j / h; // 0 = punta
        const hw = k < 0.3 ? 0 : k < 0.7 ? 1 : 2;
        rect(cx - hw + (k < 0.5 ? sway : 0), base - 4 - h + j, hw * 2 + 1, 1);
      }
      px(cx, base - 5, 0); // mecha dentro de la llama
    } else {
      rect(cx, base - 6, 1, 2); // mecha apagada
    }
  };

  // roca de cima plana. (cx, top) = centro de la cima
  const rock = (cx, top, w, h, seed) => {
    const rx = w / 2, ry = h * 0.62, cy = top + h * 0.38;
    const r = rng(seed);
    for (let y = top; y < top + h; y++)
      for (let x = cx - rx; x <= cx + rx; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        const edge = 1 + Math.sin(x * 0.9 + seed) * 0.04 + Math.sin(y * 1.3) * 0.03;
        if (dx * dx + dy * dy > edge) continue;
        const shade = dx * 0.55 + dy * 0.7; // sombra abajo a la derecha
        px(x, y, (shade - 0.15) * 1.4 > bayer(x | 0, y) ? 0 : 1);
      }
    for (let k = 0; k < 3; k++) { // grietas
      let x = cx - rx * 0.6 + r() * rx * 1.2, y = top + 3 + r() * h * 0.3;
      for (let s = 0; s < 6; s++) {
        const nx = x + (r() * 4 - 2), ny = y + 1 + r() * 2;
        line(x, y, nx, ny, 0); x = nx; y = ny;
      }
    }
    for (let x = cx - rx * 0.8; x < cx + rx * 0.8; x += 2) // musgo
      if (r() > 0.4) { px(x, top - 1); if (r() > 0.6) px(x + 1, top - 2); }
  };

  // rana de frente, con parpadeo y buche que se infla al croar
  const FROG = [
    "..ooo.....ooo..",
    ".o###o...o###o.",
    ".o#o#ooooo#o#o.",
    "o#############o",
    "o#ooooooooooo#o",
    "o#############o",
    "o##o#######o##o",
    "o#oo#######oo#o",
    "o#o.ooooooo.o#o",
    "ooo.........ooo",
  ];
  const FROG_BLINK = FROG.map((row, j) => j === 2 ? ".o###ooooo###o." : row);
  const frog = (x, y, t, s = 2) => {
    const blink = (t % 3.7) < 0.18;
    (blink ? FROG_BLINK : FROG).forEach((row, j) => [...row].forEach((c, i) => {
      if (c === "#") rect(x + i * s, y + j * s, s, s, 1);
      else if (c === "o") rect(x + i * s, y + j * s, s, s, 0);
    }));
    if ((t % 4.6) > 3.9) { // croac: el buche se infla
      const k = Math.sin(((t % 4.6) - 3.9) / 0.7 * Math.PI);
      const r = Math.round((1 + k * 2) * s / 1.5);
      const cx = x + 7.5 * s, cy = y + 6.5 * s;
      disc(cx, cy, r + 1, 0); disc(cx, cy, r, 1);
    }
  };

  // nube de mosquitos zumbando alrededor de una luz
  const mosquitoes = (t, cx, cy, n, spread) => {
    for (let i = 0; i < n; i++) {
      const a = t * (1.7 + (i % 4) * 0.45) + i * 1.9;
      const r = spread * (0.45 + ((i * 37) % 11) / 20);
      const x = cx + Math.cos(a) * r + Math.sin(t * 13 + i) * 1.5;
      const y = cy + Math.sin(a * 1.31 + i) * r * 0.7 + Math.cos(t * 11 + i * 2) * 1.5;
      const up = ((t * 24) | 0) % 2 === i % 2; // aleteo
      rect(x - 2, y - 2, 5, 4, 0);
      px(x, y); px(x + 1, y);
      if (up) { px(x - 1, y - 1); px(x + 2, y - 1); } else { px(x - 1, y + 1); px(x + 2, y + 1); }
    }
  };

  // ---------- ilustraciones ----------
  const ARTS = {
    claro(t, f) {
      disc(100, 16, 7); disc(103, 14, 6, 0); // luna
      forest(7, 14, 72);
      groundLine(72, 3);
      girl(60, 57);
      rock(53, 69, 16, 6, 9);
      lantern(52, 63, f.candil, t);
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
      lantern(70, 70, f.candil, t);
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
      cabin(64, 84, 2.1, f.candil, t);
      if (f.candil) mosquitoes(t, 48, 60, 7, 16);
      // senda de piedras hasta la puerta
      [[74, 88], [71, 91], [76, 94]].forEach(([x, y]) => { rect(x, y, 4, 2); px(x + 1, y, 0); });
      wisps(t, 64, 26, 2, 54);
    },
    candil(t, f) {
      forest(44, 6, 74);
      groundLine(80, 6);
      if (f.candil) glow(50, 47, 36, 0.5, t);
      rock(62, 60, 72, 28, 3);
      bigCandil(48, 60, f.candil, t);
      frog(66, 40, t);
      mosquitoes(t, 48, 40, 3, 18);
    },
    ventana(t, f) {
      // pared de troncos
      rect(0, 0, W, H);
      const r = rng(8);
      for (let y = 5; y < H; y += 6) {
        line(0, y, W - 1, y, 0);
        for (let x = 0; x < W; x += 1) if (r() > 0.93) px(x, y + 2 + (r() * 2 | 0), 0); // vetas
      }
      rect(0, 0, W, 4, 0); for (let x = 0; x < W; x += 4) rect(x, 3, 2, 2); // alero
      // ventana
      rect(25, 11, 79, 68, 0);
      rect(26, 12, 77, 66);
      rect(30, 16, 69, 58, 0);                    // cristal
      glow(46, 62, 40, 0.6, t, [30, 16, 98, 73]);
      dither(68, 16, 30, 27, 0.18);               // cortina rota al fondo
      for (let y = 16; y < 43; y += 3) px(70 + (y % 7), y, 0);
      line(34, 32, 42, 24, 0); line(34, 36, 46, 24, 0); // reflejos
      rect(63, 16, 3, 58); rect(30, 43, 69, 3);   // marco en cruz
      bigCandil(46, 73, true, t);
      rect(20, 78, 89, 4); line(20, 82, 108, 82, 0); // alféizar
      px(30, 79, 0); px(72, 80, 0);
      mosquitoes(t, 48, 52, 11, 30);
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
  // Se calcula sobre la pantalla (no sobre el dibujo). ox/oy desplazan la niebla
  // más despacio que la escena: eso da sensación de profundidad (parallax).
  function fog(buf, t, level, clear, ox, oy) {
    for (let y = 0; y < H; y++) {
      const low = y / H; // más niebla abajo
      const fy = y + oy;
      for (let x = 0; x < W; x++) {
        const fx = x + ox;
        let n = Math.sin(fx * 0.06 + t * 0.35) * Math.cos(fy * 0.09 - t * 0.25)
              + 0.6 * Math.sin((fx + fy) * 0.045 - t * 0.6)
              + 0.4 * Math.sin(fx * 0.17 - fy * 0.05 + t * 0.9);
        let d = level * (0.12 + 0.45 * low * low + 0.16 * n);
        if (clear) { // el candil aparta la niebla
          const dist = Math.hypot(x - clear.x, (y - clear.y) * 1.3);
          d *= Math.min(1, dist / clear.r);
        }
        if (d > bayer(x, y)) buf[y * W + x] = 1;
      }
    }
  }

  // ---------- cámara ----------
  // Cada ilustración tiene un plano: la cámara va de "from" a "to" (centro x, y y zoom)
  // durante "dur" segundos. Después respira suavemente. Zoom 1 = escena completa.
  const SHOTS = {
    claro:  { from: { x: 60, y: 64, z: 1.7 }, to: { x: 64, y: 50, z: 1.08 }, dur: 7 },  // de Lía al bosque
    bosque: { from: { x: 64, y: 40, z: 1.08 }, to: { x: 64, y: 66, z: 1.45 }, dur: 9 }, // el bosque se cierra
    fuegos: { from: { x: 40, y: 50, z: 1.4 }, to: { x: 76, y: 52, z: 1.2 }, dur: 8 },   // traveling lateral
    puente: { from: { x: 64, y: 70, z: 1.05 }, to: { x: 64, y: 40, z: 1.7 }, dur: 11 }, // avanzar hacia la cabaña
    lago:   { from: { x: 64, y: 24, z: 1.5 }, to: { x: 60, y: 58, z: 1.12 }, dur: 8 },  // de la luna al agua
    cabana: { from: { x: 64, y: 52, z: 1.02 }, to: { x: 50, y: 58, z: 1.55 }, dur: 10 },// hacia la ventana
    candil:  { from: { x: 48, y: 46, z: 2.0 }, to: { x: 62, y: 54, z: 1.1 }, dur: 8 },   // de la llama a la roca y la rana
    ventana: { from: { x: 64, y: 48, z: 1.0 }, to: { x: 52, y: 54, z: 1.3 }, dur: 12 },  // acercarse al candil
    oscuro: { from: { x: 64, y: 48, z: 1.3 }, to: { x: 64, y: 56, z: 1.1 }, dur: 9 },
    luz:    { from: { x: 64, y: 48, z: 2.0 }, to: { x: 64, y: 48, z: 1.0 }, dur: 7 },   // zoom out, liberación
    niebla: { from: { x: 64, y: 54, z: 1.0 }, to: { x: 64, y: 56, z: 1.7 }, dur: 12 },  // la niebla la engulle
  };
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ease = k => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, k)));

  function camera(art, st, t) {
    const shot = SHOTS[art] || SHOTS.niebla;
    if (reduceMotion) return { x: 64, y: 48, z: 1 };
    const k = ease(st / shot.dur);
    let x = shot.from.x + (shot.to.x - shot.from.x) * k;
    let y = shot.from.y + (shot.to.y - shot.from.y) * k;
    let z = shot.from.z + (shot.to.z - shot.from.z) * k;
    // respiración: un leve vaivén, como cámara en mano
    x += Math.sin(t * 0.31) * 1.6;
    y += Math.cos(t * 0.23) * 1.1;
    z *= 1 + 0.025 * Math.sin(t * 0.4);
    z = Math.max(1, z);
    const hw = W / z / 2, hh = H / z / 2; // no salirse del dibujo
    x = Math.min(W - hw, Math.max(hw, x));
    y = Math.min(H - hh, Math.max(hh, y));
    return { x, y, z };
  }

  // ---------- bucle ----------
  const screen = new Uint8Array(W * H);
  const prev = new Uint8Array(W * H);
  const TRANSITION = 0.7; // segundos del fundido tramado entre escenas
  let current = null, flags = {}, start = performance.now(), last = 0, sceneStart = 0;
  const LANTERN_POS = { claro: { x: 54, y: 66 }, fuegos: { x: 72, y: 72 }, cabana: { x: 48, y: 60 }, candil: { x: 48, y: 50 }, ventana: { x: 46, y: 62 } };

  function draw(now) {
    requestAnimationFrame(draw);
    if (now - last < 33) return; // ~30 fps
    last = now;
    if (!current) return;
    const t = (now - start) / 1000;
    const st = t - sceneStart;

    // 1. dibujar la escena completa
    art.fill(0);
    (ARTS[current.art] || ARTS.niebla)(t, flags);

    // 2. encuadrar con la cámara (vecino más cercano: se mantiene 1-bit)
    const cam = camera(current.art, st, t);
    const left = cam.x - W / cam.z / 2, top = cam.y - H / cam.z / 2;
    for (let y = 0; y < H; y++) {
      const sy = Math.min(H - 1, (top + (y + 0.5) / cam.z) | 0) * W;
      for (let x = 0; x < W; x++) {
        screen[y * W + x] = art[sy + Math.min(W - 1, (left + (x + 0.5) / cam.z) | 0)];
      }
    }

    // 3. niebla por encima, con parallax
    const lp = flags.candil && LANTERN_POS[current.art];
    const clear = lp ? { x: (lp.x - left) * cam.z, y: (lp.y - top) * cam.z, r: 26 * cam.z } : null;
    fog(screen, t, current.fog ?? 0.5, clear, left * 0.5, top * 0.5);

    // 4. fundido tramado desde la escena anterior
    if (st < TRANSITION) {
      const k = st / TRANSITION;
      for (let i = 0; i < screen.length; i++)
        if (bayer(i % W, (i / W) | 0) > k) screen[i] = prev[i];
    } else {
      prev.set(screen);
    }

    const d = img.data;
    for (let i = 0; i < screen.length; i++) {
      const c = screen[i] ? FG : BG;
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  requestAnimationFrame(draw);

  return {
    show(scene, f) {
      // si cambia la ilustración, la cámara empieza su plano y se hace el fundido
      if (!current || current.art !== scene.art) sceneStart = (performance.now() - start) / 1000;
      current = scene; flags = f;
    },
  };
})();
