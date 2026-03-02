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
const rotateLeftBtn = document.getElementById("rotateLeftBtn");
const rotateRightBtn = document.getElementById("rotateRightBtn");
const bringFrontBtn = document.getElementById("bringFrontBtn");
const sendBackBtn = document.getElementById("sendBackBtn");

reportDateInput.valueAsDate = new Date();

let activeTool = "select";
let items = [];
let selectedId = null;
let dragging = false;
let dragOffset = { x: 0, y: 0 };
const snapshots = [];
let vehicleCounter = 1;

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

function selectedItem() {
  return items.find((entry) => entry.id === selectedId);
}

function rotateSelected(direction) {
  const item = selectedItem();
  if (!item) return;
  saveSnapshot();
  item.rotation += direction * 0.12;
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

toolButtons.forEach((btn) => btn.addEventListener("click", () => setTool(btn.dataset.tool)));
undoBtn.addEventListener("click", undo);
rotateLeftBtn.addEventListener("click", () => rotateSelected(-1));
rotateRightBtn.addEventListener("click", () => rotateSelected(1));
bringFrontBtn.addEventListener("click", () => moveLayer(true));
sendBackBtn.addEventListener("click", () => moveLayer(false));

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

[roadTypeSelect, weatherSelect, lightSelect, reportNumberInput, reportDateInput, reportLocationInput, officerNameInput].forEach((input) => {
  input.addEventListener("change", draw);
  input.addEventListener("input", draw);
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
    items.push({ id: uid(), type: "text", text: label, x: pos.x, y: pos.y, rotation: 0 });
  } else if (activeTool === "arrow") {
    items.push({ id: uid(), type: "arrow", x: pos.x, y: pos.y, width: 90, height: 14, rotation: 0 });
  } else if (activeTool === "skid") {
    items.push({ id: uid(), type: "skid", x: pos.x, y: pos.y, width: 84, height: 8, rotation: Math.PI / 8 });
  } else if (activeTool === "cone") {
    items.push({ id: uid(), type: "cone", x: pos.x, y: pos.y, width: 22, height: 22, rotation: 0 });
  } else {
    items.push({
      id: uid(),
      type: activeTool,
      x: pos.x,
      y: pos.y,
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
  const item = selectedItem();
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
  ctx.fillStyle = "#3b4a5f";
  ctx.strokeStyle = "#e8eef7";
  ctx.lineWidth = 2;

  if (type === "straight") {
    ctx.fillRect(36, 230, canvas.width - 72, 260);
    dashedLine(36, canvas.height / 2, canvas.width - 36, canvas.height / 2);
  } else if (type === "t-junction") {
    ctx.fillRect(36, 230, canvas.width - 72, 260);
    ctx.fillRect(canvas.width / 2 - 130, 84, 260, 290);
    dashedLine(36, canvas.height / 2, canvas.width - 36, canvas.height / 2);
    dashedLine(canvas.width / 2, 84, canvas.width / 2, 374);
  } else {
    ctx.fillRect(36, 230, canvas.width - 72, 260);
    ctx.fillRect(canvas.width / 2 - 130, 84, 260, canvas.height - 168);
    dashedLine(36, canvas.height / 2, canvas.width - 36, canvas.height / 2);
    dashedLine(canvas.width / 2, 84, canvas.width / 2, canvas.height - 84);
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
  ctx.fillStyle = "#facc15";
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
  ctx.strokeStyle = "#0f172a";
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
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.moveTo(0, -item.height / 2);
  ctx.lineTo(item.width / 2, item.height / 2);
  ctx.lineTo(-item.width / 2, item.height / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#7c2d12";
  ctx.stroke();
  ctx.restore();
}

function drawText(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rotation || 0);
  ctx.fillStyle = "#e5ebf7";
  ctx.font = "600 16px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(item.text, 0, 0);
  ctx.restore();
}

function drawSelection(item) {
  const bounds = itemBounds(item);
  ctx.save();
  ctx.strokeStyle = "#155aa8";
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(bounds.left - 6, bounds.top - 6, bounds.right - bounds.left + 12, bounds.bottom - bounds.top + 12);
  ctx.restore();
}

function drawFooterLegend() {
  ctx.save();
  ctx.fillStyle = "#0f1829";
  ctx.fillRect(24, canvas.height - 82, 420, 48);
  ctx.strokeStyle = "#3a567d";
  ctx.strokeRect(24, canvas.height - 82, 420, 48);
  ctx.fillStyle = "#d6e3f5";
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.fillText(`Weather: ${weatherSelect.value}   Light: ${lightSelect.value}`, 34, canvas.height - 54);
  ctx.fillText("Legend: V# = Vehicle Unit, Arrow = Direction of Travel, Cone = Evidence Marker", 34, canvas.height - 38);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawReportFrame();
  drawRoad();

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

  drawFooterLegend();
}

draw();
