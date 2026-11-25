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
        cooldown: 0,                   // пауза до выстрела
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
    let dx = 0, dy = 0;
    if (keys.KeyW || keys.ArrowUp)    dy -= 1;
    if (keys.KeyS || keys.ArrowDown)  dy += 1;
    if (keys.KeyA || keys.ArrowLeft)  dx -= 1;
    if (keys.KeyD || keys.ArrowRight) dx += 1;

    if (dx !== 0 || dy !== 0) {
        // Нормализуем, чтобы по диагонали не было быстрее
        const len = Math.hypot(dx, dy);
        dx /= len; dy /= len;
        player.x += dx * player.speed;
        player.y += dy * player.speed;
        player.moveAngle = Math.atan2(dy, dx);   // ← запоминаем направление
        player.moving = true;
    } else {
        player.moving = false;
    }
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
        b.x += b.vx;
        b.y += b.vy;
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
    if (player.tank) return; 
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

    for (const p of particles) {
    ctx.globalAlpha = p.life / 50;
    glowCircle(p.x, p.y, p.flame ? 4 : 2.5, p.color);   // ← пламя крупнее
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
    if (player.invul > 0 && player.invul % 10 < 5) return;
    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);

    // Ствол — только не танку
    if (!player.tank) {
        ctx.strokeStyle = player.color;
        ctx.lineWidth = 6;
        ctx.shadowColor = player.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(player.x + Math.cos(angle) * 28, player.y + Math.sin(angle) * 28);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // Основной круг (как у мечника)
    glowCircle(player.x, player.y, player.r, player.color);

    // 🛡️ Танк: индикатор направления движения (треугольник-щит спереди)
    if (player.tank && player.moving) {
        const a = player.moveAngle;
        const tipX = player.x + Math.cos(a) * (player.r + 14);
        const tipY = player.y + Math.sin(a) * (player.r + 14);
        const leftX = player.x + Math.cos(a + 2.5) * (player.r + 6);
        const leftY = player.y + Math.sin(a + 2.5) * (player.r + 6);
        const rightX = player.x + Math.cos(a - 2.5) * (player.r + 6);
        const rightY = player.y + Math.sin(a - 2.5) * (player.r + 6);

        ctx.fillStyle = player.color;
        ctx.globalAlpha = 0.55;
        ctx.shadowColor = player.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(leftX, leftY);
        ctx.lineTo(rightX, rightY);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    // Дуга меча (оставляем — вдруг пригодится)
    if (slash && slash.life > 0) {
        ctx.globalAlpha = slash.life / 10;
        ctx.strokeStyle = player.color;
        ctx.lineWidth = 10;
        ctx.shadowColor = player.color;
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.reach, slash.angle - 1.05, slash.angle + 1.05);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        slash.life--;
    }

    // Эмодзи героя
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.emoji, player.x, player.y + 1);
    ctx.textBaseline = 'alphabetic';
}

// =============================================================
//  ИГРОВОЙ ЦИКЛ: браузер вызывает loop перед каждым кадром
// =============================================================
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}


// =============================================================
//  ВСТАВКА 1. ГЕРОИ: у каждого свои характеристики
// =============================================================

// 👇 Список героев. Каждый герой — это просто набор чисел.
//    Добавить своего героя = дописать ещё один объект { … }
const HEROES = [
    {
        name: 'Мечник', emoji: '⚔️', color: '#ff9f1c',
        desc: 'Рубит всех вокруг мечом. Живучий, но бьёт вблизи',
        hp: 7,             // жизни
        speed: 4.5,        // скорость бега
        damage: 2,         // урон одного удара
        fireRate: 22,      // пауза между ударами (меньше = чаще)
        sword: true,       // ⚔ вместо пуль — удар мечом
        reach: 80,         // длина меча: на каком расстоянии достаёт
    },
    {
        name: 'Маг', emoji: '🔮', color: '#b14cff',
        desc: 'Медленный огромный шар, прожигает всех на пути',
        hp: 4, speed: 4, damage: 2, fireRate: 30,
        shots: 1, spread: 0, bulletSpeed: 6, bulletSize: 11, pierce: 99,
    },
    {
        name: 'Военный', emoji: '💂‍♂️', color: '#3dff8a',
        desc: 'Автомат: очередь без остановки',
        hp: 5, speed: 4, damage: 1, fireRate: 5,
        shots: 1, spread: 0, bulletSpeed: 13, bulletSize: 3, pierce: 0,
    },
    {
    name: 'Огнемётчик', emoji: '🔥', color: '#ff6a00',
    desc: 'Струя пламени: поджигает всех в конусе',
    hp: 6, speed: 3.5, damage: 1, fireRate: 3,
    flame: true,          // ← флаг: вместо пуль — струя огня
    reach: 160,           // дальность струи
    arc: 0.45,            // полуширина конуса в радианах (~26°)
    burnDamage: 1,        // урон от горения за тик
    burnTime: 90,         // кадров горения (1.5 сек)
    },
    {
    name: 'Танк', emoji: '🛡️', color: '#7dff5e',
    desc: 'Таран: враги получают урон, врезаясь в тебя. Неуязвим спереди',
    hp: 10, speed: 3, damage: 2, fireRate: 99,
    tank: true,
    contactDamage: 3,
    },
];

let hero = HEROES[0];      // выбранный герой
let paused = false;        // пауза: пока выбираем героя или улучшение
let slash = null;          // взмах меча, который сейчас рисуем
let xp, level, xpNeed;     // опыт и уровень — понадобятся на второй паре

function reset() {
    // Игрок получает ВСЕ характеристики выбранного героя: ...hero
    player = { x: W / 2, y: H / 2, r: 14, cooldown: 0, invul: 0, moveAngle: 0, moving: false,  ...hero, maxHp: hero.hp }; // ← новое
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
    xp = 0;                                               // ← новое
    level = 1;                                            // ← новое
    xpNeed = 5;                                           // ← новое
    slash = null;                                         // ← новое
    document.getElementById('level').textContent = level; // ← новое
    document.getElementById('xp').style.width = '0%';     // ← новое
}

function shooting() {
    player.cooldown--;
    if (mouse.down && player.cooldown <= 0) {
        const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
        if (player.tank) {
            // танк не стреляет — урон наносится касанием (см. tankContact)
        } else if (player.flame) {
            flame(angle);
        } else if (player.sword) {
            swing(angle);
        } else {
            for (let i = 0; i < player.shots; i++) {
                shoot(angle + (i - (player.shots - 1) / 2) * player.spread);
            }
        }
        player.cooldown = player.fireRate;
        sound(880, 0.05, 'square', 0.03);
    }
}

function shoot(angle) {
    bullets.push({
        x: player.x, y: player.y, r: player.bulletSize,   // ← новое
        vx: Math.cos(angle) * player.bulletSpeed,         // ← новое
        vy: Math.sin(angle) * player.bulletSpeed,         // ← новое
        pierce: player.pierce,   // сколько ещё врагов пробьёт
        hit: [],                 // кого уже задела (чтобы не бить одного дважды)
    });
}

function hitEnemies() {
    for (const e of enemies) {
        for (const b of bullets) {
            if (!b.dead && !e.dead && !b.hit.includes(e) && dist(b, e) < b.r + e.r) { // ← новое
                b.hit.push(e);                            // ← новое
                if (b.pierce > 0) b.pierce--;    // пробила и летит дальше
                else b.dead = true;                       // ← новое
                damageEnemy(e);                           // ← новое
            }
        }
    }
    bullets = bullets.filter(b => !b.dead);
    enemies = enemies.filter(e => !e.dead);
}

// Ранить врага: и пулей, и мечом — одна функция на всех
function damageEnemy(e) {
    e.hp -= player.damage;
    e.flash = 4;
    if (e.hp <= 0) {
        e.dead = true;
        score += e.points;
        explode(e.x, e.y, e.color, 18);
        shake = Math.max(shake, 5);
        sound(140, 0.15, 'sawtooth', 0.05);
        onKill(e);
    } else {
        sound(300, 0.04, 'triangle', 0.04);
    }
}

// ⚔ Удар мечом: задевает всех врагов в «куске пиццы» перед героем
function swing(angle) {
    slash = { angle: angle, life: 10 };       // 10 кадров рисуем дугу
    for (const e of enemies) {
        // Угол от героя до врага и разница с направлением удара
        const toEnemy = Math.atan2(e.y - player.y, e.x - player.x);
        let diff = Math.abs(toEnemy - angle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;   // через «ноль» короче
        // Достаёт мечом и враг впереди (±60°)?
        if (!e.dead && dist(e, player) < player.reach + e.r && diff < 1.05) {
            damageEnemy(e);
        }
    }
}

// 🔥 Струя пламени: конус, который поджигает врагов
function flame(angle) {
    // 1) Спавним частицы-искры для визуала (не логика, только картинка)
    for (let i = 0; i < 6; i++) {
        const a = angle + (Math.random() - 0.5) * player.arc * 2;
        const speed = 4 + Math.random() * 6;
        particles.push({
            x: player.x, y: player.y,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            life: 12 + Math.random() * 10,
            color: Math.random() < 0.5 ? '#ff6a00' : '#ffe600',
            flame: true,                 // помечаем: это пламя, а не искры взрыва
        });
    }

    // 2) Бьём всех врагов в конусе
    for (const e of enemies) {
        if (e.dead) continue;
        const toEnemy = Math.atan2(e.y - player.y, e.x - player.x);
        let diff = Math.abs(toEnemy - angle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if (dist(e, player) < player.reach + e.r && diff < player.arc) {
            damageEnemy(e);
            e.burn = player.burnTime;    // поджигаем
        }
    }
}

function updateBurn(){
    // 🔥 Урон от горения: тикает у каждого подожжённого врага
    let burnTimer = 0;
    function updateBurn() {
        burnTimer++;
        if (burnTimer % 20 !== 0) return;   // урон раз в ~0.33 сек
        for (const e of enemies) {
            if (e.burn > 0) {
                e.burn -= 20;
                e.hp -= player.burnDamage;
                e.flash = 2;
                if (Math.random() < 0.5) {
                    particles.push({
                        x: e.x + (Math.random() - 0.5) * e.r,
                        y: e.y + (Math.random() - 0.5) * e.r,
                        vx: (Math.random() - 0.5) * 2,
                        vy: -1 - Math.random() * 2,
                        life: 15, color: '#ff6a00', flame: true,
                    });
                }
                if (e.hp <= 0 && !e.dead) {
                    e.dead = true;
                    score += e.points;
                    explode(e.x, e.y, e.color, 18);
                    shake = Math.max(shake, 5);
                    sound(140, 0.15, 'sawtooth', 0.05);
                    onKill(e);
                }
            }
        }
        enemies = enemies.filter(e => !e.dead);
    }
}

// 🛡️ Танк: враг, коснувшийся танка, получает урон от тарана.
// Танк НЕ получает урон, если враг находится в передней полусфере
// (в направлении движения танка). Иначе — получает.
function tankContact() {
    if (!player.tank) return;
    if (player.invul > 0) player.invul--;

    for (const e of enemies) {
        if (e.dead) continue;
        if (dist(e, player) < e.r + player.r) {
            // Враг всегда получает урон от тарана
            damageEnemyByContact(e);

            // Угол от танка к врагу
            const toEnemy = Math.atan2(e.y - player.y, e.x - player.x);
            let diff = Math.abs(toEnemy - player.moveAngle);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;

            // Если танк движется и враг в передней полусфере (±90° = π/2)
            // — танк неуязвим. Иначе (стоит или враг сзади/сбоку) — получает урон.
            const shielded = player.moving && diff < Math.PI / 2;

            if (!shielded && player.invul <= 0) {
                player.hp--;
                player.invul = 40;
                explode(player.x, player.y, player.color, 10);
                shake = 8;
                sound(90, 0.2, 'sawtooth', 0.05);
                if (player.hp <= 0) endGame();
            }

            // Отбрасываем врага, чтобы он не «прилипал»
            const a = Math.atan2(e.y - player.y, e.x - player.x);
            e.x += Math.cos(a) * 4;
            e.y += Math.sin(a) * 4;
        }
    }
    enemies = enemies.filter(e => !e.dead);
}

// Урон врагу от касания танка. Отдельная функция, чтобы не путать
// с player.damage (у танка он может отличаться от contactDamage).
function damageEnemyByContact(e) {
    e.hp -= player.contactDamage;
    e.flash = 4;
    shake = Math.max(shake, 3);
    if (e.hp <= 0) {
        e.dead = true;
        score += e.points;
        explode(e.x, e.y, e.color, 18);
        shake = Math.max(shake, 5);
        sound(140, 0.15, 'sawtooth', 0.05);
        onKill(e);
    } else {
        sound(200, 0.04, 'square', 0.03);
    }
}

// Вызывается, когда враг погиб. Пока пустая — наполним на второй паре
function onKill(e) {
}

function drawPlayer() {
    if (player.invul > 0 && player.invul % 10 < 5) return;
    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    ctx.strokeStyle = player.color;                       // ← новое
    ctx.lineWidth = 6;
    ctx.shadowColor = player.color;                       // ← новое
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + Math.cos(angle) * 28, player.y + Math.sin(angle) * 28);
    ctx.stroke();
    ctx.shadowBlur = 0;
    glowCircle(player.x, player.y, player.r, player.color); // ← новое
    // Дуга меча: тает за 10 кадров
    if (slash && slash.life > 0) {                        // ← новое
        ctx.globalAlpha = slash.life / 10;                // ← новое
        ctx.strokeStyle = player.color;                   // ← новое
        ctx.lineWidth = 10;                               // ← новое
        ctx.shadowColor = player.color;                   // ← новое
        ctx.shadowBlur = 25;                              // ← новое
        ctx.beginPath();                                  // ← новое
        ctx.arc(player.x, player.y, player.reach, slash.angle - 1.05, slash.angle + 1.05); // ← новое
        ctx.stroke();                                     // ← новое
        ctx.shadowBlur = 0;                               // ← новое
        ctx.globalAlpha = 1;                              // ← новое
        slash.life--;                                     // ← новое
    }                                                     // ← новое
    // Эмодзи героя в центре
    ctx.font = '16px sans-serif';                         // ← новое
    ctx.textAlign = 'center';                             // ← новое
    ctx.textBaseline = 'middle';                          // ← новое
    ctx.fillText(player.emoji, player.x, player.y + 1);   // ← новое
    ctx.textBaseline = 'alphabetic';                      // ← новое
}


// =============================================================
//  ВСТАВКА 2. ЭКРАН ВЫБОРА ГЕРОЯ
// =============================================================

// Одна карточка-кнопка: картинка, название, описание
function makeCard(icon, title, text, color, onPick) {
    const card = document.createElement('button');
    card.className = 'card';
    card.style.borderColor = color;
    card.innerHTML = `<div class="icon">${icon}</div><b>${title}</b><small>${text}</small>`;
    card.onclick = onPick;
    return card;
}

function showHeroes() {
    paused = true;
    document.getElementById('over').hidden = true;
    const box = document.getElementById('heroes');
    box.innerHTML = '';
    for (const h of HEROES) {
        const stats = `${h.desc}<br>❤ ${h.hp} · 👟 ${h.speed} · 💥 ${h.damage}`;
        box.append(makeCard(h.emoji, h.name, stats, h.color, () => {
            hero = h;
            document.getElementById('pick').hidden = true;
            reset();
            paused = false;
        }));
    }
    document.getElementById('pick').hidden = false;
}

function update() {
    if (gameOver || paused) return;       // на паузе мир стоит
    movePlayer();
    shooting();
    moveBullets();
    spawnEnemies();
    moveEnemies();
    hitEnemies();
    tankContact();
    hitPlayer();
    updateParticles();
    updateBurn();
    nextWave();
    updateHud();
}

// После смерти кнопка ведёт к выбору героя (R — снова тем же героем)
document.getElementById('restart').onclick = showHeroes;
showHeroes();


reset();
loop();
