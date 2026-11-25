// =============================================================
//  game.js — игра «Неоновый рой».
// =============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const keys = {};
const mouse = { x: W / 2, y: H / 2, down: false };

// ---------- Состояние игры ----------
let player = null;
let bullets = [];
let enemies = [];
let clones = [];
let allies = []; 
let particles = [];
let spawnTimer = 0;
let score = 0;
let gameOver = false;
let shake = 0;
let wave = 1;
let waveTimer = 0;
let banner = 0;
let slash = null;
let paused = true;

// Переменные для уровней
let xp = 0;
let level = 1;
let xpNeed = 5;

// ---------- Помощники ----------
function glowCircle(x, y, r, color) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

// ---------- Управление ----------
addEventListener('keydown', e => keys[e.code] = true);
addEventListener('keyup', e => keys[e.code] = false);

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * W / rect.width;
    mouse.y = (e.clientY - rect.top) * H / rect.height;
});
canvas.addEventListener('mousedown', () => mouse.down = true);
addEventListener('mouseup', () => mouse.down = false);

function movePlayer() {
    if (keys.KeyW || keys.ArrowUp)    player.y -= player.speed;
    if (keys.KeyS || keys.ArrowDown)  player.y += player.speed;
    if (keys.KeyA || keys.ArrowLeft)  player.x -= player.speed;
    if (keys.KeyD || keys.ArrowRight) player.x += player.speed;
    player.x = clamp(player.x, player.r, W - player.r);
    player.y = clamp(player.y, player.r, H - player.r);
}

// ---------- Логика стрельбы игрока ----------
function shooting() {
    if (!player) return;
    player.cooldown--;
    if (mouse.down && player.cooldown <= 0) {
        const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
        
        if (player.sword) {
            swing(angle);
        } else {
            for (let i = 0; i < player.shots; i++) {
                shoot(angle + (i - (player.shots - 1) / 2) * player.spread, player.x, player.y);
            }
        }
        
        // Механика призыва по выстрелам
        if (player.summoner) {
            player.summonCounter = (player.summonCounter || 0) + 1;
            if (player.summonCounter >= (player.summonRate || 10)) {
                player.summonCounter = 0;
                clones.push({
                    x: player.x + (Math.random() - 0.5) * 50, 
                    y: player.y + (Math.random() - 0.5) * 50,
                    r: player.r,
                    color: player.color,
                    life: player.cloneLife || (60 * 8), 
                    cooldown: 0, 
                    angle: angle 
                });
                if (audio) sound(600, 0.2, 'sine', 0.05);
            }
            updateStatsPanel(); // Обновляем панель, чтобы видеть счетчик выстрелов
        }
        
        player.cooldown = player.fireRate;
        if (audio) sound(880, 0.05, 'square', 0.03);
    }
}

function shoot(angle, startX = player.x, startY = player.y) {
    bullets.push({
        x: startX, y: startY, r: player.bulletSize,
        vx: Math.cos(angle) * player.bulletSpeed,
        vy: Math.sin(angle) * player.bulletSpeed,
        pierce: player.pierce,
        hit: [],
    });
}

function moveBullets() {
    for (const b of bullets) {
        b.x += b.vx;
        b.y += b.vy;
    }
    bullets = bullets.filter(b => b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20);
}

// ---------- Логика врагов ----------
function spawnEnemies() {
    spawnTimer--;
    if (spawnTimer > 0) return;
    
    spawnTimer = Math.max(10, 45 - wave * 6);

    let spawnCount = 1;
    if (wave > 2 && Math.random() < 0.3) spawnCount = 2; 
    if (wave > 4 && Math.random() < 0.2) spawnCount = 3;

    for (let i = 0; i < spawnCount; i++) {
        let x, y;
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { x = Math.random() * W; y = -30; }
        if (side === 1) { x = W + 30; y = Math.random() * H; }
        if (side === 2) { x = Math.random() * W; y = H + 30; }
        if (side === 3) { x = -30; y = Math.random() * H; }

        const roll = Math.random();
        if (wave >= 3 && roll < 0.15) {
            enemies.push({ x, y, r: 28, speed: 0.9, hp: 6, color: '#b14cff', points: 50, flash: 0 });
        } else if (wave >= 2 && roll < 0.45) {
            enemies.push({ x, y, r: 10, speed: 3.2, hp: 1, color: '#ffe600', points: 15, flash: 0 });
        } else {
            enemies.push({ x, y, r: 16, speed: 1.4 + wave * 0.15, hp: 1, color: '#ff2e88', points: 10, flash: 0 });
        }
    }
}

function moveEnemies() {
    for (const e of enemies) {
        const angle = Math.atan2(player.y - e.y, player.x - e.x);
        e.x += Math.cos(angle) * e.speed;
        e.y += Math.sin(angle) * e.speed;
        if (e.flash > 0) e.flash--;
    }
}

function hitEnemies() {
    for (const e of enemies) {
        for (const b of bullets) {
            if (!b.dead && !e.dead && !b.hit.includes(e) && dist(b, e) < b.r + e.r) {
                b.hit.push(e);
                if (b.pierce > 0) b.pierce--;
                else b.dead = true;
                
                damageEnemy(e);
            }
        }
    }
    bullets = bullets.filter(b => !b.dead);
    enemies = enemies.filter(e => !e.dead);
}

function damageEnemy(e, isExplosion = false) {
    e.hp -= player.damage;
    e.flash = 4;

    if (player.explosive && !isExplosion) {
        for (let other of enemies) {
            if (other !== e && !other.dead && dist(e, other) < 50) {
                damageEnemy(other, true);
            }
        }
        explode(e.x, e.y, '#ffcc00', 10);
    }

    if (player.vampBullet && Math.random() < player.vampBullet) {
        player.hp = Math.min(player.maxHp, player.hp + 1);
        explode(player.x, player.y, '#00ff00', 5);
        updateStatsPanel();
    }

    if (player.slow && e.speed > 0.5) {
        e.speed *= 0.85; 
    }

    if (e.hp <= 0) {
        e.dead = true;
        
        const earnedScore = Math.floor(e.points * (player.scoreMultiplier || 1));
        score += earnedScore;

        explode(e.x, e.y, e.color, 18);
        shake = Math.max(shake, 5);
        if (audio) sound(140, 0.15, 'sawtooth', 0.05);

        // --- ГИПНОТИЗЕР ---
        if (player.mindControl && Math.random() < (player.hypnoChance || 0.33)) {
            let hitsAllowed = 1;
            if (e.color === '#b14cff') hitsAllowed = 5; 
            if (player.alliesHits) hitsAllowed += player.alliesHits;

            allies.push({
                x: e.x, y: e.y,
                r: e.r,
                speed: e.speed * 2.5, 
                color: '#ff00ff',     
                originalColor: e.color,
                maxHits: hitsAllowed,
                hitsDone: 0,
                target: null,
                life: 60 * 6 
            });
            if (audio) sound(600, 0.15, 'sine', 0.05);

            if (player.hypnoHeal) {
                player.hp = Math.min(player.maxHp, player.hp + 1);
                explode(player.x, player.y, '#00ff00', 5);
                updateStatsPanel();
            }
        }
        
        onKill(e);
    } else {
        if (audio && !isExplosion) sound(300, 0.04, 'triangle', 0.04);
    }
}

// ---------- Урон по игроку ----------
function hitPlayer() {
    if (!player) return;
    if (player.invul > 0) player.invul--;
    for (const e of enemies) {
        if (!e.dead && player.invul <= 0 && dist(e, player) < e.r + player.r) {
            e.dead = true;
            
            if (player.shield > 0) {
                player.shield--;
                player.invul = 60;
                explode(player.x, player.y, '#00ffff', 20);
                if (audio) sound(300, 0.3, 'sine', 0.08);
            } else {
                player.hp--;
                player.invul = 60;
                explode(player.x, player.y, '#00f0ff', 30);
                shake = 16;
                if (audio) sound(70, 0.35, 'sawtooth', 0.08);
                if (player.hp <= 0) endGame();
            }
            updateStatsPanel();
        }
    }
    enemies = enemies.filter(e => !e.dead);
}

function endGame() {
    gameOver = true;
    document.getElementById('final').textContent = score;
    document.getElementById('over').hidden = false;
    if (audio) {
        sound(220, 0.6, 'square', 0.06);
        sound(110, 0.9, 'square', 0.06);
    }
}

// ---------- Эффекты ----------
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
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.life--;
    }
    particles = particles.filter(p => p.life > 0);
    shake *= 0.85;
}

// ---------- ОБНОВЛЕНИЕ КЛОНОВ ----------
function updateClones() {
    for (let i = clones.length - 1; i >= 0; i--) {
        const c = clones[i];
        c.life--;
        
        for (const e of enemies) {
            if (!e.dead && dist(e, c) < e.r + c.r) {
                c.life = 0; 
            }
        }

        if (c.life > 0) {
            c.cooldown--;
            if (c.cooldown <= 0) {
                shoot(c.angle, c.x, c.y);
                c.cooldown = player.fireRate; 
            }
        }

        if (c.life <= 0) {
            explode(c.x, c.y, c.color, 10);
            clones.splice(i, 1);
        }
    }
}

// ---------- ОБНОВЛЕНИЕ СОЮЗНИКОВ (ГИПНОЗ) ----------
function findNearestEnemy(a) {
    let nearest = null;
    let minDist = Infinity;
    for (const e of enemies) {
        if (!e.dead) {
            let d = dist(a, e);
            if (d < minDist) {
                minDist = d;
                nearest = e;
            }
        }
    }
    return nearest;
}

function updateAllies() {
    for (let i = allies.length - 1; i >= 0; i--) {
        let a = allies[i];
        a.life--;

        if (!a.target || a.target.dead) {
            a.target = findNearestEnemy(a);
        }

        if (a.target) {
            let angle = Math.atan2(a.target.y - a.y, a.target.x - a.x);
            a.x += Math.cos(angle) * a.speed;
            a.y += Math.sin(angle) * a.speed;

            if (dist(a, a.target) < a.r + a.target.r) {
                a.target.hp = 0; 
                damageEnemy(a.target); 
                a.hitsDone++;
                explode(a.x, a.y, a.color, 15);

                if (a.hitsDone >= a.maxHits || a.life <= 0) {
                    explode(a.x, a.y, a.originalColor, 30);
                    allies.splice(i, 1);
                    continue;
                } else {
                    a.target = null; 
                }
            }
        }

        if (a.life <= 0) {
            explode(a.x, a.y, a.color, 10);
            allies.splice(i, 1);
        }
    }
}

// ---------- Волны ----------
function nextWave() {
    waveTimer++;
    if (waveTimer >= 60 * 15) {
        waveTimer = 0;
        wave++;
        banner = 120;
        if (audio) {
            sound(520, 0.15, 'triangle', 0.06);
            sound(780, 0.25, 'triangle', 0.06);
        }
    }
    if (banner > 0) banner--;
}

// ---------- Звук ----------
let audio = null;
canvas.addEventListener('mousedown', () => {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
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

// ---------- ОБНОВЛЕНИЕ HTML-ПАНЕЛИ СТАТОВ ----------
function updateStatsPanel() {
    if (!player) return;
    const panel = document.getElementById('stats-panel');
    if (!panel) return;

    // Меняем цвет рамки под цвет героя
    panel.style.borderColor = player.color;
    panel.style.boxShadow = `0 0 15px ${player.color}44`;

    let html = `<h3 style="color: ${player.color}">${player.name.toUpperCase()}</h3>`;
    html += `<ul class="stat-list">`;
    
    // Базовые статы
    html += `<li>❤ Жизни: <b>${player.hp} / ${player.maxHp}</b></li>`;
    html += `<li>👟 Скорость: <b>${player.speed.toFixed(1)}</b></li>`;
    html += `<li>💥 Урон: <b>${player.damage}</b></li>`;
    html += `<li>⚡ Задержка: <b>${player.fireRate} кад.</b></li>`;
    
    // Специфичные статы
    if (player.summoner) {
        const left = (player.summonRate || 10) - (player.summonCounter || 0);
        html += `<li style="color: ${player.color}">✨ До призыва: <b>${left} выстр.</b></li>`;
    }
    if (player.mindControl) {
        html += `<li style="color: ${player.color}">🧠 Шанс гипноза: <b>${Math.round((player.hypnoChance || 0.33) * 100)}%</b></li>`;
    }
    
    // Доп. статы
    if (player.shield > 0) html += `<li>🛡 Щиты: <b>${player.shield}</b></li>`;
    if (player.lifesteal) html += `<li>🩸 Вампиризм: <b>${Math.round(player.lifesteal*100)}%</b></li>`;
    if (player.vampBullet) html += `<li>🩸 Вампирские пули: <b>${Math.round(player.vampBullet*100)}%</b></li>`;
    if (player.explosive) html += `<li>💣 Взрывные пули: <b>ВКЛ</b></li>`;
    if (player.xpMultiplier > 1) html += `<li>⭐ Множитель опыта: <b>x${player.xpMultiplier.toFixed(1)}</b></li>`;
    if (player.scoreMultiplier > 1) html += `<li>💰 Множитель очков: <b>x${player.scoreMultiplier.toFixed(1)}</b></li>`;
    
    html += `</ul>`;

    // Список купленных улучшений
    if (player.upgrades && player.upgrades.length > 0) {
        html += `<div class="upgrade-title">ВЫБРАННЫЕ УЛУЧШЕНИЯ:</div>`;
        html += `<ul class="upgrade-list">`;
        
        const counts = {};
        player.upgrades.forEach(u => counts[u.name] = (counts[u.name] || 0) + 1);
        
        for (const [name, count] of Object.entries(counts)) {
            const u = player.upgrades.find(x => x.name === name);
            const countText = count > 1 ? ` x${count}` : '';
            html += `<li>${u.icon} ${name}${countText}</li>`;
        }
        html += `</ul>`;
    }

    panel.innerHTML = html;
}

// ---------- Обновление и отрисовка ----------
function updateHud() {
    if (!player) return;
    document.getElementById('hp').textContent = player.hp;
    document.getElementById('score').textContent = score;
    document.getElementById('wave').textContent = wave;
}

function update() {
    if (gameOver || paused || !player) return;
    movePlayer();
    shooting();
    moveBullets();
    spawnEnemies();
    moveEnemies();
    hitEnemies();
    hitPlayer();
    updateClones();
    updateAllies(); 
    updateParticles();
    nextWave();
    updateHud();
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
    if (!player) return;

    for (const c of clones) {
        if (c.life < 120 && c.life % 10 < 5) continue;
        glowCircle(c.x, c.y, c.r, c.color);
        ctx.globalAlpha = 0.5; 
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👤', c.x, c.y + 1);
        ctx.globalAlpha = 1;
        
        ctx.strokeStyle = c.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + Math.cos(c.angle) * 20, c.y + Math.sin(c.angle) * 20);
        ctx.stroke();
    }

    if (player.invul > 0 && player.invul % 10 < 5) return;
    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    ctx.strokeStyle = player.color || '#00f0ff';
    ctx.lineWidth = 6;
    ctx.shadowColor = player.color || '#00f0ff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + Math.cos(angle) * 28, player.y + Math.sin(angle) * 28);
    ctx.stroke();
    ctx.shadowBlur = 0;
    glowCircle(player.x, player.y, player.r, player.color || '#00f0ff');
    
    if (slash && slash.life > 0) {
        const arc = player.swingArc || 1.05; 
        ctx.globalAlpha = slash.life / 10;
        ctx.strokeStyle = player.color;
        ctx.lineWidth = 10;
        ctx.shadowColor = player.color;
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.reach, slash.angle - arc, slash.angle + arc);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        slash.life--;
    }
    
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.emoji || '', player.x, player.y + 1);
    ctx.textBaseline = 'alphabetic';
}

function draw() {
    ctx.fillStyle = 'rgba(5, 5, 13, 0.35)';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    drawGrid();

    for (const a of allies) {
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r + 4, 0, Math.PI * 2);
        ctx.stroke();
        
        glowCircle(a.x, a.y, a.r, a.originalColor);
        glowCircle(a.x, a.y, a.r * 0.5, '#ffffff');
    }

    for (const b of bullets) glowCircle(b.x, b.y, b.r, '#00f0ff');

    for (const e of enemies) {
        glowCircle(e.x, e.y, e.r, e.flash > 0 ? '#ffffff' : e.color);
        glowCircle(e.x, e.y, e.r * 0.55, '#05050d');
    }

    for (const p of particles) {
        ctx.globalAlpha = p.life / 50;
        glowCircle(p.x, p.y, 2.5, p.color);
    }
    ctx.globalAlpha = 1;

    drawPlayer();
    ctx.restore();

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

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// =============================================================
//  ГЕРОИ
// =============================================================
const HEROES = [
    {
        id: 'swordsman',
        name: 'Мечник', emoji: '⚔️', color: '#ff9f1c',
        desc: 'Рубит всех вокруг мечом. Живучий, но бьёт вблизи',
        hp: 7, speed: 4.5, damage: 2, fireRate: 10,
        sword: true, reach: 100, swingArc: 1.05
    },
    {
        id: 'mage',
        name: 'Маг', emoji: '🔮', color: '#b14cff',
        desc: 'Медленный огромный шар, прожигает всех на пути',
        hp: 4, speed: 4, damage: 2, fireRate: 30,
        shots: 1, spread: 0, bulletSpeed: 6, bulletSize: 11, pierce: 99,
    },
    {
        id: 'soldier',
        name: 'Военный', emoji: '🪖', color: '#3dff8a',
        desc: 'Автомат: очередь без остановки',
        hp: 5, speed: 4, damage: 1, fireRate: 5,
        shots: 1, spread: 0, bulletSpeed: 13, bulletSize: 3, pierce: 0,
    },
    {
        id: 'summoner',
        name: 'Призыватель', emoji: '👥', color: '#00ffcc',
        desc: 'Создаёт копию себя каждые 10 выстрелов. Копия живёт 8 секунд',
        hp: 4, speed: 4, damage: 1, fireRate: 12,
        shots: 1, spread: 0, bulletSpeed: 10, bulletSize: 4, pierce: 0,
        summoner: true, summonRate: 10 // <-- Изначально 10 выстрелов
    },
    {
        id: 'hypnotist',
        name: 'Гипнотизер', emoji: '🧠', color: '#ff00ff',
        desc: '33% шанс переманить убитого врага. Танки бьют до 5 врагов',
        hp: 4, speed: 4.2, damage: 1, fireRate: 8,
        shots: 1, spread: 0, bulletSpeed: 12, bulletSize: 4, pierce: 0,
        mindControl: true, hypnoChance: 0.33 
    },
];

let hero = HEROES[0];

function reset() {
    player = { 
        x: W / 2, y: H / 2, r: 14, cooldown: 0, invul: 0, 
        ...hero, 
        maxHp: hero.hp,
        summonCounter: 0, // Счетчик выстрелов до призыва
        xpMultiplier: 1,
        scoreMultiplier: 1,
        shield: 0,
        upgrades: [] 
    };
    bullets = [];
    enemies = [];
    clones = [];
    allies = []; 
    particles = [];
    spawnTimer = 0;
    score = 0;
    gameOver = false;
    document.getElementById('over').hidden = true;
    shake = 0;
    wave = 1;
    waveTimer = 0;
    banner = 120;
    slash = null;
    
    xp = 0;
    level = 1;
    xpNeed = 5;
    if (document.getElementById('level')) document.getElementById('level').textContent = level;
    if (document.getElementById('xp')) document.getElementById('xp').style.width = '0%';
    
    updateStatsPanel(); 
}

function swing(angle) {
    slash = { angle: angle, life: 10 };
    for (const e of enemies) {
        const toEnemy = Math.atan2(e.y - player.y, e.x - player.x);
        let diff = Math.abs(toEnemy - angle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        
        const arc = player.swingArc || 1.05;
        
        if (!e.dead && dist(e, player) < player.reach + e.r && diff < arc) {
            damageEnemy(e);
            
            if (player.lifesteal && Math.random() < player.lifesteal) {
                player.hp = Math.min(player.maxHp, player.hp + 1);
                explode(player.x, player.y, '#00ff00', 5);
                updateStatsPanel();
            }
        }
    }
}

// =============================================================
//  УЛУЧШЕНИЯ И ОПЫТ
// =============================================================
const UPGRADES = [
    // --- ОБЩИЕ УЛУЧШЕНИЯ ---
    { icon: '💥', name: 'Тяжёлые пули', desc: 'Урон +1', apply: p => p.damage += 1 },
    { icon: '⚡', name: 'Скорострельность', desc: 'Стреляешь на 25% чаще', apply: p => p.fireRate = Math.max(3, p.fireRate * 0.75) },
    { icon: '👟', name: 'Кроссовки', desc: 'Скорость бега +15%', apply: p => p.speed *= 1.15 },
    { icon: '❤', name: 'Аптечка', desc: 'Здоровье — до максимума', apply: p => p.hp = p.maxHp },
    { icon: '🛡', name: 'Броня', desc: 'Максимум здоровья +1', apply: p => { p.maxHp += 1; p.hp += 1; } },
    { icon: '⭐', name: 'Мудрость', desc: 'Получаемый опыт +50%', apply: p => p.xpMultiplier = (p.xpMultiplier || 1) + 0.5 },
    { icon: '💰', name: 'Охотник за головами', desc: 'Очки за убийство +50%', apply: p => p.scoreMultiplier = (p.scoreMultiplier || 1) + 0.5 },
    
    // --- НОВЫЕ УЛУЧШЕНИЯ ---
    { icon: '💣', name: 'Взрывные пули', desc: 'Пули наносят урон по площади', apply: p => p.explosive = true },
    { icon: '🔰', name: 'Щит', desc: 'Поглощает 1 удар', apply: p => p.shield = (p.shield || 0) + 1 },
    { icon: '🩸', name: 'Вампирские пули', desc: '2% шанс лечения при выстреле', apply: p => p.vampBullet = (p.vampBullet || 0) + 0.02 },

    // --- МЕЧНИК ---
    { icon: '🌀', name: 'Широкий замах', desc: 'Угол атаки мечом +30%', apply: p => p.swingArc = (p.swingArc || 1.05) * 1.3, req: p => p.id === 'swordsman' },
    { icon: '🩸', name: 'Вампиризм', desc: '15% шанс восстановить 1 HP при ударе', apply: p => p.lifesteal = (p.lifesteal || 0) + 0.15, req: p => p.id === 'swordsman' },
    { icon: '🗡', name: 'Длинный клинок', desc: 'Меч достаёт на 25% дальше', apply: p => p.reach = (p.reach || 80) * 1.25, req: p => p.id === 'swordsman' },

    // --- МАГ ---
    { icon: '🔮', name: 'Гигантский шар', desc: 'Размер пули +20%', apply: p => p.bulletSize *= 1.2, req: p => p.id === 'mage' },
    { icon: '🐢', name: 'Гравитация', desc: 'Враги замедляются при попадании', apply: p => p.slow = true, req: p => p.id === 'mage' },

    // --- ВОЕННЫЙ ---
    { icon: '🔱', name: 'Дробовик', desc: '+1 пуля в залпе', apply: p => { p.shots += 1; p.spread = Math.max(p.spread, 0.15); }, req: p => p.id === 'soldier' },
    { icon: '🏹', name: 'Бронебойные', desc: 'Пуля пробивает ещё 1 врага', apply: p => p.pierce += 1, req: p => p.id === 'soldier' },

    // --- ПРИЗЫВАТЕЛЬ ---
    { icon: '⏳', name: 'Долгая жизнь', desc: 'Клоны живут на 3 сек дольше', apply: p => p.cloneLife = (p.cloneLife || 480) + 180, req: p => p.summoner },
    { 
        icon: '✨', name: 'Быстрый призыв', desc: 'Призыв на 3 выстрела раньше (мин. 1)', 
        apply: p => p.summonRate = Math.max(1, (p.summonRate || 10) - 3), // <-- Возврат к выстрелам
        req: p => p.summoner 
    },

    // --- ГИПНОТИЗЕР ---
    { 
        icon: '🧠', name: 'Глубокий транс', desc: 'Шанс гипноза +15% (макс. 65%)', 
        apply: p => p.hypnoChance = Math.min(0.65, (p.hypnoChance || 0.33) + 0.15), // <-- Лимит 65%
        req: p => p.mindControl 
    },
    { icon: '👑', name: 'Кукловод', desc: 'Загипнотизированные бьют на +2 врага', apply: p => p.alliesHits = (p.alliesHits || 0) + 2, req: p => p.mindControl },
    { icon: '💖', name: 'Симбиоз', desc: 'Успешный гипноз восстанавливает 1 HP', apply: p => p.hypnoHeal = true, req: p => p.mindControl },
];

function onKill(e) {
    const earnedXp = (e.points / 10) * (player.xpMultiplier || 1);
    xp += earnedXp;

    if (xp >= xpNeed) {
        xp -= xpNeed;
        level++;
        xpNeed = Math.round(xpNeed * 1.35); 
        showUpgrades();
    }
    if (document.getElementById('level')) document.getElementById('level').textContent = level;
    if (document.getElementById('xp')) document.getElementById('xp').style.width = (xp / xpNeed * 100) + '%';
}

function showUpgrades() {
    paused = true;
    mouse.down = false;
    
    let picksLeft = (level % 3 === 0) ? 2 : 1;
    
    const available = UPGRADES.filter(u => !u.req || u.req(player));
    const choice = [...available].sort(() => Math.random() - 0.5).slice(0, 6);
    
    const box = document.getElementById('cards');
    if (!box) return;
    box.innerHTML = '';
    
    box.style.display = 'flex';
    box.style.flexWrap = 'wrap';
    box.style.justifyContent = 'center';
    box.style.gap = '10px';
    box.style.maxWidth = '700px';

    for (const u of choice) {
        const card = makeCard(u.icon, u.name, u.desc, '#ffe600', (evt) => {
            u.apply(player);
            player.upgrades.push(u); 
            
            updateStatsPanel(); 
            
            const btn = evt.currentTarget;
            btn.style.opacity = '0.3';
            btn.style.pointerEvents = 'none';
            
            picksLeft--;
            
            if (audio) {
                sound(660, 0.12, 'sine', 0.08);
                sound(990, 0.2, 'sine', 0.08);
            }

            if (picksLeft === 0) {
                document.getElementById('levelup').hidden = true;
                paused = false;
            }
        });
        box.append(card);
    }
    document.getElementById('levelup').hidden = false;
    if (audio) sound(520, 0.3, 'triangle', 0.07);
}

// =============================================================
//  ВЫБОР ГЕРОЯ
// =============================================================
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
    if (!box) return;
    box.innerHTML = '';
    for (const h of HEROES) {
        let stats = `${h.desc}<br>❤ ${h.hp} · 👟 ${h.speed} · 💥 ${h.damage}`;
        
        box.append(makeCard(h.emoji, h.name, stats, h.color, () => {
            hero = h;
            document.getElementById('pick').hidden = true;
            reset();
            paused = false;
        }));
    }
    document.getElementById('pick').hidden = false;
}

document.getElementById('restart').onclick = showHeroes;
showHeroes();   
loop();