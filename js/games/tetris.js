/* TETRIS — 7 piezas, bolsa aleatoria, pieza fantasma, rotación con "wall kicks" y niveles */
(function () {
  'use strict';

  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  };
  const COLORS = { I: '#2ee6e6', O: '#f5e027', T: '#b45cff', S: '#3ddc5a', Z: '#f0453a', J: '#3a6df0', L: '#f59a27' };
  const LINE_POINTS = [0, 100, 300, 500, 800];

  function rotate(m, dir) {
    const n = m.length;
    const r = Array.from({ length: n }, () => Array(n).fill(0));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (dir > 0) r[x][n - 1 - y] = m[y][x];
        else r[n - 1 - x][y] = m[y][x];
      }
    }
    return r;
  }

  Arcade.register({
    id: 'tetris',
    title: 'TETRIS',
    color: '#b45cff',
    help: 'FLECHAS MOVER  ARRIBA/X GIRAR  ESPACIO CAER',

    icon(c, x, y, w, h, t) {
      const s = 14, n = Math.floor(w / s), ox = x + (w - n * s) / 2;
      const pal = Object.values(COLORS);
      for (let r = 0; r < 2; r++) {
        for (let k = 0; k < n; k++) {
          if ((k + r * 3) % 7 === 5) continue;
          Arcade.block(ox + k * s, y + h - (r + 1) * s, s, s, pal[(k + r * 2) % pal.length]);
        }
      }
      const fy = y + 2 + Math.floor((t * 30) % (h - 3 * s));
      const cx = ox + Math.floor(n / 2) * s;
      for (const [dx, dy] of [[-1, 1], [0, 1], [1, 1], [0, 0]]) Arcade.block(cx + dx * s, fy + dy * s, s, s, COLORS.T);
    },

    create(api) {
      const { W, H, input } = api;
      const COLS = 10, ROWS = 20, S = 28, OX = 24, OY = 40;
      const PX = OX + COLS * S + 22; // panel lateral

      const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      let bag = [];
      let piece = null;
      let next = null;
      let score = 0, lines = 0, level = 1;
      let dropT = 0, lockT = 0;
      let clearing = null, clearT = 0;
      let over = false;
      const fx = new api.Particles();

      function fromBag() {
        if (!bag.length) {
          bag = Object.keys(SHAPES);
          for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
          }
        }
        return bag.pop();
      }

      function collide(m, px, py) {
        for (let y = 0; y < m.length; y++) {
          for (let x = 0; x < m[y].length; x++) {
            if (!m[y][x]) continue;
            const bx = px + x, by = py + y;
            if (bx < 0 || bx >= COLS || by >= ROWS) return true;
            if (by >= 0 && board[by][bx]) return true;
          }
        }
        return false;
      }

      function finish() {
        if (over) return;
        over = true;
        api.noise(0.5, 0.1);
        api.gameOver(score);
      }

      function spawn() {
        const type = next || fromBag();
        next = fromBag();
        const m = SHAPES[type].map((r) => r.slice());
        piece = { type, m, x: Math.floor((COLS - m[0].length) / 2), y: type === 'I' ? -1 : 0 };
        dropT = 0;
        lockT = 0;
        if (collide(piece.m, piece.x, piece.y)) finish();
      }

      function gravity() { return Math.max(0.05, 0.8 * Math.pow(0.82, level - 1)); }

      function move(dx) {
        if (!collide(piece.m, piece.x + dx, piece.y)) {
          piece.x += dx;
          lockT = 0;
          api.beep(220, 0.03, 'square', 0.03);
        }
      }

      function tryRotate(dir) {
        if (piece.type === 'O') return;
        const m = rotate(piece.m, dir);
        for (const [kx, ky] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
          if (!collide(m, piece.x + kx, piece.y + ky)) {
            piece.m = m;
            piece.x += kx;
            piece.y += ky;
            lockT = 0;
            api.beep(440, 0.04, 'square', 0.04);
            return;
          }
        }
      }

      function ghostY() {
        let y = piece.y;
        while (!collide(piece.m, piece.x, y + 1)) y++;
        return y;
      }

      function lock() {
        let above = false;
        piece.m.forEach((row, y) => row.forEach((v, x) => {
          if (!v) return;
          const by = piece.y + y;
          if (by < 0) above = true;
          else board[by][piece.x + x] = piece.type;
        }));
        piece = null;
        if (above) { finish(); return; }
        api.beep(130, 0.06, 'triangle', 0.08);
        const full = [];
        for (let y = 0; y < ROWS; y++) if (board[y].every(Boolean)) full.push(y);
        if (full.length) {
          clearing = full;
          clearT = 0.3;
          if (full.length === 4) api.melody([[523, 0.06], [659, 0.06], [784, 0.06], [1047, 0.12]]);
          else api.beep(660, 0.12, 'square', 0.06, 990);
          for (const y of full) {
            for (let x = 0; x < COLS; x++) fx.burst(OX + x * S + S / 2, OY + y * S + S / 2, COLORS[board[y][x]], 3, 120, 0.5);
          }
        } else {
          spawn();
        }
      }

      function finishClear() {
        for (const y of clearing) {
          board.splice(y, 1);
          board.unshift(Array(COLS).fill(null));
        }
        lines += clearing.length;
        score += LINE_POINTS[clearing.length] * level;
        const newLevel = Math.floor(lines / 10) + 1;
        if (newLevel > level) { level = newLevel; api.melody([[784, 0.08], [988, 0.08], [1175, 0.16]]); }
        clearing = null;
        spawn();
      }

      function hardDrop() {
        const gy = ghostY();
        score += (gy - piece.y) * 2;
        piece.y = gy;
        lock();
      }

      spawn();

      function drawPiece(c, m, px, py, color, size, ox, oy) {
        m.forEach((row, y) => row.forEach((v, x) => {
          if (v && py + y >= 0) api.block(ox + (px + x) * size, oy + (py + y) * size, size, size, color);
        }));
      }

      return {
        update(dt) {
          fx.update(dt);
          if (over) return;
          if (clearing) {
            clearT -= dt;
            if (clearT <= 0) finishClear();
            return;
          }
          if (!piece) return;

          if (input.repeat('left')) move(-1);
          if (input.repeat('right')) move(1);
          if (input.pressed('up')) tryRotate(1);
          if (input.pressed('alt')) tryRotate(-1);
          if (input.pressed('fire')) { hardDrop(); return; }

          const soft = input.down('down');
          const interval = soft ? Math.min(0.04, gravity()) : gravity();
          dropT += dt;
          if (dropT >= interval) {
            dropT = 0;
            if (!collide(piece.m, piece.x, piece.y + 1)) {
              piece.y++;
              if (soft) score += 1;
            }
          }
          if (collide(piece.m, piece.x, piece.y + 1)) {
            lockT += dt;
            if (lockT >= (soft ? 0.15 : 0.5)) lock();
          } else {
            lockT = 0;
          }
        },

        draw(c) {
          c.fillStyle = '#0a0a1a';
          c.fillRect(0, 0, W, H);

          // Tablero
          c.fillStyle = '#000';
          c.fillRect(OX, OY, COLS * S, ROWS * S);
          c.strokeStyle = '#16163a';
          c.lineWidth = 1;
          for (let x = 1; x < COLS; x++) { c.beginPath(); c.moveTo(OX + x * S + 0.5, OY); c.lineTo(OX + x * S + 0.5, OY + ROWS * S); c.stroke(); }
          for (let y = 1; y < ROWS; y++) { c.beginPath(); c.moveTo(OX, OY + y * S + 0.5); c.lineTo(OX + COLS * S, OY + y * S + 0.5); c.stroke(); }
          c.strokeStyle = '#b45cff';
          c.lineWidth = 3;
          c.strokeRect(OX - 2, OY - 2, COLS * S + 4, ROWS * S + 4);

          const flash = clearing && Math.floor(clearT * 20) % 2 === 0;
          for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
              const v = board[y][x];
              if (!v) continue;
              const color = clearing && clearing.includes(y) && flash ? '#fff' : COLORS[v];
              api.block(OX + x * S, OY + y * S, S, S, color);
            }
          }

          if (piece && !over) {
            // Pieza fantasma
            const gy = ghostY();
            c.strokeStyle = COLORS[piece.type];
            c.globalAlpha = 0.45;
            c.lineWidth = 2;
            piece.m.forEach((row, y) => row.forEach((v, x) => {
              if (v && gy + y >= 0) c.strokeRect(OX + (piece.x + x) * S + 2, OY + (gy + y) * S + 2, S - 4, S - 4);
            }));
            c.globalAlpha = 1;
            drawPiece(c, piece.m, piece.x, piece.y, COLORS[piece.type], S, OX, OY);
          }
          fx.draw(c);

          // Panel lateral
          const cx = PX + (W - PX - 10) / 2;
          api.text('TETRIS', cx, OY + 14, 14, '#b45cff');
          api.text('SIGUIENTE', cx, OY + 56, 8, '#aaa');
          c.strokeStyle = '#3a3a6a';
          c.lineWidth = 2;
          c.strokeRect(PX, OY + 68, W - PX - 10, 90);
          if (next) {
            const m = SHAPES[next];
            const cells = [];
            m.forEach((row, y) => row.forEach((v, x) => { if (v) cells.push([x, y]); }));
            const s = 22;
            const minX = Math.min(...cells.map((p) => p[0])), maxX = Math.max(...cells.map((p) => p[0]));
            const minY = Math.min(...cells.map((p) => p[1])), maxY = Math.max(...cells.map((p) => p[1]));
            const ox = cx - ((maxX - minX + 1) * s) / 2 - minX * s;
            const oy = OY + 113 - ((maxY - minY + 1) * s) / 2 - minY * s;
            for (const [x, y] of cells) api.block(ox + x * s, oy + y * s, s, s, COLORS[next]);
          }

          const stat = (label, val, y, color) => {
            api.text(label, cx, y, 8, '#aaa');
            api.text(String(val), cx, y + 22, 12, color);
          };
          stat('PUNTOS', score, OY + 200, '#fff');
          stat('LINEAS', lines, OY + 260, '#3ddc5a');
          stat('NIVEL', level, OY + 320, '#f5e027');
          stat('RECORD', api.best('tetris'), OY + 380, '#9ea0ff');
        },
      };
    },
  });
})();
