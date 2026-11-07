/*
 * MODELOS LOW-POLY
 * Todo se construye con piezas simples (cajas, conos, esferas de pocas caras),
 * como en los juegos de PS1.
 */
const Models = (() => {
  const { M, T } = PS1;
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
  const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);

  // barra entre dos puntos (cuerdas, ramas)
  function rod(a, b, r, mat) {
    const len = a.distanceTo(b);
    const geo = new THREE.CylinderGeometry(r, r, len, 4, 1, true);
    geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.lookAt(b);
    return m;
  }

  // ruido determinista para deformar geometrías sin romper las costuras
  const noise3 = (x, y, z) => {
    const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    return s - Math.floor(s);
  };

  // ---------- naturaleza ----------
  const mats = {};
  function M_(key, o) { return mats[key] || (mats[key] = M(o)); }

  function ground(w, d, seg, opts = {}) {
    const geo = new THREE.PlaneGeometry(w, d, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const flat = opts.flat ? opts.flat(x, z) : 1;
      p.setY(i, (noise3(x * 0.3, 0, z * 0.3) - 0.5) * 0.5 * flat);
    }
    geo.computeVertexNormals();
    return mesh(geo, M_("grass" + (opts.rep || 8), { map: T.grass, repeat: [opts.rep || 8, opts.rep || 8] }));
  }

  function pine(x, z, h = 4, s = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(mesh(new THREE.CylinderGeometry(0.08 * s, 0.16 * s, h * 0.5, 5), M_("bark", { map: T.bark, repeat: [1, 2] }), 0, h * 0.25, 0));
    const needles = M_("needles", { map: T.needles, repeat: [5, 3], wind: 0.04 });
    for (let k = 0; k < 3; k++) {
      const r = (1.1 - k * 0.28) * s * (h / 4);
      const cone = mesh(new THREE.ConeGeometry(r, h * 0.38, 6), needles, 0, h * (0.38 + k * 0.2), 0);
      cone.rotation.y = k * 0.7;
      g.add(cone);
    }
    g.rotation.y = x * 3.1 + z;
    return g;
  }

  function deadTree(x, z, h = 3.5) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const bark = M_("bark", { map: T.bark, repeat: [1, 2] });
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.22, h, 5), bark, 0, h / 2, 0));
    for (let k = 0; k < 4; k++) {
      const y = h * (0.45 + k * 0.13), a = k * 2.1 + x;
      const tip = new THREE.Vector3(Math.cos(a) * 1.1, y + 0.6, Math.sin(a) * 1.1);
      g.add(rod(new THREE.Vector3(0, y, 0), tip, 0.04, bark));
    }
    return g;
  }

  function rock(r = 0.8, seedOff = 0) {
    const geo = new THREE.IcosahedronGeometry(r, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 0.82 + noise3(x + seedOff, y, z) * 0.3;
      x *= n; y *= n; z *= n;
      if (y > r * 0.35) y = r * 0.35 + (y - r * 0.35) * 0.15; // cima plana
      p.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return mesh(geo, M_("rock", { map: T.rock, repeat: [2, 2] }));
  }

  // ---------- Lía ----------
  function girl() {
    const g = new THREE.Group();
    const dress = M({ map: T.dress, repeat: [3, 2] });
    const skin = M({ map: T.skin });
    const hairM = M({ map: T.hair, repeat: [2, 2] });
    const dark = M({ color: 0x241530 });

    const legs = [-1, 1].map(s => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.08, 0.55, 0);
      pivot.add(box(0.09, 0.5, 0.09, skin, 0, -0.25, 0));
      pivot.add(box(0.11, 0.08, 0.16, dark, 0, -0.51, 0.03)); // botas
      g.add(pivot);
      return pivot;
    });
    const body = new THREE.Group();
    g.add(body);
    body.add(mesh(new THREE.CylinderGeometry(0.12, 0.34, 0.64, 6), dress, 0, 0.8, 0));
    body.add(mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.22, 6), dress, 0, 1.2, 0));
    const arms = [-1, 1].map(s => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.17, 1.26, 0);
      pivot.add(box(0.07, 0.42, 0.07, dress, 0, -0.2, 0));
      const hand = box(0.07, 0.08, 0.07, skin, 0, -0.44, 0);
      pivot.add(hand);
      pivot.userData.hand = hand;
      body.add(pivot);
      return pivot;
    });
    const head = new THREE.Group();
    head.position.y = 1.47;
    body.add(head);
    head.add(mesh(new THREE.IcosahedronGeometry(0.16, 1), skin));
    head.add(mesh(new THREE.IcosahedronGeometry(0.18, 1), hairM, 0, 0.04, -0.04));
    head.add(box(0.3, 0.42, 0.08, hairM, 0, -0.2, -0.12)); // melena
    head.add(box(0.28, 0.06, 0.08, hairM, 0, 0.1, 0.11));  // flequillo
    head.add(box(0.035, 0.035, 0.02, dark, -0.06, -0.01, 0.155));
    head.add(box(0.035, 0.035, 0.02, dark, 0.06, -0.01, 0.155));
    // sombra redonda bajo los pies
    const sh = mesh(new THREE.CircleGeometry(0.32, 8), M({ color: 0x0c0414, alpha: 0.6 }), 0, 0.03, 0);
    sh.rotation.x = -Math.PI / 2;
    g.add(sh);

    let phase = 0;
    return {
      group: g, legs, arms, body, head,
      holding: false,
      animate(dt, moving, t) {
        phase += moving ? dt * 9 : 0;
        const sw = moving ? Math.sin(phase) : 0;
        legs[0].rotation.x = sw * 0.6;
        legs[1].rotation.x = -sw * 0.6;
        arms[0].rotation.x = -sw * 0.5;
        arms[1].rotation.x = this.holding ? -1.1 + sw * 0.08 : sw * 0.5;
        body.position.y = moving ? Math.abs(Math.cos(phase)) * 0.04 : Math.sin(t * 1.6) * 0.008;
        head.rotation.y = moving ? 0 : Math.sin(t * 0.4) * 0.25; // mira alrededor
      },
      handPos(v) { return arms[1].userData.hand.getWorldPosition(v); },
    };
  }

  // ---------- rana ----------
  function frog() {
    const g = new THREE.Group();
    const skin = M({ map: T.frog, repeat: [2, 2] });
    const pale = M({ color: 0xb9e6a0 });
    const dark = M({ color: 0x0c0414 });
    const body = mesh(new THREE.IcosahedronGeometry(0.2, 1), skin, 0, 0.13, 0);
    body.scale.set(1.1, 0.7, 1.2);
    g.add(body);
    const throat = mesh(new THREE.IcosahedronGeometry(0.1, 1), pale, 0, 0.09, 0.15);
    g.add(throat);
    [-1, 1].forEach(s => {
      g.add(mesh(new THREE.IcosahedronGeometry(0.07, 0), skin, s * 0.1, 0.25, 0.08));
      g.add(box(0.04, 0.04, 0.02, dark, s * 0.11, 0.27, 0.145));
      const leg = box(0.1, 0.06, 0.24, skin, s * 0.2, 0.05, -0.04);
      leg.rotation.y = s * 0.4;
      g.add(leg);
      g.add(box(0.06, 0.04, 0.1, skin, s * 0.12, 0.03, 0.17));
    });
    let croak = 0;
    return {
      group: g,
      croak() { croak = 1; },
      animate(dt, t) {
        if (croak > 0) croak = Math.max(0, croak - dt * 1.2);
        const auto = (t % 5.3) > 4.8 ? Math.sin(((t % 5.3) - 4.8) / 0.5 * Math.PI) : 0;
        const k = Math.max(Math.sin(croak * Math.PI * 2) * croak, auto);
        throat.scale.setScalar(1 + Math.max(0, k) * 1.2);
        body.scale.y = 0.7 + Math.sin(t * 2.2) * 0.03; // respira
      },
    };
  }

  // ---------- candil ----------
  function candil() {
    const g = new THREE.Group();
    const metal = M({ map: T.metal });
    const glass = M({ color: 0x3a5a3a });
    g.add(mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.05, 6), metal, 0, 0.025, 0));
    const glassM = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.17, 6, 1, true), glass, 0, 0.135, 0);
    g.add(glassM);
    [0, 1, 2].forEach(k => {
      const a = k / 3 * Math.PI * 2;
      g.add(box(0.015, 0.17, 0.015, metal, Math.cos(a) * 0.075, 0.135, Math.sin(a) * 0.075));
    });
    g.add(mesh(new THREE.ConeGeometry(0.1, 0.09, 6), metal, 0, 0.265, 0));
    const ring = mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 8), metal, 0, 0.35, 0);
    g.add(ring);
    const flameMat = M({ map: T.flame, unlit: true });
    const flame = mesh(new THREE.PlaneGeometry(0.07, 0.13), flameMat, 0, 0.13, 0);
    g.add(flame);
    const c = {
      group: g, lit: false, flame,
      setLit(on) {
        c.lit = on;
        flame.visible = on;
        glass.uniforms.uEmissive.value.set(on ? 0x2a6a2a : 0x000000);
        glass.uniforms.uUnlit.value = 0;
      },
      animate(t, camera) {
        flame.quaternion.copy(camera.quaternion);
        const f = 1 + Math.sin(t * 13) * 0.12 + Math.sin(t * 7.3) * 0.1;
        flame.scale.set(1, f, 1);
      },
      lightPos(v) { return flame.getWorldPosition(v); },
    };
    c.setLit(false);
    return c;
  }

  // ---------- cabaña ----------
  function cabin(lit = true) {
    const g = new THREE.Group();
    const logs = M({ map: T.logs, repeat: [3, 2] });
    const W = 5, Hh = 2.6, D = 4;
    g.add(box(W, Hh, D, logs, 0, Hh / 2, 0));
    // tejado: prisma triangular
    const roofGeo = new THREE.CylinderGeometry(2.7, 2.7, W + 0.8, 3, 1);
    roofGeo.rotateZ(Math.PI / 2); roofGeo.rotateX(-Math.PI / 2);
    const roof = mesh(roofGeo, M({ map: T.shingles, repeat: [4, 2] }), 0, Hh + 0.66, 0);
    roof.scale.set(1, 0.5, 1);
    g.add(roof);
    g.add(box(0.5, 1.4, 0.5, M({ map: T.cliff }), 1.3, Hh + 1.2, -0.6)); // chimenea
    const front = D / 2 + 0.02;
    // puerta
    const door = box(0.9, 1.7, 0.06, M({ map: T.door }), 1.2, 0.85, front);
    g.add(door);
    g.add(box(1.3, 0.1, 0.5, M({ map: T.planks }), 1.2, 0.05, front + 0.2)); // escalón
    // ventana
    const glassMat = M({ map: T.glass, unlit: true, color: lit ? 0xffffff : 0x223322 });
    const win = mesh(new THREE.PlaneGeometry(1.1, 0.9), glassMat, -1.1, 1.45, front + 0.01);
    g.add(win);
    const frame = M({ map: T.planks, color: 0x8a6a7a });
    g.add(box(1.3, 0.1, 0.08, frame, -1.1, 1.95, front + 0.03));
    g.add(box(1.3, 0.1, 0.08, frame, -1.1, 0.95, front + 0.03));
    g.add(box(0.1, 1.0, 0.08, frame, -1.7, 1.45, front + 0.03));
    g.add(box(0.1, 1.0, 0.08, frame, -0.5, 1.45, front + 0.03));
    g.add(box(0.06, 0.9, 0.06, frame, -1.1, 1.45, front + 0.03));
    g.add(box(1.1, 0.06, 0.06, frame, -1.1, 1.45, front + 0.03));
    const sill = box(1.5, 0.08, 0.3, frame, -1.1, 0.92, front + 0.13);
    g.add(sill);
    return {
      group: g, door, win, sill, glassMat,
      setLit(on) { glassMat.uniforms.uColor.value.set(on ? 0xffffff : 0x223322); },
      winFront: front,
    };
  }

  // ---------- puente colgante a lo largo del eje Z ----------
  function bridge(z0, z1, width = 1.3) {
    const g = new THREE.Group();
    const plank = M({ map: T.planks, repeat: [2, 1] });
    const rope = M({ color: 0x8a7a6a });
    const post = M({ map: T.bark });
    const len = z0 - z1, n = Math.floor(len / 0.36);
    const missing = new Set([9, 10, 21, 30]);
    for (let i = 0; i < n; i++) {
      if (missing.has(i)) continue;
      const p = box(width, 0.06, 0.28, plank, (noise3(i, 1, 2) - 0.5) * 0.06, -0.03, z0 - 0.18 - i * 0.36);
      p.rotation.y = (noise3(i, 3, 1) - 0.5) * 0.08;
      g.add(p);
    }
    [-1, 1].forEach(s => {
      g.add(box(0.06, 0.08, len, plank, s * (width / 2 + 0.02), -0.08, (z0 + z1) / 2)); // vigas
      const posts = [];
      for (let z = z0; z >= z1 - 0.01; z -= len / 6) posts.push(z);
      posts.forEach(z => g.add(box(0.08, 1.05, 0.08, post, s * (width / 2 + 0.05), 0.45, z)));
      for (let k = 0; k < posts.length - 1; k++) { // pasamanos combado
        const za = posts[k], zb = posts[k + 1], segs = 5;
        for (let j = 0; j < segs; j++) {
          const sa = j / segs, sb = (j + 1) / segs;
          const ya = 0.95 - Math.sin(sa * Math.PI) * 0.18, yb = 0.95 - Math.sin(sb * Math.PI) * 0.18;
          const a = new THREE.Vector3(s * (width / 2 + 0.05), ya, za + (zb - za) * sa);
          const b = new THREE.Vector3(s * (width / 2 + 0.05), yb, za + (zb - za) * sb);
          g.add(rod(a, b, 0.018, rope));
          if (j % 2 === 1) g.add(rod(a, new THREE.Vector3(a.x, -0.05, a.z), 0.01, rope));
        }
      }
    });
    return g;
  }

  // ---------- efectos ----------
  // jirones de niebla: planos con transparencia tramada que derivan despacio
  function fogBanks(n, area, y0 = 0.4, size = 4) {
    const g = new THREE.Group();
    const items = [];
    for (let i = 0; i < n; i++) {
      const m = mesh(new THREE.PlaneGeometry(size * (0.7 + PS1.rnd() * 0.6), size * 0.4), M({ map: T.fog, unlit: true, alpha: 0.9 }));
      m.position.set(area[0] + PS1.rnd() * (area[1] - area[0]), y0 + PS1.rnd() * 0.8, area[2] + PS1.rnd() * (area[3] - area[2]));
      m.userData.speed = 0.15 + PS1.rnd() * 0.2;
      m.userData.x0 = m.position.x;
      m.userData.ph = PS1.rnd() * 10;
      items.push(m);
      g.add(m);
    }
    return {
      group: g,
      animate(t, camera) {
        items.forEach(m => {
          m.quaternion.copy(camera.quaternion);
          const w = area[1] - area[0];
          m.position.x = area[0] + (((m.userData.x0 - area[0] + t * m.userData.speed) % w) + w) % w;
          m.position.y += Math.sin(t * 0.5 + m.userData.ph) * 0.0015;
        });
      },
    };
  }

  // fuegos fatuos
  function wisps(n, center, radius) {
    const g = new THREE.Group();
    const mat = M({ color: 0x8cff6a, unlit: true });
    const items = [];
    for (let i = 0; i < n; i++) {
      const m = mesh(new THREE.OctahedronGeometry(0.06, 0), mat);
      m.userData.ph = i * 1.7;
      items.push(m); g.add(m);
    }
    return {
      group: g,
      animate(t) {
        items.forEach((m, i) => {
          const a = t * (0.3 + i * 0.05) + m.userData.ph;
          m.position.set(center.x + Math.cos(a) * radius * (0.6 + 0.4 * Math.sin(i)),
            center.y + Math.sin(t * 0.8 + i) * 0.4,
            center.z + Math.sin(a * 1.3) * radius * 0.5);
          m.rotation.y = t * 2;
        });
      },
    };
  }

  // nube de mosquitos alrededor de un punto
  function mosquitoes(n) {
    const g = new THREE.Group();
    const mat = M({ color: 0x120818, unlit: true });
    const items = [];
    for (let i = 0; i < n; i++) {
      const m = mesh(new THREE.BoxGeometry(0.05, 0.03, 0.03), mat);
      items.push(m); g.add(m);
    }
    return {
      group: g,
      animate(t, center) {
        items.forEach((m, i) => {
          const a = t * (2.2 + (i % 4) * 0.5) + i * 1.9;
          const r = 0.18 + ((i * 37) % 11) / 30;
          m.position.set(center.x + Math.cos(a) * r + Math.sin(t * 17 + i) * 0.03,
            center.y + Math.sin(a * 1.4 + i) * r * 0.7 + Math.cos(t * 13 + i) * 0.03,
            center.z + Math.sin(a) * r * 0.6);
        });
      },
    };
  }

  // humo de chimenea
  function smoke(origin) {
    const g = new THREE.Group();
    const items = [];
    for (let i = 0; i < 6; i++) {
      const mat = M({ map: T.fog, unlit: true, alpha: 1, color: 0xc0b0d0 });
      const m = mesh(new THREE.PlaneGeometry(0.8, 0.6), mat);
      items.push(m); g.add(m);
    }
    return {
      group: g,
      animate(t, camera) {
        items.forEach((m, i) => {
          const k = (t * 0.18 + i / items.length) % 1;
          m.position.set(origin.x + k * 0.9 + Math.sin(k * 6 + i) * 0.15, origin.y + k * 2.4, origin.z);
          m.scale.setScalar(0.5 + k * 1.3);
          m.material.uniforms.uAlpha.value = (1 - k) * 0.9;
          m.quaternion.copy(camera.quaternion);
        });
      },
    };
  }

  return { mesh, box, rod, ground, pine, deadTree, rock, girl, frog, candil, cabin, bridge, fogBanks, wisps, mosquitoes, smoke };
})();
