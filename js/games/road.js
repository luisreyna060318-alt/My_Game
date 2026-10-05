/* CARRETERA 8-BIT — esquiva autos, junta gasolina y recorre la mayor distancia posible */
(function () {
  'use strict';

  const RL = 80, RR = 400, LANES = 4, LW = (RR - RL) / LANES;
  const laneX = (i) => RL + LW * i + LW / 2;
  const CAR_COLORS = ['#3cc8ff', '#ffe23c', '#ff7ad9', '#f2f2f2', '#46e06a', '#ff9a3c', '#a87bff'];

  function hash(n) {
    const s = Math.sin(n * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }

  function drawCar(c, x, y, w, h, color) {
    const l = Math.round(x - w / 2), t = Math.round(y - h / 2);
    c.fillStyle = '#111';
    c.fillRect(l - 3, t + 7, 5, 12);
    c.fillRect(l + w - 2, t + 7, 5, 12);
    c.fillRect(l - 3, t + h - 19, 5, 12);
    c.fillRect(l + w - 2, t + h - 19, 5, 12);
    c.fillStyle = color;
    c.fillRect(l, t + 3, w, h - 6);
    c.fillRect(l + 3, t, w - 6, h);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(l + w - 5, t + 3, 5, h - 6);
    c.fillStyle = '#142446';
    c.fillRect(l + 5, t + 12, w - 10, 10);
    c.fillRect(l + 6, t + h - 16, w - 12, 7);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(l + 7, t + 24, w - 14, h - 42);
    c.fillStyle = '#ffffcc';
    c.fillRect(l + 4, t + 1, 6, 3);
    c.fillRect(l + w - 10, t + 1, 6, 3);
  }

  function drawCan(c, x, y) {
    const l = Math.round(x - 10), t = Math.round(y - 12);
    c.fillStyle = '#c81e1e';
    c.fillRect(l, t + 4, 20, 20);
    c.fillRect(l + 12, t, 6, 5);
    c.fillStyle = '#ff5050';
    c.fillRect(l + 2, t + 6, 4, 16);
    c.fillStyle = '#ffd23f';
    c.font = '10px ' + Arcade.FONT;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('F', l + 11, t + 15);
  }

  function drawTree(c, x, y) {
    c.fillStyle = '#5a3a1a';
    c.fillRect(x - 3, y + 6, 6, 10);
    c.fillStyle = '#0f5a1f';
    c.fillRect(x - 12, y - 6, 24, 14);
    c.fillRect(x - 8, y - 14, 16, 8);
    c.fillStyle = '#1c7f30';
    c.fillRect(x - 8, y - 4, 8, 6);
  }

  Arcade.register({
    id: 'road',
    title: 'CARRETERA 8-BIT',
    color: '#ff4d4d',
    help: 'IZQ/DER GIRAR  ARRIBA ACELERA  ABAJO FRENA',

    icon(c, x, y, w, h, t) {
      c.fillStyle = '#1f7a2e';
      c.fillRect(x, y, w, h);
      const rl = x + 30, rw = w - 60;
      c.fillStyle = '#555';
      c.fillRect(rl, y, rw, h);
      c.fillStyle = '#ddd';
      const off = (t * 120) % 24;
      for (let yy = y - 24 + off; yy < y + h; yy += 24) c.fillRect(rl + rw / 2 - 2, yy, 4, 12);
      drawCar(c, rl + rw * 0.28, y + h - 30, 22, 38, '#ff4d4d');
      drawCar(c, rl + rw * 0.72, y + ((t * 50) % (h + 60)) - 30, 22, 38, '#3cc8ff');
    },

    create(api) {
      const { W, H, input, rand, clamp } = api;
      const pl = { x: W / 2, y: H - 100, w: 30, h: 52 };
      let speed = 0, dist = 0, bonus = 0, fuel = 100, scroll = 0, t = 0;
      let cars = [], cans = [];
      let spawnT = 1.2, canT = 6;
      let dead = false, deadT = 0, deadMsg = '';
      const fx = new api.Particles();

      const score = () => Math.floor(dist / 10) + bonus;
      const overlap = (a, b, pad = 4) =>
        Math.abs(a.x - b.x) < (a.w + b.w) / 2 - pad && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - pad;

      function crash() {
        dead = true;
        deadT = 1.4;
        deadMsg = 'CHOCASTE!';
        fx.burst(pl.x, pl.y, '#ff9a3c', 30, 220, 0.9);
        fx.burst(pl.x, pl.y, '#ffe23c', 20, 160, 0.7);
        fx.burst(pl.x, pl.y, '#555', 15, 90, 1.2);
        api.noise(0.7, 0.15);
      }

      function spawnCar() {
        const lane = Math.floor(rand(0, LANES));
        const x = laneX(lane);
        if (cars.some((c) => Math.abs(c.x - x) < LW * 0.8 && c.y < 150)) return;
        const swerve = dist > 6000 && Math.random() < Math.min(0.4, dist / 40000);
        cars.push({
          x, y: -60, w: 30, h: 52, lane, swerve, swT: rand(0.8, 2),
          speed: rand(110, 230),
          color: CAR_COLORS[Math.floor(rand(0, CAR_COLORS.length))],
        });
      }

      return {
        update(dt) {
          t += dt;
          fx.update(dt);
          if (dead) {
            deadT -= dt;
            speed = Math.max(0, speed - 500 * dt);
            scroll += speed * dt;
            if (deadT <= 0) api.gameOver(score(), deadMsg);
            return;
          }

          // Velocidad y dirección
          const target = input.down('up') ? 560 : input.down('down') ? 150 : 330;
          const accel = target > speed ? 260 : 420;
          speed += Math.sign(target - speed) * Math.min(Math.abs(target - speed), accel * dt);
          const steer = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
          pl.x = clamp(pl.x + steer * (200 + speed * 0.15) * dt, RL + pl.w / 2 + 4, RR - pl.w / 2 - 4);

          dist += speed * dt;
          scroll += speed * dt;

          // Gasolina
          fuel -= dt * (2.2 + speed / 250);
          if (fuel <= 0) {
            fuel = 0;
            dead = true;
            deadT = 1.2;
            deadMsg = 'SIN GASOLINA';
            api.beep(300, 0.6, 'sawtooth', 0.06, 60);
            return;
          }

          // Aparición de tráfico y gasolina
          spawnT -= dt * (speed / 330);
          if (spawnT <= 0) {
            spawnCar();
            spawnT = Math.max(0.32, 1.15 - dist / 25000) * rand(0.7, 1.3);
          }
          canT -= dt;
          if (canT <= 0) {
            canT = rand(5, 8);
            cans.push({ x: laneX(Math.floor(rand(0, LANES))), y: -30, w: 22, h: 26 });
          }

          // Tráfico
          for (const c of cars) {
            for (const o of cars) {
              if (o !== c && Math.abs(o.x - c.x) < LW * 0.7 && o.y < c.y && c.y - o.y < 75) c.speed = Math.min(c.speed, o.speed);
            }
            if (c.swerve) {
              c.swT -= dt;
              if (c.swT <= 0) {
                c.lane = clamp(c.lane + (Math.random() < 0.5 ? -1 : 1), 0, LANES - 1);
                c.swT = rand(1.2, 2.5);
              }
              const tx = laneX(c.lane);
              c.x += clamp(tx - c.x, -70 * dt, 70 * dt);
            }
            c.y += (speed - c.speed) * dt;
            if (c.y > H + 80 && !c.passed) { c.passed = true; bonus += 10; }
          }
          cars = cars.filter((c) => c.y < H + 80 && c.y > -300);

          for (const k of cans) k.y += speed * dt;
          for (const k of cans) {
            if (!k.taken && overlap(pl, k, 0)) {
              k.taken = true;
              fuel = Math.min(100, fuel + 35);
              bonus += 50;
              fx.burst(k.x, k.y, '#ffd23f', 12, 120, 0.5);
              api.melody([[880, 0.05], [1320, 0.08]]);
            }
          }
          cans = cans.filter((k) => !k.taken && k.y < H + 40);

          for (const c of cars) {
            if (overlap(pl, c)) { crash(); break; }
          }
        },

        draw(c) {
          // Pasto con franjas
          c.fillStyle = '#1f7a2e';
          c.fillRect(0, 0, W, H);
          const off = scroll % 80;
          c.fillStyle = '#23892f';
          for (let y = -80 + off; y < H; y += 80) {
            c.fillRect(0, y, RL - 10, 40);
            c.fillRect(RR + 10, y, W - RR - 10, 40);
          }
          // Árboles (posiciones fijas en el "mundo")
          const SEG = 110;
          for (let seg = Math.floor((scroll - H) / SEG) - 1; seg <= Math.floor(scroll / SEG) + 1; seg++) {
            const y = scroll - seg * SEG;
            if (y < -30 || y > H + 30) continue;
            const r = hash(seg);
            if (r < 0.55) drawTree(c, 18 + hash(seg + 7) * 40, y);
            if (r > 0.35) drawTree(c, RR + 30 + hash(seg + 13) * 40, y + 40);
          }

          // Carretera
          c.fillStyle = '#4a4a52';
          c.fillRect(RL, 0, RR - RL, H);
          c.fillStyle = '#fff';
          c.fillRect(RL - 10, 0, 10, H);
          c.fillRect(RR, 0, 10, H);
          c.fillStyle = '#e22';
          for (let y = (scroll % 40) - 40; y < H; y += 40) {
            c.fillRect(RL - 10, y, 10, 20);
            c.fillRect(RR, y, 10, 20);
          }
          c.fillStyle = '#ddd';
          for (let i = 1; i < LANES; i++) {
            const x = RL + i * LW - 2;
            for (let y = (scroll % 60) - 60; y < H; y += 60) c.fillRect(x, y, 4, 32);
          }

          for (const k of cans) drawCan(c, k.x, k.y);
          for (const car of cars) drawCar(c, car.x, car.y, car.w, car.h, car.color);
          if (!dead || deadMsg !== 'CHOCASTE!') drawCar(c, pl.x, pl.y, pl.w, pl.h, '#ff4d4d');
          fx.draw(c);

          // HUD
          c.fillStyle = 'rgba(0,0,0,0.6)';
          c.fillRect(0, 0, W, 40);
          api.text('PUNTOS ' + score(), 10, 20, 10, '#fff', 'left');
          api.text(Math.round(speed * 0.4) + ' KM/H', W / 2 + 20, 20, 10, '#ffd23f');
          api.text('F', W - 112, 20, 10, '#ff5050');
          c.fillStyle = '#222';
          c.fillRect(W - 100, 12, 90, 16);
          c.fillStyle = fuel < 25 && Math.floor(t * 6) % 2 ? '#ff3030' : fuel < 25 ? '#a01010' : '#3ddc5a';
          c.fillRect(W - 98, 14, 86 * (fuel / 100), 12);

          if (t < 2.5) api.text('ESQUIVA EL TRAFICO!', W / 2, H / 2 - 40, 12, '#ffd23f');
          if (t < 2.5) api.text('RECOGE GASOLINA (F)', W / 2, H / 2 - 14, 10, '#fff');
        },
      };
    },
  });
})();
