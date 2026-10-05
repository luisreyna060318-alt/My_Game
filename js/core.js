/*
 * Arcade 8-Bit — núcleo
 * Bucle principal, entrada (teclado, ratón y táctil), sonido 8-bit con WebAudio,
 * menú de selección, pausa, fin de partida y récords en localStorage.
 *
 * Cada minijuego se registra con Arcade.register({ id, title, color, help, icon, create }).
 * create(api) devuelve un objeto { update(dt), draw(ctx) } y llama a api.gameOver(puntos)
 * cuando la partida termina.
 */
(function () {
  'use strict';

  const W = 480, H = 640;
  const FONT = '"Press Start 2P", "Courier New", monospace';
  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  const games = [];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));

  // ---------------------------------------------------------------- Entrada
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'fire', KeyZ: 'fire', KeyJ: 'fire',
    KeyX: 'alt', KeyK: 'alt',
    Enter: 'start', NumpadEnter: 'start',
    KeyP: 'pause',
    Escape: 'back', Backspace: 'back',
    KeyM: 'mute',
  };
  const REPEAT_DELAY = 0.17, REPEAT_RATE = 0.05;
  const actions = {};
  const act = (a) => actions[a] || (actions[a] = { down: false, pressed: false, t: 0, next: 0 });

  function press(a) {
    const s = act(a);
    if (!s.down) { s.down = true; s.pressed = true; s.t = 0; s.next = REPEAT_DELAY; }
  }
  function release(a) { act(a).down = false; }

  const input = {
    /** true mientras la acción está presionada */
    down: (a) => act(a).down,
    /** true solo en el cuadro en que se presionó */
    pressed: (a) => act(a).pressed,
    /** true al presionar y luego repetidamente mientras se mantiene (autorepeat) */
    repeat(a) {
      const s = act(a);
      if (s.pressed) return true;
      if (!s.down) return false;
      if (s.t >= s.next) { s.next += REPEAT_RATE; return true; }
      return false;
    },
    consume() { for (const k in actions) actions[k].pressed = false; },
    endFrame(dt) {
      for (const k in actions) {
        const s = actions[k];
        s.pressed = false;
        if (s.down) s.t += dt;
      }
    },
    releaseAll() { for (const k in actions) { actions[k].down = false; actions[k].pressed = false; } },
  };

  window.addEventListener('keydown', (e) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    unlockAudio();
    press(a);
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (a) release(a);
  });

  const pointer = { x: W / 2, y: H / 2, down: false, pressed: false, moved: false };
  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  }
  canvas.addEventListener('pointermove', (e) => {
    const p = toCanvas(e);
    pointer.x = p.x; pointer.y = p.y; pointer.moved = true;
  });
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    unlockAudio();
    const p = toCanvas(e);
    pointer.x = p.x; pointer.y = p.y;
    pointer.down = true; pointer.pressed = true; pointer.moved = true;
  });
  window.addEventListener('pointerup', () => { pointer.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function setupTouchPad() {
    document.querySelectorAll('#pad [data-act]').forEach((btn) => {
      const a = btn.dataset.act;
      const on = (e) => {
        e.preventDefault();
        unlockAudio();
        if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
        press(a);
        btn.classList.add('on');
      };
      const off = () => { release(a); btn.classList.remove('on'); };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  // ---------------------------------------------------------------- Sonido
  let actx = null;
  let muted = false;
  let noiseBuf = null;

  function unlockAudio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
    }
    if (actx && actx.state === 'suspended') actx.resume();
  }

  function beep(freq = 440, dur = 0.1, type = 'square', vol = 0.06, slideTo = 0) {
    if (muted || !actx) return;
    try {
      const t = actx.currentTime;
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(actx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) { /* sin sonido */ }
  }

  function noise(dur = 0.3, vol = 0.08) {
    if (muted || !actx) return;
    try {
      if (!noiseBuf) {
        noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t = actx.currentTime;
      const src = actx.createBufferSource();
      const g = actx.createGain();
      src.buffer = noiseBuf;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(g);
      g.connect(actx.destination);
      src.start(t);
      src.stop(t + dur);
    } catch (e) { /* sin sonido */ }
  }

  /** Reproduce una secuencia de notas [frecuencia, duración] */
  function melody(notes, type = 'square', vol = 0.05) {
    let delay = 0;
    for (const [f, d] of notes) {
      setTimeout(() => beep(f, d, type, vol), delay * 1000);
      delay += d;
    }
  }

  // ---------------------------------------------------------------- Récords
  const STORE = 'arcade8bit.best';
  let best = {};
  try { best = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { best = {}; }
  function saveBest() {
    try { localStorage.setItem(STORE, JSON.stringify(best)); } catch (e) { /* almacenamiento no disponible */ }
  }

  // ---------------------------------------------------------------- Dibujo
  function text(str, x, y, size = 16, color = '#fff', align = 'center') {
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillText(str, x + 2, y + 2);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  /** Bloque con biselado estilo 8-bit */
  function block(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    const b = Math.max(2, Math.floor(Math.min(w, h) / 7));
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(x, y, w, b);
    ctx.fillRect(x, y, b, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x, y + h - b, w, b);
    ctx.fillRect(x + w - b, y, b, h);
  }

  /** Crea un sprite a partir de filas de texto: cada carácter es un color de la paleta ('.' = vacío) */
  function makeSprite(rows, palette, scale = 2) {
    const c = document.createElement('canvas');
    c.width = rows[0].length * scale;
    c.height = rows.length * scale;
    const g = c.getContext('2d');
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = palette[row[x]];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x * scale, y * scale, scale, scale);
      }
    });
    return c;
  }

  function drawSprite(img, cx, cy, w = img.width, h = img.height) {
    ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
  }

  class Particles {
    constructor() { this.list = []; }
    burst(x, y, color, n = 12, speed = 160, life = 0.6) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.3 + Math.random() * 0.7);
        const l = life * (0.5 + Math.random() * 0.5);
        this.list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: l, max: l, color, size: 2 + Math.floor(Math.random() * 3) });
      }
    }
    update(dt) {
      for (const p of this.list) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
      this.list = this.list.filter((p) => p.life > 0);
    }
    draw(c) {
      for (const p of this.list) {
        c.globalAlpha = Math.max(0, p.life / p.max);
        c.fillStyle = p.color;
        c.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
      }
      c.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- Estados
  let mode = 'menu';      // menu | playing | paused | gameover
  let modeT = 0;
  let clock = 0;
  let sel = 0;
  let current = null;
  let currentDef = null;
  let result = null;

  function setMode(m) { mode = m; modeT = 0; }

  function startGame(i) {
    sel = i;
    currentDef = games[i];
    current = currentDef.create(api);
    setMode('playing');
    input.consume();
    pointer.pressed = false;
    pointer.moved = false;
    melody([[523, 0.06], [784, 0.08]]);
  }

  function toMenu() {
    current = null;
    setMode('menu');
    input.consume();
  }

  function gameOver(score, msg) {
    if (mode !== 'playing') return;
    score = Math.max(0, Math.floor(score || 0));
    const prev = best[currentDef.id] || 0;
    const isBest = score > prev;
    if (isBest) { best[currentDef.id] = score; saveBest(); }
    result = { score, best: Math.max(prev, score), isBest, msg: msg || 'FIN DEL JUEGO' };
    setMode('gameover');
    if (isBest) melody([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.25]]);
    else melody([[392, 0.15], [330, 0.15], [262, 0.3]], 'triangle', 0.08);
  }

  // ---------------------------------------------------------------- Menú
  const menuStars = Array.from({ length: 60 }, () => ({ x: rand(0, W), y: rand(0, H), v: rand(10, 50) }));

  function cardRect(i) {
    const col = i % 2, row = Math.floor(i / 2);
    return { x: 30 + col * 220, y: 150 + row * 146, w: 200, h: 130 };
  }
  function cardAt(p) {
    for (let i = 0; i < games.length; i++) {
      const r = cardRect(i);
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return i;
    }
    return -1;
  }

  function updateMenu(dt) {
    for (const s of menuStars) { s.y += s.v * dt; if (s.y > H) { s.y = 0; s.x = rand(0, W); } }
    const n = games.length;
    const old = sel;
    if (input.repeat('left')) sel = (sel + n - 1) % n;
    if (input.repeat('right')) sel = (sel + 1) % n;
    if (input.repeat('up') && sel - 2 >= 0) sel -= 2;
    if (input.repeat('down') && sel + 2 < n) sel += 2;
    if (pointer.moved) { const i = cardAt(pointer); if (i >= 0) sel = i; }
    if (sel !== old) beep(880, 0.04, 'square', 0.04);
    if (input.pressed('start') || input.pressed('fire')) { startGame(sel); return; }
    if (pointer.pressed) { const i = cardAt(pointer); if (i >= 0) startGame(i); }
  }

  function drawMenu() {
    ctx.fillStyle = '#0b0b1e';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    for (const s of menuStars) ctx.fillRect(Math.round(s.x), Math.round(s.y), s.v > 35 ? 2 : 1, s.v > 35 ? 2 : 1);

    // Título con ondas de color
    const title = 'ARCADE 8-BIT';
    const size = 28;
    ctx.font = `${size}px ${FONT}`;
    const tw = ctx.measureText(title).width;
    let x = W / 2 - tw / 2;
    for (let i = 0; i < title.length; i++) {
      const ch = title[i];
      const cw = ctx.measureText(ch).width;
      const hue = (clock * 90 + i * 25) % 360;
      text(ch, x + cw / 2, 56 + Math.sin(clock * 4 + i * 0.6) * 5, size, `hsl(${hue},100%,65%)`);
      x += cw;
    }
    text('ELIGE UN MINIJUEGO', W / 2, 108, 10, '#9ea0ff');
    text(muted ? 'SONIDO: NO' : 'SONIDO: SI', W - 10, 14, 8, '#666', 'right');

    games.forEach((g, i) => {
      const r = cardRect(i);
      const active = i === sel;
      const lift = active ? Math.sin(clock * 6) * 2 - 2 : 0;
      ctx.save();
      ctx.translate(0, lift);
      ctx.fillStyle = active ? '#23235a' : '#15153a';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      if (active) { ctx.shadowColor = g.color; ctx.shadowBlur = 18; }
      ctx.strokeStyle = active ? g.color : '#3a3a6a';
      ctx.lineWidth = active ? 4 : 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.shadowBlur = 0;

      // Icono animado del juego
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x + 8, r.y + 8, r.w - 16, 72);
      ctx.clip();
      ctx.fillStyle = '#05050f';
      ctx.fillRect(r.x + 8, r.y + 8, r.w - 16, 72);
      if (g.icon) g.icon(ctx, r.x + 8, r.y + 8, r.w - 16, 72, active ? clock : 0);
      ctx.restore();

      text(g.title, r.x + r.w / 2, r.y + 97, g.title.length > 12 ? 9 : 12, active ? g.color : '#fff');
      text('RECORD ' + (best[g.id] || 0), r.x + r.w / 2, r.y + 117, 8, '#aaa');
      ctx.restore();
    });

    const g = games[sel];
    if (g) text(g.help, W / 2, 596, 8, '#ddd');
    if (Math.floor(clock * 2) % 2 === 0) text('ENTER JUGAR  P PAUSA  ESC MENU  M SONIDO', W / 2, 622, 8, '#888');
  }

  // ---------------------------------------------------------------- Capas
  function dim(alpha = 0.65) {
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  function drawPaused() {
    dim();
    text('PAUSA', W / 2, H / 2 - 40, 32, '#ffd23f');
    text('P o ENTER: CONTINUAR', W / 2, H / 2 + 20, 10);
    text('ESC: MENU', W / 2, H / 2 + 46, 10);
  }

  function drawGameOver() {
    dim(0.7);
    const msg = result.msg;
    text(msg, W / 2, H / 2 - 90, msg.length > 10 ? 20 : 26, '#ff4d6d');
    text('PUNTOS: ' + result.score, W / 2, H / 2 - 30, 14);
    text('RECORD: ' + result.best, W / 2, H / 2, 14, '#9ea0ff');
    if (result.isBest && Math.floor(clock * 4) % 2 === 0) text('NUEVO RECORD!', W / 2, H / 2 + 36, 14, '#ffd23f');
    if (modeT > 0.6) {
      text('ENTER: REINTENTAR', W / 2, H / 2 + 86, 10);
      text('ESC: MENU', W / 2, H / 2 + 112, 10);
    }
  }

  // ---------------------------------------------------------------- Bucle
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    clock += dt;
    modeT += dt;

    if (input.pressed('mute')) muted = !muted;

    switch (mode) {
      case 'menu':
        updateMenu(dt);
        break;
      case 'playing':
        if (input.pressed('pause') || input.pressed('start')) setMode('paused');
        else if (input.pressed('back')) toMenu();
        else current.update(dt);
        break;
      case 'paused':
        if (input.pressed('pause') || input.pressed('start') || pointer.pressed) setMode('playing');
        else if (input.pressed('back')) toMenu();
        break;
      case 'gameover':
        if (modeT > 0.6 && (input.pressed('start') || pointer.pressed)) startGame(sel);
        else if (input.pressed('back')) toMenu();
        break;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    if (mode === 'menu' || !current) {
      drawMenu();
    } else {
      current.draw(ctx);
      if (mode === 'paused') drawPaused();
      else if (mode === 'gameover') drawGameOver();
    }

    input.endFrame(dt);
    pointer.pressed = false;
    pointer.moved = false;
    requestAnimationFrame(frame);
  }

  window.addEventListener('blur', () => {
    input.releaseAll();
    if (mode === 'playing') setMode('paused');
  });

  // ---------------------------------------------------------------- API pública
  const api = {
    W, H, FONT, input, pointer,
    beep, noise, melody,
    text, block, makeSprite, drawSprite, Particles,
    clamp, rand, randInt,
    gameOver,
    best: (id) => best[id] || 0,
  };

  window.Arcade = Object.assign({}, api, {
    games,
    register(def) { games.push(def); },
    start() {
      setupTouchPad();
      if (document.fonts && document.fonts.load) document.fonts.load(`16px ${FONT}`).catch(() => {});
      requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
    },
  });
})();
