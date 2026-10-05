/* BREAKOUT — rompe todos los ladrillos. Los plateados necesitan dos golpes */
(function () {
  'use strict';

  const COLS = 10, BW = 44, BH = 18, GAP = 2, TOP = 44;
  const BX = (480 - (COLS * (BW + GAP) - GAP)) / 2, BY = 96;
  const ROW_COLORS = ['#f0453a', '#f59a27', '#f5e027', '#3ddc5a', '#2ee6e6', '#3a6df0', '#b45cff', '#ff66cc'];

  Arcade.register({
    id: 'breakout',
    title: 'BREAKOUT',
    color: '#ffb84d',
    help: 'IZQ/DER O RATON MOVER  ESPACIO LANZAR',

    icon(c, x, y, w, h, t) {
      const bw = 20, bh = 8, n = Math.floor(w / (bw + 2));
      const ox = x + (w - n * (bw + 2)) / 2;
      for (let r = 0; r < 3; r++) {
        for (let k = 0; k < n; k++) Arcade.block(ox + k * (bw + 2), y + 6 + r * (bh + 2), bw, bh, ROW_COLORS[r]);
      }
      const px = x + w / 2 + Math.sin(t * 2) * 50;
      Arcade.block(px - 20, y + h - 10, 40, 6, '#ffb84d');
      const bx = x + w / 2 + Math.sin(t * 2.3) * 60, by = y + 40 + Math.abs(Math.sin(t * 3)) * -10 + 10;
      c.fillStyle = '#fff';
      c.fillRect(bx - 3, by - 3, 6, 6);
    },

    create(api) {
      const { W, H, input, pointer, rand, clamp } = api;
      const pad = { x: W / 2, y: H - 48, w: 84, h: 12 };
      let ball = null, bricks = [];
      let lives = 3, level = 0, score = 0, t = 0;
      const fx = new api.Particles();

      function resetBall() {
        ball = { x: pad.x, y: pad.y - pad.h / 2 - 7, vx: 0, vy: 0, r: 6, stuck: true, speed: 320 + (level - 1) * 25 };
      }

      function build() {
        level++;
        bricks = [];
        const rows = Math.min(8, 4 + level);
        for (let r = 0; r < rows; r++) {
          for (let k = 0; k < COLS; k++) {
            if (level % 3 === 0 && (r + k) % 2) continue;
            const hard = (level >= 2 && r === 0) || (level >= 4 && r === 1);
            bricks.push({
              x: BX + k * (BW + GAP), y: BY + r * (BH + GAP), w: BW, h: BH,
              hp: hard ? 2 : 1, color: hard ? '#c8c8d8' : ROW_COLORS[r % ROW_COLORS.length],
              pts: (rows - r) * 10 + (hard ? 20 : 0),
            });
          }
        }
        resetBall();
      }
      build();

      function launch() {
        const a = rand(-0.4, 0.4);
        ball.vx = Math.sin(a) * ball.speed;
        ball.vy = -Math.cos(a) * ball.speed;
        ball.stuck = false;
        api.beep(523, 0.06);
      }

      function hitBrick(b) {
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        const ox = b.w / 2 + ball.r - Math.abs(ball.x - cx);
        const oy = b.h / 2 + ball.r - Math.abs(ball.y - cy);
        if (ox < oy) ball.vx = ball.x < cx ? -Math.abs(ball.vx) : Math.abs(ball.vx);
        else ball.vy = ball.y < cy ? -Math.abs(ball.vy) : Math.abs(ball.vy);
        b.hp--;
        if (b.hp <= 0) {
          b.dead = true;
          score += b.pts;
          fx.burst(cx, cy, b.color, 10, 140, 0.5);
          api.beep(300 + (BY + 8 * (BH + GAP) - b.y) * 4, 0.05, 'square', 0.05);
        } else {
          b.color = '#7a7a8a';
          api.beep(1400, 0.04, 'square', 0.04);
        }
        ball.speed = Math.min(ball.speed * 1.012, 640);
        const k = ball.speed / Math.hypot(ball.vx, ball.vy);
        ball.vx *= k;
        ball.vy *= k;
      }

      return {
        update(dt) {
          t += dt;
          fx.update(dt);

          const mv = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
          pad.x += mv * 460 * dt;
          if (pointer.moved) pad.x = pointer.x;
          pad.x = clamp(pad.x, pad.w / 2, W - pad.w / 2);

          if (ball.stuck) {
            ball.x = pad.x;
            ball.y = pad.y - pad.h / 2 - ball.r - 1;
            if (input.pressed('fire') || input.pressed('up') || pointer.pressed) launch();
            return;
          }

          const steps = Math.max(1, Math.ceil((ball.speed * dt) / 4));
          const h = dt / steps;
          for (let i = 0; i < steps; i++) {
            ball.x += ball.vx * h;
            ball.y += ball.vy * h;
            if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); api.beep(200, 0.03); }
            if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); api.beep(200, 0.03); }
            if (ball.y < TOP + ball.r) { ball.y = TOP + ball.r; ball.vy = Math.abs(ball.vy); api.beep(200, 0.03); }

            // Paleta: el ángulo depende de dónde golpea
            if (ball.vy > 0 && ball.y + ball.r >= pad.y - pad.h / 2 && ball.y - ball.r <= pad.y + pad.h / 2 &&
                Math.abs(ball.x - pad.x) <= pad.w / 2 + ball.r) {
              const off = clamp((ball.x - pad.x) / (pad.w / 2), -1, 1);
              const a = off * 1.05;
              ball.vx = Math.sin(a) * ball.speed;
              ball.vy = -Math.cos(a) * ball.speed;
              ball.y = pad.y - pad.h / 2 - ball.r;
              api.beep(440, 0.05, 'square', 0.05);
            }

            for (const b of bricks) {
              if (b.dead) continue;
              const nx = clamp(ball.x, b.x, b.x + b.w), ny = clamp(ball.y, b.y, b.y + b.h);
              const dx = ball.x - nx, dy = ball.y - ny;
              if (dx * dx + dy * dy <= ball.r * ball.r) { hitBrick(b); break; }
            }

            if (ball.y - ball.r > H) {
              lives--;
              api.noise(0.4, 0.1);
              if (lives <= 0) { api.gameOver(score); return; }
              resetBall();
              return;
            }
          }
          bricks = bricks.filter((b) => !b.dead);

          if (!bricks.length) {
            score += 500;
            api.melody([[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.2]]);
            build();
          }
        },

        draw(c) {
          c.fillStyle = '#0b0b1e';
          c.fillRect(0, 0, W, H);
          c.fillStyle = '#12122c';
          for (let x = 0; x < W; x += 32) c.fillRect(x, TOP, 1, H - TOP);
          for (let y = TOP; y < H; y += 32) c.fillRect(0, y, W, 1);
          c.fillStyle = '#ffb84d';
          c.fillRect(0, TOP - 4, W, 4);

          for (const b of bricks) api.block(b.x, b.y, b.w, b.h, b.color);
          api.block(Math.round(pad.x - pad.w / 2), pad.y - pad.h / 2, pad.w, pad.h, '#ffb84d');

          c.fillStyle = '#fff';
          c.fillRect(Math.round(ball.x - ball.r), Math.round(ball.y - ball.r) + 2, ball.r * 2, ball.r * 2 - 4);
          c.fillRect(Math.round(ball.x - ball.r) + 2, Math.round(ball.y - ball.r), ball.r * 2 - 4, ball.r * 2);
          fx.draw(c);

          api.text('PUNTOS ' + score, 10, 20, 10, '#fff', 'left');
          api.text('NIVEL ' + level, W / 2 + 30, 20, 10, '#ffb84d');
          for (let i = 0; i < lives; i++) api.block(W - 30 - i * 26, 14, 20, 10, '#ff4d6d');

          if (ball.stuck && Math.floor(t * 2) % 2 === 0) {
            api.text('ESPACIO PARA LANZAR', W / 2, H / 2 + 120, 10, '#fff');
          }
        },
      };
    },
  });
})();
