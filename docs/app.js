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

function init() {
  form.addEventListener("submit", handleSubmit);
  document.querySelector("#load-example").addEventListener("click", loadExample);
  document.querySelector("#reset-form").addEventListener("click", resetForm);
  document.querySelector("#copy-sheets").addEventListener("click", copyForSheets);
  document.querySelector("#download-csv").addEventListener("click", downloadCsv);
  document.querySelector("#edit-inputs").addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

  for (const button of document.querySelectorAll("[data-next]")) {
    button.addEventListener("click", () => setStep(Math.min(state.currentStep + 1, steps.length - 1)));
  }
  for (const button of document.querySelectorAll("[data-prev]")) {
    button.addEventListener("click", () => setStep(Math.max(state.currentStep - 1, 0)));
  }
  for (const item of navItems) {
    item.addEventListener("click", () => setStep(Number(item.dataset.stepTarget)));
  }

  setTodayDefaults();
  setStep(0);
}

function setTodayDefaults() {
  const today = new Date();
  const start = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const race = new Date(start);
  race.setUTCDate(race.getUTCDate() + 7 * 20);
  form.elements.startDate.value = start.toISOString().slice(0, 10);
  form.elements.raceDate.value = race.toISOString().slice(0, 10);
}

function setStep(index) {
  state.currentStep = index;
  steps.forEach((step, stepIndex) => step.toggleAttribute("hidden", stepIndex !== index));
  navItems.forEach((item, itemIndex) => item.classList.toggle("is-active", itemIndex === index));
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
  setTodayDefaults();
  setCheckboxes("strengthDays", ["Thursday"]);
  setCheckboxes("restDays", ["Sunday"]);
  state.plan = null;
  output.hidden = true;
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
