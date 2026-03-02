const canvas = document.getElementById("diagramCanvas");
const ctx = canvas.getContext("2d");
const toolButtons = [...document.querySelectorAll(".tool")];
const roadTypeSelect = document.getElementById("roadType");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");
const undoBtn = document.getElementById("undoBtn");

let activeTool = "select";
let items = [];
let selectedId = null;
let dragging = false;
let dragOffset = { x: 0, y: 0 };
const snapshots = [];

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

function setTool(tool) {
  activeTool = tool;
  toolButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tool === tool));
}

toolButtons.forEach((btn) => btn.addEventListener("click", () => setTool(btn.dataset.tool)));
undoBtn.addEventListener("click", undo);
clearBtn.addEventListener("click", () => {
  saveSnapshot();
  items = [];
  selectedId = null;
  draw();
});
exportBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `crash-diagram-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});
roadTypeSelect.addEventListener("change", draw);

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
    const label = prompt("Enter label text:", "Vehicle 1");
    if (!label) return;
    items.push({ id: uid(), type: "text", text: label, x: pos.x, y: pos.y, rotation: 0 });
  } else if (activeTool === "arrow") {
    items.push({ id: uid(), type: "arrow", x: pos.x, y: pos.y, width: 90, height: 14, rotation: 0 });
  } else if (activeTool === "skid") {
    items.push({ id: uid(), type: "skid", x: pos.x, y: pos.y, width: 80, height: 8, rotation: Math.PI / 8 });
  } else {
    items.push({ id: uid(), type: activeTool, x: pos.x, y: pos.y, width: 80, height: 42, rotation: 0 });
  }

  draw();
});

canvas.addEventListener("mousemove", (event) => {
  if (!dragging || !selectedId) return;
  const pos = pointer(event);
  const item = items.find((entry) => entry.id === selectedId);
  if (!item) return;
  item.x = pos.x - dragOffset.x;
  item.y = pos.y - dragOffset.y;
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
  const item = items.find((entry) => entry.id === selectedId);
  if (!item) return;
  item.rotation += event.deltaY > 0 ? 0.08 : -0.08;
  draw();
});

window.addEventListener("keydown", (event) => {
  if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
    saveSnapshot();
    items = items.filter((entry) => entry.id !== selectedId);
    selectedId = null;
    draw();
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

function drawRoad() {
  const type = roadTypeSelect.value;
  ctx.save();
  ctx.fillStyle = "#3b404d";
  ctx.strokeStyle = "#f4f4f4";
  ctx.lineWidth = 2;

  if (type === "straight") {
    ctx.fillRect(0, 240, canvas.width, 240);
    dashedLine(0, canvas.height / 2, canvas.width, canvas.height / 2);
  } else if (type === "t-junction") {
    ctx.fillRect(0, 240, canvas.width, 240);
    ctx.fillRect(canvas.width / 2 - 120, 0, 240, 360);
    dashedLine(0, canvas.height / 2, canvas.width, canvas.height / 2);
    dashedLine(canvas.width / 2, 0, canvas.width / 2, 360);
  } else {
    ctx.fillRect(0, 240, canvas.width, 240);
    ctx.fillRect(canvas.width / 2 - 120, 0, 240, canvas.height);
    dashedLine(0, canvas.height / 2, canvas.width, canvas.height / 2);
    dashedLine(canvas.width / 2, 0, canvas.width / 2, canvas.height);
  }

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
  ctx.fillStyle = color;
  ctx.strokeStyle = "#12151c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-item.width / 2, -item.height / 2, item.width, item.height, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e8eef8";
  ctx.font = "600 12px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function drawArrow(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rotation || 0);
  ctx.fillStyle = "#ffd166";
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
  ctx.restore();
}

function drawSkid(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rotation || 0);
  ctx.strokeStyle = "#0b0d12";
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

function drawText(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rotation || 0);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "600 16px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(item.text, 0, 0);
  ctx.restore();
}

function drawSelection(item) {
  const bounds = itemBounds(item);
  ctx.save();
  ctx.strokeStyle = "#4ea8ff";
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(bounds.left - 6, bounds.top - 6, bounds.right - bounds.left + 12, bounds.bottom - bounds.top + 12);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawRoad();

  items.forEach((item) => {
    if (item.type === "car") drawVehicle(item, "#2dd4bf", "CAR");
    if (item.type === "truck") drawVehicle(item, "#f97316", "TRUCK");
    if (item.type === "motorcycle") drawVehicle({ ...item, width: 56, height: 28 }, "#a78bfa", "BIKE");
    if (item.type === "arrow") drawArrow(item);
    if (item.type === "skid") drawSkid(item);
    if (item.type === "text") drawText(item);

    if (item.id === selectedId) drawSelection(item);
  });

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "12px Inter, sans-serif";
  ctx.fillText(`Weather: ${document.getElementById("weather").value}`, 12, canvas.height - 28);
  ctx.fillText(`Light: ${document.getElementById("light").value}`, 12, canvas.height - 12);
}

document.getElementById("weather").addEventListener("change", draw);
document.getElementById("light").addEventListener("change", draw);

draw();
