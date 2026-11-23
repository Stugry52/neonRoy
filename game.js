// =============================================================
//  game.js — игра «Неоновый рой». Этот файл пишем МЫ.
//  Сохранили (Ctrl+S) — в браузере F5.
// =============================================================
 
// ---------- Холст: на нём рисуем всю игру ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;    // 960
const H = canvas.height;   // 600
 
// ---------- Управление: какие клавиши нажаты, где мышь ----------
const keys = {};
const mouse = { x: W / 2, y: H / 2, down: false };
 
// ---------- Состояние игры ----------
let player;
let bullets;
let enemies, spawnTimer, score;
let gameOver;
let particles, shake;
let wave, waveTimer, banner;
 
// ---------- Новая игра ----------
function reset() {
    player = {
        x: W / 2, y: H / 2, r: 14,     // в центре, радиус 14
        speed: 4,                      // пикселей за кадр
        cooldown: 3,                   // пауза до выстрела
        hp: 5, invul: 0,               // жизни и неуязвимость
    };
    bullets = [];
    enemies = [];
    spawnTimer = 0;
    score = 0;
    gameOver = false;
    document.getElementById('over').hidden = true;
    particles = [];
    shake = 0;
    wave = 1;
    waveTimer = 0;
    banner = 120;
}
 
// ---------- Помощники ----------
// Светящийся круг: основа всей неоновой графики
function glowCircle(x, y, r, color) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}
 
// Не даём числу выйти за границы: clamp(15, 0, 10) → 10
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}
 
// Расстояние между двумя объектами (теорема Пифагора)
function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
 
// ---------- Шаг 2: управление ----------
addEventListener('keydown', e => keys[e.code] = true);
addEventListener('keyup', e => keys[e.code] = false);
 
canvas.addEventListener('mousemove', e => {
    // Холст на экране может быть растянут — переводим координаты в «игровые»
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * W / rect.width;
    mouse.y = (e.clientY - rect.top) * H / rect.height;
});
canvas.addEventListener('mousedown', () => mouse.down = true);
addEventListener('mouseup', () => mouse.down = false);
addEventListener('keydown', e => { if (e.code === 'KeyR' && gameOver) reset(); });
document.getElementById('restart').onclick = reset;
 
function movePlayer() {
    if (keys.KeyW || keys.ArrowUp)    player.y -= player.speed;
    if (keys.KeyS || keys.ArrowDown)  player.y += player.speed;
    if (keys.KeyA || keys.ArrowLeft)  player.x -= player.speed;
    if (keys.KeyD || keys.ArrowRight) player.x += player.speed;
    // Не выходим за края арены
    player.x = clamp(player.x, player.r, W - player.r);
    player.y = clamp(player.y, player.r, H - player.r);
}
 
// ---------- Шаг 3: стрельба ----------
function shooting() {
    player.cooldown--;
    if (mouse.down && player.cooldown <= 0) {
        const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
        shoot(angle);
        player.cooldown = 8;           // пауза между выстрелами (в кадрах)
        sound(880, 0.05, 'square', 0.03);
    }
}
 
function shoot(angle) {
    bullets.push({
        x: player.x, y: player.y, r: 4,
        vx: Math.cos(angle) * 11,
        vy: Math.sin(angle) * 11,
    });
}
 
function moveBullets() {
    for (const b of bullets) {
        b.x += b.vx * 2;
        b.y += b.vy * 2;
    }
    // Оставляем только пули, которые ещё на экране
    bullets = bullets.filter(b => b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20);
}
 
// ---------- Шаг 4: враги ----------
function spawnEnemies() {
    spawnTimer--;
    if (spawnTimer > 0) return;
    spawnTimer = Math.max(14, 60 - wave * 7);
 
    // Враг появляется за случайным краем экрана
    let x, y;
    const side = Math.floor(Math.random() * 4);
    if (side === 0) { x = Math.random() * W; y = -30; }
    if (side === 1) { x = W + 30; y = Math.random() * H; }
    if (side === 2) { x = Math.random() * W; y = H + 30; }
    if (side === 3) { x = -30; y = Math.random() * H; }
 
    // Тип врага: чем дальше волна, тем опаснее
    const roll = Math.random();
    if (wave >= 3 && roll < 0.15) {
        enemies.push({ x, y, r: 28, speed: 0.9, hp: 6, color: '#b14cff', points: 50, flash: 0 });  // танк
    } else if (wave >= 2 && roll < 0.45) {
        enemies.push({ x, y, r: 10, speed: 3.2, hp: 1, color: '#ffe600', points: 15, flash: 0 });  // бегун
    } else {
        enemies.push({ x, y, r: 16, speed: 1.4 + wave * 0.15, hp: 1, color: '#ff2e88', points: 10, flash: 0 });
    }
}
 
function moveEnemies() {
    for (const e of enemies) {
        // Каждый враг летит прямо на игрока
        const angle = Math.atan2(player.y - e.y, player.x - e.x);
        e.x += Math.cos(angle) * e.speed;
        e.y += Math.sin(angle) * e.speed;
        if (e.flash > 0) e.flash--;
    }
}
 
function hitEnemies() {
    for (const e of enemies) {
        for (const b of bullets) {
            if (!b.dead && !e.dead && dist(b, e) < b.r + e.r) {
                b.dead = true;
                e.hp--;
                e.flash = 4;
                if (e.hp <= 0) {
                    e.dead = true;
                    score += e.points;
                    explode(e.x, e.y, e.color, 18);
                    shake = Math.max(shake, 5);
                    sound(140, 0.15, 'sawtooth', 0.05);
                } else {
                    sound(300, 0.04, 'triangle', 0.04);
                }
            }
        }
    }
    // Убираем всё, что погибло
    bullets = bullets.filter(b => !b.dead);
    enemies = enemies.filter(e => !e.dead);
}
 
// Табло над игрой: пишем цифры в HTML
function updateHud() {
    document.getElementById('hp').textContent = player.hp;
    document.getElementById('score').textContent = score;
    document.getElementById('wave').textContent = wave;
}
 
// ---------- Шаг 5: урон и конец игры ----------
function hitPlayer() {
    if (player.invul > 0) player.invul--;
    for (const e of enemies) {
        if (!e.dead && player.invul <= 0 && dist(e, player) < e.r + player.r) {
            e.dead = true;
            player.hp--;
            player.invul = 60;               // секунда неуязвимости
            explode(player.x, player.y, '#00f0ff', 30);
            shake = 16;
            sound(70, 0.35, 'sawtooth', 0.08);
            if (player.hp <= 0) endGame();
        }
    }
    enemies = enemies.filter(e => !e.dead);
}
 
function endGame() {
    gameOver = true;
    document.getElementById('final').textContent = score;
    document.getElementById('over').hidden = false;
    sound(220, 0.6, 'square', 0.06);
    sound(110, 0.9, 'square', 0.06);
}
 
// ---------- Шаг 6: взрывы и тряска ----------
function explode(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 5;
        particles.push({
            x, y, color,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 30 + Math.random() * 20,
        });
    }
}
 
function updateParticles() {
    for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;          // искры тормозят
        p.vy *= 0.94;
        p.life--;
    }
    particles = particles.filter(p => p.life > 0);
    shake *= 0.85;             // тряска затухает
}
 
// ---------- Шаг 7: волны ----------
function nextWave() {
    waveTimer++;
    if (waveTimer >= 60 * 15) {    // каждые 15 секунд
        waveTimer = 0;
        wave++;
        banner = 120;              // 2 секунды показываем надпись
        sound(520, 0.15, 'triangle', 0.06);
        sound(780, 0.25, 'triangle', 0.06);
    }
    if (banner > 0) banner--;
}
 
// ---------- Шаг 8: звук (синтезатор прямо в браузере) ----------
let audio = null;
canvas.addEventListener('mousedown', () => {
    // Браузер разрешает звук только после первого клика
    if (!audio) audio = new AudioContext();
});
 
function sound(freq, duration, type, volume) {
    if (!audio) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.frequency.exponentialRampToValueAtTime(freq / 2, audio.currentTime + duration);
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
}
 
// =============================================================
//  ОБНОВЛЕНИЕ: двигаем всё (60 раз в секунду)
// =============================================================
function update() {
    if (gameOver) return;
    movePlayer();
    shooting();
    shooting();
    shooting();
    shooting();
    shooting();
    moveBullets();
    spawnEnemies();
    moveEnemies();
    hitEnemies();
    hitPlayer();
    updateParticles();
    nextWave();
    updateHud();
}
 
// =============================================================
//  РИСОВАНИЕ: рисуем кадр с нуля (60 раз в секунду)
// =============================================================
function draw() {
    // Фон
    // Полупрозрачный фон: старый кадр не стирается до конца — получаются шлейфы
    ctx.fillStyle = 'rgba(5, 5, 13, 0.35)';
    ctx.fillRect(0, 0, W, H);
 
    ctx.save();
    // Тряска: сдвигаем весь мир на случайные пиксели
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
 
    drawGrid();
 
    // Пули
    for (const b of bullets) {
        glowCircle(b.x, b.y, b.r, '#00f0ff');
    }
 
    // Враги
    for (const e of enemies) {
        glowCircle(e.x, e.y, e.r, e.flash > 0 ? '#ffffff' : e.color);
        glowCircle(e.x, e.y, e.r * 0.55, '#05050d');    // тёмная серединка — получается неоновое кольцо
    }
 
    // Искры
    for (const p of particles) {
        ctx.globalAlpha = p.life / 50;
        glowCircle(p.x, p.y, 2.5, p.color);
    }
    ctx.globalAlpha = 1;
 
    drawPlayer();
    ctx.restore();
 
    // Надпись «ВОЛНА N»
    if (banner > 0) {
        ctx.globalAlpha = Math.min(1, banner / 30);
        ctx.fillStyle = '#ffe600';
        ctx.shadowColor = '#ffe600';
        ctx.shadowBlur = 25;
        ctx.font = 'bold 72px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`ВОЛНА ${wave}`, W / 2, H / 2 - 60);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
}
 
function drawGrid() {
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
}
 
function drawPlayer() {
    // Мигаем, пока неуязвимы после удара
    if (player.invul > 0 && player.invul % 10 < 5) return;
    // Ствол — линия в сторону мыши
    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 6;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + Math.cos(angle) * 28, player.y + Math.sin(angle) * 28);
    ctx.stroke();
    ctx.shadowBlur = 0;
    glowCircle(player.x, player.y, player.r, '#00f0ff');
    glowCircle(player.x, player.y, player.r * 0.45, '#ffffff');
}
 
// =============================================================
//  ИГРОВОЙ ЦИКЛ: браузер вызывает loop перед каждым кадром
// =============================================================
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}
 
reset();
loop();