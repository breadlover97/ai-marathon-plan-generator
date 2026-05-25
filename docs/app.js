const state = {
  currentStep: 0,
  plan: null,
};

const steps = Array.from(document.querySelectorAll(".step"));
const navItems = Array.from(document.querySelectorAll("[data-step-target]"));
const form = document.querySelector("#intake-form");
const output = document.querySelector("#plan-output");
const summary = document.querySelector("#plan-summary");
const planTable = document.querySelector("#plan-table");
const mileageChart = document.querySelector("#mileage-chart");
const statusBox = document.querySelector("#status-box");
const transferBox = document.querySelector("#sheets-transfer");

const defaults = {
  athleteName: "Tai Zhi",
  raceName: "Standard Chartered Kuala Lumpur Marathon 2026",
  startDate: "2026-05-11",
  raceDate: "2026-10-04",
  goalHours: "2",
  goalMinutes: "50",
  goalSeconds: "00",
  goalDescription: "2h 50m / Top 8 Open",
  currentWeeklyKm: "52",
  longestRecentRunKm: "21",
  paceMinutes: "4",
  paceSeconds: "15",
  runsPerWeek: "5",
  runningAbility: "advanced",
  trainingVolume: "progressive",
  difficulty: "challenging",
  workoutDay: "Monday",
  mediumLongDay: "Wednesday",
  longRunDay: "Saturday",
  maxLongRunKm: "34",
  primaryRisks: "Injury and burnout",
  raceSpecifics: "Heat/humidity + very early start",
  fuelNotes: "Amino Vital AminoShot; refine carb/hr",
  adminNotes: "REPC 1-3 Oct at MITEC",
  constraints: "Protect shins and calves; keep hard workouts controlled in tropical conditions",
  injuryNotes: "Previous shin/calf sensitivity",
};

const chartTooltipSize = {
  width: 172,
  height: 122,
  gap: 12,
};

const stepRequirements = [
  ["raceName", "startDate", "raceDate"],
  ["currentWeeklyKm", "longestRecentRunKm", "runsPerWeek", "runningAbility"],
  ["workoutDay", "mediumLongDay", "longRunDay"],
  ["trainingVolume", "difficulty"],
  [],
  [],
];

function init() {
  form.addEventListener("submit", handleSubmit);
  document.querySelector("#load-example").addEventListener("click", loadExample);
  document.querySelectorAll("[data-reset]").forEach((button) => button.addEventListener("click", resetForm));
  document.querySelector("#copy-sheets").addEventListener("click", copyForSheets);
  document.querySelector("#download-csv").addEventListener("click", downloadCsv);
  document.querySelector("#edit-inputs").addEventListener("click", editInputs);
  document.querySelector("#return-top").addEventListener("click", returnToGeneratedTop);

  for (const button of document.querySelectorAll("[data-next]")) {
    button.addEventListener("click", () => {
      if (validateStep(state.currentStep)) {
        setStep(Math.min(state.currentStep + 1, steps.length - 1));
      }
    });
  }
  for (const button of document.querySelectorAll("[data-prev]")) {
    button.addEventListener("click", () => setStep(Math.max(state.currentStep - 1, 0)));
  }
  for (const item of navItems) {
    item.addEventListener("click", () => {
      const target = Number(item.dataset.stepTarget);
      if (target <= state.currentStep || validateStepsBefore(target)) {
        setStep(target);
      }
    });
  }

  setStep(0);
}

function setStep(index, options = {}) {
  state.currentStep = index;
  steps.forEach((step, stepIndex) => step.toggleAttribute("hidden", stepIndex !== index));
  navItems.forEach((item, itemIndex) => item.classList.toggle("is-active", itemIndex === index));
  if (!options.preserveHighlights) clearFieldHighlights();
  if (index === 5) renderReview();
}

function loadExample() {
  for (const [key, value] of Object.entries(defaults)) {
    if (form.elements[key]) form.elements[key].value = value;
  }
  setCheckboxes("strengthDays", ["Thursday"]);
  setCheckboxes("restDays", ["Sunday"]);
  setStatus("Example loaded. Review the details, then generate the plan.", "info");
}

function resetForm() {
  if (!window.confirm("Reset the form and clear all inputs? This cannot be undone.")) {
    return;
  }
  form.reset();
  clearFieldHighlights();
  state.plan = null;
  output.hidden = true;
  transferBox.hidden = true;
  transferBox.value = "";
  setStep(0);
  setStatus("Form reset.", "info");
}

function setCheckboxes(name, selected) {
  for (const input of form.querySelectorAll(`input[name="${name}"]`)) {
    input.checked = selected.includes(input.value);
  }
}

function handleSubmit(event) {
  event.preventDefault();
  const profile = collectProfile();
  const plan = MarathonEngine.buildTrainingPlan(profile);
  state.plan = plan;

  if (plan.validation.errors.length) {
    setStatus(plan.validation.errors.join(" "), "error");
    output.hidden = true;
    return;
  }

  setStatus(plan.validation.warnings.length ? plan.validation.warnings.join(" ") : "Plan generated.", plan.validation.warnings.length ? "warning" : "success");
  renderSummary(plan);
  renderMileageChart(plan);
  renderPlan(plan);
  transferBox.hidden = true;
  transferBox.value = "";
  output.hidden = false;
  output.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editInputs() {
  output.hidden = true;
  transferBox.hidden = true;
  transferBox.value = "";
  setStep(0);
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  setStatus("You can edit the inputs now. Generate again when ready.", "info");
}

function returnToGeneratedTop() {
  output.scrollIntoView({ behavior: "smooth", block: "start" });
}

function collectProfile() {
  const data = new FormData(form);
  return {
    athleteName: clean(data.get("athleteName")),
    raceName: clean(data.get("raceName")),
    startDate: data.get("startDate"),
    raceDate: data.get("raceDate"),
    goalTime: composeTime(data.get("goalHours"), data.get("goalMinutes"), data.get("goalSeconds")),
    goalDescription: clean(data.get("goalDescription")) || "Finish strong",
    currentWeeklyKm: Number(data.get("currentWeeklyKm")),
    longestRecentRunKm: Number(data.get("longestRecentRunKm")),
    currentMarathonPace: composePace(data.get("paceMinutes"), data.get("paceSeconds")),
    runsPerWeek: Number(data.get("runsPerWeek")),
    runningAbility: data.get("runningAbility"),
    trainingVolume: data.get("trainingVolume"),
    difficulty: data.get("difficulty"),
    workoutDay: data.get("workoutDay"),
    mediumLongDay: data.get("mediumLongDay"),
    longRunDay: data.get("longRunDay"),
    strengthDays: data.getAll("strengthDays"),
    restDays: data.getAll("restDays"),
    maxLongRunKm: Number(data.get("maxLongRunKm")) || null,
    primaryRisks: clean(data.get("primaryRisks")),
    raceSpecifics: clean(data.get("raceSpecifics")),
    fuelNotes: clean(data.get("fuelNotes")),
    adminNotes: clean(data.get("adminNotes")),
    constraints: clean(data.get("constraints")),
    injuryNotes: clean(data.get("injuryNotes")),
  };
}

function clean(value) {
  return String(value || "").trim();
}

function composeTime(hours, minutes, seconds) {
  const hasAnyValue = [hours, minutes, seconds].some((value) => clean(value) !== "");
  if (!hasAnyValue) return "";
  const safeHours = clampNumber(hours, 0, 99);
  const safeMinutes = clampNumber(minutes, 0, 59);
  const safeSeconds = clampNumber(seconds, 0, 59);
  return `${String(safeHours).padStart(2, "0")}:${String(safeMinutes).padStart(2, "0")}:${String(safeSeconds).padStart(2, "0")}`;
}

function composePace(minutes, seconds) {
  const hasAnyValue = [minutes, seconds].some((value) => clean(value) !== "");
  if (!hasAnyValue) return "";
  const safeMinutes = clampNumber(minutes, 0, 59);
  const safeSeconds = clampNumber(seconds, 0, 59);
  return `${String(safeMinutes).padStart(2, "0")}:${String(safeSeconds).padStart(2, "0")}`;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(Math.max(Math.trunc(number), min), max);
}

function validateStep(stepIndex) {
  const missing = stepRequirements[stepIndex]
    .map((name) => form.elements[name])
    .filter((field) => !clean(field.value));

  clearFieldHighlights();
  if (missing.length) {
    for (const field of missing) markInvalid(field);
    missing[0].focus();
    setStatus("Please complete the required fields on this step before continuing.", "error");
    return false;
  }

  if (stepIndex === 0 && form.elements.startDate.value && form.elements.raceDate.value) {
    const start = new Date(`${form.elements.startDate.value}T00:00:00Z`);
    const race = new Date(`${form.elements.raceDate.value}T00:00:00Z`);
    if (race < start) {
      markInvalid(form.elements.raceDate);
      setStatus("Race date must be after the plan start date.", "error");
      return false;
    }
  }

  if (stepIndex === 2) {
    const conflicts = scheduleConflicts();
    if (conflicts.length) {
      setStatus(conflicts.join(" "), "error");
      return false;
    }
  }

  setStatus("Looks good. Keep going.", "success");
  return true;
}

function validateStepsBefore(targetStep) {
  for (let index = 0; index < targetStep; index += 1) {
    if (!validateStep(index)) {
      setStep(index, { preserveHighlights: true });
      return false;
    }
  }
  return true;
}

function scheduleConflicts() {
  const workout = form.elements.workoutDay.value;
  const medium = form.elements.mediumLongDay.value;
  const long = form.elements.longRunDay.value;
  const strength = new Set(new FormData(form).getAll("strengthDays"));
  const rest = new Set(new FormData(form).getAll("restDays"));
  const messages = [];
  const keyDays = [
    ["Workout day", workout],
    ["Medium-long day", medium],
    ["Long-run day", long],
  ];
  const dayCounts = keyDays.reduce((map, [, day]) => map.set(day, (map.get(day) || 0) + 1), new Map());
  const duplicate = [...dayCounts.entries()].find(([day, count]) => day && count > 1);
  if (duplicate) messages.push("Workout, medium-long, and long-run days must be different.");
  for (const [label, day] of keyDays) {
    if (rest.has(day)) messages.push(`${label} cannot also be a rest day.`);
    if (strength.has(day)) messages.push(`${label} cannot also be a strength-only day.`);
  }
  return messages;
}

function markInvalid(field) {
  field.classList.add("is-invalid");
  field.closest("label")?.classList.add("has-error");
}

function clearFieldHighlights() {
  form.querySelectorAll(".is-invalid").forEach((field) => field.classList.remove("is-invalid"));
  form.querySelectorAll(".has-error").forEach((label) => label.classList.remove("has-error"));
}

function renderReview() {
  const profile = collectProfile();
  const reviewPanel = document.querySelector("#review-summary");
  if (!reviewPanel) return;
  const rows = [
    ["Race", profile.raceName || "Missing"],
    ["Dates", profile.startDate && profile.raceDate ? `${profile.startDate} to ${profile.raceDate}` : "Missing"],
    ["Current running", profile.currentWeeklyKm && profile.longestRecentRunKm ? `${profile.currentWeeklyKm} km/week, ${profile.longestRecentRunKm} km long run` : "Missing"],
    ["Schedule", profile.workoutDay && profile.mediumLongDay && profile.longRunDay ? `Workout ${profile.workoutDay}, medium-long ${profile.mediumLongDay}, long run ${profile.longRunDay}` : "Missing"],
    ["Training style", profile.trainingVolume && profile.difficulty ? `${profile.trainingVolume}, ${profile.difficulty}` : "Missing"],
  ];
  reviewPanel.innerHTML = rows.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function renderSummary(plan) {
  const items = [
    ["Plan length", `${plan.summary.totalWeeks} weeks`],
    ["Start volume", `${plan.summary.startKm} km`],
    ["Peak volume", `${plan.summary.peakKm} km`],
    ["Goal pace", plan.goalPacePerKm || "RPE-based"],
    ["Runs/week", plan.profile.runsPerWeek],
    ["Long run", plan.profile.longRunDay],
    ["Export", "Copy table into Google Sheets or download CSV"],
  ];
  summary.innerHTML = items.map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function renderPlan(plan) {
  planTable.innerHTML = plan.weeks
    .map(
      (week) => `
        <article class="week-card">
          <header class="week-header">
            <div>
              <span class="eyebrow">Week ${week.weekNumber} · ${week.dateRange}</span>
              <h3>${week.phase}</h3>
            </div>
            <strong>${week.targetKm} km</strong>
          </header>
          <div class="week-grid">
            ${week.sessions
              .map(
                (session) => `
                  <div class="session">
                    <div class="session-top">
                      <span>${session.day.slice(0, 3)}</span>
                      <strong>${session.plannedKm} km</strong>
                    </div>
                    <b>${session.sessionType}</b>
                    <p>${session.plan}</p>
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      `
    )
    .join("");
}

function renderMileageChart(plan) {
  const weeks = plan.weeks;
  if (!weeks.length) {
    mileageChart.innerHTML = "";
    return;
  }

  const width = 920;
  const height = 300;
  const margin = { top: 28, right: 28, bottom: 42, left: 54 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const baseline = height - margin.bottom;
  const weeklyValues = weeks.map((week) => Number(week.targetKm || 0));
  const longRunValues = weeks.map((week) => longRunKm(week));
  const maxValue = niceChartMax(Math.max(...weeklyValues, ...longRunValues, 10));
  const step = plotWidth / weeks.length;
  const barWidth = Math.max(10, step * 0.56);

  const phaseBands = phaseRanges(weeks)
    .map((range) => {
      const x = margin.left + range.start * step;
      const w = (range.end - range.start + 1) * step;
      return `<rect class="chart-phase-band ${phaseClass(range.phase)}" x="${x.toFixed(1)}" y="${margin.top}" width="${w.toFixed(1)}" height="${plotHeight}"></rect>`;
    })
    .join("");

  const bars = weeks
    .map((week, index) => {
      const value = weeklyValues[index];
      const barHeight = (value / maxValue) * plotHeight;
      const x = margin.left + index * step + (step - barWidth) / 2;
      const y = baseline - barHeight;
      const label = index % Math.ceil(weeks.length / 8) === 0 || index === weeks.length - 1 ? `<text class="chart-label" x="${(x + barWidth / 2).toFixed(1)}" y="${height - 15}" text-anchor="middle">W${week.weekNumber}</text>` : "";
      return `
        <g>
          <rect class="chart-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}">
            <title>Week ${week.weekNumber}: ${value} km total</title>
          </rect>
          ${label}
        </g>
      `;
    })
    .join("");

  const longRunPoints = weeks.map((week, index) => {
    const value = longRunValues[index];
    const x = margin.left + index * step + step / 2;
    const y = baseline - (value / maxValue) * plotHeight;
    return { x, y, value, week };
  });
  const longRunPath = longRunPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const longRunDots = longRunPoints
    .filter((_, index) => index % Math.ceil(weeks.length / 7) === 0 || index === weeks.length - 1)
    .map((point) => `<circle class="chart-dot" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4"><title>Week ${point.week.weekNumber}: ${point.value} km long run</title></circle>`)
    .join("");
  const hoverPoints = longRunPoints.map((point, index) => ({
    ...point,
    label: `Week ${point.week.weekNumber}`,
    dateRange: point.week.dateRange,
    phase: point.week.phase,
    totalKm: weeklyValues[index],
    longRunKm: point.value,
  }));

  mileageChart.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Weekly planned mileage chart">
      ${phaseBands}
      <line class="chart-grid" x1="${margin.left}" y1="${margin.top}" x2="${width - margin.right}" y2="${margin.top}"></line>
      <line class="chart-grid" x1="${margin.left}" y1="${margin.top + plotHeight / 2}" x2="${width - margin.right}" y2="${margin.top + plotHeight / 2}"></line>
      <line class="chart-axis" x1="${margin.left}" y1="${baseline}" x2="${width - margin.right}" y2="${baseline}"></line>
      <line class="chart-axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${baseline}"></line>
      <text class="chart-label" x="6" y="${margin.top + 4}">${maxValue} km</text>
      <text class="chart-label" x="6" y="${margin.top + plotHeight / 2 + 4}">${Math.round(maxValue / 2)} km</text>
      ${bars}
      <path class="chart-line" d="${longRunPath}"></path>
      ${longRunDots}
      ${chartHoverMarkup(margin.left, margin.top, plotWidth, plotHeight, baseline)}
    </svg>
  `;
  setupMileageChartHover(mileageChart, hoverPoints, {
    width,
    height,
    left: margin.left,
    right: margin.right,
    top: margin.top,
    baseline,
    plotWidth,
    plotHeight,
  });
}

function chartHoverMarkup(left, top, plotWidth, plotHeight, baseline) {
  return `
    <g class="chart-hover" data-hover>
      <line class="chart-crosshair" data-hover-v x1="${left}" y1="${top}" x2="${left}" y2="${baseline}"></line>
      <line class="chart-crosshair chart-crosshair-horizontal" data-hover-h x1="${left}" y1="${top}" x2="${left + plotWidth}" y2="${top}"></line>
      <circle class="chart-hover-dot" data-hover-dot cx="${left}" cy="${top}" r="5"></circle>
      <g class="chart-tooltip" data-hover-tip>
        <rect class="chart-tooltip-bg" width="${chartTooltipSize.width}" height="${chartTooltipSize.height}" rx="10"></rect>
        <text class="chart-tooltip-title" data-hover-week x="14" y="20"></text>
        <text class="chart-tooltip-date" data-hover-date x="14" y="38"></text>
        <line class="chart-tooltip-divider" x1="14" y1="52" x2="${chartTooltipSize.width - 14}" y2="52"></line>
        <text class="chart-tooltip-label" x="14" y="70">Phase</text>
        <text class="chart-tooltip-phase" data-hover-phase x="${chartTooltipSize.width - 14}" y="70" text-anchor="end"></text>
        <circle class="tooltip-marker total" cx="18" cy="91" r="4"></circle>
        <text class="chart-tooltip-label" x="32" y="91">Mileage</text>
        <text class="chart-tooltip-total" data-hover-total x="${chartTooltipSize.width - 14}" y="91" text-anchor="end"></text>
        <circle class="tooltip-marker long-run" cx="18" cy="109" r="4"></circle>
        <text class="chart-tooltip-label" x="32" y="109">Long run</text>
        <text class="chart-tooltip-long-run" data-hover-long-run x="${chartTooltipSize.width - 14}" y="109" text-anchor="end"></text>
      </g>
    </g>
    <rect class="chart-hit-area" x="${left}" y="${top}" width="${plotWidth}" height="${plotHeight}"></rect>
  `;
}

function setupMileageChartHover(container, points, dims) {
  const svg = container.querySelector("svg");
  const hitArea = container.querySelector(".chart-hit-area");
  const hover = container.querySelector("[data-hover]");
  if (!svg || !hitArea || !hover || !points.length) return;

  const vLine = container.querySelector("[data-hover-v]");
  const hLine = container.querySelector("[data-hover-h]");
  const dot = container.querySelector("[data-hover-dot]");
  const tip = container.querySelector("[data-hover-tip]");
  const weekText = container.querySelector("[data-hover-week]");
  const dateText = container.querySelector("[data-hover-date]");
  const phaseText = container.querySelector("[data-hover-phase]");
  const totalText = container.querySelector("[data-hover-total]");
  const longRunText = container.querySelector("[data-hover-long-run]");

  const nearestPoint = (x) => points.reduce((best, point) => {
    return Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best;
  }, points[0]);

  const moveCrosshair = (event) => {
    const screenMatrix = svg.getScreenCTM();
    if (!screenMatrix) return;
    const svgPoint = svg.createSVGPoint();
    svgPoint.x = event.clientX;
    svgPoint.y = event.clientY;
    const transformed = svgPoint.matrixTransform(screenMatrix.inverse());
    const x = Math.min(Math.max(transformed.x, dims.left), dims.left + dims.plotWidth);
    const point = nearestPoint(x);
    const preferredTooltipX = x > dims.width - dims.right - chartTooltipSize.width - chartTooltipSize.gap
      ? x - chartTooltipSize.width - chartTooltipSize.gap
      : x + chartTooltipSize.gap;
    const tooltipX = Math.max(4, Math.min(preferredTooltipX, dims.width - chartTooltipSize.width - 4));
    const tooltipY = Math.max(
      dims.top + 4,
      Math.min(point.y - chartTooltipSize.height - 10, dims.baseline - chartTooltipSize.height - 8)
    );

    hover.style.opacity = "1";
    vLine.setAttribute("x1", point.x);
    vLine.setAttribute("x2", point.x);
    hLine.setAttribute("y1", point.y);
    hLine.setAttribute("y2", point.y);
    hLine.setAttribute("x1", dims.left);
    hLine.setAttribute("x2", dims.left + dims.plotWidth);
    dot.setAttribute("cx", point.x);
    dot.setAttribute("cy", point.y);
    tip.setAttribute("transform", `translate(${tooltipX}, ${tooltipY})`);
    weekText.textContent = point.label;
    dateText.textContent = point.dateRange;
    phaseText.textContent = point.phase;
    totalText.textContent = formatKm(point.totalKm);
    longRunText.textContent = formatKm(point.longRunKm);
  };

  hitArea.addEventListener("pointerenter", moveCrosshair);
  hitArea.addEventListener("pointermove", moveCrosshair);
  hitArea.addEventListener("pointerleave", () => {
    hover.style.opacity = "0";
  });
}

function formatKm(value) {
  return `${Math.round(Number(value || 0))} km`;
}

function longRunKm(week) {
  const longRun = week.sessions.find((session) => session.sessionType === "Long Run" || session.sessionType === "Race");
  return Number(longRun?.plannedKm || 0);
}

function niceChartMax(value) {
  if (value <= 50) return Math.ceil(value / 10) * 10;
  return Math.ceil(value / 20) * 20;
}

function phaseRanges(weeks) {
  const ranges = [];
  for (const week of weeks) {
    const last = ranges[ranges.length - 1];
    if (last && last.phase === week.phase) {
      last.end = week.weekNumber - 1;
    } else {
      ranges.push({ phase: week.phase, start: week.weekNumber - 1, end: week.weekNumber - 1 });
    }
  }
  return ranges;
}

function phaseClass(phase) {
  return phase.toLowerCase().replaceAll(" ", "-");
}

async function copyForSheets() {
  if (!state.plan || !state.plan.weeks.length) {
    setStatus("Generate a plan first.", "error");
    return;
  }
  const tsv = MarathonEngine.planToTsv(state.plan);
  transferBox.value = tsv;
  transferBox.hidden = false;
  transferBox.focus();
  transferBox.select();

  try {
    const copied = document.execCommand("copy");
    setStatus(copied ? "Copied. Open Google Sheets and paste into cell A1." : "Transfer table is ready. Select it and paste into Google Sheets.", copied ? "success" : "warning");
  } catch (error) {
    setStatus("Transfer table is ready. Select it and paste into Google Sheets.", "warning");
  }
}

function downloadCsv() {
  if (!state.plan || !state.plan.weeks.length) {
    setStatus("Generate a plan first.", "error");
    return;
  }
  const csv = MarathonEngine.planToCsv(state.plan);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "marathon-training-plan.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus("CSV downloaded.", "success");
}

function setStatus(message, type) {
  statusBox.textContent = message;
  statusBox.dataset.type = type;
  statusBox.hidden = false;
}

init();
