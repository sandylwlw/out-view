const elementSymbols = [
  "",
  "H",
  "He",
  "Li",
  "Be",
  "B",
  "C",
  "N",
  "O",
  "F",
  "Ne",
  "Na",
  "Mg",
  "Al",
  "Si",
  "P",
  "S",
  "Cl",
  "Ar",
  "K",
  "Ca",
  "Sc",
  "Ti",
  "V",
  "Cr",
  "Mn",
  "Fe",
  "Co",
  "Ni",
  "Cu",
  "Zn",
  "Ga",
  "Ge",
  "As",
  "Se",
  "Br",
  "Kr",
  "Rb",
  "Sr",
  "Y",
  "Zr",
  "Nb",
  "Mo",
  "Tc",
  "Ru",
  "Rh",
  "Pd",
  "Ag",
  "Cd",
  "In",
  "Sn",
  "Sb",
  "Te",
  "I",
  "Xe",
  "Cs",
  "Ba",
  "La",
  "Ce",
  "Pr",
  "Nd",
  "Pm",
  "Sm",
  "Eu",
  "Gd",
  "Tb",
  "Dy",
  "Ho",
  "Er",
  "Tm",
  "Yb",
  "Lu",
  "Hf",
  "Ta",
  "W",
  "Re",
  "Os",
  "Ir",
  "Pt",
  "Au",
  "Hg",
  "Tl",
  "Pb",
  "Bi",
  "Po",
  "At",
  "Rn",
  "Fr",
  "Ra",
  "Ac",
  "Th",
  "Pa",
  "U",
  "Np",
  "Pu",
  "Am",
  "Cm",
  "Bk",
  "Cf",
  "Es",
  "Fm",
  "Md",
  "No",
  "Lr",
  "Rf",
  "Db",
  "Sg",
  "Bh",
  "Hs",
  "Mt",
  "Ds",
  "Rg",
  "Cn",
  "Nh",
  "Fl",
  "Mc",
  "Lv",
  "Ts",
  "Og",
];

const elementColors = {
  H: 0xf8fafc,
  C: 0x111827,
  N: 0x2563eb,
  O: 0xdc2626,
  F: 0x14b8a6,
  P: 0xf59e0b,
  S: 0xfacc15,
  Cl: 0x22c55e,
  Br: 0xfb923c,
  I: 0xa855f7,
  Cu: 0xb45309,
  Fe: 0xdc2626,
  Zn: 0x71717a,
  Na: 0x60a5fa,
  K: 0x7c3aed,
  Ca: 0x9ca3af,
  Mg: 0x34d399,
  Si: 0x94a3b8,
};

const palette = [
  "#c95c3a",
  "#2563eb",
  "#14b8a6",
  "#a855f7",
  "#f59e0b",
  "#16a34a",
  "#ef4444",
  "#0ea5e9",
  "#7c3aed",
];

const state = {
  datasets: [],
  viewers: new Map(),
  unit: "hartree",
  syncEnabled: false,
};

const fileInput = document.getElementById("file-input");
const fileMeta = document.getElementById("file-meta");
const statFiles = document.getElementById("stat-files");
const statSteps = document.getElementById("stat-steps");
const statAtoms = document.getElementById("stat-atoms");
const unitHartree = document.getElementById("unit-hartree");
const unitKcal = document.getElementById("unit-kcal");
const viewerGrid = document.getElementById("viewer-grid");
const syncToggle = document.getElementById("sync-toggle");
const syncSlider = document.getElementById("sync-slider");
const syncStepLabel = document.getElementById("sync-step");

function extractRoute(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith("#")) {
      const routeLines = [line];
      for (let j = i + 1; j < lines.length; j += 1) {
        const next = lines[j];
        if (!next.trim()) break;
        routeLines.push(next.trim());
      }
      return routeLines.join(" ");
    }
  }
  return null;
}

function extractMethodFromScf(lines) {
  for (const line of lines) {
    if (line.includes("SCF Done:")) {
      const match = line.match(/SCF Done:\s+E\(([^\)]+)\)/);
      if (match) {
        return match[1].replace(/^(R|U|RO)/, "");
      }
    }
  }
  return null;
}

function extractGenBasis(lines) {
  const basisMap = new Map();
  const elementHeader = /^([A-Z][a-z]?)\s+0\b/;
  const basisName = /^[A-Za-z][A-Za-z0-9+\-()]*$/;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const match = line.match(elementHeader);
    if (!match) continue;
    const element = match[1];
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j += 1) {
      const candidate = lines[j].trim();
      if (!candidate || candidate === "****") continue;
      if (basisName.test(candidate) && candidate !== element) {
        if (!basisMap.has(element)) basisMap.set(element, candidate);
        break;
      }
    }
  }

  if (!basisMap.size) return null;

  const grouped = new Map();
  basisMap.forEach((basis, element) => {
    const list = grouped.get(basis) ?? [];
    list.push(element);
    grouped.set(basis, list);
  });

  return Array.from(grouped.entries())
    .map(([basis, elements]) => `${basis}: ${elements.sort().join(",")}`)
    .join("; ");
}

function extractMethodBasis(text) {
  const lines = text.split(/\r?\n/);
  const route = extractRoute(lines);
  let method = null;
  let basis = null;

  if (route) {
    const match = route.match(/([A-Za-z0-9]+)\s*\/\s*([A-Za-z0-9+\-()]+|genecp|gen)/i);
    if (match) {
      method = match[1].toUpperCase();
      basis = match[2];
    }
  }

  if (basis && /genecp|gen/i.test(basis)) {
    const genBasis = extractGenBasis(lines);
    basis = genBasis || "GEN (custom)";
  }

  if (!method) {
    method = extractMethodFromScf(lines);
  }

  return {
    method: method || "n/a",
    basis: basis || "n/a",
    route: route || "",
  };
}

function parseGaussian(text) {
  const lines = text.split(/\r?\n/);
  const structures = [];
  const energies = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.includes("SCF Done:")) {
      const match = line.match(/SCF Done:\s+E\([^\)]+\)\s+=\s+(-?\d+\.\d+)/);
      if (match) energies.push(parseFloat(match[1]));
    }

    if (line.includes("Standard orientation:")) {
      while (i < lines.length && lines[i].indexOf("---") === -1) i++;
      i++;
      while (i < lines.length && lines[i].indexOf("---") === -1) i++;
      i++;

      const atoms = [];
      for (; i < lines.length; i++) {
        const row = lines[i];
        if (row.indexOf("---") !== -1) break;
        const parts = row.trim().split(/\s+/);
        if (parts.length >= 6) {
          const atomicNumber = parseInt(parts[1], 10);
          const symbol = elementSymbols[atomicNumber] || "X";
          atoms.push({
            symbol,
            x: parseFloat(parts[3]),
            y: parseFloat(parts[4]),
            z: parseFloat(parts[5]),
          });
        }
      }
      if (atoms.length) structures.push({ atoms });
    }
    i++;
  }

  return { structures, energies };
}

function buildSteps(structures, energies) {
  const steps = structures.map((structure, index) => ({
    ...structure,
    energy: energies[index] ?? null,
    index,
  }));

  let lastEnergy = null;
  const energySeries = steps.map((step) => {
    if (step.energy !== null) lastEnergy = step.energy;
    return step.energy ?? lastEnergy;
  });

  return {
    steps,
    energies,
    energySeries,
  };
}

function toXYZ(atoms, label) {
  const header = `${atoms.length}\n${label}`;
  const body = atoms.map((atom) => `${atom.symbol} ${atom.x} ${atom.y} ${atom.z}`).join("\n");
  return `${header}\n${body}`;
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function createId() {
  return `ds-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function updateStats() {
  statFiles.textContent = state.datasets.length.toString();
  const maxSteps = state.datasets.reduce((max, ds) => Math.max(max, ds.steps.length), 0);
  const maxAtoms = state.datasets.reduce(
    (max, ds) => Math.max(max, ds.steps[0]?.atoms.length ?? 0),
    0
  );
  statSteps.textContent = maxSteps ? maxSteps.toString() : "-";
  statAtoms.textContent = maxAtoms ? maxAtoms.toString() : "-";
}

function updateUnitButtons(unit) {
  state.unit = unit;
  unitHartree.classList.toggle("active", unit === "hartree");
  unitKcal.classList.toggle("active", unit === "kcal");
  state.viewers.forEach((viewState, id) => {
    const dataset = state.datasets.find((ds) => ds.id === id);
    if (dataset) {
      drawChart(viewState.chart, dataset, viewState.currentStep);
    }
  });
}

function updateSyncControls() {
  const maxSteps = state.datasets.reduce((max, ds) => Math.max(max, ds.steps.length), 0);
  syncSlider.max = Math.max(maxSteps - 1, 0).toString();
  syncSlider.disabled = !state.syncEnabled || maxSteps <= 1;
  syncStepLabel.textContent = state.syncEnabled
    ? `Step ${parseInt(syncSlider.value, 10) + 1}`
    : "-";
}

function applySyncStep(stepIndex) {
  syncSlider.value = stepIndex.toString();
  syncStepLabel.textContent = `Step ${stepIndex + 1}`;
  state.viewers.forEach((viewState, id) => {
    const dataset = state.datasets.find((ds) => ds.id === id);
    if (!dataset) return;
    const clamped = Math.min(stepIndex, dataset.steps.length - 1);
    renderStep(dataset, viewState, clamped);
  });
}

function createViewerCard(dataset) {
  const card = document.createElement("div");
  card.className = "viewer-card";
  card.dataset.id = dataset.id;

  const methodBasis = `Method: ${dataset.method} | Basis: ${dataset.basis}`;
  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">
        <span class="color-dot" style="background:${dataset.color}"></span>
        <div class="file-info">
          <div class="file-name">${dataset.name}</div>
          <div class="file-meta">Steps: ${dataset.steps.length} • Atoms: ${dataset.steps[0]?.atoms.length ?? 0}</div>
          <div class="file-method" title="${methodBasis}">${methodBasis}</div>
        </div>
      </div>
      <button class="remove-btn" type="button">Remove</button>
    </div>
    <div class="viewer" id="viewer-${dataset.id}"></div>
    <div class="card-controls">
      <input class="step-slider" type="range" min="0" max="${Math.max(
        dataset.steps.length - 1,
        0
      )}" value="0" />
      <div class="step-meta">
        <div class="step-label">Step 1</div>
        <div class="energy-label">Energy: -</div>
      </div>
    </div>
    <canvas class="chart-canvas"></canvas>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Step</th>
            <th>Energy (Hartree)</th>
            <th>Delta (kcal/mol)</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  viewerGrid.appendChild(card);

  const viewerEl = card.querySelector(".viewer");
  const slider = card.querySelector(".step-slider");
  const stepLabel = card.querySelector(".step-label");
  const energyLabel = card.querySelector(".energy-label");
  const chart = card.querySelector(".chart-canvas");
  const tableBody = card.querySelector("tbody");
  const removeBtn = card.querySelector(".remove-btn");

  const viewer = $3Dmol.createViewer(viewerEl, { backgroundColor: "#f8f6f2" });

  const viewState = {
    viewer,
    slider,
    stepLabel,
    energyLabel,
    chart,
    tableBody,
    currentStep: 0,
    rows: [],
  };

  slider.addEventListener("input", () => {
    if (state.syncEnabled) return;
    renderStep(dataset, viewState, parseInt(slider.value, 10));
  });

  chart.addEventListener("click", (event) => {
    const targetStep = chartClickToStep(dataset, chart, event);
    if (targetStep === null) return;
    if (state.syncEnabled) {
      applySyncStep(targetStep);
    } else {
      renderStep(dataset, viewState, targetStep);
    }
  });

  removeBtn.addEventListener("click", () => {
    removeDataset(dataset.id);
  });

  buildTable(dataset, viewState);
  renderStep(dataset, viewState, 0);
  resizeChart(chart);
  drawChart(chart, dataset, 0);

  state.viewers.set(dataset.id, viewState);
}

function removeDataset(id) {
  state.datasets = state.datasets.filter((ds) => ds.id !== id);
  const viewState = state.viewers.get(id);
  if (viewState) {
    viewState.viewer?.clear();
    state.viewers.delete(id);
  }
  const card = viewerGrid.querySelector(`[data-id="${id}"]`);
  if (card) card.remove();
  updateStats();
  updateSyncControls();
  if (state.syncEnabled) {
    applySyncStep(parseInt(syncSlider.value, 10) || 0);
  }
}

function buildTable(dataset, viewState) {
  viewState.tableBody.innerHTML = "";
  viewState.rows = [];
  dataset.steps.forEach((step, index) => {
    const row = document.createElement("tr");
    const delta = step.energy !== null ? (step.energy - dataset.minEnergy) * 627.5095 : null;
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${step.energy !== null ? step.energy.toFixed(6) : "-"}</td>
      <td>${delta !== null ? delta.toFixed(3) : "-"}</td>
    `;
    row.addEventListener("click", () => {
      if (state.syncEnabled) {
        applySyncStep(index);
      } else {
        renderStep(dataset, viewState, index);
      }
    });
    viewState.tableBody.appendChild(row);
    viewState.rows.push(row);
  });
}

function highlightRow(viewState, index) {
  viewState.rows.forEach((row) => row.classList.remove("active"));
  const active = viewState.rows[index];
  if (active) active.classList.add("active");
}

function renderStep(dataset, viewState, index) {
  const safeIndex = Math.max(0, Math.min(index, dataset.steps.length - 1));
  viewState.currentStep = safeIndex;
  viewState.slider.value = safeIndex.toString();
  const step = dataset.steps[safeIndex];
  viewState.stepLabel.textContent = `Step ${safeIndex + 1}`;
  viewState.energyLabel.textContent =
    step.energy !== null
      ? `Energy: ${step.energy.toFixed(6)} Hartree`
      : "Energy: n/a";

  viewState.viewer.clear();
  const xyz = toXYZ(step.atoms, `Step ${safeIndex + 1}`);
  viewState.viewer.addModel(xyz, "xyz");
  viewState.viewer.setStyle(
    {},
    {
      stick: { radius: 0.1, color: 0x6b7280 },
      sphere: { scale: 0.3, colorscheme: "Jmol" },
    }
  );
  viewState.viewer.addStyle(
    { elem: "C" },
    { sphere: { scale: 0.3, color: 0x111827 } }
  );
  viewState.viewer.zoomTo();
  viewState.viewer.render();

  highlightRow(viewState, safeIndex);
  drawChart(viewState.chart, dataset, safeIndex);
}

function resizeChart(canvas) {
  const scale = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
}

function drawChart(canvas, dataset, currentStep) {
  if (!canvas) return;
  resizeChart(canvas);
  const ctx = canvas.getContext("2d");
  const width = canvas.width / (window.devicePixelRatio || 1);
  const height = canvas.height / (window.devicePixelRatio || 1);
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (!dataset.energies.length) return;

  const padding = 28;
  const values = dataset.energySeries.map((energy) => {
    if (state.unit === "kcal") {
      return (energy - dataset.minEnergy) * 627.5095;
    }
    return energy;
  });

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = maxVal - minVal || 1;

  ctx.strokeStyle = "#d6c7b7";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  ctx.strokeStyle = dataset.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x =
      padding + (index / (values.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - ((value - minVal) / span) * (height - padding * 2);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const markerIndex = Math.min(currentStep, values.length - 1);
  const markerX =
    padding + (markerIndex / (values.length - 1 || 1)) * (width - padding * 2);
  ctx.strokeStyle = "#1e1d1b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(markerX, padding);
  ctx.lineTo(markerX, height - padding);
  ctx.stroke();
}

function chartClickToStep(dataset, canvas, event) {
  if (!dataset.steps.length) return null;
  const rect = canvas.getBoundingClientRect();
  const padding = 28;
  const x = event.clientX - rect.left;
  const clamped = Math.max(padding, Math.min(rect.width - padding, x));
  const ratio = (clamped - padding) / (rect.width - padding * 2);
  return Math.round(ratio * (dataset.steps.length - 1));
}

async function handleFiles(files) {
  const list = Array.from(files || []);
  if (!list.length) return;
  fileMeta.textContent = `${list.length} files selected`;

  for (const file of list) {
    try {
      const text = await readFile(file);
      const { structures, energies } = parseGaussian(text);
      const { steps, energies: trimmed, energySeries } = buildSteps(structures, energies);
      if (!steps.length) continue;
      const meta = extractMethodBasis(text);
      const dataset = {
        id: createId(),
        name: file.name,
        steps,
        energies: trimmed,
        energySeries,
        minEnergy: trimmed.length ? Math.min(...trimmed) : 0,
        color: palette[state.datasets.length % palette.length],
        method: meta.method,
        basis: meta.basis,
      };
      state.datasets.push(dataset);
      createViewerCard(dataset);
    } catch (error) {
      fileMeta.textContent = `Failed to read ${file.name}`;
    }
  }

  updateStats();
  updateSyncControls();
  if (state.syncEnabled) {
    applySyncStep(parseInt(syncSlider.value, 10) || 0);
  }
}

function handleSyncToggle() {
  state.syncEnabled = syncToggle.checked;
  updateSyncControls();
  if (state.syncEnabled && state.datasets.length) {
    const firstId = state.datasets[0].id;
    const viewState = state.viewers.get(firstId);
    const step = viewState?.currentStep ?? 0;
    applySyncStep(step);
  }
}

fileInput.addEventListener("change", (event) => handleFiles(event.target.files));
unitHartree.addEventListener("click", () => updateUnitButtons("hartree"));
unitKcal.addEventListener("click", () => updateUnitButtons("kcal"));
syncToggle.addEventListener("change", handleSyncToggle);
syncSlider.addEventListener("input", () => {
  if (!state.syncEnabled) return;
  applySyncStep(parseInt(syncSlider.value, 10));
});

window.addEventListener("resize", () => {
  state.viewers.forEach((viewState, id) => {
    const dataset = state.datasets.find((ds) => ds.id === id);
    if (!dataset) return;
    drawChart(viewState.chart, dataset, viewState.currentStep);
  });
});

updateStats();
updateUnitButtons("hartree");
