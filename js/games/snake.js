/* SNAKE — come manzanas, crece y no choques. Cada 5 manzanas aparece una estrella de bonus */
(function () {
  'use strict';

  const COLS = 20, ROWS = 23, S = 24, OY = 64;
  const DIRS = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };

  function drawApple(c, x, y, s) {
    const u = s / 8;
    c.fillStyle = '#e8262f';
    c.fillRect(x + u, y + 2 * u, 6 * u, 5 * u);
    c.fillRect(x + 2 * u, y + u * 1.5, 4 * u, 6.5 * u);
    c.fillStyle = '#ff7a7a';
    c.fillRect(x + 2 * u, y + 3 * u, u, 2 * u);
    c.fillStyle = '#6b3a12';
    c.fillRect(x + 3.5 * u, y, u, 2 * u);
    c.fillStyle = '#3ddc5a';
    c.fillRect(x + 4.5 * u, y + 0.5 * u, 2 * u, u);
  }

  function drawStar(c, x, y, s) {
    const u = s / 8;
    c.fillStyle = '#ffd23f';
    c.fillRect(x + 3 * u, y, 2 * u, 8 * u);
    c.fillRect(x, y + 3 * u, 8 * u, 2 * u);
    c.fillRect(x + 2 * u, y + 2 * u, 4 * u, 4 * u);
    c.fillStyle = '#fff6b0';
    c.fillRect(x + 3 * u, y + 3 * u, u, u);
  }

  Arcade.register({
    id: 'snake',
    title: 'SNAKE',
    color: '#5cff5c',
    help: 'FLECHAS CAMBIAR DIRECCION  COME Y CRECE',

    icon(c, x, y, w, h, t) {
      const s = 12;
      c.fillStyle = '#0d2b12';
      c.fillRect(x, y, w, h);
      const n = 9;
      const head = Math.floor(t * 6);
      for (let i = 0; i < n; i++) {
        const p = head - i;
        const px = x + ((p % 12 + 12) % 12) * s + 10;
        const py = y + h / 2 - s / 2 + Math.round(Math.sin(p * 0.6) * 1) * s;
        Arcade.block(px, py, s, s, i === 0 ? '#8dff8d' : '#2fbf4a');
      }
      drawApple(c, x + w - 28, y + 10, 16);
    },

    create(api) {
      const { W, H, input } = api;
      let snake = [{ x: 6, y: 11 }, { x: 5, y: 11 }, { x: 4, y: 11 }];
      let dir = DIRS.right;
      const queue = [];
      let food = null, bonus = null;
      let step = 0.14, acc = 0, score = 0, eaten = 0, t = 0;
      let dead = false, deadT = 0, won = false;
      const fx = new api.Particles();

      function freeCell() {
        const occ = new Set(snake.map((p) => p.x + ',' + p.y));
        if (food) occ.add(food.x + ',' + food.y);
        if (bonus) occ.add(bonus.x + ',' + bonus.y);
        const cells = [];
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!occ.has(x + ',' + y)) cells.push({ x, y });
        return cells.length ? cells[Math.floor(Math.random() * cells.length)] : null;
      }
      food = freeCell();

      function die() {
        dead = true;
        deadT = 1.2;
        const h = snake[0];
        fx.burst(h.x * S + S / 2, OY + h.y * S + S / 2, '#5cff5c', 24, 180, 0.8);
        api.noise(0.5, 0.12);
      }

      function tick() {
        if (queue.length) dir = queue.shift();
        const h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        const grow = food && h.x === food.x && h.y === food.y;
        const body = grow ? snake : snake.slice(0, -1);
        if (h.x < 0 || h.y < 0 || h.x >= COLS || h.y >= ROWS || body.some((p) => p.x === h.x && p.y === h.y)) {
          die();
          return;
        }
        snake.unshift(h);
        if (grow) {
          eaten++;
          score += 10;
          step = Math.max(0.055, step * 0.97);
          api.beep(660, 0.05, 'square', 0.05, 990);
          fx.burst(h.x * S + S / 2, OY + h.y * S + S / 2, '#e8262f', 10, 120, 0.4);
          food = freeCell();
          if (!food) { won = true; dead = true; deadT = 1; return; }
          if (eaten % 5 === 0 && !bonus) {
            const b = freeCell();
            if (b) bonus = { x: b.x, y: b.y, t: 6 };
          }
        } else {
          snake.pop();
        }
        if (bonus && h.x === bonus.x && h.y === bonus.y) {
          score += 50;
          fx.burst(h.x * S + S / 2, OY + h.y * S + S / 2, '#ffd23f', 16, 150, 0.6);
          api.melody([[880, 0.05], [1175, 0.05], [1568, 0.1]]);
          bonus = null;
        }
      }

      return {
        update(dt) {
          t += dt;
          fx.update(dt);
          if (dead) {
            deadT -= dt;
            if (deadT <= 0) api.gameOver(won ? score + 1000 : score, won ? 'GANASTE!' : null);
            return;
          }
          for (const k in DIRS) {
            if (!input.pressed(k)) continue;
            const last = queue.length ? queue[queue.length - 1] : dir;
            const d = DIRS[k];
            const opposite = d.x === -last.x && d.y === -last.y;
            const same = d.x === last.x && d.y === last.y;
            if (queue.length < 3 && !opposite && !same) queue.push(d);
          }
          if (bonus) { bonus.t -= dt; if (bonus.t <= 0) bonus = null; }
          acc += dt;
          while (acc >= step && !dead) { acc -= step; tick(); }
        },

        draw(c) {
          c.fillStyle = '#071a0b';
          c.fillRect(0, 0, W, H);
          for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
              c.fillStyle = (x + y) % 2 ? '#0d2b12' : '#10331a';
              c.fillRect(x * S, OY + y * S, S, S);
            }
          }
          c.strokeStyle = '#5cff5c';
          c.lineWidth = 2;
          c.strokeRect(1, OY - 1, W - 2, ROWS * S + 2);

          if (food) drawApple(c, food.x * S + 2, OY + food.y * S + 2, S - 4);
          if (bonus && (bonus.t > 2 || Math.floor(t * 8) % 2)) drawStar(c, bonus.x * S + 2, OY + bonus.y * S + 2, S - 4);

          const n = snake.length;
          snake.forEach((p, i) => {
            let color;
            if (dead && !won) color = Math.floor(t * 10) % 2 ? '#ff4d4d' : '#7a1010';
            else {
              const k = i / Math.max(1, n - 1);
              color = `rgb(${Math.round(60 - 30 * k)},${Math.round(230 - 90 * k)},${Math.round(80 - 30 * k)})`;
            }
            api.block(p.x * S + 1, OY + p.y * S + 1, S - 2, S - 2, color);
          });
          // Ojos
          const h = snake[0];
          const hx = h.x * S, hy = OY + h.y * S;
          c.fillStyle = '#000';
          const e1 = dir.x !== 0 ? [hx + (dir.x > 0 ? 15 : 5), hy + 5] : [hx + 5, hy + (dir.y > 0 ? 15 : 5)];
          const e2 = dir.x !== 0 ? [e1[0], hy + 15] : [hx + 15, e1[1]];
          c.fillRect(e1[0], e1[1], 4, 4);
          c.fillRect(e2[0], e2[1], 4, 4);

          fx.draw(c);

          api.text('SNAKE', 12, 22, 14, '#5cff5c', 'left');
          api.text('PUNTOS ' + score, W - 12, 18, 10, '#fff', 'right');
          api.text('RECORD ' + Math.max(score, api.best('snake')), W - 12, 40, 8, '#9ea0ff', 'right');
          api.text('LARGO ' + n, 12, 46, 8, '#aaa', 'left');
          if (t < 2) api.text('USA LAS FLECHAS', W / 2, OY + ROWS * S / 2 - 60, 12, '#fff');
        },
      };
    },
  });
})();
