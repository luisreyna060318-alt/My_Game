/* GALAGA — formación enemiga, picadas en curva, jefes con 2 vidas y oleadas cada vez más rápidas */
(function () {
  'use strict';

  const PLAYER = [
    '......w......',
    '......w......',
    '.....www.....',
    '.....www.....',
    '..r..www..r..',
    '..r.wwwww.r..',
    '..wwwbwbwww..',
    'r.wwwwwwwww.r',
    'w.wwwrwrwww.w',
    'wwwwwwwwwwwww',
    'www.rr.rr.www',
    'ww.........ww',
  ];
  const BEE = [[
    '...b.....b...',
    '....b...b....',
    '.b...yyy...b.',
    '.bb.ryyyr.bb.',
    '..bbyyyyybb..',
    '...byyyyyb...',
    '....ryyyr....',
    '.....r.r.....',
  ], [
    '....b...b....',
    '....b...b....',
    '.....yyy.....',
    'bbb.ryyyr.bbb',
    '.bbbyyyyybbb.',
    '....yyyyy....',
    '....ryyyr....',
    '.....r.r.....',
  ]];
  const FLY = [[
    '....b...b....',
    '.....b.b.....',
    '.rr..www..rr.',
    'rrrr.wbw.rrrr',
    'rrrrrwwwrrrrr',
    '.rrr.www.rrr.',
    '..r..www..r..',
    '.....w.w.....',
  ], [
    '....b...b....',
    '.....b.b.....',
    '.....www.....',
    '.rrrrwbwrrrr.',
    'rrrrrwwwrrrrr',
    'rrrr.www.rrrr',
    '.r...www...r.',
    '.....w.w.....',
  ]];
  const BOSS = [[
    '...g.....g...',
    '....g...g....',
    '...ggggggg...',
    '..gyygggyyg..',
    '.ggggggggggg.',
    'gg.gooooog.gg',
    'g..g.ooo.g..g',
    '...g.....g...',
  ], [
    '...g.....g...',
    '....g...g....',
    '...ggggggg...',
    '..gyygggyyg..',
    '.ggggggggggg.',
    '.ggg.ooo.ggg.',
    '..g..ooo..g..',
    '.............',
  ]];

  const PAL = { w: '#ffffff', r: '#ff3b3b', b: '#3a6df0', y: '#ffe23c', g: '#3ddc5a', o: '#ff8a1e' };
  const TYPES = {
    boss: { hp: 2, pts: 150, color: '#3ddc5a' },
    fly: { hp: 1, pts: 80, color: '#ff3b3b' },
    bee: { hp: 1, pts: 50, color: '#ffe23c' },
  };

  let SPR = null;
  function sprites() {
    if (SPR) return SPR;
    const S = Arcade.makeSprite;
    const hurt = Object.assign({}, PAL, { g: '#a855ff' });
    const fly = Object.assign({}, PAL, { b: '#2ee6e6' });
    SPR = {
      player: S(PLAYER, PAL, 2),
      bee: BEE.map((f) => S(f, PAL, 2)),
      fly: FLY.map((f) => S(f, fly, 2)),
      boss: BOSS.map((f) => S(f, PAL, 2)),
      boss2: BOSS.map((f) => S(f, hurt, 2)),
    };
    return SPR;
  }

  Arcade.register({
    id: 'galaga',
    title: 'GALAGA',
    color: '#4dd2ff',
    help: 'IZQ/DER MOVER  ESPACIO DISPARAR',

    icon(c, x, y, w, h, t) {
      const spr = sprites();
      c.fillStyle = '#fff';
      for (let i = 0; i < 18; i++) c.fillRect(x + ((i * 53) % w), y + ((i * 37 + t * 40) % h), 1, 1);
      const f = Math.floor(t * 3) % 2;
      for (let i = 0; i < 4; i++) Arcade.drawSprite(spr.bee[f], x + 30 + i * 38 + Math.sin(t * 2) * 8, y + 16);
      Arcade.drawSprite(spr.boss[f], x + w / 2 + Math.sin(t * 2) * 8, y + 2 + 10);
      Arcade.drawSprite(spr.player, x + w / 2 + Math.sin(t * 1.5) * 50, y + h - 14);
      c.fillStyle = '#ffe23c';
      c.fillRect(x + w / 2 + Math.sin(t * 1.5) * 50 - 1, y + h - 30 - ((t * 120) % 30), 3, 8);
    },

    create(api) {
      const { W, H, input, rand, clamp } = api;
      const spr = sprites();
      const pl = { x: W / 2, y: H - 50, alive: true, inv: 2, respawn: 0 };
      let lives = 3, score = 0, wave = 0, t = 0, sway = 0;
      let shots = [], ebs = [], foes = [];
      let diveT = 3, banner = 0, nextWaveT = 0, overT = 0;
      const fx = new api.Particles();
      const stars = Array.from({ length: 70 }, () => ({
        x: rand(0, W), y: rand(0, H), v: rand(20, 90),
        c: ['#fff', '#8af', '#fa8', '#ff8'][Math.floor(rand(0, 4))],
      }));

      function slot(e) {
        return { x: W / 2 + e.fx * 38 + Math.sin(sway) * 24, y: 80 + e.fy * 34 };
      }

      function newWave() {
        wave++;
        banner = 2;
        foes = [];
        shots = [];
        ebs = [];
        const layout = [['boss', 4], ['fly', 8], ['fly', 8], ['bee', 10], ['bee', 10]];
        let i = 0;
        layout.forEach(([type, n], row) => {
          for (let k = 0; k < n; k++, i++) {
            foes.push({
              type, hp: TYPES[type].hp, fx: k - (n - 1) / 2, fy: row,
              state: 'return', delay: 0.4 + i * 0.045,
              x: k % 2 ? -30 : W + 30, y: rand(240, 340),
            });
          }
        });
        diveT = 3;
      }

      function startDive(e, leader) {
        e.state = 'dive';
        e.t = 0;
        e.sx = e.x;
        e.sy = e.y;
        e.tx = leader ? leader.tx + (e.x - leader.x) : pl.x;
        e.dir = leader ? leader.dir : (e.x < W / 2 ? 1 : -1);
        e.nextShot = rand(0.4, 1.0);
        e.shots = Math.random() < 0.45 + wave * 0.08 ? 1 + (wave > 2 ? 1 : 0) : 0;
      }

      function hitPlayer() {
        pl.alive = false;
        lives--;
        pl.respawn = 2;
        fx.burst(pl.x, pl.y, '#fff', 30, 220, 1);
        fx.burst(pl.x, pl.y, '#ff3b3b', 20, 160, 0.8);
        api.noise(0.8, 0.15);
        ebs = [];
        if (lives <= 0) overT = 1.8;
      }

      function killFoe(e) {
        e.dead = true;
        score += TYPES[e.type].pts * (e.state === 'dive' ? 2 : 1);
        fx.burst(e.x, e.y, TYPES[e.type].color, 16, 180, 0.6);
        fx.burst(e.x, e.y, '#fff', 6, 100, 0.4);
        api.noise(0.2, 0.08);
      }

      newWave();

      return {
        update(dt) {
          t += dt;
          sway += dt * 0.9;
          fx.update(dt);
          for (const s of stars) { s.y += s.v * dt; if (s.y > H) { s.y = 0; s.x = rand(0, W); } }

          if (overT > 0) {
            overT -= dt;
            if (overT <= 0) { api.gameOver(score); return; }
          }
          if (banner > 0) banner -= dt;

          // Jugador
          if (pl.alive) {
            const mv = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
            pl.x = clamp(pl.x + mv * 260 * dt, 20, W - 20);
            if (input.pressed('fire') && shots.length < 2) {
              shots.push({ x: pl.x, y: pl.y - 14 });
              api.beep(1200, 0.07, 'square', 0.035, 500);
            }
            pl.inv -= dt;
          } else if (lives > 0) {
            pl.respawn -= dt;
            if (pl.respawn <= 0) { pl.alive = true; pl.inv = 2; pl.x = W / 2; }
          }

          for (const s of shots) s.y -= 560 * dt;
          for (const b of ebs) { b.x += b.vx * dt; b.y += b.vy * dt; }
          ebs = ebs.filter((b) => b.y < H + 10 && b.x > -10 && b.x < W + 10);

          // Enemigos
          const diveSpeed = 170 + wave * 12;
          for (const e of foes) {
            if (e.delay > 0) { e.delay -= dt; continue; }
            if (e.state === 'formation') {
              const s = slot(e);
              e.x = s.x;
              e.y = s.y;
            } else if (e.state === 'return') {
              const s = slot(e);
              const dx = s.x - e.x, dy = s.y - e.y, d = Math.hypot(dx, dy);
              const v = 280 * dt;
              if (d <= v) { e.x = s.x; e.y = s.y; e.state = 'formation'; }
              else { e.x += (dx / d) * v; e.y += (dy / d) * v; }
            } else if (e.state === 'dive') {
              e.t += dt;
              const k = Math.min(1, e.t / 1.8);
              e.x = e.sx + (e.tx - e.sx) * k + Math.sin(e.t * 3) * 70 * e.dir;
              e.y = e.sy + e.t * diveSpeed - Math.sin((Math.min(e.t, 0.7) / 0.7) * Math.PI) * 50;
              if (e.shots > 0 && e.t >= e.nextShot && e.y < pl.y - 120 && pl.alive) {
                e.shots--;
                e.nextShot = e.t + rand(0.3, 0.7);
                const vy = 260 + wave * 10;
                const time = (pl.y - e.y) / vy;
                ebs.push({ x: e.x, y: e.y + 10, vx: clamp((pl.x - e.x) / time, -120, 120), vy });
              }
              if (e.y > H + 30) { e.state = 'return'; e.y = -30; e.x = slot(e).x; }
            }
          }

          // Programar picadas
          if (pl.alive && overT <= 0 && banner <= 0.5) {
            diveT -= dt;
            if (diveT <= 0) {
              const cand = foes.filter((e) => e.state === 'formation' && e.delay <= 0);
              if (cand.length) {
                const e = cand[Math.floor(rand(0, cand.length))];
                startDive(e);
                if (e.type === 'boss') {
                  cand.filter((o) => o.type === 'fly' && o.fy === 1 && Math.abs(o.fx - e.fx * 2) <= 1.5)
                    .slice(0, 2).forEach((o) => startDive(o, e));
                }
                api.beep(600, 0.25, 'triangle', 0.04, 200);
              }
              diveT = Math.max(0.5, 2.2 - wave * 0.15) * rand(0.6, 1.3);
            }
          }

          // Colisiones: disparos vs enemigos
          for (const s of shots) {
            for (const e of foes) {
              if (e.delay > 0 || e.dead) continue;
              if (Math.abs(s.x - e.x) < 14 && Math.abs(s.y - e.y) < 12) {
                s.y = -100;
                e.hp--;
                if (e.hp <= 0) killFoe(e);
                else api.beep(300, 0.08, 'square', 0.05);
                break;
              }
            }
          }
          shots = shots.filter((s) => s.y > -20);

          // Colisiones: jugador
          if (pl.alive && pl.inv <= 0) {
            for (const b of ebs) {
              if (Math.abs(b.x - pl.x) < 10 && Math.abs(b.y - pl.y) < 12) { hitPlayer(); break; }
            }
          }
          if (pl.alive && pl.inv <= 0) {
            for (const e of foes) {
              if (e.delay > 0 || e.dead) continue;
              if (Math.abs(e.x - pl.x) < 22 && Math.abs(e.y - pl.y) < 20) { killFoe(e); hitPlayer(); break; }
            }
          }
          foes = foes.filter((e) => !e.dead);

          // Siguiente oleada
          if (!foes.length && overT <= 0) {
            if (nextWaveT <= 0) nextWaveT = 1.5;
            nextWaveT -= dt;
            if (nextWaveT <= 0) {
              newWave();
              api.melody([[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.16]]);
            }
          }
        },

        draw(c) {
          c.fillStyle = '#000';
          c.fillRect(0, 0, W, H);
          for (const s of stars) {
            if ((Math.floor(t * 4 + s.x) % 7) === 0) continue;
            c.fillStyle = s.c;
            c.fillRect(Math.round(s.x), Math.round(s.y), s.v > 60 ? 2 : 1, s.v > 60 ? 2 : 1);
          }

          const frame = Math.floor(t * 3) % 2;
          for (const e of foes) {
            if (e.delay > 0) continue;
            const set = e.type === 'boss' ? (e.hp < 2 ? spr.boss2 : spr.boss) : spr[e.type];
            api.drawSprite(set[(frame + Math.abs(Math.round(e.fx))) % 2], e.x, e.y);
          }

          c.fillStyle = '#ffe23c';
          for (const s of shots) c.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 8, 3, 12);
          c.fillStyle = '#ff6060';
          for (const b of ebs) c.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 5, 4, 10);

          if (pl.alive && (pl.inv <= 0 || Math.floor(t * 10) % 2)) api.drawSprite(spr.player, pl.x, pl.y);
          fx.draw(c);

          // HUD
          api.text('1UP', 12, 16, 10, '#ff3b3b', 'left');
          api.text(String(score), 60, 16, 10, '#fff', 'left');
          api.text('RECORD ' + Math.max(score, api.best('galaga')), W / 2 + 40, 16, 8, '#9ea0ff');
          api.text('NIVEL ' + wave, W - 12, 16, 10, '#4dd2ff', 'right');
          for (let i = 0; i < lives - (pl.alive ? 1 : 0); i++) api.drawSprite(spr.player, 20 + i * 22, H - 12, 13, 12);

          if (banner > 0) {
            api.text('NIVEL ' + wave, W / 2, H / 2 + 40, 20, '#4dd2ff');
            api.text('PREPARATE!', W / 2, H / 2 + 72, 10, '#fff');
          }
        },
      };
    },
  });
})();
