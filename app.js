const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Game State
let gameState = "START"; // START, PLAYING, GAMEOVER, LEVEL_COMPLETE, GAME_WON
let currentLevel = 0;
let lastTime = 0;
let cameraY = 0; // The virtual vertical position of the camera/player
let traffic = [];
let target = null;
let particles = [];

// Input State
const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  w: false,
  s: false,
  a: false,
  d: false
};

// Player Entity
const player = {
  x: canvas.width / 2,
  y: canvas.height * 0.8,
  width: 42,
  height: 86,
  vx: 0,
  vy: 0,
  speed: 0,
  maxSpeed: 800, // Pixels per second
  acceleration: 400,
  friction: 200,
  braking: 600,
  rotation: 0,
  health: 100,
  maxHealth: 100,
  type: "car",
  color: "#2563eb",
  label: "POLICE"
};

// UI Elements
const playerHealthEl = document.getElementById("playerHealth");
const targetHealthEl = document.getElementById("targetHealth");
const targetHealthRow = document.getElementById("targetHealthRow");
const speedDisplay = document.getElementById("speedDisplay");

const storyModal = document.getElementById("storyModal");
const storyTitle = document.getElementById("storyTitle");
const storyText = document.getElementById("storyText");
const startLevelBtn = document.getElementById("startLevelBtn");

const gameOverModal = document.getElementById("gameOverModal");
const restartGameBtn = document.getElementById("restartGameBtn");

const levelCompleteModal = document.getElementById("levelCompleteModal");
const nextLevelBtn = document.getElementById("nextLevelBtn");

const gameWonModal = document.getElementById("gameWonModal");
const playAgainBtn = document.getElementById("playAgainBtn");

// Levels
const levels = [
  {
    title: "Mission 1: The Getaway Van",
    story: "A suspect is fleeing the scene of a robbery in a grey van. Stop them before they reach the city limits.",
    targetType: "van",
    targetSpeed: 250,
    targetHealth: 50,
    targetColor: "#1e293b",
    targetWidth: 46,
    targetHeight: 96,
  },
  {
    title: "Mission 2: Reckless Endangerment",
    story: "An SUV is driving erratically, endangering civilians. Take it down.",
    targetType: "suv",
    targetSpeed: 300,
    targetHealth: 80,
    targetColor: "#64748b",
    targetWidth: 46,
    targetHeight: 92,
  },
  {
    title: "Mission 3: Heavy Load",
    story: "A stolen delivery truck is plowing through traffic. It's heavily armored.",
    targetType: "truck",
    targetSpeed: 280,
    targetHealth: 120,
    targetColor: "#475569",
    targetWidth: 48,
    targetHeight: 98,
  },
  {
    title: "Mission 4: Speed Demon",
    story: "A street racer is testing a stolen sports car. You'll need to go fast to catch them.",
    targetType: "car",
    targetSpeed: 450,
    targetHealth: 60,
    targetColor: "#ef4444",
    targetWidth: 42,
    targetHeight: 86,
  },
  {
    title: "Mission 5: Unstoppable Force",
    story: "A rogue semi-truck is on a rampage. It will take everything you have to stop it.",
    targetType: "semi",
    targetSpeed: 320,
    targetHealth: 200,
    targetColor: "#7c3aed",
    targetWidth: 48,
    targetHeight: 126,
  }
];

// Spawning Logic
const vehicleTypes = [
  { type: "car", width: 42, height: 86, color: "#9ca3af" },
  { type: "suv", width: 46, height: 92, color: "#64748b" },
  { type: "van", width: 46, height: 96, color: "#1e293b" },
  { type: "truck", width: 48, height: 98, color: "#334155" },
];

function spawnTraffic() {
  const lanes = [233, 400, 566]; // Approx center of 3 lanes
  const lane = lanes[Math.floor(Math.random() * lanes.length)];
  const vType = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];

  // Spawn ahead of the player
  const spawnY = -200 - Math.random() * 300;

  traffic.push({
    id: Math.random(),
    x: lane,
    y: spawnY,
    width: vType.width,
    height: vType.height,
    type: vType.type,
    color: vType.color,
    label: "CIV",
    speed: 200 + Math.random() * 150, // Move forward
    rotation: 0
  });
}

function checkCollision(a, b) {
  // Simple AABB collision
  return (
    a.x - a.width / 2 < b.x + b.width / 2 &&
    a.x + a.width / 2 > b.x - b.width / 2 &&
    a.y - a.height / 2 < b.y + b.height / 2 &&
    a.y + a.height / 2 > b.y - b.height / 2
  );
}

function updateHealthUI() {
  if (player.health < 0) player.health = 0;
  playerHealthEl.style.width = `${Math.max(0, (player.health / player.maxHealth) * 100)}%`;

  if (player.health < 30) {
    playerHealthEl.style.backgroundColor = "#ef4444"; // Red
  } else if (player.health < 60) {
    playerHealthEl.style.backgroundColor = "#facc15"; // Yellow
  } else {
    playerHealthEl.style.backgroundColor = "#4ade80"; // Green
  }

  if (target) {
    if (target.health < 0) target.health = 0;
    targetHealthEl.style.width = `${Math.max(0, (target.health / target.maxHealth) * 100)}%`;
  }
}

function lighten(hex, amount) {
  const color = hex.replace("#", "");
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  const lift = (channel) => Math.min(255, Math.round(channel + (255 - channel) * amount));
  return `rgb(${lift(r)}, ${lift(g)}, ${lift(b)})`;
}

function drawRoad(scrollY) {
  ctx.save();

  // Base background
  const lotGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  lotGrad.addColorStop(0, "#1b2638");
  lotGrad.addColorStop(1, "#162131");
  ctx.fillStyle = lotGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const roadGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  roadGrad.addColorStop(0, "#52657f");
  roadGrad.addColorStop(0.5, "#3a4a60");
  roadGrad.addColorStop(1, "#2a394d");

  const shoulderGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  shoulderGrad.addColorStop(0, "#2e3f55");
  shoulderGrad.addColorStop(1, "#223246");

  const roadWidth = 500;
  const roadX = (canvas.width - roadWidth) / 2;

  // Shoulders
  ctx.fillStyle = shoulderGrad;
  ctx.fillRect(roadX - 20, 0, 20, canvas.height);
  ctx.fillRect(roadX + roadWidth, 0, 20, canvas.height);

  // Main road
  ctx.fillStyle = roadGrad;
  ctx.fillRect(roadX, 0, roadWidth, canvas.height);

  // Road edges
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(roadX + 10, 0);
  ctx.lineTo(roadX + 10, canvas.height);
  ctx.moveTo(roadX + roadWidth - 10, 0);
  ctx.lineTo(roadX + roadWidth - 10, canvas.height);
  ctx.stroke();

  // Dashed lines
  const lanes = 3;
  const laneWidth = roadWidth / lanes;

  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.setLineDash([30, 30]);
  ctx.lineWidth = 3;

  const yOffset = -(scrollY % 60);

  for (let i = 1; i < lanes; i++) {
    const lx = roadX + i * laneWidth;
    ctx.beginPath();
    ctx.moveTo(lx, yOffset - 60);
    ctx.lineTo(lx, canvas.height);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.restore();
}

function drawVehicle(item) {
  const { x, y, width, height, rotation, type, color, label } = item;

  // Don't draw if off-screen (mostly for enemies/traffic)
  if (y + height/2 < 0 || y - height/2 > canvas.height) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation || 0);

  if (type === "motorcycle") {
    ctx.strokeStyle = "#0b0f16";
    ctx.lineWidth = 2.5;
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    // motorcycle wheels vertically
    ctx.arc(0, -height * 0.28, width * 0.34, 0, Math.PI * 2);
    ctx.arc(0, height * 0.28, width * 0.34, 0, Math.PI * 2);
    ctx.fill();

    const bikeGrad = ctx.createLinearGradient(0, -height / 2, 0, height / 2);
    bikeGrad.addColorStop(0, lighten(color, 0.3));
    bikeGrad.addColorStop(1, color);
    ctx.fillStyle = bikeGrad;
    ctx.beginPath();
    ctx.roundRect(-width * 0.2, -height * 0.2, width * 0.4, height * 0.4, 6);
    ctx.fill();

    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(-width * 0.1, height * 0.05);
    ctx.lineTo(-width * 0.26, height * 0.34);
    ctx.moveTo(width * 0.08, -height * 0.06);
    ctx.lineTo(width * 0.24, -height * 0.3);
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 11px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${label || "V?"}`, -width * 0.75, 0);
    ctx.restore();
    return;
  }

  if (type === "trailer") {
    const trailerGrad = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
    trailerGrad.addColorStop(0, lighten(color, 0.22));
    trailerGrad.addColorStop(1, color);
    ctx.fillStyle = trailerGrad;
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(-width / 2 + 5, -height / 2 + 8, 7, height - 16);
  } else {
    const bodyGrad = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
    bodyGrad.addColorStop(0, lighten(color, 0.24));
    bodyGrad.addColorStop(1, color);
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = "#0c1118";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, 8);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(-width / 2 + 6, -height / 2 + 8, 8, height - 16);

    if (type === "semi") {
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(-width / 2 + 8, -height / 2 + 10, width - 16, height * 0.28);
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -height / 2 + height * 0.28);
      ctx.lineTo(0, -height / 2 + height * 0.46);
      ctx.stroke();
    }
  }

  // Draw wheels based on swapped W/H
  const wheelH = Math.max(8, Math.round(height * 0.12));
  const wheelW = Math.max(5, Math.round(width * 0.2));
  ctx.fillStyle = "#0b0f16";
  ctx.fillRect(-width / 2 - 2, -height / 2 + 8, wheelW, wheelH);
  ctx.fillRect(-width / 2 - 2, height / 2 - wheelH - 8, wheelW, wheelH);
  ctx.fillRect(width / 2 - wheelW + 2, -height / 2 + 8, wheelW, wheelH);
  ctx.fillRect(width / 2 - wheelW + 2, height / 2 - wheelH - 8, wheelW, wheelH);

  if (type === "trailer") {
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -height / 2 - 14);
    ctx.lineTo(0, -height / 2 + 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#f9fbff";
  ctx.font = "700 12px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Rotate label to be upright in top-down view
  ctx.rotate(Math.PI / 2);
  ctx.fillText(label || "V?", 0, 0);

  ctx.restore();
}

function update(dt) {
  if (gameState !== "PLAYING") return;

  // Accelerate / Brake
  if (keys.ArrowUp || keys.w) {
    player.speed += player.acceleration * dt;
  } else if (keys.ArrowDown || keys.s) {
    player.speed -= player.braking * dt;
  } else {
    // Friction
    if (player.speed > 0) {
      player.speed -= player.friction * dt;
      if (player.speed < 0) player.speed = 0;
    } else if (player.speed < 0) {
      player.speed += player.friction * dt;
      if (player.speed > 0) player.speed = 0;
    }
  }

  // Limit speed
  if (player.speed > player.maxSpeed) player.speed = player.maxSpeed;
  if (player.speed < -player.maxSpeed / 2) player.speed = -player.maxSpeed / 2;

  // Steering
  if (player.speed !== 0) {
    const steerSpeed = (Math.abs(player.speed) / player.maxSpeed) * 200 + 100;
    if (keys.ArrowLeft || keys.a) {
      player.x -= steerSpeed * dt;
      player.rotation = -0.1;
    } else if (keys.ArrowRight || keys.d) {
      player.x += steerSpeed * dt;
      player.rotation = 0.1;
    } else {
      player.rotation = 0;
    }
  } else {
    player.rotation = 0;
  }

  // Boundaries
  const minX = 150 + player.width / 2;
  const maxX = 650 - player.width / 2;
  if (player.x < minX) {
    player.x = minX;
  }
  if (player.x > maxX) {
    player.x = maxX;
  }

  // Move camera forward based on speed
  cameraY += player.speed * dt;

  // Move target
  if (target) {
    target.y += (player.speed - target.speed) * dt;

    // AI simple steering: try to stay in middle lane
    if (target.x < 390) target.x += 20 * dt;
    if (target.x > 410) target.x -= 20 * dt;
  }

  // Move traffic
  for (let i = traffic.length - 1; i >= 0; i--) {
    let t = traffic[i];
    // Y position is relative to player speed difference
    t.y += (player.speed - t.speed) * dt;

    // Remove if far behind
    if (t.y > canvas.height + 200) {
      traffic.splice(i, 1);
    }
  }

  // Spawn more traffic
  if (Math.random() < 0.015 + (currentLevel * 0.005)) {
    if (traffic.length < 5 + currentLevel * 2) {
      spawnTraffic();
    }
  }

  // Collisions - Player vs Traffic
  for (let i = traffic.length - 1; i >= 0; i--) {
    let t = traffic[i];
    if (checkCollision(player, t)) {
      // Impact logic
      player.speed *= 0.6;
      player.health -= 15;

      // Bump traffic out of the way
      if (player.x > t.x) t.x -= 20;
      else t.x += 20;
      t.y += 30; // Push forward

      updateHealthUI();
    }
  }

  // Collisions - Player vs Target
  if (target && checkCollision(player, target)) {
    let damage = Math.abs(player.speed - target.speed) / 20;
    if (damage < 5) damage = 5;

    target.health -= damage;
    player.health -= damage * 0.5; // Player takes some damage too

    // Bounce effect
    player.speed *= 0.5;
    player.y += 20;

    updateHealthUI();
  }

  // Win / Loss Conditions
  if (player.health <= 0) {
    gameState = "GAMEOVER";
    gameOverModal.classList.remove("hidden");
  } else if (target && target.health <= 0) {
    gameState = "LEVEL_COMPLETE";
    if (currentLevel >= levels.length - 1) {
      gameState = "GAME_WON";
      gameWonModal.classList.remove("hidden");
    } else {
      levelCompleteModal.classList.remove("hidden");
    }
  }

  // Update UI
  speedDisplay.innerText = `Speed: ${Math.round(player.speed / 10)} mph`;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawRoad(cameraY);

  if (gameState === "PLAYING" || gameState === "GAMEOVER" || gameState === "LEVEL_COMPLETE") {
    traffic.forEach(t => drawVehicle(t));
    if (target) drawVehicle(target);
    drawVehicle(player);
  }
}

function gameLoop(timestamp) {
  let dt = (timestamp - lastTime) / 1000;
  if (dt > 0.1) dt = 0.1; // Cap delta time
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (e) => {
  if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
});

window.addEventListener("keyup", (e) => {
  if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

function startLevel() {
  const levelData = levels[currentLevel];

  // Reset Player
  player.x = canvas.width / 2;
  player.y = canvas.height * 0.8;
  player.speed = 0;
  player.health = 100;
  player.rotation = 0;

  // Create Target
  target = {
    x: canvas.width / 2,
    y: canvas.height * 0.2, // Start ahead of player
    width: levelData.targetWidth,
    height: levelData.targetHeight,
    type: levelData.targetType,
    color: levelData.targetColor,
    speed: levelData.targetSpeed,
    health: levelData.targetHealth,
    maxHealth: levelData.targetHealth,
    rotation: 0,
    label: "TARGET"
  };

  traffic = [];
  cameraY = 0;

  targetHealthRow.style.display = "flex";
  updateHealthUI();

  storyModal.classList.add("hidden");
  gameOverModal.classList.add("hidden");
  levelCompleteModal.classList.add("hidden");
  gameWonModal.classList.add("hidden");

  gameState = "PLAYING";
}

function showStory() {
  gameState = "START";
  const levelData = levels[currentLevel];
  storyTitle.innerText = levelData.title;
  storyText.innerText = levelData.story;
  storyModal.classList.remove("hidden");
}

startLevelBtn.addEventListener("click", () => {
  startLevel();
});

restartGameBtn.addEventListener("click", () => {
  currentLevel = 0;
  showStory();
});

nextLevelBtn.addEventListener("click", () => {
  currentLevel++;
  showStory();
});

playAgainBtn.addEventListener("click", () => {
  currentLevel = 0;
  showStory();
});

// Initialize first level story
showStory();

// Start loop
requestAnimationFrame((timestamp) => {
  lastTime = timestamp;
  gameLoop(timestamp);
});
