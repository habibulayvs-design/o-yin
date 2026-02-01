// Canvas setup
const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

// Audio System
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let soundEnabled = true;

// Sound effects using Web Audio API
function playBeep(frequency, duration) {
    if (!soundEnabled) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// Voice messages using Web Speech API
function speak(text, lang = 'uz-UZ') {
    if (!soundEnabled || !('speechSynthesis' in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to find Uzbek voice, fallback to any available voice
    const voices = speechSynthesis.getVoices();
    const uzbekVoice = voices.find(voice => voice.lang.startsWith('uz'));
    if (uzbekVoice) {
        utterance.voice = uzbekVoice;
    }

    speechSynthesis.speak(utterance);
}

// Load voices (needed for some browsers)
if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = () => {
        speechSynthesis.getVoices();
    };
}

// Sound effect functions
function playPaddleHit() {
    playBeep(440, 0.1); // A4 note
}

function playWallHit() {
    playBeep(220, 0.1); // A3 note
}

function playScore() {
    playBeep(523, 0.2); // C5 note
    setTimeout(() => playBeep(659, 0.2), 100); // E5 note
}

function playGameStart() {
    playBeep(523, 0.15);
    setTimeout(() => playBeep(659, 0.15), 100);
    setTimeout(() => playBeep(784, 0.2), 200);
}

function playGameOver(playerWon) {
    if (playerWon) {
        // Victory sound
        playBeep(523, 0.15);
        setTimeout(() => playBeep(659, 0.15), 100);
        setTimeout(() => playBeep(784, 0.15), 200);
        setTimeout(() => playBeep(1047, 0.3), 300);

        // Voice message
        setTimeout(() => {
            speak("Shukurllo, sen yutding!");
        }, 800);
    } else {
        // Defeat sound
        playBeep(392, 0.2);
        setTimeout(() => playBeep(330, 0.2), 150);
        setTimeout(() => playBeep(262, 0.3), 300);

        // Voice message
        setTimeout(() => {
            speak("Shukurllo, sen yutqazding!");
        }, 800);
    }
}

// Set canvas size
function resizeCanvas() {
    const maxWidth = 800;
    const maxHeight = 500;
    const containerWidth = document.querySelector('.game-container').offsetWidth - 40;

    if (window.innerWidth <= 768) {
        canvas.width = Math.min(containerWidth, maxWidth);
        canvas.height = canvas.width * 0.7;
    } else {
        canvas.width = maxWidth;
        canvas.height = maxHeight;
    }
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game variables
let gameRunning = false;
let difficulty = 'medium';
const winningScore = 5;

// Difficulty settings
const difficultySettings = {
    easy: { aiSpeed: 3, ballSpeed: 4 },
    medium: { aiSpeed: 4.5, ballSpeed: 5 },
    hard: { aiSpeed: 6, ballSpeed: 6.5 }
};

// Paddle properties
const paddleWidth = 12;
const paddleHeight = 100;
const paddleSpeed = 8;

const player = {
    x: 20,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    dy: 0,
    score: 0
};

const ai = {
    x: canvas.width - 20 - paddleWidth,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    dy: 0,
    score: 0
};

// Ball properties
const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 8,
    dx: 5,
    dy: 3,
    speed: 5
};

// Keyboard controls
const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Touch controls
let touchY = null;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchY = e.touches[0].clientY;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (touchY !== null) {
        const newTouchY = e.touches[0].clientY;
        const deltaY = newTouchY - touchY;
        player.y += deltaY;
        touchY = newTouchY;

        // Keep paddle in bounds
        if (player.y < 0) player.y = 0;
        if (player.y + player.height > canvas.height) {
            player.y = canvas.height - player.height;
        }
    }
});

canvas.addEventListener('touchend', () => {
    touchY = null;
});

// Mouse controls (for desktop)
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    player.y = mouseY - player.height / 2;

    // Keep paddle in bounds
    if (player.y < 0) player.y = 0;
    if (player.y + player.height > canvas.height) {
        player.y = canvas.height - player.height;
    }
});

// Draw functions
function drawRect(x, y, width, height, color, glow = true) {
    ctx.fillStyle = color;
    if (glow) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
    }
    ctx.fillRect(x, y, width, height);
    ctx.shadowBlur = 0;
}

function drawCircle(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.shadowBlur = 30;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawNet() {
    const netWidth = 4;
    const netHeight = 15;
    const gap = 20;

    for (let i = 0; i < canvas.height; i += netHeight + gap) {
        drawRect(
            canvas.width / 2 - netWidth / 2,
            i,
            netWidth,
            netHeight,
            'rgba(0, 243, 255, 0.3)',
            false
        );
    }
}

function drawGame() {
    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw net
    drawNet();

    // Draw paddles
    drawRect(player.x, player.y, player.width, player.height, '#00f3ff');
    drawRect(ai.x, ai.y, ai.width, ai.height, '#ff00ff');

    // Draw ball
    drawCircle(ball.x, ball.y, ball.radius, '#39ff14');
}

// Update game state
function update() {
    if (!gameRunning) return;

    // Player movement (keyboard)
    if (keys['w'] || keys['W'] || keys['ArrowUp']) {
        player.y -= paddleSpeed;
    }
    if (keys['s'] || keys['S'] || keys['ArrowDown']) {
        player.y += paddleSpeed;
    }

    // Keep player paddle in bounds
    if (player.y < 0) player.y = 0;
    if (player.y + player.height > canvas.height) {
        player.y = canvas.height - player.height;
    }

    // AI movement
    const aiCenter = ai.y + ai.height / 2;
    const ballCenter = ball.y;
    const aiSpeed = difficultySettings[difficulty].aiSpeed;

    if (aiCenter < ballCenter - 35) {
        ai.y += aiSpeed;
    } else if (aiCenter > ballCenter + 35) {
        ai.y -= aiSpeed;
    }

    // Keep AI paddle in bounds
    if (ai.y < 0) ai.y = 0;
    if (ai.y + ai.height > canvas.height) {
        ai.y = canvas.height - ai.height;
    }

    // Ball movement
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Ball collision with top and bottom
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
        ball.dy *= -1;
        playWallHit();
    }

    // Ball collision with paddles
    // Player paddle
    if (ball.x - ball.radius < player.x + player.width &&
        ball.x + ball.radius > player.x &&
        ball.y > player.y &&
        ball.y < player.y + player.height) {

        ball.dx = Math.abs(ball.dx);
        playPaddleHit();

        // Add spin based on where ball hits paddle
        const hitPos = (ball.y - player.y) / player.height;
        ball.dy = (hitPos - 0.5) * 10;

        // Increase speed slightly
        ball.dx *= 1.05;
        ball.dy *= 1.05;
    }

    // AI paddle
    if (ball.x + ball.radius > ai.x &&
        ball.x - ball.radius < ai.x + ai.width &&
        ball.y > ai.y &&
        ball.y < ai.y + ai.height) {

        ball.dx = -Math.abs(ball.dx);
        playPaddleHit();

        // Add spin
        const hitPos = (ball.y - ai.y) / ai.height;
        ball.dy = (hitPos - 0.5) * 10;

        // Increase speed slightly
        ball.dx *= 1.05;
        ball.dy *= 1.05;
    }

    // Scoring
    if (ball.x - ball.radius < 0) {
        // AI scores
        ai.score++;
        playScore();
        updateScore();
        resetBall();
        checkWin();
    }

    if (ball.x + ball.radius > canvas.width) {
        // Player scores
        player.score++;
        playScore();
        updateScore();
        resetBall();
        checkWin();
    }
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;

    const speed = difficultySettings[difficulty].ballSpeed;
    const angle = (Math.random() - 0.5) * Math.PI / 3;

    ball.dx = Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1);
    ball.dy = Math.sin(angle) * speed;
}

function updateScore() {
    document.getElementById('playerScore').textContent = player.score;
    document.getElementById('aiScore').textContent = ai.score;
}

function checkWin() {
    if (player.score >= winningScore || ai.score >= winningScore) {
        gameRunning = false;
        showGameOver();
    }
}

function showGameOver() {
    const gameOverScreen = document.getElementById('gameOverScreen');
    const gameResult = document.getElementById('gameResult');

    const playerWon = player.score >= winningScore;

    if (playerWon) {
        gameResult.textContent = '🎉 Siz yutdingiz! 🎉';
        gameResult.style.color = '#39ff14';
    } else {
        gameResult.textContent = '😔 Kompyuter yutdi 😔';
        gameResult.style.color = '#ff00ff';
    }

    document.getElementById('finalPlayerScore').textContent = player.score;
    document.getElementById('finalAiScore').textContent = ai.score;

    gameOverScreen.style.display = 'flex';

    // Play game over sound and voice
    playGameOver(playerWon);
}

// Game loop
function gameLoop() {
    update();
    drawGame();
    requestAnimationFrame(gameLoop);
}

// Start game
function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    gameRunning = true;
    player.score = 0;
    ai.score = 0;
    updateScore();
    resetBall();
    playGameStart();

    // Welcome message
    setTimeout(() => {
        speak("O'yin boshlandi! Omad tilayman, Shukurllo!");
    }, 500);
}

// Restart game
function restartGame() {
    document.getElementById('gameOverScreen').style.display = 'none';
    player.score = 0;
    ai.score = 0;
    updateScore();
    resetBall();
    gameRunning = true;
}

// Set difficulty
function setDifficulty(level) {
    difficulty = level;

    // Update button styles
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

// Initialize
resizeCanvas();
drawGame();
gameLoop();
