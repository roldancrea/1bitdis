/*
 * MÚSICA AMBIENTAL OMINOSA (generada en tiempo real con Web Audio)
 * No usa archivos de audio: todo se sintetiza, así que nunca suena igual dos veces.
 *
 * Capas:
 *  - zumbido grave (drone) que se desliza de nota al cambiar de lugar
 *  - voz disonante que aparece cuando hay tensión
 *  - viento: ruido filtrado que sube y baja
 *  - acordes lentos en modo frigio (oscuro, inquietante)
 *  - notas sueltas de "caja de música" desafinada
 *  - campana lejana con armónicos metálicos
 *  - todo pasa por una reverberación larga, como un bosque en niebla
 *
 * Uso:  Ambient.start()  (siempre tras un toque: los móviles lo exigen)
 *       Ambient.setMood("bosque")   Ambient.bell()   Ambient.croak()
 *       Ambient.toggle()  → silencia / activa
 */
const Ambient = (() => {
  const SCALE = [0, 1, 3, 5, 7, 8, 10]; // frigio: el más sombrío de los modos
  const MOODS = {
    //        nota base, intervalos del zumbido, tensión, viento, cada cuánto campana / notas sueltas (s), brillo del filtro
    claro:  { root: 38, drone: [0, 7],     tension: 0.2,  wind: 0.25, bells: [22, 45], plinks: [6, 14],  cutoff: 320 },
    candil: { root: 38, drone: [0, 7, 12], tension: 0.1,  wind: 0.2,  bells: [30, 55], plinks: [4, 9],   cutoff: 420 },
    bosque: { root: 37, drone: [0, 6],     tension: 0.75, wind: 0.4,  bells: [9, 18],  plinks: [5, 10],  cutoff: 250 },
    fuegos: { root: 38, drone: [0, 7, 15], tension: 0.35, wind: 0.2,  bells: [30, 60], plinks: [2, 5],   cutoff: 450 },
    puente: { root: 36, drone: [0, 7],     tension: 0.5,  wind: 0.7,  bells: [30, 50], plinks: [8, 16],  cutoff: 230 },
    lago:   { root: 38, drone: [0, 7, 12], tension: 0.3,  wind: 0.15, bells: [35, 60], plinks: [3, 7],   cutoff: 380 },
    cabana: { root: 41, drone: [0, 6],     tension: 0.55, wind: 0.3,  bells: [40, 70], plinks: [5, 11],  cutoff: 290 },
    oscuro: { root: 35, drone: [0, 1],     tension: 0.9,  wind: 0.1,  bells: [18, 35], plinks: [12, 25], cutoff: 170 },
    niebla: { root: 36, drone: [0, 1, 7],  tension: 0.85, wind: 0.55, bells: [14, 28], plinks: [10, 20], cutoff: 190 },
    final:  { root: 38, drone: [0, 7, 12], tension: 0.05, wind: 0.15, bells: [45, 90], plinks: [3, 6],   cutoff: 520 },
  };
  // nombres de escenas/ilustraciones que comparten ambiente
  const ALIAS = { luz: "final", ventana: "final", sendero: "puente" };

  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  const rand = (a, b) => a + Math.random() * (b - a);

  let ctx = null, master, verb, dry, drone = [], tensionV, droneFilter, windGain, windFilter;
  let mood = MOODS.claro, moodName = "claro";
  let muted = false, started = false, nextBell = 0, nextPlink = 0, nextPad = 0, nextWind = 0;
  try { muted = localStorage.getItem("niebla.mute") === "1"; } catch {}

  // ---------- utilidades ----------
  function impulse(seconds, decay) {
    const len = ctx.sampleRate * seconds, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  function noiseBuffer(seconds) {
    const len = ctx.sampleRate * seconds, buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6; } // ruido "marrón", más suave
    return buf;
  }
  // salida con mezcla seca/reverberada y paneo
  function out(node, wet = 0.6, pan = 0) {
    let n = node;
    if (ctx.createStereoPanner && pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; n.connect(p); n = p; }
    const d = ctx.createGain(); d.gain.value = 1 - wet * 0.7; n.connect(d); d.connect(dry);
    const w = ctx.createGain(); w.gain.value = wet; n.connect(w); w.connect(verb);
  }
  function env(g, t, peak, attack, hold, release) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  }

  // ---------- construcción ----------
  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(comp);
    dry = ctx.createGain(); dry.connect(master);
    const conv = ctx.createConvolver(); conv.buffer = impulse(4.5, 2.4);
    verb = ctx.createGain(); verb.gain.value = 0.9;
    verb.connect(conv); conv.connect(master);

    // zumbido: 3 voces, cada una con dos sierras desafinadas
    droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass"; droneFilter.frequency.value = mood.cutoff; droneFilter.Q.value = 4;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.045; lfoG.gain.value = 90;
    lfo.connect(lfoG); lfoG.connect(droneFilter.frequency); lfo.start();
    const droneGain = ctx.createGain(); droneGain.gain.value = 0.16;
    droneFilter.connect(droneGain); out(droneGain, 0.5);
    for (let v = 0; v < 3; v++) {
      const g = ctx.createGain(); g.gain.value = 0;
      g.connect(droneFilter);
      const oscs = [-7, 7].map(cents => {
        const o = ctx.createOscillator();
        o.type = "sawtooth"; o.detune.value = cents + rand(-3, 3);
        o.connect(g); o.start();
        return o;
      });
      drone.push({ g, oscs });
    }
    // voz disonante (tensión) con trémolo lento
    const tg = ctx.createGain(); tg.gain.value = 0;
    const to = ctx.createOscillator(); to.type = "triangle";
    const trem = ctx.createOscillator(), tremG = ctx.createGain();
    trem.frequency.value = 0.13; tremG.gain.value = 0.5;
    const tAmp = ctx.createGain(); tAmp.gain.value = 0.5;
    trem.connect(tremG); tremG.connect(tAmp.gain);
    to.connect(tAmp); tAmp.connect(tg); out(tg, 0.8);
    to.start(); trem.start();
    tensionV = { g: tg, o: to };

    // viento
    const ns = ctx.createBufferSource(); ns.buffer = noiseBuffer(4); ns.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = "bandpass"; windFilter.frequency.value = 500; windFilter.Q.value = 0.8;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    ns.connect(windFilter); windFilter.connect(windGain); out(windGain, 0.4);
    ns.start();

    applyMood(true);
    setInterval(tick, 200);
    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else if (!muted) ctx.resume();
    });
  }

  function applyMood(instant) {
    const t = ctx.currentTime, tc = instant ? 0.01 : 2.5; // las notas se deslizan despacio
    drone.forEach((v, i) => {
      const iv = mood.drone[i];
      const note = iv === undefined ? mood.root - 12 : mood.root + iv;
      v.oscs.forEach(o => o.frequency.setTargetAtTime(hz(note), t, tc));
      v.g.gain.setTargetAtTime(iv === undefined ? 0.35 : 1 / (1 + i * 0.6), t, tc);
    });
    tensionV.o.frequency.setTargetAtTime(hz(mood.root + 13), t, tc);
    tensionV.g.gain.setTargetAtTime(mood.tension * 0.05, t, tc * 1.5);
    droneFilter.frequency.setTargetAtTime(mood.cutoff, t, tc);
    windGain.gain.setTargetAtTime(mood.wind * 0.05, t, tc);
  }

  // ---------- sucesos ----------
  function pad() { // acorde lento que se hincha y se apaga
    const t = ctx.currentTime;
    const notes = [0, SCALE[1 + ((Math.random() * 3) | 0)], SCALE[4 + ((Math.random() * 3) | 0)]];
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900;
    const g = ctx.createGain(); f.connect(g); out(g, 0.85, rand(-0.4, 0.4));
    env(g, t, 0.05, rand(3, 5), rand(1, 3), rand(5, 8));
    notes.forEach(n => {
      const o = ctx.createOscillator(); o.type = "triangle";
      o.frequency.value = hz(mood.root + 24 + n); o.detune.value = rand(-12, 12);
      o.connect(f); o.start(t); o.stop(t + 18);
    });
  }

  function plink() { // nota suelta de caja de música, un poco desafinada
    const t = ctx.currentTime;
    const n = mood.root + 36 + SCALE[(Math.random() * SCALE.length) | 0] + (Math.random() < 0.3 ? 12 : 0);
    const g = ctx.createGain(); out(g, 0.9, rand(-0.8, 0.8));
    env(g, t, 0.035, 0.005, 0, rand(2, 3.5));
    [0, 1].forEach(k => {
      const o = ctx.createOscillator(); o.type = "sine";
      o.frequency.value = hz(n) * (k ? 2.01 : 1); o.detune.value = rand(-25, 25);
      const og = ctx.createGain(); og.gain.value = k ? 0.25 : 1;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 4);
    });
  }

  function bell(near = false) { // campana lejana: armónicos inarmónicos, muy reverberada
    if (!ctx || muted) return;
    const t = ctx.currentTime + 0.05;
    const f0 = hz(mood.root + 24) * (near ? 1 : 0.995);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = near ? 3500 : 1600;
    const g = ctx.createGain(); lp.connect(g); out(g, near ? 0.6 : 0.95, rand(-0.6, 0.6));
    [[1, 1], [2.0, 0.5], [2.76, 0.6], [4.07, 0.3], [5.4, 0.25], [8.93, 0.12]].forEach(([r, a]) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f0 * r;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(a * (near ? 0.12 : 0.07), t + 0.01);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 7 / Math.sqrt(r));
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + 8);
    });
  }

  function croak() { // rana: dos ráfagas de pulsos graves
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + 0.02;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 520; bp.Q.value = 3;
    const g = ctx.createGain(); g.gain.value = 0; bp.connect(g); out(g, 0.3);
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 95;
    o.connect(bp);
    [0, 0.32].forEach(off => {
      for (let k = 0; k < 9; k++) {
        const t = t0 + off + k * 0.028;
        g.gain.setValueAtTime(0.5, t);
        g.gain.setValueAtTime(0, t + 0.014);
      }
    });
    o.frequency.setValueAtTime(95, t0); o.frequency.linearRampToValueAtTime(80, t0 + 0.6);
    o.start(t0); o.stop(t0 + 0.7);
  }

  function tick() {
    if (!ctx || muted || ctx.state !== "running") return;
    const t = ctx.currentTime;
    if (t > nextPad) { pad(); nextPad = t + rand(8, 14); }
    if (t > nextPlink) { plink(); nextPlink = t + rand(...mood.plinks); }
    if (t > nextBell) { bell(); nextBell = t + rand(...mood.bells); }
    if (t > nextWind) { // ráfagas de viento
      windFilter.frequency.setTargetAtTime(rand(250, 1100), t, rand(1.5, 4));
      windGain.gain.setTargetAtTime(mood.wind * rand(0.02, 0.09), t, 2);
      nextWind = t + rand(3, 7);
    }
  }

  // ---------- API ----------
  function start() {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    // iPhone: que suene aunque el móvil esté en modo silencio
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch {}
    if (!ctx) build();
    if (!started) {
      started = true;
      const t = ctx.currentTime;
      nextPad = t + 2; nextPlink = t + 5; nextBell = t + 6; nextWind = t;
    }
    if (!muted) {
      ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0.8, ctx.currentTime, 1.5); // entra poco a poco
    }
    updateButtons();
  }

  function setMood(name) {
    const key = MOODS[name] ? name : ALIAS[name];
    if (!key || key === moodName) return;
    moodName = key; mood = MOODS[key];
    if (ctx) {
      applyMood(false);
      const t = ctx.currentTime;
      nextBell = Math.min(nextBell, t + rand(...mood.bells) * 0.5);
    }
  }

  function toggle() {
    muted = !muted;
    try { localStorage.setItem("niebla.mute", muted ? "1" : "0"); } catch {}
    if (!ctx) { if (!muted) start(); updateButtons(); return; }
    if (muted) {
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
      setTimeout(() => muted && ctx.suspend(), 1200);
    } else { start(); }
    updateButtons();
  }

  // botones con data-sound se actualizan solos
  function updateButtons() {
    document.querySelectorAll("[data-sound]").forEach(b => {
      b.textContent = muted ? "♪ no" : "♪ sí";
      b.setAttribute("aria-label", muted ? "Activar música" : "Silenciar música");
      b.setAttribute("aria-pressed", String(!muted));
    });
  }
  document.addEventListener("DOMContentLoaded", updateButtons);
  if (document.readyState !== "loading") setTimeout(updateButtons);

  return { start, setMood, toggle, bell: () => bell(true), croak, get muted() { return muted; } };
})();
