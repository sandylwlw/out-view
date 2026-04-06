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

const covalentRadii = {
  H: 0.31,
  C: 0.76,
  N: 0.71,
  O: 0.66,
  F: 0.57,
  P: 1.07,
  S: 1.05,
  Cl: 1.02,
  Br: 1.2,
  I: 1.39,
  Cu: 1.32,
  Fe: 1.24,
  Zn: 1.22,
  Na: 1.66,
  K: 2.03,
  Ca: 1.76,
  Mg: 1.41,
  Si: 1.11,
};

const state = {
  steps: [],
  energies: [],
  energySeries: [],
  minEnergy: null,
  viewer: null,
  current: 0,
  playing: false,
  timer: null,
  unit: "hartree",
};

const fileInput = document.getElementById("file-input");
const fileMeta = document.getElementById("file-meta");
const stepSlider = document.getElementById("step-slider");
const stepLabel = document.getElementById("step-label");
const energyLabel = document.getElementById("energy-label");
const energyTable = document.getElementById("energy-table");
const statSteps = document.getElementById("stat-steps");
const statAtoms = document.getElementById("stat-atoms");
const statRange = document.getElementById("stat-range");
const playBtn = document.getElementById("play-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const speedInput = document.getElementById("speed");
const downloadBtn = document.getElementById("download-btn");
const unitHartree = document.getElementById("unit-hartree");
const unitKcal = document.getElementById("unit-kcal");
const chartCanvas = document.getElementById("energy-chart");
const ctx = chartCanvas.getContext("2d");

function initViewer() {
  state.viewer = $3Dmol.createViewer("viewer", {
    backgroundColor: "#f8f6f2",
  });
  state.viewer.render();
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
  const body = atoms
    .map((atom) => `${atom.symbol} ${atom.x} ${atom.y} ${atom.z}`)
    .join("\n");
  return `${header}\n${body}`;
}

function setStep(index) {
  if (!state.steps.length) return;
  const safeIndex = Math.max(0, Math.min(index, state.steps.length - 1));
  state.current = safeIndex;
  stepSlider.value = safeIndex;

  const step = state.steps[safeIndex];
  const label = `Step ${safeIndex + 1}`;
  stepLabel.textContent = label;
  energyLabel.textContent =
    step.energy !== null
      ? `Energy: ${step.energy.toFixed(6)} Hartree`
      : "Energy: n/a";

  state.viewer.clear();
  const xyz = toXYZ(step.atoms, label);
  const model = state.viewer.addModel(xyz, "xyz");
  const baseScale = 0.3;
  state.viewer.setStyle(
    {},
    {
      stick: { radius: 0.1, color: 0x6b7280 },
      sphere: { scale: baseScale, colorscheme: "Jmol" },
    }
  );
  state.viewer.addStyle(
    { elem: "C" },
    { sphere: { scale: baseScale, color: 0x111827 } }
  );
  state.viewer.zoomTo();
  state.viewer.render();

  highlightRow(safeIndex);
  drawChart();
}

function highlightRow(index) {
  const rows = energyTable.querySelectorAll("tr");
  rows.forEach((row) => row.classList.remove("active"));
  const active = rows[index];
  if (active) active.classList.add("active");
}

function updateStats() {
  statSteps.textContent = state.steps.length.toString();
  statAtoms.textContent = state.steps[0]?.atoms.length?.toString() ?? "-";

  if (!state.energies.length) {
    statRange.textContent = "-";
    return;
  }
  const min = Math.min(...state.energies);
  const max = Math.max(...state.energies);
  statRange.textContent = `${(max - min).toFixed(6)} Hartree`;
}

function buildTable() {
  energyTable.innerHTML = "";
  const minEnergy = state.minEnergy;
  state.steps.forEach((step, index) => {
    const row = document.createElement("tr");
    const delta = step.energy !== null ? (step.energy - minEnergy) * 627.5095 : null;
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${step.energy !== null ? step.energy.toFixed(6) : "-"}</td>
      <td>${delta !== null ? delta.toFixed(3) : "-"}</td>
    `;
    row.addEventListener("click", () => setStep(index));
    energyTable.appendChild(row);
  });
}

function drawChart() {
  const width = chartCanvas.clientWidth || chartCanvas.width;
  const height = chartCanvas.clientHeight || chartCanvas.height;
  ctx.clearRect(0, 0, width, height);

  if (!state.energies.length) return;

  const padding = 36;
  const values = state.energySeries.map((energy) => {
    if (state.unit === "kcal") {
      return (energy - state.minEnergy) * 627.5095;
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

  ctx.strokeStyle = "#c95c3a";
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

  const currentIndex = Math.min(state.current, values.length - 1);
  const currentX =
    padding + (currentIndex / (values.length - 1 || 1)) * (width - padding * 2);
  ctx.strokeStyle = "#1e1d1b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(currentX, padding);
  ctx.lineTo(currentX, height - padding);
  ctx.stroke();

  ctx.fillStyle = "#1e1d1b";
  ctx.font = "12px Space Grotesk";
  ctx.fillText(
    state.unit === "kcal" ? "kcal/mol" : "Hartree",
    padding,
    padding - 10
  );
}

function updateUnits(unit) {
  state.unit = unit;
  unitHartree.classList.toggle("active", unit === "hartree");
  unitKcal.classList.toggle("active", unit === "kcal");
  drawChart();
}

function togglePlay() {
  if (!state.steps.length) return;
  if (state.playing) {
    stopPlay();
  } else {
    startPlay();
  }
}

function startPlay() {
  state.playing = true;
  playBtn.textContent = "Pause";
  const speed = parseInt(speedInput.value, 10);
  const interval = Math.max(150, 1200 / speed);
  state.timer = setInterval(() => {
    const next = (state.current + 1) % state.steps.length;
    setStep(next);
  }, interval);
}

function stopPlay() {
  state.playing = false;
  playBtn.textContent = "Play";
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

function refreshPlaybackSpeed() {
  if (state.playing) {
    stopPlay();
    startPlay();
  }
}

function handleFile(file) {
  if (!file) return;
  fileMeta.textContent = `${file.name} - ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  const reader = new FileReader();
  reader.onload = () => {
    const { structures, energies } = parseGaussian(reader.result);
    const { steps, energies: trimmed, energySeries } = buildSteps(structures, energies);
    state.steps = steps;
    state.energies = trimmed;
    state.energySeries = energySeries;
    state.minEnergy = trimmed.length ? Math.min(...trimmed) : null;
    stepSlider.max = Math.max(steps.length - 1, 0).toString();
    updateStats();
    buildTable();
    stopPlay();
    setStep(0);
  };
  reader.readAsText(file);
}

function downloadXYZ() {
  if (!state.steps.length) return;
  const step = state.steps[state.current];
  const xyz = toXYZ(step.atoms, `Step ${state.current + 1}`);
  const blob = new Blob([xyz], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `step-${state.current + 1}.xyz`;
  link.click();
  URL.revokeObjectURL(url);
}

fileInput.addEventListener("change", (event) => handleFile(event.target.files[0]));
prevBtn.addEventListener("click", () => setStep(state.current - 1));
nextBtn.addEventListener("click", () => setStep(state.current + 1));
playBtn.addEventListener("click", togglePlay);
speedInput.addEventListener("input", refreshPlaybackSpeed);
downloadBtn.addEventListener("click", downloadXYZ);
unitHartree.addEventListener("click", () => updateUnits("hartree"));
unitKcal.addEventListener("click", () => updateUnits("kcal"));
stepSlider.addEventListener("input", (event) => setStep(parseInt(event.target.value, 10)));
chartCanvas.addEventListener("click", (event) => {
  if (!state.steps.length) return;
  const rect = chartCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const padding = 36;
  const clamped = Math.max(padding, Math.min(rect.width - padding, x));
  const ratio = (clamped - padding) / (rect.width - padding * 2);
  const index = Math.round(ratio * (state.steps.length - 1));
  setStep(index);
});

window.addEventListener("resize", () => {
  const scale = window.devicePixelRatio || 1;
  chartCanvas.width = Math.floor(chartCanvas.clientWidth * scale);
  chartCanvas.height = Math.floor(chartCanvas.clientHeight * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawChart();
});

initViewer();
updateUnits("hartree");
window.dispatchEvent(new Event("resize"));
