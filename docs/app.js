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
const statusBox = document.querySelector("#status-box");
const transferBox = document.querySelector("#sheets-transfer");

const defaults = {
  athleteName: "Tai Zhi",
  raceName: "Standard Chartered Kuala Lumpur Marathon 2026",
  startDate: "2026-05-11",
  raceDate: "2026-10-04",
  goalTime: "02:50:00",
  goalDescription: "2h 50m / Top 8 Open",
  currentWeeklyKm: "52",
  longestRecentRunKm: "21",
  currentMarathonPace: "04:15",
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
  document.querySelector("#reset-form").addEventListener("click", resetForm);
  document.querySelector("#copy-sheets").addEventListener("click", copyForSheets);
  document.querySelector("#download-csv").addEventListener("click", downloadCsv);
  document.querySelector("#edit-inputs").addEventListener("click", editInputs);

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

function collectProfile() {
  const data = new FormData(form);
  return {
    athleteName: clean(data.get("athleteName")),
    raceName: clean(data.get("raceName")),
    startDate: data.get("startDate"),
    raceDate: data.get("raceDate"),
    goalTime: clean(data.get("goalTime")),
    goalDescription: clean(data.get("goalDescription")) || "Finish strong",
    currentWeeklyKm: Number(data.get("currentWeeklyKm")),
    longestRecentRunKm: Number(data.get("longestRecentRunKm")),
    currentMarathonPace: clean(data.get("currentMarathonPace")),
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
    ["Risk", plan.profile.primaryRisks || plan.profile.injuryNotes || "None added"],
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
          <dl class="week-notes">
            <div><dt>Focus</dt><dd>${week.focus}</dd></div>
            <div><dt>Fuel</dt><dd>${week.fuelNote}</dd></div>
            <div><dt>Risk</dt><dd>${week.riskNote}</dd></div>
            <div><dt>Adjust</dt><dd>${week.adjustNote}</dd></div>
          </dl>
        </article>
      `
    )
    .join("");
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
