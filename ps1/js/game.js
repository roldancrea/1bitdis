/*
 * NIEBLA — versión point & click
 * Toca el suelo para caminar. Toca las cosas para ver qué puedes hacer con ellas.
 */
(() => {
  const { M, U } = PS1;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const $ = id => document.getElementById(id);

  const canvas = $("c");
  const renderer = PS1.init(canvas);
  const camera = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 60);
  const ray = new THREE.Raycaster();

  // ---------- estado ----------
  const G = {
    scene: null, room: null, flags: {},
    busy: false, started: false,
    target: null, onArrive: null, stuck: 0,
    t: 0,
  };
  const girl = Models.girl();
  const candil = Models.candil();
  candil.group.scale.setScalar(1.5);
  const tmp = V3(), tmp2 = V3();

  // ---------- interfaz de texto ----------
  const sayEl = $("say"), actionsEl = $("actions");
  let typing = null, waitTap = null;

  function say(text) {
    actionsEl.innerHTML = "";
    return new Promise(res => {
      if (typing) clearInterval(typing.timer);
      let i = 0;
      sayEl.textContent = "";
      const done = () => { clearInterval(typing.timer); typing = null; sayEl.textContent = text; res(); };
      typing = { timer: setInterval(() => { i++; sayEl.textContent = text.slice(0, i); if (i >= text.length) done(); }, 24), done };
    });
  }
  function next() {
    return new Promise(res => {
      sayEl.insertAdjacentHTML("beforeend", ' <span class="more">▼</span>');
      waitTap = () => { waitTap = null; res(); };
    });
  }
  async function talk(...lines) {
    for (let i = 0; i < lines.length; i++) {
      await say(lines[i]);
      if (i < lines.length - 1) await next();
    }
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function showActions(hs) {
    sayEl.innerHTML = `<span class="hs-name">${hs.name}</span>`;
    actionsEl.innerHTML = "";
    hs.actions.filter(a => !a.if || a.if()).forEach((a, i) => {
      const b = document.createElement("button");
      b.className = "act";
      b.textContent = a.label;
      b.style.animationDelay = `${i * 0.06}s`;
      b.addEventListener("click", () => runAction(hs, a));
      actionsEl.appendChild(b);
    });
  }

  async function runAction(hs, a) {
    if (G.busy) return;
    G.busy = true;
    actionsEl.innerHTML = "";
    sayEl.textContent = "";
    try {
      if (hs.at && a.walk !== false) await walkTo(V3(hs.at[0], 0, hs.at[1]));
      if (hs.face) face(hs.face[0], hs.face[1]);
      await a.run();
    } finally { G.busy = false; }
  }

  function updateInventory() {
    $("inv").textContent = G.flags.candil ? "◆ candil" : "";
  }

  // ---------- fundido entre escenas ----------
  const fadeEl = $("fade");
  const fade = on => { fadeEl.classList.toggle("on", on); return wait(500); };

  // ---------- movimiento de Lía ----------
  function walkTo(p) {
    return new Promise(res => {
      G.target = p.clone();
      G.onArrive = res;
      G.stuck = 0;
    });
  }
  function face(x, z) {
    girl.group.rotation.y = Math.atan2(x - girl.group.position.x, z - girl.group.position.z);
  }
  function arrive() {
    G.target = null;
    const f = G.onArrive; G.onArrive = null;
    if (f) f();
  }

  function updateGirl(dt) {
    let moving = false;
    const p = girl.group.position;
    if (G.target) {
      tmp.copy(G.target).sub(p); tmp.y = 0;
      const d = tmp.length();
      if (d < 0.06) arrive();
      else {
        const step = Math.min(d, dt * 1.6);
        tmp.normalize();
        const before = p.clone();
        p.addScaledVector(tmp, step);
        G.room.clamp(p);
        moving = true;
        // girar suavemente hacia donde camina
        const want = Math.atan2(tmp.x, tmp.z);
        let diff = want - girl.group.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        girl.group.rotation.y += diff * Math.min(1, dt * 12);
        // atascada contra un obstáculo: se rinde
        if (before.distanceTo(p) < step * 0.3) { G.stuck += dt; if (G.stuck > 0.35) arrive(); }
        else G.stuck = 0;
      }
    }
    girl.animate(dt, moving, G.t);
    if (G.room.exits) G.room.exits(p);
  }

  // marcador donde se toca el suelo
  const marker = Models.mesh(new THREE.RingGeometry(0.12, 0.18, 8), M({ color: 0x8cff6a, unlit: true }));
  marker.rotation.x = -Math.PI / 2;
  let markerLife = 0;

  // ---------- habitaciones ----------
  const ROOMS = {};

  function newScene() {
    const s = new THREE.Scene();
    s.add(girl.group);
    s.add(marker);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), M());
    floor.rotation.x = -Math.PI / 2;
    floor.visible = false;
    floor.userData.floor = true;
    s.add(floor);
    s.userData.hits = [floor];
    return s;
  }

  // zona tocable invisible (más grande que el objeto, para dedos)
  function hotspot(scene, o) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...o.size), M());
    m.position.set(...o.pos);
    m.visible = false;
    m.userData.hs = o;
    scene.add(m);
    scene.userData.hits.unshift(m);
    o.mesh = m;
    return o;
  }
  const removeHotspot = (scene, o) => {
    scene.userData.hits = scene.userData.hits.filter(m => m !== o.mesh);
  };

  // ======== EL CLARO ========
  ROOMS.claro = () => {
    PS1.setSeed(11);
    const s = newScene();
    s.add(Models.ground(36, 36, 26, { flat: (x, z) => Math.min(1, Math.hypot(x, z) / 6), rep: 10 }));
    // anillo de pinos con dos huecos: el sendero (derecha) y la campana (izquierda)
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2;
      if (Math.abs(Math.sin(a)) < 0.25 || Math.sin(a) > 0.15) continue; // huecos y lado de la cámara
      const r = 7 + PS1.rnd() * 5;
      s.add(PS1.rnd() < 0.2 ? Models.deadTree(Math.cos(a) * r, Math.sin(a) * r * 0.8 - 2, 4)
                                : Models.pine(Math.cos(a) * r, Math.sin(a) * r * 0.8 - 2, 4 + PS1.rnd() * 3));
    }
    s.add(Models.pine(-6.2, 2.2, 5.5)); s.add(Models.pine(7.4, 1.6, 6)); s.add(Models.deadTree(-6.5, -6, 5));
    for (let x = 3.2; x < 9; x += 0.8) { // piedras del sendero
      const r = Models.rock(0.12, x); r.position.set(x, 0, (Math.sin(x * 3) * 0.6)); s.add(r);
    }
    const rk = Models.rock(0.85, 3);
    rk.scale.set(1.4, 0.9, 1.2);
    rk.position.set(1.3, 0.1, -1.6);
    s.add(rk);
    const frog = Models.frog();
    frog.group.position.set(1.95, 0.38, -1.35);
    frog.group.rotation.y = -0.5;
    frog.group.scale.setScalar(1.7);
    s.add(frog.group);
    if (!G.flags.candil) {
      candil.group.position.set(0.95, 0.42, -1.45);
      candil.group.rotation.set(0, 0, 0);
    }
    s.add(candil.group);
    const wisps = Models.wisps(5, V3(-6, 1.3, -4), 2.5);
    s.add(wisps.group);
    const fogs = Models.fogBanks(10, [-12, 12, -9, 1.5], 0.3, 5);
    s.add(fogs.group);

    U.uFogNear.value = 3; U.uFogFar.value = 15;
    const hsCandil = hotspot(s, {
      name: "Candil", pos: [0.95, 0.75, -1.45], size: [0.8, 1.0, 0.8], at: [0.4, -0.7], face: [0.95, -1.45],
      actions: [
        { label: "Mirar", run: () => say("Un candil viejo sobre la roca. El metal está frío y la mecha, seca.") },
        {
          label: "Coger", if: () => !G.flags.candil, run: async () => {
            girl.holding = true;
            await wait(350);
            G.flags.candil = true;
            candil.setLit(true);
            removeHotspot(s, hsCandil);
            updateInventory();
            frog.croak();
            await talk("El metal está frío. En cuanto lo roza, una llama verde se enciende sola.",
                       "La rana croa una vez, como si diera permiso.",
                       "La niebla retrocede un paso, como un animal que respeta el fuego.");
          },
        },
      ],
    });
    if (G.flags.candil) removeHotspot(s, hsCandil);
    hotspot(s, {
      name: "Rana", pos: [1.95, 0.7, -1.35], size: [0.9, 0.9, 0.9], at: [2.4, -0.35], face: [1.95, -1.35],
      actions: [
        { label: "Mirar", run: () => say("Una rana enorme, verde como el musgo. Te mira sin parpadear.") },
        {
          label: "Hablar", run: async () => {
            if (!G.flags.candil) await talk("—Hola… ¿Sabes cómo salir de aquí?", "La rana mira el candil. Luego te mira a ti.");
            else { frog.croak(); await say("La rana croa. Hacia la derecha, la niebla se abre un poco: hay un sendero."); }
          },
        },
      ],
    });
    hotspot(s, {
      name: "Sendero", pos: [3.2, 0.5, -0.5], size: [1.6, 1.2, 2.4], at: [4.0, -0.3], face: [8, 0],
      actions: [
        { label: "Mirar", walk: false, run: () => say("Unas piedras se pierden entre los pinos, hacia la derecha.") },
        {
          label: "Ir", run: async () => {
            if (!G.flags.candil) await say("La niebla se traga el sendero. Sin luz no ves dónde pisas.");
            else await goRoom("puente");
          },
        },
      ],
    });
    hotspot(s, {
      name: "Campana lejana", pos: [-3.0, 1, -1.4], size: [1.8, 2, 2.4], at: [-4.2, -0.4], face: [-8, -0.5],
      actions: [
        { label: "Escuchar", walk: false, run: () => say("Una campana, lenta, como si contara algo. Suena en todas partes a la vez.") },
        {
          label: "Ir", run: () => say(G.flags.candil
            ? "Por aquí el bosque se cierra. (Este camino llegará en la próxima versión.)"
            : "Das unos pasos hacia el sonido… pero algo te dice que primero busques luz."),
        },
      ],
    });

    const camBase = V3(0.4, 1.9, 4.3), lookBase = V3(0.5, 0.55, -1.3);
    return {
      scene: s, spawn: [-1.2, 0.8], spawnFace: [1, -1],
      clamp(p) {
        const ex = p.x / 5.6, ez = (p.z + 0.2) / 2.4;
        const k = Math.hypot(ex, ez);
        if (k > 1) { p.x /= k; p.z = -0.2 + (p.z + 0.2) / k; }
        tmp2.set(p.x - 1.3, 0, p.z + 1.6); // la roca
        if (tmp2.length() < 1.15) { tmp2.setLength(1.15); p.x = 1.3 + tmp2.x; p.z = -1.6 + tmp2.z; }
      },
      update(dt, t) {
        frog.animate(dt, t);
        wisps.animate(t);
        fogs.animate(t, camera);
        const gx = girl.group.position.x;
        camera.position.set(camBase.x + gx * 0.6, camBase.y, camBase.z);
        camera.lookAt(lookBase.x + gx * 0.7, lookBase.y, lookBase.z);
      },
    };
  };

  // ======== EL PUENTE ========
  ROOMS.puente = () => {
    PS1.setSeed(23);
    const s = newScene();
    const near = Models.ground(14, 10, 10, { rep: 4 }); near.position.z = 8.2; s.add(near);
    const far = Models.ground(18, 10, 10, { rep: 4 }); far.position.z = -17.8; s.add(far);
    const cliff = M({ map: PS1.T.cliff, repeat: [6, 8] });
    s.add(Models.box(14, 30, 1, cliff, 0, -15.05, 3.7));
    s.add(Models.box(18, 30, 1, cliff, 0, -15.05, -13.3));
    s.add(Models.bridge(3.2, -12.8));
    const cab = Models.cabin(true);
    cab.group.position.set(0, 0, -17);
    s.add(cab.group);
    const smoke = Models.smoke(V3(1.3, 4.2, -17.6));
    s.add(smoke.group);
    [[-4, -15], [-6.5, -18], [4.5, -15.5], [6.5, -19], [-3, -21], [3, -21.5], [-8, -16], [8.5, -16.5]]
      .forEach(([x, z]) => s.add(Models.pine(x, z, 5 + PS1.rnd() * 2)));
    [[-4.5, 5.5], [4.8, 6], [-6, 8]].forEach(([x, z]) => s.add(Models.pine(x, z, 5)));
    const fogBelow = Models.fogBanks(12, [-9, 9, -12, 3], -2.2, 6);
    const fogAbove = Models.fogBanks(5, [-9, 9, -12, 0], 0.6, 4);
    s.add(fogBelow.group, fogAbove.group);
    U.uFogNear.value = 4; U.uFogFar.value = 19;

    hotspot(s, {
      name: "Tablón roto", pos: [0, 0, -0.4], size: [1.4, 0.6, 0.9], at: [0, 0.35], face: [0, -0.4],
      actions: [{ label: "Mirar", run: () => talk("Falta un tablón.", "Abajo solo hay niebla… y algo que respira.") }],
    });
    hotspot(s, {
      name: "Cabaña", pos: [0, 1.6, -17], size: [6, 4.5, 4.5],
      actions: [
        { label: "Mirar", walk: false, run: () => say("Una cabaña de troncos. Sale humo de la chimenea y la ventana está encendida.") },
        { label: "Ir", run: async () => { await walkTo(V3(0, 0, -14.2)); await goRoom("cabana"); } },
      ],
    });

    const camPos = V3(0, 2, 9), camLook = V3(0, 1, 0);
    return {
      scene: s, spawn: [0, 5.6], spawnFace: [0, -10],
      back: { label: "◂ Volver al claro", to: "claro", spawn: [4.2, 0.1], face: [-1, 0] },
      onEnter: () => talk("El sendero termina en un puente de cuerdas sobre un barranco sin fondo.",
                          "Al otro lado, una cabaña con una ventana encendida. Las tablas crujen solo de mirarlas."),
      clamp(p) {
        if (p.z > 3.2) { p.x = THREE.MathUtils.clamp(p.x, -2.4, 2.4); p.z = Math.min(p.z, 6.8); }
        else if (p.z > -12.8) p.x = THREE.MathUtils.clamp(p.x, -0.38, 0.38);
        else { p.x = THREE.MathUtils.clamp(p.x, -2.8, 2.8); p.z = Math.max(p.z, -14.4); }
      },
      update(dt, t) {
        smoke.animate(t, camera);
        fogBelow.animate(t, camera);
        fogAbove.animate(t, camera);
        const g = girl.group.position;
        // la cámara sigue a Lía por detrás: traveling por el puente
        camPos.lerp(tmp.set(g.x * 0.5, 1.9 + Math.sin(t * 0.7) * 0.05, g.z + 3.4), Math.min(1, dt * 2.5));
        camLook.lerp(tmp.set(g.x * 0.3, 1.0, g.z - 4), Math.min(1, dt * 2.5));
        camera.position.copy(camPos);
        camera.lookAt(camLook);
      },
    };
  };

  // ======== LA CABAÑA ========
  ROOMS.cabana = () => {
    PS1.setSeed(37);
    const s = newScene();
    s.add(Models.ground(24, 20, 16, { rep: 6 }));
    const cab = Models.cabin(true);
    cab.group.position.set(0, 0, -2);
    s.add(cab.group);
    const smoke = Models.smoke(V3(1.3, 4.2, -2.6));
    s.add(smoke.group);
    [[-4.2, -2.5], [-6, 0.5], [4.6, -2.2], [6.2, 1.2], [-3.5, -6], [3.5, -6.5], [-7.5, 3.5], [7.8, 4]]
      .forEach(([x, z]) => s.add(Models.pine(x, z, 5 + PS1.rnd() * 2.5)));
    const fogs = Models.fogBanks(6, [-10, 10, -6, 3], 0.2, 4);
    s.add(fogs.group);
    const mosq = Models.mosquitoes(16);
    mosq.group.visible = false;
    s.add(mosq.group);
    U.uFogNear.value = 3; U.uFogFar.value = 16;
    const winPos = V3(-1.1, 1.45, 0.25);
    let ending = false;
    const camPos = V3(0.4, 1.9, 6.6), camLook = V3(-0.2, 1.4, -1);

    hotspot(s, {
      name: "Ventana", pos: [-1.1, 1.45, 0.1], size: [1.6, 1.4, 0.6], at: [-1.1, 0.85], face: [-1.1, 0],
      actions: [
        { label: "Mirar", run: () => talk("Dentro hay una mesa con dos tazas. Una todavía humea.", "En la pared, un espejo cubierto con una sábana.") },
        {
          label: "Dejar el candil", if: () => G.flags.candil, run: async () => {
            ending = true;
            girl.holding = false;
            G.flags.candil = false;
            G.candilAt = V3(-1.1, 0.97, 0.15);
            updateInventory();
            $("back").hidden = true;
            mosq.group.visible = true;
            await wait(400);
            await walkTo(V3(0.4, 0, 1.9)); // se aparta para mirar la luz
            face(-1.1, 0.1);
            await talk("Coloca el candil junto al cristal. La llama crece, verde y tranquila.",
                       "Los mosquitos acuden a bailar a su alrededor.",
                       "Lía comprende que no va a salir. Pero cualquiera que se pierda aquí verá esta luz.",
                       "Y nadie más tendrá que esperar sola.");
            await next();
            showEnding("LA LUZ EN LA VENTANA");
          },
        },
      ],
    });
    hotspot(s, {
      name: "Puerta", pos: [1.2, 0.85, 0.1], size: [1.2, 1.9, 0.6], at: [1.2, 0.9], face: [1.2, 0],
      actions: [
        { label: "Mirar", run: () => say("Una puerta de tablones. Hay arañazos a la altura de una niña.") },
        { label: "Llamar", run: () => talk("Llamas. Nadie responde.", "La puerta está cerrada… por dentro.") },
      ],
    });

    return {
      scene: s, spawn: [0.6, 4.2], spawnFace: [0, -2],
      back: { label: "◂ Volver al puente", to: "puente", spawn: [0, -13.6], face: [0, 0] },
      clamp(p) {
        p.x = THREE.MathUtils.clamp(p.x, -4, 4);
        p.z = THREE.MathUtils.clamp(p.z, 0.55, 4.8);
      },
      light() { // sin candil en la mano, ilumina la ventana
        return { pos: G.candilAt || winPos, col: G.candilAt ? [0.6, 1.1, 0.5] : [0.18, 0.32, 0.16], range: G.candilAt ? 6 : 4 };
      },
      update(dt, t) {
        smoke.animate(t, camera);
        fogs.animate(t, camera);
        if (G.candilAt) mosq.animate(t, tmp.copy(G.candilAt).add(V3(0, 0.25, 0.15)));
        if (ending) { // la cámara se acerca despacio a la ventana
          camPos.lerp(V3(-2.5, 1.35, 2.5), dt * 0.3);
          camLook.lerp(V3(-0.9, 1.05, 0.1), dt * 0.5);
        } else {
          camPos.set(0.4 + girl.group.position.x * 0.3, 1.9, 6.6);
        }
        camera.position.copy(camPos);
        camera.lookAt(camLook);
      },
    };
  };

  // ---------- cambiar de habitación ----------
  async function goRoom(id, spawn, faceTo) {
    await fade(true);
    G.room = ROOMS[id]();
    G.roomId = id;
    G.scene = G.room.scene;
    const sp = spawn || G.room.spawn, fc = faceTo || G.room.spawnFace;
    girl.group.position.set(sp[0], 0, sp[1]);
    face(sp[0] + fc[0], sp[1] + fc[1]);
    G.target = null;
    const back = $("back");
    back.hidden = !G.room.back;
    if (G.room.back) back.textContent = G.room.back.label;
    G.room.update(0.016, G.t);
    sayEl.textContent = "";
    actionsEl.innerHTML = "";
    await fade(false);
    if (G.room.onEnter && !G.flags["visto_" + id]) {
      G.flags["visto_" + id] = true;
      await G.room.onEnter();
    }
  }

  $("back").addEventListener("click", async () => {
    if (G.busy || !G.room.back) return;
    G.busy = true;
    const b = G.room.back;
    await goRoom(b.to, b.spawn, b.face);
    G.busy = false;
  });

  function showEnding(title) {
    sayEl.innerHTML = `<span class="ending">— FINAL: ${title} —</span>`;
    actionsEl.innerHTML = "";
    const b = document.createElement("button");
    b.className = "act";
    b.textContent = "Volver a empezar";
    b.addEventListener("click", () => location.reload());
    actionsEl.appendChild(b);
  }

  // ---------- toques ----------
  canvas.addEventListener("pointerdown", e => {
    if (!G.started) return start();
    if (typing) return typing.done();
    if (waitTap) return waitTap();
    if (G.busy) return;
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(G.scene.userData.hits, false)[0];
    if (!hit) return;
    if (hit.object.userData.hs) return showActions(hit.object.userData.hs);
    // caminar
    sayEl.textContent = ""; actionsEl.innerHTML = "";
    const p = hit.point.clone();
    G.room.clamp(p);
    marker.position.set(p.x, 0.05, p.z);
    markerLife = 0.6;
    walkTo(p);
  });
  $("panel").addEventListener("pointerdown", e => {
    if (e.target.closest("button")) return;
    if (typing) typing.done();
    else if (waitTap) waitTap();
  });

  // ---------- inicio ----------
  async function start() {
    G.started = true;
    $("title").classList.add("hide");
    G.busy = true;
    await talk("Lía despierta sobre musgo húmedo. No recuerda haberse dormido.",
               "La niebla lo cubre todo. A lo lejos suena una campana, lenta, como si contara algo.",
               "Toca el suelo para caminar. Toca las cosas para ver qué puedes hacer.");
    G.busy = false;
  }

  // ---------- bucle ----------
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    G.t += dt;
    U.uTime.value = G.t;
    if (!G.room) return;

    if (G.started) updateGirl(dt); else girl.animate(dt, false, G.t);
    G.room.update(dt, G.t);
    if (!G.started) { // cámara de la pantalla de título: vuelta lenta
      const a = G.t * 0.15;
      camera.position.set(0.6 + Math.sin(a) * 2.2, 3.0 + Math.sin(a * 0.7) * 0.3, 5.2);
      camera.lookAt(0.6 + Math.sin(a) * 0.6, 0.6, -1.2);
    }

    // candil: en la mano, en la roca o en la ventana
    if (G.flags.candil) {
      girl.handPos(tmp);
      candil.group.position.set(tmp.x, tmp.y - 0.36 * candil.group.scale.y, tmp.z);
      candil.group.rotation.y = girl.group.rotation.y;
      if (candil.group.parent !== G.scene) G.scene.add(candil.group);
    } else if (G.candilAt) {
      candil.group.position.copy(G.candilAt);
      if (candil.group.parent !== G.scene) G.scene.add(candil.group);
    }
    candil.animate(G.t, camera);

    // luz principal
    const flick = 0.9 + Math.sin(G.t * 11) * 0.06 + Math.sin(G.t * 4.7) * 0.05;
    if (candil.lit && (G.flags.candil || G.candilAt)) {
      candil.lightPos(U.uPLPos.value);
      U.uPLCol.value.setRGB(0.55 * flick, 1.0 * flick, 0.45 * flick);
      U.uPLRange.value = G.candilAt ? 6 : 6.5;
    } else if (G.room.light) {
      const l = G.room.light();
      U.uPLPos.value.copy(l.pos);
      U.uPLCol.value.setRGB(l.col[0] * flick, l.col[1] * flick, l.col[2] * flick);
      U.uPLRange.value = l.range;
    } else {
      U.uPLCol.value.setRGB(0, 0, 0);
    }

    if (markerLife > 0) { markerLife -= dt; marker.visible = markerLife > 0 && ((G.t * 10) | 0) % 2 === 0; }
    else marker.visible = false;

    renderer.render(G.scene, camera);
  }

  // arrancar en el claro, con la cámara de título
  G.room = ROOMS.claro();
  G.roomId = "claro";
  G.scene = G.room.scene;
  girl.group.position.set(-1.2, 0, 0.8);
  face(1, -1);
  requestAnimationFrame(loop);
  window.NIEBLA = { G, goRoom, walkTo, ROOMS, camera }; // para pruebas
})();
