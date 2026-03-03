const canvas = document.getElementById("diagramCanvas");
const ctx = canvas.getContext("2d");
const toolButtons = [...document.querySelectorAll(".tool")];
const roadTypeSelect = document.getElementById("roadType");
const weatherSelect = document.getElementById("weather");
const lightSelect = document.getElementById("light");
const reportNumberInput = document.getElementById("reportNumber");
const reportDateInput = document.getElementById("reportDate");
const reportLocationInput = document.getElementById("reportLocation");
const officerNameInput = document.getElementById("officerName");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");
const undoBtn = document.getElementById("undoBtn");
const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const loadFileInput = document.getElementById("loadFileInput");
const rotateLeftBtn = document.getElementById("rotateLeftBtn");
const rotateRightBtn = document.getElementById("rotateRightBtn");
const bringFrontBtn = document.getElementById("bringFrontBtn");
const sendBackBtn = document.getElementById("sendBackBtn");
const duplicateBtn = document.getElementById("duplicateBtn");
const showGridInput = document.getElementById("showGrid");
const snapGridInput = document.getElementById("snapGrid");
const gridSizeInput = document.getElementById("gridSize");
const inspectorX = document.getElementById("inspectorX");
const inspectorY = document.getElementById("inspectorY");
const inspectorRotation = document.getElementById("inspectorRotation");
const inspectorLabel = document.getElementById("inspectorLabel");
const simDirectionA = document.getElementById("simDirectionA");
const simDirectionB = document.getElementById("simDirectionB");
const simUnitA = document.getElementById("simUnitA");
const simUnitB = document.getElementById("simUnitB");
const simSpeedA = document.getElementById("simSpeedA");
const simSpeedB = document.getElementById("simSpeedB");
const simPlayBtn = document.getElementById("simPlayBtn");
const simResetBtn = document.getElementById("simResetBtn");

reportDateInput.valueAsDate = new Date();

let activeTool = "select";
let items = [];
let selectedId = null;
let dragging = false;
let dragOffset = { x: 0, y: 0 };
const snapshots = [];
let vehicleCounter = 1;
let simState = null;
let simAnimationId = null;
let lastTickTime = 0;

function vehicleItems() {
  return items.filter((item) => ["car", "truck", "motorcycle"].includes(item.type));
}

function speedFromSlider(value) {
  return Number(value) / 16;
}

function widthByType(type) {
  if (type === "motorcycle") return 62;
  return 86;
}

function heightByType(type) {
  if (type === "motorcycle") return 30;
  return 42;
}

function unitMass(type) {
  if (type === "truck") return 1.8;
  if (type === "motorcycle") return 0.8;
  return 1.2;
}

function collisionRadius(unit) {
  return Math.hypot(unit.width, unit.height) * 0.35;
}

function updateSimUnitSelectors() {
  const vehicles = vehicleItems();
  const previousA = simUnitA.value;
  const previousB = simUnitB.value;

  [simUnitA, simUnitB].forEach((select) => {
    select.innerHTML = "";
    vehicles.forEach((vehicle) => {
      const option = document.createElement("option");
      option.value = vehicle.id;
      option.textContent = `${vehicle.label || "Vehicle"} (${vehicle.type})`;
      select.append(option);
    });
  });

  if (!vehicles.length) {
    const optionA = document.createElement("option");
    optionA.textContent = "Place vehicles first";
    optionA.value = "";
    const optionB = optionA.cloneNode(true);
    simUnitA.append(optionA);
    simUnitB.append(optionB);
    simUnitA.disabled = true;
    simUnitB.disabled = true;
    simPlayBtn.disabled = true;
    return;
  }

  simUnitA.disabled = false;
  simUnitB.disabled = vehicles.length < 2;
  simPlayBtn.disabled = vehicles.length < 2;
  simUnitA.value = vehicles.some((vehicle) => vehicle.id === previousA) ? previousA : vehicles[0].id;
  const fallbackB = vehicles[1]?.id || vehicles[0].id;
  simUnitB.value = vehicles.some((vehicle) => vehicle.id === previousB && vehicle.id !== simUnitA.value)
    ? previousB
    : fallbackB;
}

function directionVector(direction) {
  if (direction === "east") return { x: 1, y: 0 };
  if (direction === "west") return { x: -1, y: 0 };
  if (direction === "south") return { x: 0, y: 1 };
  return { x: 0, y: -1 };
}

function directionRotation(direction) {
  if (direction === "east") return 0;
  if (direction === "west") return Math.PI;
  if (direction === "south") return Math.PI / 2;
  return -Math.PI / 2;
}

function startSimulation() {
  if (simAnimationId) cancelAnimationFrame(simAnimationId);
  const a = items.find((item) => item.id === simUnitA.value);
  const b = items.find((item) => item.id === simUnitB.value);
  if (!a || !b || a.id === b.id) {
    alert("Place at least 2 vehicles and choose different units for the sim.");
    return;
  }

  const dirA = directionVector(simDirectionA.value);
  const dirB = directionVector(simDirectionB.value);
  const speedA = speedFromSlider(simSpeedA.value);
  const speedB = speedFromSlider(simSpeedB.value);

  simState = {
    running: true,
    crashed: false,
    sliding: false,
    impactAt: 0,
    impactPoint: null,
    unitA: {
      x: a.x,
      y: a.y,
      width: widthByType(a.type),
      height: heightByType(a.type),
      rotation: directionRotation(simDirectionA.value),
      vx: dirA.x * speedA,
      vy: dirA.y * speedA,
      angularVelocity: 0,
      mass: unitMass(a.type),
      type: a.type,
      color: "#0f766e",
      label: a.label || "SIM-1",
      trail: []
    },
    unitB: {
      x: b.x,
      y: b.y,
      width: widthByType(b.type),
      height: heightByType(b.type),
      rotation: directionRotation(simDirectionB.value),
      vx: dirB.x * speedB,
      vy: dirB.y * speedB,
      angularVelocity: 0,
      mass: unitMass(b.type),
      type: b.type,
      color: "#b45309",
      label: b.label || "SIM-2",
      trail: []
    }
  };

  lastTickTime = performance.now();
  tickSimulation();
}

function resetSimulation() {
  simRunToken += 1;
  if (simAnimationId) cancelAnimationFrame(simAnimationId);
  simAnimationId = null;
  simState = null;
  draw();
}

function applyImpactPhysics(unitA, unitB) {
  const nx = unitB.x - unitA.x;
  const ny = unitB.y - unitA.y;
  const distance = Math.hypot(nx, ny) || 1;
  const normalX = nx / distance;
  const normalY = ny / distance;

  const relativeVelocityX = unitA.vx - unitB.vx;
  const relativeVelocityY = unitA.vy - unitB.vy;
  const closingSpeed = relativeVelocityX * normalX + relativeVelocityY * normalY;
  const restitution = 0.25;
  const impulse = (-(1 + restitution) * closingSpeed) / ((1 / unitA.mass) + (1 / unitB.mass));

  unitA.vx += (impulse / unitA.mass) * normalX;
  unitA.vy += (impulse / unitA.mass) * normalY;
  unitB.vx -= (impulse / unitB.mass) * normalX;
  unitB.vy -= (impulse / unitB.mass) * normalY;

  const tangentX = -normalY;
  const tangentY = normalX;
  const sideSlip = 0.55;
  const aSpeed = Math.hypot(unitA.vx, unitA.vy);
  const bSpeed = Math.hypot(unitB.vx, unitB.vy);
  unitA.vx += tangentX * (aSpeed * sideSlip);
  unitA.vy += tangentY * (aSpeed * sideSlip);
  unitB.vx -= tangentX * (bSpeed * sideSlip);
  unitB.vy -= tangentY * (bSpeed * sideSlip);

  unitA.angularVelocity = (Math.random() > 0.5 ? 1 : -1) * 0.08;
  unitB.angularVelocity = (Math.random() > 0.5 ? 1 : -1) * 0.1;
}

function clampSimulationUnit(unit) {
  const marginX = unit.width / 2 + 12;
  const marginY = unit.height / 2 + 88;
  if (unit.x < marginX || unit.x > canvas.width - marginX) unit.vx *= -0.45;
  if (unit.y < marginY || unit.y > canvas.height - marginY) unit.vy *= -0.45;
  unit.x = Math.max(marginX, Math.min(canvas.width - marginX, unit.x));
  unit.y = Math.max(marginY, Math.min(canvas.height - marginY, unit.y));
}

function tickSimulation() {
  if (!simState || !simState.running) return;

  const now = performance.now();
  const dt = Math.min(1.6, (now - lastTickTime) / 16.667 || 1);
  lastTickTime = now;
  const units = [simState.unitA, simState.unitB];

  units.forEach((unit) => {
    unit.x += unit.vx * dt;
    unit.y += unit.vy * dt;
    const speed = Math.hypot(unit.vx, unit.vy);
    if (speed > 0.01 && !simState.sliding) {
      unit.rotation = Math.atan2(unit.vy, unit.vx);
    } else if (simState.sliding) {
      unit.rotation += unit.angularVelocity * dt;
      unit.angularVelocity *= 0.97;
      unit.trail.push({ x: unit.x, y: unit.y });
      if (unit.trail.length > 45) unit.trail.shift();
    }
  });

  if (!simState.crashed) {
    const dx = simState.unitA.x - simState.unitB.x;
    const dy = simState.unitA.y - simState.unitB.y;
    const minDistance = collisionRadius(simState.unitA) + collisionRadius(simState.unitB);
    if (Math.hypot(dx, dy) < minDistance) {
      simState.crashed = true;
      simState.sliding = true;
      simState.impactAt = performance.now();
      simState.impactPoint = {
        x: (simState.unitA.x + simState.unitB.x) / 2,
        y: (simState.unitA.y + simState.unitB.y) / 2
      };
      applyImpactPhysics(simState.unitA, simState.unitB);
    }
  } else {
    units.forEach((unit) => {
      unit.vx *= 0.967;
      unit.vy *= 0.967;
    });

    const maxSpeed = Math.max(...units.map((unit) => Math.hypot(unit.vx, unit.vy)));
    if (maxSpeed < 0.18) {
      simState.running = false;
    }
  }

  clampSimulationUnit(simState.unitA);
  clampSimulationUnit(simState.unitB);

  draw();
  if (simState.running) simAnimationId = requestAnimationFrame(tickSimulation);
  else simAnimationId = null;
}

function saveSnapshot() {
  snapshots.push(JSON.stringify(items));
  if (snapshots.length > 50) snapshots.shift();
}

function undo() {
  const previous = snapshots.pop();
  if (!previous) return;
  items = JSON.parse(previous);
  selectedId = null;
  draw();
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function snap(value) {
  if (!snapGridInput.checked) return value;
  const size = Number(gridSizeInput.value) || 24;
  return Math.round(value / size) * size;
}

function setTool(tool) {
  activeTool = tool;
  toolButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tool === tool));
}

function selectedItem() {
  return items.find((entry) => entry.id === selectedId);
}

function refreshInspector() {
  const item = selectedItem();
  const hasSelection = Boolean(item);
  [inspectorX, inspectorY, inspectorRotation, inspectorLabel].forEach((input) => {
    input.disabled = !hasSelection;
  });
  if (!item) {
    inspectorX.value = "";
    inspectorY.value = "";
    inspectorRotation.value = "";
    inspectorLabel.value = "";
    return;
  }
  inspectorX.value = Math.round(item.x);
  inspectorY.value = Math.round(item.y);
  inspectorRotation.value = Math.round(((item.rotation || 0) * 180) / Math.PI);
  inspectorLabel.value = item.type === "text" ? item.text || "" : item.label || "";
}

function rotateSelected(direction, snapStep = false) {
  const item = selectedItem();
  if (!item) return;
  saveSnapshot();
  const step = snapStep ? Math.PI / 12 : 0.12;
  item.rotation += direction * step;
  draw();
}

function moveLayer(toFront) {
  const item = selectedItem();
  if (!item) return;
  saveSnapshot();
  items = items.filter((entry) => entry.id !== item.id);
  if (toFront) items.push(item);
  else items.unshift(item);
  draw();
}

function duplicateSelected() {
  const item = selectedItem();
  if (!item) return;
  saveSnapshot();
  const clone = {
    ...item,
    id: uid(),
    x: snap(item.x + 32),
    y: snap(item.y + 24)
  };
  if (clone.type !== "text") {
    clone.label = `V${vehicleCounter++}`;
  }
  items.push(clone);
  selectedId = clone.id;
  draw();
}

function downloadJson() {
  const payload = {
    metadata: {
      reportNumber: reportNumberInput.value,
      reportDate: reportDateInput.value,
      reportLocation: reportLocationInput.value,
      officerName: officerNameInput.value,
      roadType: roadTypeSelect.value,
      weather: weatherSelect.value,
      light: lightSelect.value,
      showGrid: showGridInput.checked,
      snapGrid: snapGridInput.checked,
      gridSize: Number(gridSizeInput.value) || 24,
      vehicleCounter
    },
    items
  };
  const link = document.createElement("a");
  link.download = `police-crash-report-${Date.now()}.json`;
  link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function loadFromJson(text) {
  const parsed = JSON.parse(text);
  saveSnapshot();
  items = Array.isArray(parsed.items) ? parsed.items : [];
  const metadata = parsed.metadata || {};
  reportNumberInput.value = metadata.reportNumber || reportNumberInput.value;
  reportDateInput.value = metadata.reportDate || reportDateInput.value;
  reportLocationInput.value = metadata.reportLocation || reportLocationInput.value;
  officerNameInput.value = metadata.officerName || officerNameInput.value;
  roadTypeSelect.value = metadata.roadType || roadTypeSelect.value;
  weatherSelect.value = metadata.weather || weatherSelect.value;
  lightSelect.value = metadata.light || lightSelect.value;
  showGridInput.checked = metadata.showGrid !== false;
  snapGridInput.checked = Boolean(metadata.snapGrid);
  gridSizeInput.value = metadata.gridSize || gridSizeInput.value;
  vehicleCounter = Number(metadata.vehicleCounter) || 1;
  selectedId = null;
  draw();
}

toolButtons.forEach((btn) => btn.addEventListener("click", () => setTool(btn.dataset.tool)));
undoBtn.addEventListener("click", undo);
saveBtn.addEventListener("click", downloadJson);
loadBtn.addEventListener("click", () => loadFileInput.click());
loadFileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    loadFromJson(await file.text());
  } catch {
    alert("Unable to read that JSON file.");
  }
  loadFileInput.value = "";
});
rotateLeftBtn.addEventListener("click", () => rotateSelected(-1));
rotateRightBtn.addEventListener("click", () => rotateSelected(1));
bringFrontBtn.addEventListener("click", () => moveLayer(true));
sendBackBtn.addEventListener("click", () => moveLayer(false));
duplicateBtn.addEventListener("click", duplicateSelected);
simPlayBtn.addEventListener("click", startSimulation);
simResetBtn.addEventListener("click", resetSimulation);

clearBtn.addEventListener("click", () => {
  saveSnapshot();
  items = [];
  selectedId = null;
  vehicleCounter = 1;
  draw();
});

exportBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `police-crash-report-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

[
  roadTypeSelect,
  weatherSelect,
  lightSelect,
  reportNumberInput,
  reportDateInput,
  reportLocationInput,
  officerNameInput,
  showGridInput,
  snapGridInput,
  gridSizeInput
].forEach((input) => {
  input.addEventListener("change", draw);
  input.addEventListener("input", draw);
});

[inspectorX, inspectorY, inspectorRotation, inspectorLabel].forEach((input) => {
  input.addEventListener("change", () => {
    const item = selectedItem();
    if (!item) return;
    saveSnapshot();
    item.x = Number(inspectorX.value) || item.x;
    item.y = Number(inspectorY.value) || item.y;
    item.rotation = ((Number(inspectorRotation.value) || 0) * Math.PI) / 180;
    if (item.type === "text") item.text = inspectorLabel.value || item.text;
    else item.label = inspectorLabel.value || item.label;
    draw();
  });
});

canvas.addEventListener("mousedown", (event) => {
  const pos = pointer(event);

  if (activeTool === "select") {
    const hit = hitTest(pos);
    selectedId = hit?.id || null;
    if (hit) {
      dragging = true;
      dragOffset = { x: pos.x - hit.x, y: pos.y - hit.y };
    }
    draw();
    return;
  }

  saveSnapshot();

  if (activeTool === "text") {
    const label = prompt("Enter label text:", "Point of Impact");
    if (!label) return;
    items.push({ id: uid(), type: "text", text: label, x: snap(pos.x), y: snap(pos.y), rotation: 0 });
  } else if (activeTool === "arrow") {
    items.push({ id: uid(), type: "arrow", x: snap(pos.x), y: snap(pos.y), width: 90, height: 14, rotation: 0 });
  } else if (activeTool === "skid") {
    items.push({ id: uid(), type: "skid", x: snap(pos.x), y: snap(pos.y), width: 84, height: 8, rotation: Math.PI / 8 });
  } else if (activeTool === "cone") {
    items.push({ id: uid(), type: "cone", x: snap(pos.x), y: snap(pos.y), width: 22, height: 22, rotation: 0 });
  } else {
    items.push({
      id: uid(),
      type: activeTool,
      x: snap(pos.x),
      y: snap(pos.y),
      width: 86,
      height: 42,
      rotation: 0,
      label: `V${vehicleCounter++}`
    });
  }

  draw();
});

canvas.addEventListener("mousemove", (event) => {
  if (!dragging || !selectedId) return;
  const pos = pointer(event);
  const item = selectedItem();
  if (!item) return;
  item.x = snap(pos.x - dragOffset.x);
  item.y = snap(pos.y - dragOffset.y);
  draw();
});

canvas.addEventListener("mouseup", () => {
  if (dragging) saveSnapshot();
  dragging = false;
});

canvas.addEventListener("mouseleave", () => {
  dragging = false;
});

canvas.addEventListener("wheel", (event) => {
  if (!selectedId) return;
  event.preventDefault();
  const item = selectedItem();
  if (!item) return;
  const step = event.altKey ? Math.PI / 12 : 0.08;
  item.rotation += event.deltaY > 0 ? step : -step;
  draw();
});

window.addEventListener("keydown", (event) => {
  if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
    saveSnapshot();
    items = items.filter((entry) => entry.id !== selectedId);
    selectedId = null;
    draw();
  }

  if (!selectedId) return;
  const item = selectedItem();
  if (!item) return;

  const step = event.shiftKey ? 10 : 2;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    saveSnapshot();
    if (event.key === "ArrowUp") item.y = snap(item.y - step);
    if (event.key === "ArrowDown") item.y = snap(item.y + step);
    if (event.key === "ArrowLeft") item.x = snap(item.x - step);
    if (event.key === "ArrowRight") item.x = snap(item.x + step);
    draw();
    event.preventDefault();
  }

  if (event.key.toLowerCase() === "d") {
    duplicateSelected();
    event.preventDefault();
  }

  if (event.key === "[" || event.key === "]") {
    rotateSelected(event.key === "]" ? 1 : -1, true);
    event.preventDefault();
  }
});

function pointer(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * canvas.width) / rect.width,
    y: ((event.clientY - rect.top) * canvas.height) / rect.height
  };
}

function hitTest(pos) {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const bounds = itemBounds(item);
    if (pos.x >= bounds.left && pos.x <= bounds.right && pos.y >= bounds.top && pos.y <= bounds.bottom) {
      return item;
    }
  }
  return null;
}

function itemBounds(item) {
  const width = item.width || 100;
  const height = item.height || 24;
  return {
    left: item.x - width / 2,
    right: item.x + width / 2,
    top: item.y - height / 2,
    bottom: item.y + height / 2
  };
}

function drawReportFrame() {
  ctx.save();
  ctx.fillStyle = "#111a2e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#314766";
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  ctx.fillStyle = "#0a1322";
  ctx.fillRect(10, 10, canvas.width - 20, 74);
  ctx.fillStyle = "#e5ebf7";
  ctx.font = "700 18px Segoe UI, sans-serif";
  ctx.fillText("TRAFFIC CRASH REPORT - DIAGRAM", 28, 39);
  ctx.font = "13px Segoe UI, sans-serif";
  ctx.fillText(`Report #: ${reportNumberInput.value || "N/A"}`, 28, 62);
  ctx.fillText(`Date: ${reportDateInput.value || "N/A"}`, 270, 62);
  ctx.fillText(`Officer: ${officerNameInput.value || "N/A"}`, 420, 62);
  ctx.fillText(`Location: ${reportLocationInput.value || "N/A"}`, 760, 62);
  ctx.restore();
}

function drawRoad() {
  const type = roadTypeSelect.value;
  ctx.save();

  const lotGrad = ctx.createLinearGradient(0, 84, 0, canvas.height - 20);
  lotGrad.addColorStop(0, "#1b2638");
  lotGrad.addColorStop(1, "#162131");
  ctx.fillStyle = lotGrad;
  ctx.fillRect(10, 84, canvas.width - 20, canvas.height - 104);

  const roadGrad = ctx.createLinearGradient(0, 84, 0, canvas.height - 84);
  roadGrad.addColorStop(0, "#52657f");
  roadGrad.addColorStop(0.5, "#3a4a60");
  roadGrad.addColorStop(1, "#2a394d");

  const shoulderGrad = ctx.createLinearGradient(0, 84, 0, canvas.height - 84);
  shoulderGrad.addColorStop(0, "#2e3f55");
  shoulderGrad.addColorStop(1, "#223246");

  const drawCrossRoad = type !== "straight";
  const crossHeight = type === "t-junction" ? 290 : canvas.height - 168;

  ctx.fillStyle = shoulderGrad;
  ctx.fillRect(36, 214, canvas.width - 72, 16);
  ctx.fillRect(36, 490, canvas.width - 72, 16);
  if (drawCrossRoad) {
    ctx.fillRect(canvas.width / 2 - 146, 84, 16, crossHeight);
    ctx.fillRect(canvas.width / 2 + 130, 84, 16, crossHeight);
  }

  ctx.fillStyle = roadGrad;
  ctx.fillRect(36, 230, canvas.width - 72, 260);
  if (drawCrossRoad) ctx.fillRect(canvas.width / 2 - 130, 84, 260, crossHeight);

  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.strokeRect(36, 230, canvas.width - 72, 260);
  if (drawCrossRoad) ctx.strokeRect(canvas.width / 2 - 130, 84, 260, crossHeight);

  dashedLine(36, canvas.height / 2, canvas.width - 36, canvas.height / 2);
  if (drawCrossRoad) dashedLine(canvas.width / 2, 84, canvas.width / 2, type === "t-junction" ? 374 : canvas.height - 84);

  drawRoadTexture(36, 230, canvas.width - 72, 260, type === "straight" ? "horizontal" : "both");
  if (drawCrossRoad) drawRoadTexture(canvas.width / 2 - 130, 84, 260, crossHeight, "vertical");

  drawStopBars(type);
  drawCrosswalks(type);

  ctx.restore();
}

function drawGrid() {
  if (!showGridInput.checked) return;
  const size = Number(gridSizeInput.value) || 24;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let x = 10; x <= canvas.width - 10; x += size) {
    ctx.beginPath();
    ctx.moveTo(x, 84);
    ctx.lineTo(x, canvas.height - 22);
    ctx.stroke();
  }
  for (let y = 84; y <= canvas.height - 22; y += size) {
    ctx.beginPath();
    ctx.moveTo(10, y);
    ctx.lineTo(canvas.width - 10, y);
    ctx.stroke();
  }
  ctx.restore();
}


function drawRoadTexture(x, y, width, height, orientation) {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;

  if (orientation === "horizontal" || orientation === "both") {
    for (let yy = y + 10; yy < y + height; yy += 16) {
      ctx.beginPath();
      ctx.moveTo(x + 8, yy);
      ctx.lineTo(x + width - 8, yy);
      ctx.stroke();
    }
  }

  if (orientation === "vertical" || orientation === "both") {
    for (let xx = x + 10; xx < x + width; xx += 16) {
      ctx.beginPath();
      ctx.moveTo(xx, y + 8);
      ctx.lineTo(xx, y + height - 8);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawCrosswalks(type) {
  ctx.save();
  ctx.fillStyle = "rgba(236, 242, 251, 0.42)";
  const stripeW = 10;
  const gap = 8;
  for (let x = 388; x < 712; x += stripeW + gap) {
    ctx.fillRect(x, 205, stripeW, 20);
    ctx.fillRect(x, 495, stripeW, 20);
  }

  if (type !== "straight") {
    for (let y = 292; y < 428; y += stripeW + gap) {
      ctx.fillRect(canvas.width / 2 - 155, y, 20, stripeW);
      ctx.fillRect(canvas.width / 2 + 135, y, 20, stripeW);
    }
  }
  ctx.restore();
}

function drawStopBars(type) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.62)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(350, 227);
  ctx.lineTo(750, 227);
  ctx.moveTo(350, 493);
  ctx.lineTo(750, 493);
  if (type !== "straight") {
    ctx.moveTo(canvas.width / 2 - 133, 270);
    ctx.lineTo(canvas.width / 2 - 133, 450);
    if (type !== "t-junction") {
      ctx.moveTo(canvas.width / 2 + 133, 270);
      ctx.lineTo(canvas.width / 2 + 133, 450);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function dashedLine(x1, y1, x2, y2) {
  ctx.save();
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawVehicle(item, color, label) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rotation || 0);
  const bodyGrad = ctx.createLinearGradient(-item.width / 2, -item.height / 2, item.width / 2, item.height / 2);
  bodyGrad.addColorStop(0, lighten(color, 0.24));
  bodyGrad.addColorStop(1, color);
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = "#0c1118";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.roundRect(-item.width / 2, -item.height / 2, item.width, item.height, 8);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(-item.width / 2 + 8, -item.height / 2 + 6, item.width - 16, 8);

  const wheelW = Math.max(8, Math.round(item.width * 0.12));
  const wheelH = Math.max(5, Math.round(item.height * 0.2));
  ctx.fillStyle = "#0b0f16";
  ctx.fillRect(-item.width / 2 + 8, -item.height / 2 - 2, wheelW, wheelH);
  ctx.fillRect(item.width / 2 - wheelW - 8, -item.height / 2 - 2, wheelW, wheelH);
  ctx.fillRect(-item.width / 2 + 8, item.height / 2 - wheelH + 2, wheelW, wheelH);
  ctx.fillRect(item.width / 2 - wheelW - 8, item.height / 2 - wheelH + 2, wheelW, wheelH);

  ctx.fillStyle = "#f9fbff";
  ctx.font = "700 12px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${item.label || "V?"} ${label}`, 0, 0);
  ctx.restore();
}

function drawArrow(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rotation || 0);
  const arrowGrad = ctx.createLinearGradient(-item.width / 2, 0, item.width / 2, 0);
  arrowGrad.addColorStop(0, "#fde047");
  arrowGrad.addColorStop(1, "#eab308");
  ctx.fillStyle = arrowGrad;
  ctx.shadowColor = "rgba(0,0,0,0.32)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(-item.width / 2, -item.height / 2);
  ctx.lineTo(item.width / 2 - 16, -item.height / 2);
  ctx.lineTo(item.width / 2 - 16, -item.height);
  ctx.lineTo(item.width / 2, 0);
  ctx.lineTo(item.width / 2 - 16, item.height);
  ctx.lineTo(item.width / 2 - 16, item.height / 2);
  ctx.lineTo(-item.width / 2, item.height / 2);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#7c5f00";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawSkid(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rotation || 0);
  const skidGrad = ctx.createLinearGradient(-item.width / 2, 0, item.width / 2, 0);
  skidGrad.addColorStop(0, "rgba(10, 12, 18, 0.2)");
  skidGrad.addColorStop(0.5, "rgba(10, 12, 18, 0.78)");
  skidGrad.addColorStop(1, "rgba(10, 12, 18, 0.25)");
  ctx.strokeStyle = skidGrad;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(-item.width / 2, -item.height);
  ctx.lineTo(item.width / 2, -item.height);
  ctx.moveTo(-item.width / 2, item.height);
  ctx.lineTo(item.width / 2, item.height);
  ctx.stroke();
  ctx.restore();
}

function drawCone(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rotation || 0);
  const coneGrad = ctx.createLinearGradient(0, -item.height / 2, 0, item.height / 2);
  coneGrad.addColorStop(0, "#fb923c");
  coneGrad.addColorStop(1, "#ea580c");
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(0, -item.height / 2);
  ctx.lineTo(item.width / 2, item.height / 2);
  ctx.lineTo(-item.width / 2, item.height / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#7c2d12";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#fff7ed";
  const stripeY = item.height * 0.08;
  ctx.fillRect(-item.width * 0.28, stripeY, item.width * 0.56, 3);

  ctx.strokeStyle = "#7c2d12";
  ctx.restore();
}

function drawText(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rotation || 0);
  ctx.font = "600 16px Segoe UI, sans-serif";
  const textWidth = ctx.measureText(item.text).width;
  ctx.fillStyle = "rgba(11, 18, 32, 0.62)";
  ctx.fillRect(-textWidth / 2 - 8, -14, textWidth + 16, 22);
  ctx.fillStyle = "#e5ebf7";
  ctx.textAlign = "center";
  ctx.fillText(item.text, 0, 0);
  ctx.restore();
}

function lighten(hex, amount) {
  const color = hex.replace("#", "");
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  const lift = (channel) => Math.min(255, Math.round(channel + (255 - channel) * amount));
  return `rgb(${lift(r)}, ${lift(g)}, ${lift(b)})`;
}

function drawSelection(item) {
  const bounds = itemBounds(item);
  const left = bounds.left - 6;
  const top = bounds.top - 6;
  const width = bounds.right - bounds.left + 12;
  const height = bounds.bottom - bounds.top + 12;

  ctx.save();
  ctx.strokeStyle = "#93c5fd";
  ctx.lineWidth = 1.8;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(left, top, width, height);
  ctx.setLineDash([]);

  const handle = 6;
  ctx.fillStyle = "#e0f2fe";
  ctx.strokeStyle = "#2563eb";
  const points = [
    [left, top],
    [left + width / 2, top],
    [left + width, top],
    [left, top + height / 2],
    [left + width, top + height / 2],
    [left, top + height],
    [left + width / 2, top + height],
    [left + width, top + height]
  ];
  points.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.rect(x - handle / 2, y - handle / 2, handle, handle);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

function drawFooterLegend() {
  ctx.save();
  ctx.fillStyle = "#0f1829";
  ctx.fillRect(24, canvas.height - 82, 560, 48);
  ctx.strokeStyle = "#3a567d";
  ctx.strokeRect(24, canvas.height - 82, 560, 48);
  ctx.fillStyle = "#d6e3f5";
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.fillText(`Weather: ${weatherSelect.value}   Light: ${lightSelect.value}`, 34, canvas.height - 54);
  const simStatus = simState ? (simState.running ? "Running" : "Stopped") : "Idle";
  ctx.fillText(`Grid: ${showGridInput.checked ? `On (${gridSizeInput.value}px)` : "Off"}   Snap: ${snapGridInput.checked ? "On" : "Off"}   Sim: ${simStatus}`, 34, canvas.height - 38);
  ctx.restore();
}

function drawSimulation() {
  if (!simState) return;
  drawVehicle(simState.unitA, simState.unitA.color, simState.unitA.label);
  drawVehicle(simState.unitB, simState.unitB.color, simState.unitB.label);

  if (simState.sliding) {
    [simState.unitA, simState.unitB].forEach((unit) => {
      if (unit.trail.length < 2) return;
      ctx.save();
      ctx.strokeStyle = "rgba(17, 24, 39, 0.45)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      unit.trail.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.restore();
    });
  }

  if (!simState.crashed) return;
  const cx = simState.impactPoint ? simState.impactPoint.x : (simState.unitA.x + simState.unitB.x) / 2;
  const cy = simState.impactPoint ? simState.impactPoint.y : (simState.unitA.y + simState.unitB.y) / 2;
  const pulse = 14 + Math.sin((performance.now() - simState.impactAt) / 180) * 5;

  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#fecaca";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, pulse + 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#fee2e2";
  ctx.font = "700 16px Segoe UI, sans-serif";
  ctx.fillText("Impact", cx + 20, cy - 12);
  ctx.restore();
}

function draw() {
  updateSimUnitSelectors();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawReportFrame();
  drawRoad();
  drawGrid();

  items.forEach((item) => {
    if (item.type === "car") drawVehicle(item, "#0f766e", "CAR");
    if (item.type === "truck") drawVehicle(item, "#b45309", "TRK");
    if (item.type === "motorcycle") drawVehicle({ ...item, width: 62, height: 30 }, "#6d28d9", "MC");
    if (item.type === "arrow") drawArrow(item);
    if (item.type === "skid") drawSkid(item);
    if (item.type === "cone") drawCone(item);
    if (item.type === "text") drawText(item);

    if (item.id === selectedId) drawSelection(item);
  });

  drawSimulation();

  drawFooterLegend();
  refreshInspector();
}

draw();
