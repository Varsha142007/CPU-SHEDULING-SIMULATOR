/* ========== Time Complexity Display ========== */
const colors = ["#e74c3c","#3498db","#2ecc71","#f1c40f","#9b59b6","#1abc9c","#e67e22","#95a5a6"];
const algoColors = {
  "FCFS": ["#e74c3c","#3498db","#2ecc71","#f1c40f","#9b59b6","#1abc9c","#e67e22","#95a5a6"],
  "SJF Non-Preemptive": ["#f39c12","#9b59b6","#16a085","#2980b9","#d35400","#c0392b","#27ae60","#8e44ad"],
  "SJF Preemptive": ["#1abc9c","#e67e22","#2c3e50","#f1c40f","#34495e","#e74c3c","#3498db","#9b59b6"],
  "Priority Non-Preemptive": ["#e74c3c","#8e44ad","#16a085","#f39c12","#2980b9","#27ae60","#d35400","#95a5a6"],
  "Priority Preemptive": ["#2ecc71","#3498db","#e74c3c","#f1c40f","#9b59b6","#1abc9c","#e67e22","#95a5a6"],
  "Round Robin": ["#f39c12","#16a085","#e74c3c","#3498db","#2ecc71","#9b59b6","#1abc9c","#95a5a6"]
};

let runStats = {};            // { algoName: {avgTAT, avgWT} }
let runHistory = {};         // { algoName: snapshotProcesses }
let lastProcesses = [];      // latest dataset shown (for export)
const ganttCanvas = document.getElementById("ganttChart");
const gctx = ganttCanvas.getContext("2d");
let comparisonChart = null;

/* View / playback state */
let viewStart = 0;    // leftmost time shown
let scale = 18;       // pixels per time unit
let isPlaying = false;
let playSpeed = 1.0;
let currentPlayTime = 0;
let totalTime = 1;
let animationRAF = null;
let slicesHit = []; // for tooltip: {pid,start,end,rect,color}

/* DOM tooltip */
const tooltip = document.getElementById("ganttTooltip");

/* ========== Helpers ========== */
function parseNumberSafe(v, fallback=0){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/* ========== Process table ========== */
// REPLACE your old addRow() with this exact function
function addRow() {
    const tbody = document.getElementById("process-tbody");
    const rowCount = tbody.rows.length + 1;
    const algo = document.getElementById("algoSelectSim").value;

    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>P${rowCount}</td>
        <td><input type="number" value="0"></td>
        <td><input type="number" value="0"></td>
        <td class="priorityCell" style="display: ${(algo.includes("Priority")) ? "table-cell" : "none"}">
            <input type="number" value="0">
        </td>
    `;
    tbody.appendChild(tr);
}

// Add this helper to toggle Priority column visibility
function setPriorityVisibility(show) {
    // Header
    document.getElementById("priorityHeader").style.display = show ? "table-cell" : "none";

    // Each row
    document.querySelectorAll("#process-tbody tr").forEach(row => {
        const cell = row.querySelector(".priorityCell");
        if (cell) cell.style.display = show ? "table-cell" : "none";
    });
}


function removeRow(){
  const tbody = document.getElementById("process-tbody");
  if(tbody.rows.length>0) tbody.deleteRow(tbody.rows.length-1);
}
function resetAll() {
    const algo = document.getElementById("algoSelectSim").value;
    const tbody = document.getElementById("process-tbody");

    // Reset all inputs in table to 0 (but keep number of rows)
    tbody.querySelectorAll("tr").forEach(row => {
        row.querySelectorAll("input").forEach(input => {
            input.value = 0;
        });
    });

    // Show/hide priority column
    if (algo === "Priority Non-Preemptive" || algo === "Priority Preemptive") {
        setPriorityVisibility(true);
    } else {
        setPriorityVisibility(false);
    }

    // Show/hide quantum input
    document.getElementById("quantumDiv").style.display = (algo === "Round Robin") ? "inline-block" : "none";

    // Clear Gantt chart, result table, etc. if needed
    const gantt = document.getElementById("ganttChart");
    if (gantt) gantt.getContext("2d").clearRect(0, 0, gantt.width, gantt.height);
    document.getElementById("resultTableContainer").innerHTML = "";
}




function getProcesses() {
  const tbody = document.getElementById("process-tbody");
  const processes = [];
  for (let i = 0; i < tbody.rows.length; i++) {
    const row = tbody.rows[i];
    const pid = parseNumberSafe(row.cells[0].innerText, i + 1);
    const arrival = parseNumberSafe(row.cells[1].querySelector("input").value, 0);
    const burst = parseNumberSafe(row.cells[2].querySelector("input").value, 0);
    const priority = parseNumberSafe(row.cells[3].querySelector("input").value, 1);

    // ✅ Validations
    if (burst <= 0) {
  alert(`Burst time must be greater than 0 (Row ${i + 1})`);
  return null; // stop execution
}
if (arrival < 0) {
  alert(`Arrival time cannot be negative (Row ${i + 1})`);
  return null;
}
if (priority < 0) {
  alert(`Priority cannot be negative (Row ${i + 1}). Note: Lower number = higher priority.`);
  return null;
}

    if (arrival < 0) {
      alert(`Arrival time cannot be negative (Row ${i + 1})`);
      return [];
    }
    if (priority < 0) {
      alert(`Priority cannot be negative (Row ${i + 1}). Note: Lower number = higher priority.`);
      return [];
    }

    processes.push({
      pid,
      arrival,
      burst,
      remaining: burst,
      priority,
      start: null,
      completion: null,
      turnaround: null,
      waiting: null,
      executedSlices: []
    });
  }
  return processes;
}




/* ========== Scheduling algorithms ========== */
function fcfs(processes){
  processes.forEach(p=>{ p.start=null; p.completion=null; p.turnaround=null; p.waiting=null; p.executedSlices=[]; p.remaining=p.burst; });
  processes.sort((a,b)=>a.arrival - b.arrival);
  let time = 0;
  for(const p of processes){
    const start = Math.max(time, p.arrival);
    const end = start + p.burst;
    p.start = start; p.completion = end; p.turnaround = end - p.arrival; p.waiting = p.turnaround - p.burst;
    p.executedSlices.push([start,end]);
    time = end;
  }
}
function sjfNonPreemptive(processes){
  processes.forEach(p=>{ p.start=null; p.completion=null; p.turnaround=null; p.waiting=null; p.executedSlices=[]; p.remaining=p.burst; });
  let time = 0;
  const proc = JSON.parse(JSON.stringify(processes));
  const completed = [];
  while(proc.length){
    const avail = proc.filter(p=>p.arrival <= time);
    if(avail.length===0){ time++; continue; }
    avail.sort((a,b)=>a.burst - b.burst || a.arrival - b.arrival);
    const p = avail[0];
    const start = Math.max(time, p.arrival);
    const end = start + p.burst;
    p.start = start; p.completion = end; p.turnaround = end - p.arrival; p.waiting = p.turnaround - p.burst;
    p.executedSlices.push([start,end]);
    time = end;
    completed.push(p);
    proc.splice(proc.findIndex(x=>x.pid===p.pid),1);
  }
  completed.forEach(c=>{ const orig = processes.find(p=>p.pid===c.pid); orig.start=c.start; orig.completion=c.completion; orig.turnaround=c.turnaround; orig.waiting=c.waiting; orig.executedSlices=c.executedSlices; });
}
function sjfPreemptive(processes){
  processes.forEach(p=>{ p.start=null; p.completion=null; p.turnaround=null; p.waiting=null; p.executedSlices=[]; p.remaining=p.burst; });
  let time=0;
  const proc = JSON.parse(JSON.stringify(processes));
  const completed = [];
  while(completed.length < processes.length){
    const avail = proc.filter(p=>p.arrival <= time && p.remaining > 0);
    if(avail.length===0){ time++; continue; }
    avail.sort((a,b)=>a.remaining - b.remaining || a.arrival - b.arrival);
    const p = avail[0];
    if(p.start === null) p.start = time;
    const s = time; time++; p.remaining--; const e = time;
    if(p.executedSlices.length && p.executedSlices[p.executedSlices.length-1][1] === s) p.executedSlices[p.executedSlices.length-1][1] = e;
    else p.executedSlices.push([s,e]);
    if(p.remaining === 0){ p.completion = time; p.turnaround = p.completion - p.arrival; p.waiting = p.turnaround - p.burst; completed.push(p); }
  }
  for(const p of processes){ const temp = proc.find(x=>x.pid===p.pid); p.start=temp.start; p.completion=temp.completion; p.turnaround=temp.turnaround; p.waiting=temp.waiting; p.executedSlices=temp.executedSlices; }
}
function priorityNonPreemptive(processes){
  processes.forEach(p=>{ p.start=null; p.completion=null; p.turnaround=null; p.waiting=null; p.executedSlices=[]; p.remaining=p.burst; });
  let time=0;
  const proc = JSON.parse(JSON.stringify(processes));
  const completed=[];
  while(proc.length){
    const avail = proc.filter(p=>p.arrival <= time);
    if(avail.length===0){ time++; continue; }
    avail.sort((a,b)=>a.priority - b.priority || a.arrival - b.arrival);
    const p = avail[0];
    const start = Math.max(time, p.arrival);
    const end = start + p.burst;
    p.start = start; p.completion = end; p.turnaround = end - p.arrival; p.waiting = p.turnaround - p.burst;
    p.executedSlices.push([start,end]);
    completed.push(p);
    time = end;
    proc.splice(proc.findIndex(x=>x.pid===p.pid),1);
  }
  completed.forEach(c=>{ const orig = processes.find(p=>p.pid===c.pid); orig.start=c.start; orig.completion=c.completion; orig.turnaround=c.turnaround; orig.waiting=c.waiting; orig.executedSlices=c.executedSlices; });
}
function priorityPreemptive(processes){
  processes.forEach(p=>{ p.start=null; p.completion=null; p.turnaround=null; p.waiting=null; p.executedSlices=[]; p.remaining=p.burst; });
  let time=0;
  const proc = JSON.parse(JSON.stringify(processes));
  const completed=[];
  while(completed.length < processes.length){
    const avail = proc.filter(p=>p.arrival <= time && p.remaining > 0);
    if(avail.length===0){ time++; continue; }
    avail.sort((a,b)=>a.priority - b.priority || a.arrival - b.arrival);
    const p = avail[0];
    if(p.start === null) p.start = time;
    const s = time; time++; p.remaining--; const e = time;
    if(p.executedSlices.length && p.executedSlices[p.executedSlices.length-1][1] === s) p.executedSlices[p.executedSlices.length-1][1] = e;
    else p.executedSlices.push([s,e]);
    if(p.remaining === 0){ p.completion = time; p.turnaround = p.completion - p.arrival; p.waiting = p.turnaround - p.burst; completed.push(p); }
  }
  for(const p of processes){ const temp = proc.find(x=>x.pid===p.pid); p.start=temp.start; p.completion=temp.completion; p.turnaround=temp.turnaround; p.waiting=temp.waiting; p.executedSlices=temp.executedSlices; }
}
function roundRobin(processes, quantum){
  processes.forEach(p=>{ p.start=null; p.completion=null; p.turnaround=null; p.waiting=null; p.executedSlices=[]; p.remaining=p.burst; });
  let time=0;
  const proc = JSON.parse(JSON.stringify(processes));
  const queue = [];
  let completedCount = 0;
  while(completedCount < processes.length){
    proc.forEach(p=>{ if(p.arrival <= time && p.remaining > 0 && !queue.includes(p)) queue.push(p); });
    if(queue.length===0){ time++; continue; }
    const p = queue.shift();
    if(p.start === null) p.start = time;
    const exec = Math.min(p.remaining, quantum);
    const s = time; time += exec; p.remaining -= exec; const e = time;
    if(p.executedSlices.length && p.executedSlices[p.executedSlices.length-1][1] === s) p.executedSlices[p.executedSlices.length-1][1] = e;
    else p.executedSlices.push([s,e]);
    proc.forEach(x=>{ if(x.arrival <= time && x.remaining > 0 && !queue.includes(x) && x.pid !== p.pid) queue.push(x); });
    if(p.remaining > 0) queue.push(p);
    else { p.completion = time; p.turnaround = p.completion - p.arrival; p.waiting = p.turnaround - p.burst; completedCount++; }
  }
  proc.forEach(temp=>{ const orig = processes.find(x=>x.pid===temp.pid); orig.start=temp.start; orig.completion=temp.completion; orig.turnaround=temp.turnaround; orig.waiting=temp.waiting; orig.executedSlices=temp.executedSlices; });
}

/* ======== Timeline drawing & tooltip ======== */
function clearGantt(){
  gctx.clearRect(0, 0, ganttCanvas.width, ganttCanvas.height); // clear canvas
  slicesHit = []; // clear slices
  gctx.fillStyle = "#fff"; 
  gctx.fillRect(0, 0, ganttCanvas.width, ganttCanvas.height); // fill background so old slices cannot flash
}

function logicalToX(t){
  const paddingLeft = 80;
  return paddingLeft + Math.round((t - viewStart) * scale);
}
function drawTimelineUpTo(processes, upToTime = null){
  clearGantt();
  
  if(!processes || processes.length === 0){
    totalTime = 1;
    return; // nothing to draw
  }
 // lastProcesses = JSON.parse(JSON.stringify(processes));
  totalTime = Math.max(1, ...processes.map(p => p.completion || 0));
  if(upToTime === null) upToTime = totalTime;
  const paddingLeft = 80, paddingTop = 20, paddingRight = 20;
  const usableWidth = ganttCanvas.width - paddingLeft - paddingRight;
  const rowHeight = Math.max(28, Math.floor((ganttCanvas.height - paddingTop*2) / Math.max(1, processes.length)));
  gctx.fillStyle = "#fff"; gctx.fillRect(0,0,ganttCanvas.width,ganttCanvas.height);
  // time ticks
  const visibleEndTime = viewStart + usableWidth/scale;
  const approxTicks = Math.min(20, Math.max(1, Math.ceil(visibleEndTime / 5)));
  const tickStep = Math.max(1, Math.ceil(visibleEndTime / approxTicks));
  gctx.font = "12px Arial";
  for(let t = Math.max(0, Math.floor(viewStart)); t <= visibleEndTime; t += tickStep){
    const x = logicalToX(t);
    gctx.strokeStyle = "#f1f1f1";
    gctx.beginPath(); gctx.moveTo(x, paddingTop - 6); gctx.lineTo(x, ganttCanvas.height - paddingTop + 6); gctx.stroke();
    gctx.fillStyle = "#666"; gctx.fillText(String(t), x - 6, paddingTop - 8);
  }
  slicesHit = [];
  for(let i=0;i<processes.length;i++){
    const p = processes[i];
    const y = paddingTop + i * rowHeight + 4;
    gctx.fillStyle = "#111"; gctx.fillText(`P${p.pid}`, 8, y + rowHeight/2 + 4);
    gctx.strokeStyle = "#eee"; gctx.beginPath(); gctx.moveTo(paddingLeft, y + rowHeight/2); gctx.lineTo(ganttCanvas.width - paddingRight, y + rowHeight/2); gctx.stroke();
    for(const sl of p.executedSlices){
      const s = sl[0], e = sl[1];
      if(!Number.isFinite(s) || !Number.isFinite(e)) continue;
      if(s >= upToTime) continue;
      const x = logicalToX(s);
      const x2 = logicalToX(e > upToTime ? upToTime : e);
      let w = x2 - x;
      if(w < 2) w = 2;
      const h = Math.max(14, Math.floor(rowHeight * 0.6));
      const rectY = y + (rowHeight - h)/2;
      const algo = document.getElementById("algoSelectSim").value;

const colorPalette = algoColors[algo] || colors;
const color = colorPalette[(p.pid - 1) % colorPalette.length];

      gctx.fillStyle = color; gctx.fillRect(x, rectY, w, h);
      gctx.strokeStyle = "#222"; gctx.strokeRect(x, rectY, w, h);
      gctx.fillStyle = "#000"; gctx.font = "11px Arial";
      gctx.fillText(`P${p.pid}`, x + 4, rectY + h/2 + 4);
      slicesHit.push({pid: p.pid, start: s, end: e, rect: {x, y: rectY, w, h}, color});
    }
  }
}

/* tooltip */
ganttCanvas.addEventListener("mousemove", (ev) => {
  const rect = ganttCanvas.getBoundingClientRect();
  const mx = ev.clientX - rect.left;
  const my = ev.clientY - rect.top;
  let found = null;
  for(let i = slicesHit.length - 1; i >= 0; i--){
    const s = slicesHit[i];
    if(mx >= s.rect.x && mx <= s.rect.x + s.rect.w && my >= s.rect.y && my <= s.rect.y + s.rect.h){
      found = s; break;
    }
  }
  if(found){
    tooltip.style.display = "block";
    tooltip.innerText = `P${found.pid} | Start: ${found.start} | End: ${found.end} | Dur: ${found.end - found.start}`;
    tooltip.style.left = (ev.pageX + 12) + "px";
    tooltip.style.top = (ev.pageY + 12) + "px";
  } else {
    tooltip.style.display = "none";
  }
});
ganttCanvas.addEventListener("mouseleave", ()=> tooltip.style.display = "none");

/* ========== Zoom / Pan ========== */
function zoomIn(){ scale = Math.min(scale * 1.25, 300); drawTimelineUpTo(lastProcesses, currentPlayTime); }
function zoomOut(){ scale = Math.max(scale / 1.25, 2); drawTimelineUpTo(lastProcesses, currentPlayTime); }
function panLeft(){ viewStart = Math.max(0, viewStart - Math.max(1, Math.round(100/scale))); drawTimelineUpTo(lastProcesses, currentPlayTime); }
function panRight(){ viewStart = Math.max(0, viewStart + Math.max(1, Math.round(100/scale))); drawTimelineUpTo(lastProcesses, currentPlayTime); }

/* ========== Playback controls ========== */
document.getElementById("playBtn").addEventListener("click", ()=>{ if(!isPlaying){ isPlaying = true; animatePlay(); } });
document.getElementById("pauseBtn").addEventListener("click", ()=>{ isPlaying = false; if(animationRAF) cancelAnimationFrame(animationRAF); });
document.getElementById("resetPlayBtn").addEventListener("click", ()=>{ isPlaying = false; currentPlayTime = 0; drawTimelineUpTo(lastProcesses, currentPlayTime); });
document.getElementById("stepBackBtn").addEventListener("click", ()=>{ currentPlayTime = Math.max(0, currentPlayTime - 1); drawTimelineUpTo(lastProcesses, currentPlayTime); });
document.getElementById("stepFwdBtn").addEventListener("click", ()=>{ currentPlayTime = Math.min(totalTime, currentPlayTime + 1); drawTimelineUpTo(lastProcesses, currentPlayTime); });
document.getElementById("timeComplexityDisplay").innerText = "Time Complexity: Select an algorithm to see its typical time complexity.";

let lastFrameTs = null;
function animatePlay(ts){
  if(!lastProcesses || lastProcesses.length === 0) return;
  if(!isPlaying){ lastFrameTs = null; return; }
  if(!lastFrameTs) lastFrameTs = ts || performance.now();
  const now = ts || performance.now();
  const dtSec = (now - lastFrameTs) / 1000;
  lastFrameTs = now;
  currentPlayTime += dtSec * playSpeed;
  if(currentPlayTime > totalTime){ currentPlayTime = totalTime; isPlaying = false; lastFrameTs = null; }
  const viewWidthTime = (ganttCanvas.width - 100) / scale;
  if(currentPlayTime < viewStart + viewWidthTime*0.15) viewStart = Math.max(0, currentPlayTime - viewWidthTime*0.15);
  if(currentPlayTime > viewStart + viewWidthTime*0.85) viewStart = Math.max(0, currentPlayTime - viewWidthTime*0.85);
  drawTimelineUpTo(lastProcesses, currentPlayTime);
  if(isPlaying) animationRAF = requestAnimationFrame(animatePlay);
}

/* ========== Comparison chart (Chart.js) + click to reload ========== */
function drawComparison(){
  const ctx = document.getElementById("comparisonChart").getContext("2d");
  if(comparisonChart) comparisonChart.destroy();
  const labels = Object.keys(runStats);
  if(!labels.length){ ctx.clearRect(0,0,document.getElementById("comparisonChart").width, document.getElementById("comparisonChart").height); return; }
  const tat = labels.map(l=>runStats[l].avgTAT);
  const wt = labels.map(l=>runStats[l].avgWT);
  const best = Math.min(...tat);
  const bg = labels.map(l => runStats[l].avgTAT === best ? "#2ecc71" : "#3498db");
  comparisonChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets:[
      { label: "Avg TAT", data: tat, backgroundColor: bg },
      { label: "Avg WT", data: wt, backgroundColor: "#e74c3c" }
    ]},
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: "Comparison Chart of Run Algorithms" }
      },
      onClick: (evt) => {
        const points = comparisonChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
        if(points.length){
          const idx = points[0].index;
          const label = comparisonChart.data.labels[idx];
          const snapshot = runHistory[label];
          if(snapshot){
            lastProcesses = JSON.parse(JSON.stringify(snapshot));
            currentPlayTime = 0; viewStart = 0;
            drawTimelineUpTo(lastProcesses, 0);
            showResultTable(lastProcesses);
            showTimeComplexity(label); // <-- show time complexity when clicked
          } else {
            alert("Snapshot not found for " + label);
          }
        }
      }
    },
    scales: { y: { beginAtZero: true } }
  });
  const bestAlgo = Object.keys(runStats).find(l => runStats[l].avgTAT === best) || "";
  document.getElementById("bestAlgo").innerText = bestAlgo;
}

/* ========== Per-process table ========== */
function showResultTable(processes){
  lastProcesses = JSON.parse(JSON.stringify(processes));
  const container = document.getElementById("resultTableContainer");
  container.innerHTML = "";
  const table = document.createElement("table");
  table.className = "result-table";
  table.style.width = "95%";
  table.style.margin = "10px auto";
  table.innerHTML = `<tr>
    <th>PID</th><th>Arrival</th><th>Burst</th><th>Priority</th>
    <th>Start</th><th>Completion</th><th>TAT</th><th>WT</th><th>Execution Slices</th>
  </tr>`;
  processes.forEach(p=>{
    const row = table.insertRow();
    row.insertCell(0).innerText = p.pid;
    row.insertCell(1).innerText = p.arrival;
    row.insertCell(2).innerText = p.burst;
    row.insertCell(3).innerText = p.priority;
    row.insertCell(4).innerText = (p.start===null? "-" : p.start);
    row.insertCell(5).innerText = (p.completion===null? "-" : p.completion);
    row.insertCell(6).innerText = (p.turnaround===null? "-" : p.turnaround);
    row.insertCell(7).innerText = (p.waiting===null? "-" : p.waiting);
    row.insertCell(8).innerText = p.executedSlices.map(s=>`[${s[0]}-${s[1]}]`).join(", ");
  });
  container.appendChild(table);
}

/* ========== Compute stats helper ========== */
function computeStatsFor(algoName, processes, quantum){
  const copy = processes.map(p=>({ ...p, remaining: p.burst, executedSlices: [] }));
  if(algoName === "Round Robin") roundRobin(copy, quantum); // only pass quantum for RR
  else if(algoName === "FCFS") fcfs(copy);
  else if(algoName === "SJF Non-Preemptive") sjfNonPreemptive(copy);
  else if(algoName === "SJF Preemptive") sjfPreemptive(copy);
  else if(algoName === "Priority Non-Preemptive") priorityNonPreemptive(copy);
  else if(algoName === "Priority Preemptive") priorityPreemptive(copy);

  const avgTAT = copy.reduce((a,b)=>a + (b.turnaround || 0), 0) / copy.length;
  const avgWT = copy.reduce((a,b)=>a + (b.waiting || 0), 0) / copy.length;
  return { avgTAT, avgWT, snapshot: copy };
}


/* ========== Main run handler ========== */
function runAlgorithm(){
  const processes = getProcesses();
  if(!processes) return; // STOP if invalid inputs

  processes.forEach(p=>{ if(!Number.isFinite(p.arrival)) p.arrival = 0; if(!Number.isFinite(p.burst)) p.burst = 0; if(!Number.isFinite(p.priority)) p.priority = 1; p.remaining = p.burst; p.executedSlices = []; p.start = null; p.completion = null; p.turnaround = null; p.waiting = null; });
  const algo = document.getElementById("algoSelectSim").value;

  const quantum = parseNumberSafe(document.getElementById("quantum").value, 2);

  if(algo === "FCFS") fcfs(processes);
  else if(algo === "SJF Non-Preemptive") sjfNonPreemptive(processes);
  else if(algo === "SJF Preemptive") sjfPreemptive(processes);
  else if(algo === "Priority Non-Preemptive") priorityNonPreemptive(processes);
  else if(algo === "Priority Preemptive") priorityPreemptive(processes);
  else if(algo === "Round Robin") roundRobin(processes, quantum);

  // Compute stats for comparison only
const stats = computeStatsFor(algo, processes, quantum);
runStats[algo] = { avgTAT: stats.avgTAT, avgWT: stats.avgWT };
runHistory[algo] = JSON.parse(JSON.stringify(stats.snapshot)); // for comparison click

// Use the actual processes timeline for animation & export
lastProcesses = JSON.parse(JSON.stringify(processes));
totalTime = Math.max(1, ...lastProcesses.map(p => p.completion || 0)) + 1;

currentPlayTime = 0;
viewStart = 0;

drawTimelineUpTo(lastProcesses, 0);  // animation works for all algorithms
showResultTable(lastProcesses);
drawComparison();
showTimeComplexity(algo); // display time complexity

}

/* ========== Time Complexity Display ========== */
function showTimeComplexity(algoName) {
  const display = document.getElementById("timeComplexityDisplay");
  let tc = "-";
  let desc = "";

  if (algoName === "FCFS") {
    tc = "O(n log n) due to sorting arrival";
    desc = "First Come First Serve (FCFS)";
  } 
  else if (algoName === "SJF Non-Preemptive") {
    tc = "O(n²)";
    desc = "Shortest Job First (Non-Preemptive)";
  } 
  else if (algoName === "SJF Preemptive") {
    tc = "O(n²)";
    desc = "Shortest Job First (Preemptive)";
  } 
  else if (algoName === "Priority Non-Preemptive") {
    tc = "O(n²)";
    desc = "Priority Scheduling (Non-Preemptive)";
  } 
  else if (algoName === "Priority Preemptive") {
    tc = "O(n²)";
    desc = "Priority Scheduling (Preemptive)";
  } 
  else if (algoName === "Round Robin") {
    tc = "O(n × q) where q = number of quanta";
    desc = "Round Robin (RR)";
  } 
  else {
    display.innerText = "Time Complexity: Select an algorithm to view details.";
    return;
  }

  display.innerText = `${desc} → Time Complexity: ${tc}`;
}
// --- Section navigation ---
function showSection(section) {
  const sections = ['homeScreen', 'simulatorSection', 'notesSection', 'deadlockSection'];
  sections.forEach(id => document.getElementById(id).style.display = 'none');

  if (section === 'home') document.getElementById('homeScreen').style.display = 'block';
  else if (section === 'simulator') document.getElementById('simulatorSection').style.display = 'block';
  else if (section === 'notes') document.getElementById('notesSection').style.display = 'block';
  else if (section === 'deadlock') document.getElementById('deadlockSection').style.display = 'block';
}


// Show home screen on page load
window.onload = () => {
  showSection('home');
};

function generateManualChecker(processes) {
  const container = document.getElementById("manualTable");
  container.innerHTML = "";

  let table = `<table border="1" cellpadding="5" cellspacing="0">
    <tr>
      <th>PID</th><th>Arrival</th><th>Burst</th><th>ST</th><th>CT</th><th>TAT</th><th>WT</th>
    </tr>`;

  processes.forEach((p, i) => {
    table += `<tr>
      <td>${p.pid}</td>
      <td>${p.arrival}</td>
      <td>${p.burst}</td>
      <td><input type="number" id="st_${i}" style="width:60px;"></td>
      <td><input type="number" id="ct_${i}" style="width:60px;"></td>
      <td><input type="number" id="tat_${i}" style="width:60px;"></td>
      <td><input type="number" id="wt_${i}" style="width:60px;"></td>
    </tr>`;
  });

  table += `</table>`;
  container.innerHTML = table;
  document.getElementById("manualCheckContainer").style.display = "block";
}

function checkManualCalculations() {
  let resultDiv = document.getElementById("manualCheckResult");
  resultDiv.innerHTML = "";

  let allCorrect = true;
  processes.forEach((p, i) => {
    let st = +document.getElementById(`st_${i}`).value;
    let ct = +document.getElementById(`ct_${i}`).value;
    let tat = +document.getElementById(`tat_${i}`).value;
    let wt = +document.getElementById(`wt_${i}`).value;

    let correct = (st === p.start) && (ct === p.completion) && (tat === p.tat) && (wt === p.wt);
    resultDiv.innerHTML += `PID ${p.pid}: ${correct ? '✅ Correct' : '❌ Incorrect'}<br>`;
    if (!correct) allCorrect = false;
  });

  if (allCorrect) resultDiv.innerHTML = "All calculations are correct! 🎉";
}
// Ensure this runs after the DOM is ready (place it near other listeners, before initial addRow calls)
document.addEventListener("DOMContentLoaded", () => {
  const algoSelect = document.getElementById("algoSelectSim");
  const quantumDiv = document.getElementById("quantumDiv");

  // When algo changes -> show/hide Priority column (and quantum for RR)
  algoSelect.addEventListener("change", () => {
    const algo = algoSelect.value;

    // Show priority only for these exact algorithm names:
    const wantsPriority = (algo === "Priority Non-Preemptive" || algo === "Priority Preemptive");

    setPriorityVisibility(wantsPriority);

    // Keep quantum logic working (you already have other code, but ensure RR is handled)
    if (algo === "Round Robin") quantumDiv.style.display = "inline-block";
    else quantumDiv.style.display = "none";

    // Also ensure process input container remains visible when algo chosen
    const processTable = document.getElementById("processInputContainer");
    if (algo !== "") processTable.style.display = "block";
    else processTable.style.display = "none";

    // call time complexity display if you want
    showTimeComplexity(algo);
  });

  // Hide priority column by default on initial load
  setPriorityVisibility(false);
});

/* ========== Initial setup ========== */
for(let i=0;i<3;i++) addRow();
document.getElementById("runBtn").addEventListener("click", runAlgorithm);


/* Call this whenever algorithm runs */
document.getElementById("algoSelectSim").addEventListener("change", ()=>{
  const algo = document.getElementById("algoSelectSim").value;
  showTimeComplexity(algo);
});

// Show/hide Quantum input only for Round Robin
document.addEventListener("DOMContentLoaded", () => {
  const algoSelect = document.getElementById("algoSelectSim");
  const quantumDiv = document.getElementById("quantumDiv");
  const processTable = document.getElementById("processInputContainer");
  const tbody = document.getElementById("process-tbody");

  algoSelect.addEventListener("change", () => {
    if (algoSelect.value !== "") processTable.style.display = "block";
    else processTable.style.display = "none";

    if (algoSelect.value === "Round Robin") quantumDiv.style.display = "inline-block";
    else quantumDiv.style.display = "none";

    showTimeComplexity(algoSelect.value);
  });
});



document.getElementById("backHomeBtn").addEventListener("click", () => {
    showSection('home');
});

document.getElementById("exportBtn").addEventListener("click", exportResults);

function exportResults(){
  if(!lastProcesses || lastProcesses.length === 0){
    alert("No results to export. Run an algorithm first.");
    return;
  }
  let csv = 'PID,Arrival,Burst,Priority,Start,Completion,TAT,WT,Slices\n';
  lastProcesses.forEach(p=>{
    const slices = p.executedSlices.map(s=>`${s[0]}-${s[1]}`).join("|");
    csv += `${p.pid},${p.arrival},${p.burst},${p.priority},${p.start},${p.completion},${p.turnaround},${p.waiting},"${slices}"\n`;
  });
  const blob = new Blob([csv], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cpu_results.csv";
  a.click();
  URL.revokeObjectURL(url);
}
const algoDropdown = document.getElementById("algoSelectSim");
const processTable = document.getElementById("processTableContainer"); // your table wrapper

algoDropdown.addEventListener("change", () => {
  if(algoDropdown.value !== ""){
    processTable.style.display = "block";  // show table
  } else {
    processTable.style.display = "none";   // hide table if none selected
  }

  // Show quantum input only for Round Robin
  const quantumDiv = document.getElementById("quantumDiv");
  if (algoDropdown.value === "Round Robin") quantumDiv.style.display = "inline-block";
else quantumDiv.style.display = "none";


  // Show time complexity
  showTimeComplexity(algoDropdown.value);
});



