/*
 * MOTOR NARRATIVO
 * Lleva la escena actual, las banderas (decisiones) y los finales descubiertos.
 * Guarda el progreso en localStorage.
 */
(() => {
  const SAVE_KEY = "niebla.save";
  const ENDINGS_KEY = "niebla.endings";
  const TYPE_SPEED = 22; // ms por letra

  const $ = id => document.getElementById(id);
  const titleEl = $("title"), gameEl = $("game");
  const textEl = $("text"), choicesEl = $("choices");

  const store = {
    get(k, fallback) {
      try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  const TOTAL_ENDINGS = Object.values(STORY.scenes).filter(s => s.ending).length;
  let state = null;
  let typing = null;

  const check = (cond, flags) => {
    if (!cond) return true;
    return cond.startsWith("!") ? !flags[cond.slice(1)] : !!flags[cond];
  };

  function showTitle() {
    gameEl.hidden = true;
    titleEl.hidden = false;
    $("btn-continue").hidden = !store.get(SAVE_KEY, null);
    const found = store.get(ENDINGS_KEY, []);
    $("endings-count").textContent = found.length
      ? `Finales descubiertos: ${found.length}/${TOTAL_ENDINGS}`
      : "";
    Render.show({ art: "claro", fog: 0.8 }, {});
  }

  function startGame(saved) {
    state = saved || { scene: STORY.start, flags: {} };
    titleEl.hidden = true;
    gameEl.hidden = false;
    goTo(state.scene);
  }

  function goTo(id) {
    const scene = STORY.scenes[id];
    if (!scene) { console.error("Escena no encontrada:", id); return; }
    state.scene = id;
    Render.show(scene, state.flags);

    if (scene.ending) {
      const found = store.get(ENDINGS_KEY, []);
      if (!found.includes(id)) store.set(ENDINGS_KEY, [...found, id]);
      store.del(SAVE_KEY);
    } else {
      store.set(SAVE_KEY, state);
    }

    choicesEl.innerHTML = "";
    typeText(scene.text, () => showChoices(scene));
  }

  function typeText(paragraphs, done) {
    textEl.innerHTML = "";
    const ps = paragraphs.map(() => {
      const p = document.createElement("p");
      textEl.appendChild(p);
      return p;
    });
    let pi = 0, ci = 0;
    const cursor = document.createElement("span");
    cursor.className = "cursor";
    cursor.textContent = "_";

    const finish = () => {
      clearInterval(typing.timer);
      paragraphs.forEach((txt, i) => { ps[i].textContent = txt; });
      typing = null;
      done();
    };

    const timer = setInterval(() => {
      if (pi >= paragraphs.length) return finish();
      ci++;
      ps[pi].textContent = paragraphs[pi].slice(0, ci);
      ps[pi].appendChild(cursor);
      if (ci >= paragraphs[pi].length) { pi++; ci = 0; }
    }, TYPE_SPEED);
    typing = { timer, finish };
  }

  function showChoices(scene) {
    choicesEl.innerHTML = "";
    if (scene.ending) {
      const t = document.createElement("strong");
      t.className = "ending-title";
      t.textContent = `— FINAL: ${scene.ending} —`;
      textEl.appendChild(t);
      addButton("Volver al inicio", showTitle, 0);
      return;
    }
    scene.choices
      .filter(c => check(c.if, state.flags))
      .forEach((c, i) => addButton(c.text, () => choose(c), i));
  }

  function addButton(label, onClick, i) {
    const b = document.createElement("button");
    b.className = "choice";
    b.textContent = label;
    b.style.animationDelay = `${i * 0.12}s`;
    b.addEventListener("click", onClick, { once: true });
    choicesEl.appendChild(b);
  }

  function choose(choice) {
    if (navigator.vibrate) navigator.vibrate(12);
    Object.assign(state.flags, choice.set || {});
    goTo(choice.to);
  }

  // Tocar el texto completa la frase de golpe
  textEl.addEventListener("click", () => typing && typing.finish());

  $("btn-new").addEventListener("click", () => { store.del(SAVE_KEY); startGame(null); });
  $("btn-continue").addEventListener("click", () => startGame(store.get(SAVE_KEY, null)));

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  showTitle();
})();
