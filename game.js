const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
let gameState = {
    players: [],
    pot: 40,
    currentPlayerIndex: 0,
    round: 1,
    card1: null,
    card2: null,
    card3: null,
    gamePhase: 'waiting',
    currentBet: 10,
    powerups: [
        { name: '🔮 Peek Card', description: 'See next card', cost: 50, used: false },
        { name: '⚡ Double Win', description: '2x payout', cost: 100, used: false },
        { name: '🛡️ Insurance', description: 'Half loss', cost: 75, used: false },
        { name: '🎯 Force Bot', description: 'Bot bets high', cost: 80, used: false },
        { name: '💎 Lucky Charm', description: 'Win boost', cost: 120, used: false }
    ],
    activePowerup: null,
    nextCard: null,
    deckCards: [],
    luckMode: 'default',
    trophies: 500,
    musicMuted: false,
    musicVolume: 0.3,
    sfxVolume: 1.0,
    gameTimer: 900, // 15 minutes in seconds
    timerInterval: null,
    gameStartTime: null
};

// Leaderboard data
let leaderboard = [
    { name: 'ProGamer', trophies: 5200, avatar: '🎮' },
    { name: 'CardMaster', trophies: 4800, avatar: '🃏' },
    { name: 'LuckyStar', trophies: 3900, avatar: '⭐' },
    { name: 'AcePlayer', trophies: 3500, avatar: '🎯' },
    { name: 'You', trophies: 500, avatar: '😎', isPlayer: true },
    { name: 'Rookie123', trophies: 450, avatar: '🆕' },
    { name: 'Beginner', trophies: 380, avatar: '🎲' }
];

// Assets
const cardImages = {};
const backImage = new Image();
const tableBackground = new Image();
let backgroundLoaded = false;

let particles = [];
let floatingTexts = [];
let floatTime = 0;

let animations = {
    card1: { x: 500, y: 300, targetX: 500, targetY: 300, scale: 0, targetScale: 1, rotation: 0, opacity: 1 },
    card2: { x: 650, y: 300, targetX: 650, targetY: 300, scale: 0, targetScale: 1, rotation: 0, opacity: 1 },
    card3: { x: 575, y: 300, targetX: 575, targetY: 300, scale: 0, targetScale: 1, rotation: 0, opacity: 1 }
};

// Load assets
function loadCardImages() {
    backImage.src = 'cards/back.png';
    backImage.onerror = () => console.error('Failed to load back.png');
    
    tableBackground.src = 'table.png';
    tableBackground.onload = () => { 
        backgroundLoaded = true;
        console.log('Table background loaded successfully');
    };
    tableBackground.onerror = () => {
        console.error('Failed to load table.png');
        backgroundLoaded = false;
    };
    
    for (let i = 1; i <= 52; i++) {
        const img = new Image();
        img.src = `cards/card${i}.png`;
        img.onerror = () => console.error(`Failed to load card${i}.png`);
        cardImages[i] = img;
    }
    
    resetDeck();
    
    // Give images time to load
    setTimeout(() => {
        console.log('Background loaded:', backgroundLoaded);
        console.log('Sample card loaded:', cardImages[1].complete);
    }, 1000);
}

function resetDeck() {
    gameState.deckCards = [];
    for (let i = 1; i <= 52; i++) {
        gameState.deckCards.push(i);
    }
    shuffleDeck();
}

function shuffleDeck() {
    for (let i = gameState.deckCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gameState.deckCards[i], gameState.deckCards[j]] = [gameState.deckCards[j], gameState.deckCards[i]];
    }
}

function drawCardFromDeck() {
    if (gameState.deckCards.length < 10) resetDeck();
    return gameState.deckCards.pop();
}

// Audio
const sounds = {
    deal: new Audio('sounds/deal.wav'),
    win: new Audio('sounds/win.wav'),
    lose: new Audio('sounds/lose.wav'),
    bgMusic: new Audio('sounds/bgmusic.mp3')
};

sounds.bgMusic.loop = true;
sounds.bgMusic.volume = gameState.musicVolume;

// Screen Management
function showMainMenu() {
    hideAllScreens();
    document.getElementById('mainMenu').classList.add('active');
    sounds.bgMusic.play().catch(e => console.log('Audio blocked'));
}

function showLuckSelect() {
    hideAllScreens();
    document.getElementById('luckSelect').classList.add('active');
}

function showLeaderboard() {
    hideAllScreens();
    updateLeaderboardDisplay();
    document.getElementById('leaderboardScreen').classList.add('active');
}

function showSettings() {
    hideAllScreens();
    document.getElementById('settingsScreen').classList.add('active');
}

function hideAllScreens() {
    document.querySelectorAll('.main-menu, .luck-select, .leaderboard-screen, .settings-screen, .game-screen').forEach(el => {
        el.classList.remove('active');
    });
}

// Game Start
function startGame(luckMode) {
    gameState.luckMode = luckMode;
    
    // Pick random opponents from leaderboard (excluding player)
    const bots = leaderboard.filter(p => !p.isPlayer).sort(() => Math.random() - 0.5).slice(0, 3);
    
    gameState.players = [
        { name: 'You', pesos: 1000, isHuman: true, position: 'bottom', avatar: '😎' },
        { name: bots[0].name, pesos: 1000, isHuman: false, position: 'left', avatar: bots[0].avatar },
        { name: bots[1].name, pesos: 1000, isHuman: false, position: 'top', avatar: bots[1].avatar },
        { name: bots[2].name, pesos: 1000, isHuman: false, position: 'right', avatar: bots[2].avatar }
    ];
    
    gameState.pot = 40;
    gameState.round = 1;
    gameState.currentPlayerIndex = 0;
    gameState.gameTimer = 900; // Reset to 15 minutes
    
    // Start timer
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    gameState.timerInterval = setInterval(updateTimer, 1000);
    
    hideAllScreens();
    document.getElementById('gameScreen').classList.add('active');
    
    resetDeck();
    setTimeout(() => {
        startPlayerTurn();
        updateUI();
    }, 500);
}

function updateTimer() {
    gameState.gameTimer--;
    
    const minutes = Math.floor(gameState.gameTimer / 60);
    const seconds = gameState.gameTimer % 60;
    const timerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timerDisplay').textContent = timerText;
    
    // Warning at 1 minute
    if (gameState.gameTimer === 60) {
        showMessage('⏰ 1 Minute Left!', '#FF0000');
    }
    
    // Time's up!
    if (gameState.gameTimer <= 0) {
        clearInterval(gameState.timerInterval);
        endGameByTime();
    }
}

function endGameByTime() {
    // Sort players by pesos
    const sortedPlayers = [...gameState.players].sort((a, b) => b.pesos - a.pesos);
    
    // Find player's position
    const playerRank = sortedPlayers.findIndex(p => p.isHuman) + 1;
    
    // Calculate trophy rewards
    let trophyGain = 0;
    if (playerRank === 1) trophyGain = 20;
    else if (playerRank === 2) trophyGain = 5;
    else if (playerRank === 3) trophyGain = 3;
    else trophyGain = 0;
    
    gameState.trophies += trophyGain;
    updateLeaderboardTrophies();
    
    // Show time's up results screen
    showTimeUpScreen(sortedPlayers, playerRank, trophyGain);
}

// Particle classes
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8 - 2;
        this.life = 1;
        this.color = color;
        this.size = Math.random() * 6 + 3;
    }

    update() {
        this.vx *= 0.98;
        this.vy += 0.15;
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.015;
    }

    draw(ctx) {
        ctx.globalAlpha = this.life;
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1;
        this.vy = -2;
    }

    update() {
        this.y += this.vy;
        this.life -= 0.01;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = this.color;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.textAlign = 'center';
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

function createParticles(x, y, color, count = 40) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function createFloatingText(x, y, text, color) {
    floatingTexts.push(new FloatingText(x, y, text, color));
}

function getCardValue(cardNum) {
    const value = ((cardNum - 1) % 13) + 1;
    return value === 1 ? 14 : value;
}

function getCurrentPlayer() {
    return gameState.players[gameState.currentPlayerIndex];
}

function startPlayerTurn() {
    const player = getCurrentPlayer();
    
    if (player.pesos <= 0) {
        nextPlayer();
        return;
    }
    
    gameState.card1 = drawCardFromDeck();
    gameState.card2 = drawCardFromDeck();
    gameState.card3 = null;
    gameState.nextCard = drawCardFromDeck();
    
    const val1 = getCardValue(gameState.card1);
    const val2 = getCardValue(gameState.card2);
    
    if (val1 === val2) {
        gameState.gamePhase = 'pair';
        handlePair();
        return;
    }
    
    if (Math.abs(val1 - val2) === 1) {
        gameState.gamePhase = 'consecutive';
        handleConsecutive();
        return;
    }
    
    animations.card1 = { x: 600, y: -50, targetX: 500, targetY: 300, scale: 0.3, targetScale: 1, rotation: -0.3, opacity: 1 };
    animations.card2 = { x: 600, y: -50, targetX: 650, targetY: 300, scale: 0.3, targetScale: 1, rotation: 0.3, opacity: 1 };
    animations.card3 = { x: 600, y: -50, targetX: 575, targetY: 300, scale: 0, targetScale: 1, rotation: 0, opacity: 1 };
    
    playSound('deal');
    createParticles(500, 300, '#8B00FF', 25);
    
    setTimeout(() => {
        playSound('deal');
        createParticles(650, 300, '#8B00FF', 25);
    }, 200);
    
    if (player.isHuman) {
        gameState.gamePhase = 'betting';
        gameState.currentBet = 10;
        showMessage(`Your turn!`, '#FFD700');
    } else {
        gameState.gamePhase = 'bot_thinking';
        setTimeout(() => botDecision(), 1500);
    }
    
    updateUI();
}

function handlePair() {
    const player = getCurrentPlayer();
    const winAmount = Math.min(20, gameState.pot);
    player.pesos += winAmount;
    gameState.pot -= winAmount;
    
    playSound('win');
    createParticles(575, 300, '#00FF00', 60);
    showMessage(`${player.name} got PAIR! +₱${winAmount}`, '#00FF00');
    createFloatingText(575, 250, `+₱${winAmount}`, '#00FF00');
    
    setTimeout(() => nextPlayer(), 2000);
}

function handleConsecutive() {
    const player = getCurrentPlayer();
    const loseAmount = Math.min(10, player.pesos);
    player.pesos -= loseAmount;
    gameState.pot += loseAmount;
    
    playSound('lose');
    createParticles(575, 300, '#FF0000', 40);
    showMessage(`${player.name} consecutive! -₱${loseAmount}`, '#FF0000');
    createFloatingText(575, 250, `-₱${loseAmount}`, '#FF0000');
    
    setTimeout(() => nextPlayer(), 2000);
}

function botDecision() {
    const player = getCurrentPlayer();
    const val1 = getCardValue(gameState.card1);
    const val2 = getCardValue(gameState.card2);
    const spread = Math.abs(val1 - val2) - 1;
    
    const passChance = spread <= 2 ? 0.6 : spread <= 4 ? 0.3 : 0.1;
    
    if (Math.random() < passChance) {
        showMessage(`${player.name} passes!`, '#FFA500');
        setTimeout(() => nextPlayer(), 1500);
        return;
    }
    
    let betAmount;
    if (spread >= 8) betAmount = Math.min(100, player.pesos);
    else if (spread >= 5) betAmount = Math.min(50, player.pesos);
    else betAmount = Math.min(20, player.pesos);
    
    gameState.currentBet = Math.max(10, betAmount);
    showMessage(`${player.name} bets ₱${gameState.currentBet}`, '#FFD700');
    
    setTimeout(() => revealCard(), 1500);
}

function playerBet() {
    if (gameState.gamePhase !== 'betting') return;
    
    const player = getCurrentPlayer();
    const bet = parseInt(document.getElementById('betAmount').value);
    
    if (bet > player.pesos) {
        showMessage('Not enough pesos!', '#FF0000');
        return;
    }
    
    if (bet < 10) {
        showMessage('Minimum ₱10!', '#FF0000');
        return;
    }
    
    gameState.currentBet = bet;
    gameState.gamePhase = 'confirming';
    updateUI();
}

function confirmBet() {
    if (gameState.gamePhase !== 'confirming') return;
    gameState.gamePhase = 'revealing';
    showMessage(`You bet ₱${gameState.currentBet}!`, '#FFD700');
    setTimeout(() => revealCard(), 1000);
}

function cancelBet() {
    gameState.gamePhase = 'betting';
    updateUI();
}

function passRound() {
    if (gameState.gamePhase !== 'betting') return;
    showMessage('You passed!', '#FFA500');
    setTimeout(() => nextPlayer(), 1500);
}

function revealCard() {
    gameState.card3 = gameState.nextCard;
    gameState.gamePhase = 'revealing';
    
    animations.card3.scale = 0.3;
    animations.card3.targetScale = 1.1;
    
    playSound('deal');
    createParticles(575, 300, '#FFD700', 50);
    
    setTimeout(() => {
        animations.card3.targetScale = 1;
        checkWin();
    }, 600);
}

function checkWin() {
    const player = getCurrentPlayer();
    const val1 = getCardValue(gameState.card1);
    const val2 = getCardValue(gameState.card2);
    const val3 = getCardValue(gameState.card3);
    
    const min = Math.min(val1, val2);
    const max = Math.max(val1, val2);
    
    gameState.gamePhase = 'results';
    
    // Apply luck modifier
    let luckBoost = gameState.luckMode === 'more' ? 0.15 : 0;
    let isWin = (val3 > min && val3 < max);
    
    // Luck mode: small chance to turn loss into win
    if (!isWin && gameState.luckMode === 'more' && Math.random() < luckBoost) {
        isWin = true;
    }
    
    if (val3 === val1 || val3 === val2) {
        player.pesos -= gameState.currentBet;
        gameState.pot += gameState.currentBet;
        playSound('lose');
        createParticles(575, 300, '#FF0000', 60);
        showMessage(`${player.name} matched! -₱${gameState.currentBet}`, '#FF0000');
        createFloatingText(575, 250, `-₱${gameState.currentBet}`, '#FF0000');
        checkElimination(player);
        
    } else if (isWin) {
        let winAmount = gameState.currentBet;
        if (gameState.activePowerup === '⚡ Double Win') winAmount *= 2;
        
        const actualWin = Math.min(winAmount, gameState.pot);
        player.pesos += actualWin;
        gameState.pot -= actualWin;
        
        playSound('win');
        createParticles(575, 300, '#00FF00', 80);
        showMessage(`${player.name} WINS ₱${actualWin}!`, '#00FF00');
        createFloatingText(575, 250, `+₱${actualWin}`, '#00FF00');
        
        if (gameState.pot <= 0) refillPot();
        
    } else {
        let loseAmount = gameState.currentBet;
        if (gameState.activePowerup === '🛡️ Insurance') loseAmount = Math.floor(loseAmount / 2);
        
        player.pesos -= loseAmount;
        gameState.pot += loseAmount;
        
        playSound('lose');
        createParticles(575, 300, '#FF0000', 60);
        showMessage(`${player.name} LOSES ₱${loseAmount}!`, '#FF0000');
        createFloatingText(575, 250, `-₱${loseAmount}`, '#FF0000');
        
        checkElimination(player);
    }
    
    gameState.activePowerup = null;
    resetPowerups();
    updateUI();
    
    setTimeout(() => nextPlayer(), 2500);
}

function checkElimination(player) {
    if (player.pesos <= 0 && player.isHuman) {
        setTimeout(() => showSlapScreen(), 2000);
    }
}

function showSlapScreen() {
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    playSound('lose');
    gameState.trophies = Math.max(0, gameState.trophies - 10);
    updateLeaderboardTrophies();
    document.getElementById('slapScreen').classList.add('active');
}

function showWinScreen() {
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    playSound('win');
    gameState.trophies += 20;
    updateLeaderboardTrophies();
    document.getElementById('winScreen').classList.add('active');
}

function showTimeUpScreen(sortedPlayers, playerRank, trophyGain) {
    const screen = document.getElementById('timeUpScreen');
    const list = document.getElementById('finalRankingsList');
    
    list.innerHTML = '';
    
    sortedPlayers.forEach((player, index) => {
        const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '4️⃣';
        const item = document.createElement('div');
        item.className = `ranking-item ${player.isHuman ? 'player-rank' : ''}`;
        item.innerHTML = `
            <span class="rank-emoji">${rankEmoji}</span>
            <span class="rank-name">${player.avatar} ${player.name}</span>
            <span class="rank-pesos">₱${player.pesos}</span>
        `;
        list.appendChild(item);
    });
    
    document.getElementById('playerRankDisplay').textContent = `You placed ${playerRank}${getOrdinalSuffix(playerRank)}!`;
    document.getElementById('trophyGainDisplay').textContent = trophyGain > 0 ? `+${trophyGain} 🏆` : 'No trophies earned';
    document.getElementById('trophyGainDisplay').style.color = trophyGain > 0 ? '#00FF00' : '#888';
    
    screen.classList.add('active');
}

function getOrdinalSuffix(num) {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
}

function playAgain() {
    document.getElementById('slapScreen').classList.remove('active');
    document.getElementById('timeUpScreen').classList.remove('active');
    gameState.players[0].pesos = 1000;
    gameState.pot = 40;
    gameState.gameTimer = 900;
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    gameState.timerInterval = setInterval(updateTimer, 1000);
    resetDeck();
    startPlayerTurn();
    updateUI();
}

function playAgainFromWin() {
    document.getElementById('winScreen').classList.remove('active');
    document.getElementById('timeUpScreen').classList.remove('active');
    startGame(gameState.luckMode);
}

function playAgainFromTimeUp() {
    document.getElementById('timeUpScreen').classList.remove('active');
    startGame(gameState.luckMode);
}

function refillPot() {
    const activePlayers = gameState.players.filter(p => p.pesos > 0);
    activePlayers.forEach(p => {
        const contribution = Math.min(10, p.pesos);
        p.pesos -= contribution;
        gameState.pot += contribution;
    });
    showMessage('Pot refilled!', '#FFD700');
}

function nextPlayer() {
    animations.card1.targetX = -200;
    animations.card2.targetX = 1400;
    animations.card3.targetY = 800;
    
    setTimeout(() => {
        do {
            gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % 4;
        } while (gameState.players[gameState.currentPlayerIndex].pesos <= 0 && 
                 gameState.players.some(p => p.pesos > 0));
        
        const activePlayers = gameState.players.filter(p => p.pesos > 0);
        if (activePlayers.length <= 1) {
            if (activePlayers[0].isHuman) {
                showWinScreen();
            } else {
                showMessage('Game Over!', '#FF0000');
            }
            return;
        }
        
        startPlayerTurn();
    }, 400);
}

function adjustBet(amount) {
    const input = document.getElementById('betAmount');
    const player = getCurrentPlayer();
    let newBet = parseInt(input.value) + amount;
    newBet = Math.max(10, Math.min(player.pesos, newBet));
    input.value = newBet;
}

function activatePowerup(index) {
    const player = getCurrentPlayer();
    const powerup = gameState.powerups[index];
    
    if (!player.isHuman || powerup.used || gameState.gamePhase !== 'betting') return;
    
    if (player.pesos < powerup.cost) {
        showMessage('Not enough pesos!', '#FF0000');
        return;
    }
    
    player.pesos -= powerup.cost;
    gameState.activePowerup = powerup.name;
    powerup.used = true;
    
    if (powerup.name === '🔮 Peek Card') {
        const val = getCardValue(gameState.nextCard);
        showMessage(`Next card: ${val}`, '#00FFFF');
        createParticles(575, 300, '#00FFFF', 40);
    }
    
    updateUI();
    updatePowerupUI();
}

function resetPowerups() {
    gameState.powerups.forEach(p => p.used = false);
    updatePowerupUI();
}

function updatePowerupUI() {
    const bar = document.getElementById('powerupBar');
    bar.innerHTML = '';
    
    const player = getCurrentPlayer();
    
    gameState.powerups.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = `powerup-item ${p.used ? 'used' : ''}`;
        div.innerHTML = `<strong>${p.name}</strong><br><small>${p.description}</small><br><span style="color:#FFD700">₱${p.cost}</span>`;
        
        if (player.isHuman && !p.used && gameState.gamePhase === 'betting') {
            div.onclick = () => activatePowerup(i);
        }
        
        bar.appendChild(div);
    });
}

function showMessage(text, color) {
    const msg = document.getElementById('message');
    msg.textContent = text;
    msg.style.color = color;
    msg.style.textShadow = `0 0 30px ${color}, 0 0 60px ${color}`;
    msg.classList.add('show');
    
    setTimeout(() => msg.classList.remove('show'), 2000);
}

function updateUI() {
    const player = getCurrentPlayer();
    
    document.getElementById('potAmount').textContent = gameState.pot;
    document.getElementById('trophies').textContent = gameState.trophies;
    document.getElementById('round').textContent = gameState.round;
    
    // Update timer display
    const minutes = Math.floor(gameState.gameTimer / 60);
    const seconds = gameState.gameTimer % 60;
    document.getElementById('timerDisplay').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    gameState.players.forEach((p, i) => {
        document.getElementById(`player${i}Name`).textContent = `${p.avatar} ${p.name}`;
        document.getElementById(`player${i}Pesos`).textContent = `₱${p.pesos}`;
        
        const indicator = document.getElementById(`player${i}Indicator`);
        indicator.style.display = i === gameState.currentPlayerIndex ? 'block' : 'none';
    });
    
    const controls = document.getElementById('betControls');
    const confirmPanel = document.getElementById('confirmPanel');
    
    if (player.isHuman && gameState.gamePhase === 'betting') {
        controls.style.display = 'flex';
        confirmPanel.style.display = 'none';
        document.getElementById('betAmount').value = gameState.currentBet;
    } else if (player.isHuman && gameState.gamePhase === 'confirming') {
        controls.style.display = 'none';
        confirmPanel.style.display = 'flex';
        document.getElementById('confirmText').textContent = `Bet ₱${gameState.currentBet}?`;
    } else {
        controls.style.display = 'none';
        confirmPanel.style.display = 'none';
    }
    
    updatePowerupUI();
}

// Leaderboard
function updateLeaderboardTrophies() {
    const playerEntry = leaderboard.find(p => p.isPlayer);
    if (playerEntry) {
        playerEntry.trophies = gameState.trophies;
        leaderboard.sort((a, b) => b.trophies - a.trophies);
    }
}

function updateLeaderboardDisplay() {
    const list = document.getElementById('leaderboardList');
    list.innerHTML = '';
    
    leaderboard.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = `leaderboard-item ${player.isPlayer ? 'player' : ''}`;
        item.innerHTML = `
            <span class="leaderboard-rank">#${index + 1}</span>
            <span>${player.avatar} ${player.name}</span>
            <span>🏆 ${player.trophies}</span>
        `;
        list.appendChild(item);
    });
}

// Settings
function updateMusicVolume(value) {
    gameState.musicVolume = value / 100;
    sounds.bgMusic.volume = gameState.musicVolume;
    document.getElementById('musicValue').textContent = value + '%';
    document.getElementById('quickMusicVolume').value = value;
}

function updateSFXVolume(value) {
    gameState.sfxVolume = value / 100;
    document.getElementById('sfxValue').textContent = value + '%';
    document.getElementById('quickSFXVolume').value = value;
}

function toggleMusic() {
    gameState.musicMuted = !gameState.musicMuted;
    if (gameState.musicMuted) {
        sounds.bgMusic.pause();
        document.getElementById('musicToggleText').textContent = '🔊 Unmute Music';
    } else {
        sounds.bgMusic.play();
        document.getElementById('musicToggleText').textContent = '🔇 Mute Music';
    }
}

function playSound(soundName) {
    if (gameState.sfxVolume > 0) {
        sounds[soundName].currentTime = 0;
        sounds[soundName].volume = gameState.sfxVolume;
        sounds[soundName].play();
    }
}

// In-game menu
function showInGameMenu() {
    document.getElementById('inGameMenuPopup').classList.add('active');
}

function closeInGameMenu() {
    document.getElementById('inGameMenuPopup').classList.remove('active');
}

function quickSettings() {
    closeInGameMenu();
    document.getElementById('quickSettingsPopup').classList.add('active');
}

function closeQuickSettings() {
    document.getElementById('quickSettingsPopup').classList.remove('active');
}

function exitToMainMenu() {
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    document.getElementById('inGameMenuPopup').classList.remove('active');
    document.getElementById('quickSettingsPopup').classList.remove('active');
    document.getElementById('winScreen').classList.remove('active');
    document.getElementById('slapScreen').classList.remove('active');
    document.getElementById('timeUpScreen').classList.remove('active');
    showMainMenu();
}

// Drawing
function drawCardOnCanvas(cardNum, anim, isBack = false) {
    ctx.save();
    ctx.globalAlpha = anim.opacity;
    ctx.translate(anim.x, anim.y);
    ctx.rotate(anim.rotation);
    ctx.scale(anim.scale, anim.scale);
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
    
    const img = isBack ? backImage : cardImages[cardNum];
    
    if (img && img.complete && img.naturalHeight !== 0) {
        // Image loaded successfully - draw it
        ctx.drawImage(img, -75, -105, 150, 210);
    } else {
        // Fallback - draw placeholder
        ctx.fillStyle = isBack ? '#4B0082' : 'white';
        ctx.fillRect(-75, -105, 150, 210);
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.strokeRect(-75, -105, 150, 210);
        
        // Add text to show card number
        if (!isBack && cardNum) {
            ctx.fillStyle = 'black';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const cardValue = getCardValue(cardNum);
            ctx.fillText(cardValue, 0, 0);
        }
    }
    
    ctx.restore();
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    if (backgroundLoaded && tableBackground.complete && tableBackground.naturalHeight !== 0) {
        // Draw the table image
        ctx.drawImage(tableBackground, 0, 0, canvas.width, canvas.height);
    } else {
        // Fallback: Draw poker table gradient
        const gradient = ctx.createRadialGradient(600, 350, 0, 600, 350, 500);
        gradient.addColorStop(0, 'rgba(0, 100, 0, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 50, 0, 0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw table border
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 20;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
        
        // Draw poker table oval
        ctx.beginPath();
        ctx.ellipse(600, 350, 400, 250, 0, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    
    floatTime += 0.02;
    
    ['card1', 'card2', 'card3'].forEach(key => {
        const anim = animations[key];
        anim.x += (anim.targetX - anim.x) * 0.15;
        anim.y += (anim.targetY - anim.y) * 0.15;
        anim.scale += (anim.targetScale - anim.scale) * 0.15;
        anim.rotation += (anim.targetRotation - anim.rotation) * 0.15;
    });
    
    if (gameState.card1) drawCardOnCanvas(gameState.card1, animations.card1);
    if (gameState.card2) drawCardOnCanvas(gameState.card2, animations.card2);
    if (gameState.card3) drawCardOnCanvas(gameState.card3, animations.card3);
    
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => { p.update(); p.draw(ctx); });
    
    floatingTexts = floatingTexts.filter(t => t.life > 0);
    floatingTexts.forEach(t => { t.update(); t.draw(ctx); });
    
    requestAnimationFrame(animate);
}

// Initialize
loadCardImages();
showMainMenu();
animate();