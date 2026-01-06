const generateBtn = document.getElementById('generateMatricesBtn');
const resetBtn = document.getElementById('resetDeadlockBtn');
const matricesDiv = document.getElementById('matricesInput');
const outputDiv = document.getElementById('deadlockOutput');
// Reset button works anytime, even before generating matrices
resetBtn.addEventListener('click', () => {
    // Reset process/resource count inputs
    document.getElementById('processCount').value = 0;
    document.getElementById('resourceCount').value = 0;

    // Clear dynamically created matrices
    matricesDiv.innerHTML = '';

    // Clear output
    outputDiv.innerHTML = '';

    // ✅ Clear RAG canvas if it exists
    const canvas = document.getElementById('ragCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
});


generateBtn.addEventListener('click', () => {
  const processCount = parseInt(document.getElementById('processCount').value);
  const resourceCount = parseInt(document.getElementById('resourceCount').value);

  if (processCount <= 0 || resourceCount <= 0) {
    alert("Enter positive number of processes and resources!");
    return;
  }

  matricesDiv.innerHTML = '';

  // Allocation Table
  let allocationHTML = `<h3>Allocation Matrix</h3><table border="1" style="margin:auto;"><tr><th>Process</th>`;
  for (let r = 0; r < resourceCount; r++) allocationHTML += `<th>R${r}</th>`;
  allocationHTML += `</tr>`;
  for (let p = 0; p < processCount; p++) {
    allocationHTML += `<tr><td>P${p}</td>`;
    for (let r = 0; r < resourceCount; r++)
      allocationHTML += `<td><input type="number" min="0" value="0" class="allocInput" data-p="${p}" data-r="${r}"></td>`;
    allocationHTML += `</tr>`;
  }
  allocationHTML += `</table>`;

  // Max Table
  let maxHTML = `<h3>Max Matrix</h3><table border="1" style="margin:auto;"><tr><th>Process</th>`;
  for (let r = 0; r < resourceCount; r++) maxHTML += `<th>R${r}</th>`;
  maxHTML += `</tr>`;
  for (let p = 0; p < processCount; p++) {
    maxHTML += `<tr><td>P${p}</td>`;
    for (let r = 0; r < resourceCount; r++)
      maxHTML += `<td><input type="number" min="0" value="0" class="maxInput" data-p="${p}" data-r="${r}"></td>`;
    maxHTML += `</tr>`;
  }
  maxHTML += `</table>`;
// Create a container for Need Matrix
let needDiv = document.createElement('div');
needDiv.id = 'needMatrixContainer';
needDiv.style.marginTop = '20px';


function updateNeedMatrix() {
  const allocInputs = document.querySelectorAll('.allocInput');
  const maxInputs = document.querySelectorAll('.maxInput');

  const processCount = Math.max(...Array.from(allocInputs).map(i => parseInt(i.dataset.p))) + 1;
  const resourceCount = Math.max(...Array.from(allocInputs).map(i => parseInt(i.dataset.r))) + 1;

  let Need = Array.from({length: processCount}, () => Array(resourceCount).fill(0));

  for (let p = 0; p < processCount; p++) {
    for (let r = 0; r < resourceCount; r++) {
      const alloc = parseInt(document.querySelector(`.allocInput[data-p="${p}"][data-r="${r}"]`).value) || 0;
      const max = parseInt(document.querySelector(`.maxInput[data-p="${p}"][data-r="${r}"]`).value) || 0;
      Need[p][r] = Math.max(0, max - alloc);
    }
  }

  // Display Need matrix
  let needHTML = `<h3>Need Matrix</h3><table border="1" style="margin:auto;"><tr><th>Process</th>`;
  for (let r = 0; r < resourceCount; r++) needHTML += `<th>R${r}</th>`;
  needHTML += `</tr>`;
  for (let p = 0; p < processCount; p++) {
    needHTML += `<tr><td>P${p}</td>`;
    for (let r = 0; r < resourceCount; r++) needHTML += `<td>${Need[p][r]}</td>`;
    needHTML += `</tr>`;
  }
  needHTML += `</table>`;
  needDiv.innerHTML = needHTML;
}

// Update Need matrix whenever user changes Allocation or Max inputs
document.addEventListener('input', e => {
  if (e.target.classList.contains('allocInput') || e.target.classList.contains('maxInput')) {
    updateNeedMatrix();
  }
});

// Initial Need matrix after generating tables
//updateNeedMatrix();


  // Available Resources
  let availHTML = `<h3>Available Resources</h3>`;
  for (let r = 0; r < resourceCount; r++)
    availHTML += `R${r}: <input type="number" min="0" value="0" class="availInput" data-r="${r}" style="width:50px; margin:5px;">`;

 matricesDiv.innerHTML = allocationHTML + maxHTML + availHTML;

// ✅ Add Need Matrix below Available Resources
matricesDiv.appendChild(needDiv);
updateNeedMatrix(); // show Need Matrix initially

// ✅ Now add Check Deadlock button AFTER Need Matrix
let checkBtnDiv = document.createElement('div');
checkBtnDiv.style.marginTop = '10px';
checkBtnDiv.innerHTML = `<button class="btn" id="checkDeadlockBtn">Check for Deadlock</button>`;
matricesDiv.appendChild(checkBtnDiv);



  document.getElementById('checkDeadlockBtn').addEventListener('click', checkDeadlock);
// Draw Resource Allocation Graph button
let drawGraphBtnDiv = document.createElement('div');
drawGraphBtnDiv.style.marginTop = '10px';
drawGraphBtnDiv.innerHTML = `<button class="btn" id="drawGraphBtn">Draw Resource Allocation Graph</button>`;
matricesDiv.appendChild(drawGraphBtnDiv);

document.getElementById('drawGraphBtn').addEventListener('click', drawRAG);


// Reset all inputs and output
//resetBtn.addEventListener('click', () => {
//document.getElementById('processCount').value = 0;
//document.getElementById('resourceCount').value = 0;
//matricesDiv.innerHTML = '';
//outputDiv.innerHTML = '';
//});
// After building matricesDiv.innerHTML
// Add Reset Table button dynamically
let resetTableBtn = document.createElement('button');
resetTableBtn.textContent = "Reset Table";
resetTableBtn.className = "btn";
resetTableBtn.style.marginTop = "10px";
matricesDiv.appendChild(resetTableBtn);

// Reset table inputs and output
resetTableBtn.addEventListener('click', () => {
  // Reset all table inputs
  document.querySelectorAll('.allocInput').forEach(input => input.value = 0);
  document.querySelectorAll('.maxInput').forEach(input => input.value = 0);
  document.querySelectorAll('.availInput').forEach(input => input.value = 0);

  // Update Need matrix
  updateNeedMatrix();

  // Clear output
  outputDiv.innerHTML = '';

  // ✅ Clear RAG canvas instead of removing container
  const canvas = document.getElementById('ragCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
});


});

function checkDeadlock() {
  const allocInputs = document.querySelectorAll('.allocInput');
  const maxInputs = document.querySelectorAll('.maxInput');
  const availInputs = document.querySelectorAll('.availInput');

  const processCount = Math.max(...Array.from(allocInputs).map(i => parseInt(i.dataset.p))) + 1;
  const resourceCount = Math.max(...Array.from(allocInputs).map(i => parseInt(i.dataset.r))) + 1;

  // Build matrices
  let Allocation = Array.from({length: processCount}, () => Array(resourceCount).fill(0));
  let Max = Array.from({length: processCount}, () => Array(resourceCount).fill(0));
  let Need = Array.from({length: processCount}, () => Array(resourceCount).fill(0));
  let Available = Array.from({length: resourceCount}, (_, r) => parseInt(availInputs[r].value));

  allocInputs.forEach(input => {
    const p = parseInt(input.dataset.p);
    const r = parseInt(input.dataset.r);
    Allocation[p][r] = Math.max(0, parseInt(input.value)); // prevent negative
  });

  maxInputs.forEach(input => {
    const p = parseInt(input.dataset.p);
    const r = parseInt(input.dataset.r);
    Max[p][r] = Math.max(0, parseInt(input.value)); // prevent negative
    Need[p][r] = Max[p][r] - Allocation[p][r];
  });

  // Banker's Algorithm
  let Finish = Array(processCount).fill(false);
  let safeSeq = [];
  let changed = true;

  while (safeSeq.length < processCount && changed) {
    changed = false;
    for (let p = 0; p < processCount; p++) {
      if (!Finish[p] && Need[p].every((n, r) => n <= Available[r])) {
        for (let r = 0; r < resourceCount; r++) Available[r] += Allocation[p][r];
        Finish[p] = true;
        safeSeq.push('P' + p);
        changed = true;
      }
    }
  }

  if (safeSeq.length === processCount) {
    outputDiv.innerHTML = `✅ Safe state! Safe sequence: ${safeSeq.join(' → ')}`;
  } else {
    outputDiv.innerHTML = `❌ Unsafe state / Deadlock possible!`;
  }
}
function drawArrow(ctx, fromX, fromY, toX, toY) {
  const headLength = 10; // arrow size
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  // arrowhead
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
  ctx.lineTo(toX, toY);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}
function drawEdgeLabel(ctx, from, to, text, side = 'center', offset = 20) {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx*dx + dy*dy);

    const nx = -dy / length; // perpendicular x
    const ny = dx / length;  // perpendicular y

    let ox = 0, oy = 0;

    if (side === 'left') {
        ox = -nx * offset;
        oy = -ny * offset;
    } else if (side === 'right') {
        ox = nx * offset;
        oy = ny * offset;
    } // 'center' keeps ox, oy = 0

    ctx.fillStyle = '#000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, midX + ox, midY + oy);
}


function drawRAG() {
    // --- Canvases ---
    const allocationCanvas = document.getElementById('allocationCanvas');
    const requestCanvas = document.getElementById('requestCanvas');
    const allocCtx = allocationCanvas.getContext('2d');
    const reqCtx = requestCanvas.getContext('2d');

    allocCtx.clearRect(0, 0, allocationCanvas.width, allocationCanvas.height);
    reqCtx.clearRect(0, 0, requestCanvas.width, requestCanvas.height);

    // --- Inputs ---
    const allocInputs = document.querySelectorAll('.allocInput');
    const availInputs = document.querySelectorAll('.availInput');
    const maxInputs = document.querySelectorAll('.maxInput');

    const processCount = Math.max(...Array.from(allocInputs).map(i => parseInt(i.dataset.p))) + 1;
    const resourceCount = Math.max(...Array.from(allocInputs).map(i => parseInt(i.dataset.r))) + 1;

    // --- Data Arrays ---
    let Allocation = Array.from({ length: processCount }, () => Array(resourceCount).fill(0));
    let Max = Array.from({ length: processCount }, () => Array(resourceCount).fill(0));
    let Need = Array.from({ length: processCount }, () => Array(resourceCount).fill(0));

    allocInputs.forEach(input => {
        const p = parseInt(input.dataset.p);
        const r = parseInt(input.dataset.r);
        Allocation[p][r] = Math.max(0, parseInt(input.value));
    });

    maxInputs.forEach(input => {
        const p = parseInt(input.dataset.p);
        const r = parseInt(input.dataset.r);
        Max[p][r] = Math.max(0, parseInt(input.value));
        Need[p][r] = Max[p][r] - Allocation[p][r];
    });

    // --- Node Positions ---
    const canvasPadding = 50;
    const procRadius = 25;
    const resWidth = 50;
    const resHeight = 30;

    let processPositions = [];
    let resourcePositions = [];

    for (let p = 0; p < processCount; p++) {
        let x = allocationCanvas.width / 3;
        let y = canvasPadding + p * (allocationCanvas.height - 2 * canvasPadding) / (processCount - 1 || 1);
        processPositions.push({ x, y });
    }

    for (let r = 0; r < resourceCount; r++) {
        let x = 2 * allocationCanvas.width / 3;
        let y = canvasPadding + r * (allocationCanvas.height - 2 * canvasPadding) / (resourceCount - 1 || 1);
        resourcePositions.push({ x, y });
    }

    // --- Draw Nodes Helper ---
    function drawNodes(ctx) {
        // Processes
        processPositions.forEach((pos, p) => {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, procRadius, 0, 2 * Math.PI);
            ctx.fillStyle = '#3498db';
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('P' + (p + 1), pos.x, pos.y);
        });
        // Resources
        resourcePositions.forEach((pos, r) => {
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(pos.x - resWidth / 2, pos.y - resHeight / 2, resWidth, resHeight);
            ctx.strokeRect(pos.x - resWidth / 2, pos.y - resHeight / 2, resWidth, resHeight);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('R' + (r + 1), pos.x, pos.y);
        });
    }

    // --- Draw Arrow Helper ---
    function drawArrow(ctx, from, to, label, color, dashed = false) {
        const headLen = 10;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const angle = Math.atan2(dy, dx);

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash(dashed ? [5, 5] : []);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();

        // Arrowhead
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - headLen * Math.cos(angle - Math.PI / 6), to.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(to.x - headLen * Math.cos(angle + Math.PI / 6), to.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();

        // Label
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        ctx.fillStyle = '#000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(label, midX, midY - 10);
    }

    // --- Draw Allocation Graph ---
    drawNodes(allocCtx);
    for (let p = 0; p < processCount; p++) {
        for (let r = 0; r < resourceCount; r++) {
            if (Allocation[p][r] > 0) {
                drawArrow(allocCtx, resourcePositions[r], processPositions[p], Allocation[p][r], '#FF8C00', false);
            }
        }
    }

    // --- Draw Request Graph ---
    drawNodes(reqCtx);
    for (let p = 0; p < processCount; p++) {
        for (let r = 0; r < resourceCount; r++) {
            if (Need[p][r] > 0) {
                drawArrow(reqCtx, processPositions[p], resourcePositions[r], Need[p][r], '#800080', true);
            }
        }
    }
}
