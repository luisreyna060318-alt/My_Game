/* PONG — contra la CPU. Gana el primero en llegar a 7 puntos */
(function () {
  'use strict';

  const TOP = 40, WIN = 7;

  Arcade.register({
    id: 'pong',
    title: 'PONG',
    color: '#ff66cc',
    help: 'IZQ/DER O RATON MOVER  GANA QUIEN LLEGUE A 7',

    icon(c, x, y, w, h, t) {
      c.fillStyle = '#333';
      for (let xx = x; xx < x + w; xx += 12) c.fillRect(xx, y + h / 2 - 1, 6, 2);
      const bx = x + w / 2 + Math.sin(t * 2.1) * (w / 2 - 20);
      const by = y + h / 2 + Math.sin(t * 3.3) * (h / 2 - 14);
      Arcade.block(x + w / 2 + Math.sin(t * 2.1 - 0.4) * (w / 2 - 30) - 20, y + 4, 40, 6, '#ff66cc');
      Arcade.block(x + w / 2 + Math.sin(t * 2.1 + 0.4) * (w / 2 - 30) - 20, y + h - 10, 40, 6, '#fff');
      c.fillStyle = '#fff';
      c.fillRect(bx - 3, by - 3, 6, 6);
    },

    create(api) {
      const { W, H, input, pointer, rand, clamp } = api;
      const MID = (TOP + H) / 2;
      const me = { x: W / 2, y: H - 40, w: 84, h: 12 };
      const cpu = { x: W / 2, y: TOP + 30, w: 84, h: 12 };
      let ball = null;
      let ps = 0, cs = 0, hits = 0, t = 0;
      let serveT = 0, aim = 0, endT = 0, endMsg = '';
      const fx = new api.Particles();

      function serve(dir) {
        ball = { x: W / 2, y: MID, vx: 0, vy: 0, r: 6, speed: 300, dir };
        serveT = 1;
      }
      serve(1);

      function point(playerScored) {
        if (playerScored) { ps++; api.melody([[659, 0.08], [880, 0.12]]); }
        else { cs++; api.beep(180, 0.3, 'sawtooth', 0.06, 80); }
        fx.burst(ball.x, clamp(ball.y, TOP, H), playerScored ? '#fff' : '#ff66cc', 20, 180, 0.6);
        if (ps >= WIN || cs >= WIN) {
          endMsg = ps >= WIN ? 'GANASTE!' : 'PERDISTE';
          endT = 1.2;
          ball.vx = ball.vy = 0;
          return;
        }
        serve(playerScored ? -1 : 1);
      }

      function bounce(p, dirY) {
        const off = clamp((ball.x - p.x) / (p.w / 2), -1, 1);
        const a = off * 1.0;
        ball.speed = Math.min(ball.speed * 1.05, 720);
        ball.vx = Math.sin(a) * ball.speed;
        ball.vy = Math.cos(a) * ball.speed * dirY;
      }

      return {
        update(dt) {
          t += dt;
          fx.update(dt);
          if (endT > 0) {
            endT -= dt;
            if (endT <= 0) api.gameOver(ps * 100 + hits * 5 + (ps > cs ? 1000 : 0), endMsg);
            return;
          }

          // Jugador
          const mv = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
          me.x += mv * 440 * dt;
          if (pointer.moved) me.x = pointer.x;
          me.x = clamp(me.x, me.w / 2, W - me.w / 2);

          // CPU: sigue la pelota con velocidad limitada y algo de error
          const target = ball.vy < 0 ? ball.x + aim : W / 2;
          const cpuSpeed = 230 + ps * 15;
          cpu.x += clamp(target - cpu.x, -cpuSpeed * dt, cpuSpeed * dt);
          cpu.x = clamp(cpu.x, cpu.w / 2, W - cpu.w / 2);

          if (serveT > 0) {
            serveT -= dt;
            if (serveT <= 0) {
              const a = rand(-0.5, 0.5);
              ball.vx = Math.sin(a) * ball.speed;
              ball.vy = Math.cos(a) * ball.speed * ball.dir;
              aim = rand(-30, 30);
            }
            return;
          }

          const steps = Math.max(1, Math.ceil((ball.speed * dt) / 4));
          const h = dt / steps;
          for (let i = 0; i < steps; i++) {
            ball.x += ball.vx * h;
            ball.y += ball.vy * h;
            if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); api.beep(220, 0.03); }
            if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); api.beep(220, 0.03); }

            if (ball.vy > 0 && ball.y + ball.r >= me.y - me.h / 2 && ball.y - ball.r <= me.y + me.h / 2 &&
                Math.abs(ball.x - me.x) <= me.w / 2 + ball.r) {
              bounce(me, -1);
              ball.y = me.y - me.h / 2 - ball.r;
              hits++;
              aim = rand(-34, 34);
              api.beep(440, 0.05);
            }
            if (ball.vy < 0 && ball.y - ball.r <= cpu.y + cpu.h / 2 && ball.y + ball.r >= cpu.y - cpu.h / 2 &&
                Math.abs(ball.x - cpu.x) <= cpu.w / 2 + ball.r) {
              bounce(cpu, 1);
              ball.y = cpu.y + cpu.h / 2 + ball.r;
              api.beep(330, 0.05);
            }

            if (ball.y < TOP - 10) { point(true); return; }
            if (ball.y > H + 10) { point(false); return; }
          }
        },

        draw(c) {
          c.fillStyle = '#000';
          c.fillRect(0, 0, W, H);
          c.fillStyle = '#ff66cc';
          c.fillRect(0, TOP - 3, W, 3);

          // Marcadores grandes de fondo
          api.text(String(cs), W / 2, MID - 90, 64, 'rgba(255,102,204,0.18)');
          api.text(String(ps), W / 2, MID + 90, 64, 'rgba(255,255,255,0.15)');

          c.fillStyle = '#444';
          for (let x = 4; x < W; x += 24) c.fillRect(x, MID - 2, 12, 4);

          api.block(Math.round(cpu.x - cpu.w / 2), cpu.y - cpu.h / 2, cpu.w, cpu.h, '#ff66cc');
          api.block(Math.round(me.x - me.w / 2), me.y - me.h / 2, me.w, me.h, '#ffffff');

          if (endT <= 0 || Math.floor(t * 8) % 2) {
            c.fillStyle = '#fff';
            c.fillRect(Math.round(ball.x - ball.r), Math.round(ball.y - ball.r), ball.r * 2, ball.r * 2);
          }
          fx.draw(c);

          api.text('CPU ' + cs, 12, 20, 10, '#ff66cc', 'left');
          api.text('PRIMERO A ' + WIN, W / 2, 20, 8, '#888');
          api.text('TU ' + ps, W - 12, 20, 10, '#fff', 'right');
          if (serveT > 0 && endT <= 0) api.text('LISTO?', W / 2, MID + 40, 12, '#ffd23f');
          if (endT > 0) api.text(endMsg, W / 2, MID - 40, 24, ps > cs ? '#3ddc5a' : '#ff4d6d');
        },
      };
    },
  });
})();
