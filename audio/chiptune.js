/*
 * CHIPTUNE 8-BIT (estilo NES / Game Boy), generado en tiempo real
 * Cuatro canales como la consola original:
 *  - pulso 1: melodía (onda cuadrada de ancho variable, con vibrato)
 *  - pulso 2: arpegios
 *  - triángulo: bajo y "bombo"
 *  - ruido: viento, latidos, platillos
 * Cada lugar tiene su propia pieza. Al cambiar de lugar, la música cambia al empezar el compás siguiente.
 *
 * Misma API que Ambient: start(), setMood(nombre), toggle(), bell(), croak()
 *
 * Cómo se escriben las melodías: 16 casillas por compás (semicorcheas).
 *   número = nota (semitonos sobre la nota base, 0 = re)
 *   "-"    = mantener la nota anterior
 *   "."    = silencio
 */
const Chiptune = (() => {
  const D = 62; // re4

  // acordes en semitonos respecto a re
  const Dm = [0, 3, 7], Eb = [1, 5, 8], C = [-2, 2, 5], Bb = [-4, 0, 3], Gm = [5, 8, 12], A = [-5, -1, 2];
  const Ddim = [0, 3, 6], Ebdim = [1, 4, 7], DM = [0, 4, 7], F = [3, 7, 10];

  const SONGS = {
    claro: {
      bpm: 72, prog: [Dm, Eb, Dm, C], arp: { rate: 2, oct: 12, duty: 0.125, vol: 0.05 }, bass: "long",
      lead: [
        "7 - - - - - 8 - 7 - - - 5 - - -",
        "3 - - - - - - - 1 - - - - - . .",
        "7 - - - 10 - - - 8 - 7 - 5 - - -",
        "3 - 2 - 0 - - - - - - - . . . .",
      ], leadEvery: 2, duty: 0.25, drums: "pasos",
    },
    candil: {
      bpm: 78, prog: [Dm, F, C, Dm], arp: { rate: 1, oct: 12, duty: 0.125, vol: 0.045 }, bass: "pulse",
      lead: [
        "12 - - - 10 - 12 - 15 - - - 14 - - -",
        "12 - - - - - - - 10 - - - . . . .",
        "8 - - - 7 - 8 - 10 - - - 7 - - -",
        "5 - - - 3 - 2 - 0 - - - - - . .",
      ], leadEvery: 1, duty: 0.5, drums: "pasos",
    },
    bosque: {
      bpm: 92, prog: [Ddim, Ddim, Ebdim, Ddim], arp: { rate: 1, oct: 0, duty: 0.125, vol: 0.035 }, bass: "ostinato",
      lead: [
        "12 - - - 11 - - - 12 - - - 13 - - -",
        "12 - - - - - - - . . . . . . . .",
        "6 - - - 7 - - - 6 - - - 5 - - -",
        "6 - - - - - - - . . . . . . . .",
      ], leadEvery: 1, duty: 0.25, drums: "latido",
    },
    fuegos: {
      bpm: 104, prog: [Dm, Bb, C, Dm], arp: { rate: 1, oct: 24, duty: 0.125, vol: 0.04 }, bass: "pulse",
      lead: [
        "19 . . . . . 22 . . . 17 . . . . .",
        ". . 15 . . . . . 19 . . . . . . .",
        "22 . . . 24 . . . 19 . . . . . 17 .",
        ". . . . 15 . . . . . . . . . . .",
      ], leadEvery: 1, duty: 0.125, drums: "brillo",
    },
    puente: {
      bpm: 60, prog: [[0, 7, 12], [0, 7, 12], [1, 8, 13], [0, 7, 12]], arp: null, bass: "long",
      lead: [
        "12 - - - - - - - 10 - - - 8 - - -",
        "7 - - - - - - - - - - - . . . .",
        "5 - - - 7 - - - 8 - - - 7 - - -",
        "1 - - - - - - - - - - - . . . .",
      ], leadEvery: 1, duty: 0.25, drums: "viento",
    },
    lago: {
      bpm: 66, prog: [Dm, Gm, Bb, A], arp: { rate: 2, oct: 12, duty: 0.25, vol: 0.04 }, bass: "long",
      lead: [
        "15 - - - 14 - 12 - - - - - . . . .",
        "12 - - - 10 - 8 - - - - - . . . .",
        "10 - - - 8 - 7 - - - 5 - - - . .",
        "7 - - - - - 6 - 7 - - - - - - -",
      ], leadEvery: 1, duty: 0.5, drums: null,
    },
    cabana: { // caja de música con la quinta que sube: cliché de terror
      bpm: 76, prog: [Dm, [0, 3, 8], [0, 3, 9], [0, 3, 8]], arp: { rate: 2, oct: 0, duty: 0.25, vol: 0.03 }, bass: "long",
      lead: [
        "24 . 22 . 19 . 22 . 24 . . . . . . .",
        "24 . 22 . 20 . 22 . 24 . . . . . . .",
        "24 . 22 . 21 . 22 . 24 . . . . . . .",
        "19 . . . 15 . . . 12 . . . . . . .",
      ], leadEvery: 1, duty: 0.125, drums: null,
    },
    oscuro: {
      bpm: 56, prog: [[0, 1], [0, 1], [0, 1], [0, 6]], arp: null, bass: "sub",
      lead: [
        ". . . . . . . . . . . . . . . .",
        ". . . . . . . . 25 - - - . . . .",
        ". . . . . . . . . . . . . . . .",
        ". . . . 24 - - - . . . . . . . .",
      ], leadEvery: 1, duty: 0.125, drums: "latido",
    },
    niebla: {
      bpm: 58, prog: [Ddim, Ddim, Ebdim, Ddim], arp: { rate: 2, oct: 0, duty: 0.125, vol: 0.03 }, bass: "long",
      lead: [
        "12 - - - - - - - 11 - - - - - - -",
        "10 - - - - - - - 9 - - - - - - -",
        "8 - - - - - - - 7 - - - - - - -",
        "6 - - - - - - - - - - - . . . .",
      ], leadEvery: 1, duty: 0.25, drums: "viento",
    },
    final: { // por fin un acorde mayor
      bpm: 64, prog: [DM, C, A, DM], arp: { rate: 2, oct: 12, duty: 0.25, vol: 0.04 }, bass: "long",
      lead: [
        "16 - - - 14 - 12 - 14 - - - - - . .",
        "12 - - - 10 - 9 - 7 - - - - - . .",
        "4 - - - 7 - 9 - 11 - - - 9 - - -",
        "12 - - - - - - - - - - - - - . .",
      ], leadEvery: 1, duty: 0.5, drums: null,
    },
  };
  const ALIAS = { luz: "final", ventana: "final", sendero: "puente" };

  // convierte "7 - - . 5" en notas con duración
  const parse = s => {
    const tok = s.trim().split(/\s+/), ev = [];
    tok.forEach((t, i) => {
      if (t === "-" || t === ".") return;
      let len = 1;
      while (tok[i + len] === "-") len++;
      ev[i] = { n: +t, len };
    });
    return ev;
  };
  Object.values(SONGS).forEach(s => { s.leadEv = s.lead.map(parse); });

  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  let ctx = null, master, echoIn, waves = {}, noiseBuf, noiseShort;
  let song = SONGS.claro, songName = "claro", pending = null;
  let muted = false, started = false, timer = null;
  let nextTime = 0, step = 0, bar = 0;
  try { muted = localStorage.getItem("niebla.mute") === "1"; } catch {}

  // ---------- instrumentos ----------
  function pulseWave(duty) { // onda de pulso limitada en banda (como el chip de la NES)
    if (waves[duty]) return waves[duty];
    const N = 40, re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++) re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    return (waves[duty] = ctx.createPeriodicWave(re, im));
  }
  function triWave() { // triángulo "escalonado" de 4 bits, como la NES
    if (waves.tri) return waves.tri;
    const N = 32, samples = 64, re = new Float32Array(N), im = new Float32Array(N);
    const wave = [];
    for (let i = 0; i < samples; i++) {
      const ph = i / samples, v = ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4;
      wave.push(Math.round((v + 1) * 7.5) / 7.5 - 1);
    }
    for (let n = 1; n < N; n++) {
      let a = 0, b = 0;
      wave.forEach((v, i) => { const x = 2 * Math.PI * n * i / samples; a += v * Math.cos(x); b += v * Math.sin(x); });
      re[n] = a / samples * 2; im[n] = b / samples * 2;
    }
    return (waves.tri = ctx.createPeriodicWave(re, im));
  }
  function lfsrNoise(short) { // ruido de registro de desplazamiento, como el chip original
    const len = ctx.sampleRate, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let reg = 1, v = 0;
    const hold = 6; // muestrear más lento le da textura "crujiente"
    for (let i = 0; i < len; i++) {
      if (i % hold === 0) {
        const bit = (reg ^ (reg >> (short ? 6 : 1))) & 1;
        reg = (reg >> 1) | (bit << 14);
        v = reg & 1 ? 1 : -1;
      }
      d[i] = v;
    }
    return buf;
  }

  function note(wave, n, t, dur, vol, dest, vib = false) {
    const o = ctx.createOscillator();
    o.setPeriodicWave(wave);
    o.frequency.value = hz(n);
    const g = ctx.createGain();
    // envolvente "a escalones", como el control de volumen de 4 bits
    g.gain.setValueAtTime(vol, t);
    g.gain.setValueAtTime(vol * 0.75, t + 0.06);
    g.gain.setValueAtTime(vol * 0.6, t + Math.min(dur * 0.5, 0.3));
    g.gain.setValueAtTime(0, t + dur * 0.95);
    if (vib && dur > 0.3) { // vibrato que entra tarde
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(12, t + Math.min(dur, 0.6));
      l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(t + dur);
    }
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur);
  }
  function noise(t, dur, vol, rate = 1, short = false, swell = false) {
    const s = ctx.createBufferSource();
    s.buffer = short ? noiseShort : noiseBuf;
    s.playbackRate.value = rate;
    const g = ctx.createGain();
    if (swell) {
      g.gain.setValueAtTime(0, t);
      for (let k = 1; k <= 8; k++) g.gain.setValueAtTime(vol * Math.sin(k / 8 * Math.PI), t + dur * k / 9);
      g.gain.setValueAtTime(0, t + dur);
    } else {
      g.gain.setValueAtTime(vol, t);
      g.gain.setValueAtTime(vol * 0.4, t + dur * 0.4);
      g.gain.setValueAtTime(0, t + dur);
    }
    s.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.01);
  }
  function kick(t, vol = 0.35) {
    const o = ctx.createOscillator(); o.setPeriodicWave(triWave());
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(0, t + 0.14);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.15);
  }

  // ---------- secuenciador ----------
  function playStep(t) {
    const s = song, sd = 60 / s.bpm / 4;
    const chord = s.prog[bar % s.prog.length];
    // bajo (triángulo)
    const root = D - 24 + chord[0];
    if (s.bass === "long" && step === 0) note(triWave(), root, t, sd * 16, 0.32, master);
    if (s.bass === "pulse" && step % 4 === 0) note(triWave(), root + (step === 8 ? 12 : 0), t, sd * 3, 0.3, master);
    if (s.bass === "ostinato" && step % 2 === 0) note(triWave(), root + (step % 8 === 6 ? 6 : 0), t, sd * 1.5, 0.3, master);
    if (s.bass === "sub" && step === 0) note(triWave(), root - 12, t, sd * 14, 0.4, master);
    // arpegio (pulso 2)
    if (s.arp && step % s.arp.rate === 0) {
      const k = (step / s.arp.rate) | 0;
      const n = D + s.arp.oct + chord[k % chord.length] + (k % (chord.length * 2) >= chord.length ? 12 : 0);
      note(pulseWave(s.arp.duty), n, t, sd * s.arp.rate * 0.9, s.arp.vol, echoIn);
    }
    // melodía (pulso 1): solo en algunas vueltas, para dejar respirar
    const cycle = (bar / 4) | 0;
    if (cycle % s.leadEvery === 0) {
      const ev = s.leadEv[bar % 4][step];
      if (ev) note(pulseWave(s.duty), D + ev.n, t, sd * ev.len, 0.07, echoIn, true);
    }
    // percusión (ruido + triángulo)
    switch (s.drums) {
      case "pasos": if (step === 4 || step === 12) noise(t, 0.05, 0.03, 0.6, true); break;
      case "latido": if (step === 0 || step === 3) kick(t, step ? 0.22 : 0.34); break;
      case "brillo": if (step % 4 === 2) noise(t, 0.03, 0.025, 2.5, true); break;
      case "viento": if (step === 0 && bar % 2 === 0) noise(t, sd * 28, 0.05, 0.25, false, true); break;
    }
  }

  function tick() {
    if (!ctx || muted || ctx.state !== "running") return;
    while (nextTime < ctx.currentTime + 0.15) {
      if (step === 0 && pending) { song = pending; pending = null; bar = 0; }
      playStep(nextTime);
      nextTime += 60 / song.bpm / 4;
      step = (step + 1) % 16;
      if (step === 0) bar++;
    }
  }

  // ---------- construcción ----------
  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 0.0001; master.connect(comp);
    // eco: un clásico truco de las bandas sonoras de 8 bits
    echoIn = ctx.createGain(); echoIn.connect(master);
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.33;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    echoIn.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
    noiseBuf = lfsrNoise(false);
    noiseShort = lfsrNoise(true);
    timer = setInterval(tick, 25);
    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend();
      else if (!muted) ctx.resume().then(() => { nextTime = Math.max(nextTime, ctx.currentTime + 0.05); });
    });
  }

  // ---------- efectos ----------
  function bell() { // campana 8-bit: dos pulsos desafinados con eco
    if (!ctx || muted) return;
    const t = ctx.currentTime + 0.05;
    [[D + 12, 0.5, 0.06], [D + 19.3, 0.25, 0.03], [D + 24, 0.125, 0.025]].forEach(([n, duty, v]) => {
      const o = ctx.createOscillator(); o.setPeriodicWave(pulseWave(duty)); o.frequency.value = hz(n);
      const g = ctx.createGain();
      for (let k = 0; k < 12; k++) g.gain.setValueAtTime(v * Math.pow(0.72, k), t + k * 0.15);
      g.gain.setValueAtTime(0, t + 1.8);
      o.connect(g); g.connect(echoIn); o.start(t); o.stop(t + 1.9);
    });
  }
  function croak() { // rana: pulsos rápidos de onda estrecha
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + 0.02;
    const o = ctx.createOscillator(); o.setPeriodicWave(pulseWave(0.125));
    o.frequency.setValueAtTime(110, t0); o.frequency.linearRampToValueAtTime(82, t0 + 0.6);
    const g = ctx.createGain(); g.gain.value = 0;
    [0, 0.3].forEach(off => {
      for (let k = 0; k < 8; k++) { g.gain.setValueAtTime(0.14, t0 + off + k * 0.03); g.gain.setValueAtTime(0, t0 + off + k * 0.03 + 0.015); }
    });
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.65);
  }

  // ---------- API ----------
  function start() {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch {}
    if (!ctx) build();
    if (!started) { started = true; nextTime = ctx.currentTime + 0.3; }
    if (!muted) {
      ctx.resume().then(() => { nextTime = Math.max(nextTime, ctx.currentTime + 0.05); });
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.4);
    }
    updateButtons();
  }
  function setMood(name) {
    const key = SONGS[name] ? name : ALIAS[name];
    if (!key || key === songName) return;
    songName = key;
    pending = SONGS[key]; // cambia al empezar el compás siguiente
  }
  function toggle() {
    muted = !muted;
    try { localStorage.setItem("niebla.mute", muted ? "1" : "0"); } catch {}
    if (!ctx) { if (!muted) start(); updateButtons(); return; }
    if (muted) {
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
      setTimeout(() => muted && ctx.suspend(), 500);
    } else start();
    updateButtons();
  }
  function updateButtons() {
    document.querySelectorAll("[data-sound]").forEach(b => {
      b.textContent = muted ? "♪ no" : "♪ sí";
      b.setAttribute("aria-label", muted ? "Activar música" : "Silenciar música");
      b.setAttribute("aria-pressed", String(!muted));
    });
  }
  document.addEventListener("DOMContentLoaded", updateButtons);
  if (document.readyState !== "loading") setTimeout(updateButtons);

  return { start, setMood, toggle, bell, croak, get muted() { return muted; } };
})();
