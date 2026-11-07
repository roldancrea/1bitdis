/*
 * MOTOR GRÁFICO "PS1"
 * Imita las limitaciones de la PlayStation original:
 *  - resolución baja (320x240) ampliada sin suavizar
 *  - vértices que "tiemblan" al ajustarse a una rejilla
 *  - texturas deformadas (mapeado afín, sin corrección de perspectiva)
 *  - luz por vértice (Gouraud), color reducido con tramado
 *  - niebla de distancia
 */
const PS1 = (() => {
  const RW = 320, RH = 240;

  // ---------- paleta ----------
  const P = {
    night: "#1c0a2b", plum: "#3b1d52", mauve: "#6a3f86", lilac: "#9b77b5", pale: "#d9c8e8",
    moss0: "#10291b", moss1: "#2f6b3a", moss2: "#5fae4c", neon: "#8cff6a",
    bark: "#2a1a33", wood: "#5a3a4a", wood2: "#7a5466",
  };
  const FOG = new THREE.Color("#2d1d3d");

  // ---------- uniformes compartidos por todos los materiales ----------
  const U = {
    uTime: { value: 0 },
    uSnap: { value: new THREE.Vector2(RW / 2, RH / 2) }, // rejilla del temblor de vértices
    uAmbient: { value: new THREE.Color(0.46, 0.4, 0.56) },
    uDirDir: { value: new THREE.Vector3(0.4, -1, -0.3).normalize() },
    uDirCol: { value: new THREE.Color(0.42, 0.46, 0.56) }, // luna
    uPLPos: { value: new THREE.Vector3(0, -99, 0) },          // luz del candil
    uPLCol: { value: new THREE.Color(0, 0, 0) },
    uPLRange: { value: 7 },
    uFogCol: { value: FOG.clone() },
    uFogNear: { value: 3 },
    uFogFar: { value: 16 },
  };

  const VS = `
    uniform vec2 uSnap; uniform vec3 uAmbient, uDirDir, uDirCol, uPLPos, uPLCol, uEmissive;
    uniform float uPLRange, uWind, uTime, uUnlit; uniform vec2 uRepeat;
    varying vec2 vUvAff; varying float vW; varying vec3 vLight; varying float vFog;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      if (uWind > 0.0) wp.x += sin(uTime * 1.3 + wp.y * 0.6 + wp.z) * uWind * max(0.0, position.y);
      vec3 n = normalize(mat3(modelMatrix) * normal);
      vec3 L = uAmbient + uDirCol * max(dot(n, -uDirDir), 0.0);
      vec3 d = uPLPos - wp.xyz; float dist = length(d);
      float att = clamp(1.0 - dist / uPLRange, 0.0, 1.0); att *= att;
      L += uPLCol * att * (0.35 + 0.65 * max(dot(n, d / max(dist, 0.001)), 0.0));
      vLight = mix(L + uEmissive, vec3(1.0), uUnlit);
      vec4 mv = viewMatrix * wp;
      vFog = -mv.z;
      vec4 cp = projectionMatrix * mv;
      cp.xy /= cp.w; cp.xy = floor(cp.xy * uSnap + 0.5) / uSnap; cp.xy *= cp.w; // temblor PS1
      vUvAff = uv * uRepeat * cp.w; vW = cp.w;                                  // mapeado afín
      gl_Position = cp;
    }`;

  const FS = `
    uniform sampler2D map; uniform vec3 uColor, uFogCol; uniform float uFogNear, uFogFar, uAlpha;
    varying vec2 vUvAff; varying float vW; varying vec3 vLight; varying float vFog;
    float b2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
    float bayer(vec2 a) { return b2(0.5 * a) * 0.25 + b2(a); }
    void main() {
      vec4 tex = texture2D(map, vUvAff / vW);
      float th = bayer(gl_FragCoord.xy);
      if (tex.a * uAlpha < th * 0.94 + 0.03) discard;          // transparencia por tramado
      vec3 c = tex.rgb * uColor * vLight;
      c = mix(c, uFogCol, smoothstep(uFogNear, uFogFar, vFog));
      c = floor(c * 24.0 + th) / 24.0;                          // color reducido + tramado
      gl_FragColor = vec4(c, 1.0);
    }`;

  // ---------- texturas generadas ----------
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = a => a[(rnd() * a.length) | 0];

  function tex(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  const fill = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const speckle = (g, w, h, n, cols, sw = 1, sh = 1) => {
    for (let i = 0; i < n; i++) fill(g, pick(cols), (rnd() * w) | 0, (rnd() * h) | 0, sw, sh);
  };

  const T = {};
  function makeTextures() {
    seed = 7;
    T.white = tex(2, 2, g => fill(g, "#fff", 0, 0, 2, 2));
    T.grass = tex(64, 64, (g, w, h) => {
      fill(g, P.moss0, 0, 0, w, h);
      speckle(g, w, h, 500, [P.moss1, P.moss1, P.moss2], 1, 2);
      speckle(g, w, h, 40, [P.plum, P.mauve]);
    });
    T.bark = tex(32, 64, (g, w, h) => {
      fill(g, P.bark, 0, 0, w, h);
      for (let x = 0; x < w; x += 2 + ((rnd() * 3) | 0)) fill(g, pick([P.plum, P.mauve, P.night]), x, 0, 1, h);
      speckle(g, w, h, 60, [P.moss1, P.moss0], 2, 3);
    });
    T.needles = tex(32, 32, (g, w, h) => {
      fill(g, P.moss0, 0, 0, w, h);
      speckle(g, w, h, 180, [P.moss1, P.moss1, P.moss2], 1, 2);
      speckle(g, w, h, 30, [P.night]);
    });
    T.rock = tex(32, 32, (g, w, h) => {
      fill(g, P.mauve, 0, 0, w, h);
      speckle(g, w, h, 220, [P.lilac, P.plum, P.plum], 2, 1);
      speckle(g, w, h, 60, [P.moss1, P.moss2], 2, 2);
    });
    T.cliff = tex(32, 32, (g, w, h) => {
      fill(g, P.plum, 0, 0, w, h);
      speckle(g, w, h, 200, [P.mauve, P.night, P.bark], 3, 1);
    });
    T.planks = tex(32, 32, (g, w, h) => {
      fill(g, P.wood, 0, 0, w, h);
      for (let y = 0; y < h; y += 4) fill(g, pick([P.wood2, P.bark]), 0, y, w, 1);
      speckle(g, w, h, 20, [P.night], 1, 1);
    });
    T.logs = tex(64, 64, (g, w, h) => {
      for (let y = 0; y < h; y += 8) {
        fill(g, P.wood, 0, y, w, 8);
        fill(g, P.wood2, 0, y + 1, w, 2);
        fill(g, P.night, 0, y + 7, w, 1);
        for (let k = 0; k < 6; k++) fill(g, P.bark, (rnd() * w) | 0, y + 3 + ((rnd() * 3) | 0), 4, 1);
      }
    });
    T.shingles = tex(32, 32, (g, w, h) => {
      fill(g, P.night, 0, 0, w, h);
      for (let y = 0; y < h; y += 4)
        for (let x = (y / 4) % 2 ? -3 : 0; x < w; x += 6) fill(g, pick([P.plum, P.mauve, P.plum]), x, y, 5, 3);
      speckle(g, w, h, 25, [P.moss1, P.moss2], 2, 1);
    });
    T.door = tex(16, 32, (g, w, h) => {
      fill(g, P.bark, 0, 0, w, h);
      for (let x = 0; x < w; x += 4) fill(g, P.wood, x, 0, 3, h);
      fill(g, P.night, 0, 8, w, 1); fill(g, P.night, 0, 24, w, 1);
    });
    T.glass = tex(16, 16, (g, w, h) => {
      fill(g, P.neon, 0, 0, w, h);
      speckle(g, w, h, 40, [P.moss2, "#c8ffb0"], 1, 1);
    });
    T.dress = tex(16, 16, (g, w, h) => {
      fill(g, P.mauve, 0, 0, w, h);
      for (let y = 0; y < h; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < w; x += 4) fill(g, P.lilac, x, y, 1, 1);
    });
    T.skin = tex(8, 8, (g, w, h) => { fill(g, P.pale, 0, 0, w, h); speckle(g, w, h, 6, [P.lilac]); });
    T.hair = tex(16, 16, (g, w, h) => {
      fill(g, P.night, 0, 0, w, h);
      for (let x = 0; x < w; x += 3) fill(g, P.plum, x, 0, 1, h);
    });
    T.frog = tex(16, 16, (g, w, h) => {
      fill(g, P.moss1, 0, 0, w, h);
      speckle(g, w, h, 14, [P.moss0], 2, 2);
      speckle(g, w, h, 14, [P.moss2, P.neon], 1, 1);
    });
    T.metal = tex(8, 8, (g, w, h) => { fill(g, P.bark, 0, 0, w, h); speckle(g, w, h, 10, [P.mauve, P.lilac]); });
    T.flame = tex(8, 16, g => {
      g.fillStyle = P.neon;
      g.beginPath(); g.moveTo(4, 0); g.quadraticCurveTo(8, 10, 4, 16); g.quadraticCurveTo(0, 10, 4, 0); g.fill();
      fill(g, "#e8ffd8", 3, 9, 2, 5);
    });
    T.fog = tex(64, 64, (g, w, h) => {
      const img = g.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - 32, (y - 32) * 1.6) / 32;
        const a = Math.max(0, 1 - d) * (0.7 + 0.3 * rnd());
        const i = (y * w + x) * 4;
        img.data[i] = 0x8a; img.data[i + 1] = 0x7a; img.data[i + 2] = 0x9e; img.data[i + 3] = a * 150;
      }
      g.putImageData(img, 0, 0);
    });
    T.dot = tex(4, 4, (g, w, h) => fill(g, "#fff", 0, 0, w, h));
  }

  // ---------- material ----------
  function M(o = {}) {
    const rep = o.repeat || [1, 1];
    return new THREE.ShaderMaterial({
      uniforms: {
        ...U,
        map: { value: o.map || T.white },
        uRepeat: { value: new THREE.Vector2(rep[0], rep[1]) },
        uColor: { value: new THREE.Color(o.color ?? 0xffffff) },
        uEmissive: { value: new THREE.Color(o.emissive ?? 0x000000) },
        uWind: { value: o.wind || 0 },
        uAlpha: { value: o.alpha ?? 1 },
        uUnlit: { value: o.unlit ? 1 : 0 },
      },
      vertexShader: VS,
      fragmentShader: FS,
      side: o.side ?? THREE.FrontSide,
    });
  }

  // ---------- renderizador ----------
  let renderer;
  function init(canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "low-power" });
    renderer.setPixelRatio(1);
    renderer.setSize(RW, RH, false);
    renderer.setClearColor(FOG);
    makeTextures();
    return renderer;
  }

  return { init, M, T, U, P, FOG, RW, RH, rnd, setSeed: s => { seed = s; }, get renderer() { return renderer; } };
})();
