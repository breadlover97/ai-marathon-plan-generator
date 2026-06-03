const assert = require("node:assert/strict");
const engine = require("../docs/engine.js");

const profile = {
  athleteName: "Tai Zhi",
  raceName: "Standard Chartered Kuala Lumpur Marathon 2026",
  startDate: "2026-05-11",
  raceDate: "2026-10-04",
  goalTime: "02:50:00",
  goalDescription: "2h 50m / Top 8 Open",
  currentWeeklyKm: 52,
  longestRecentRunKm: 21,
  currentMarathonPace: "04:15",
  runsPerWeek: 5,
  runningAbility: "advanced",
  trainingVolume: "progressive",
  difficulty: "challenging",
  workoutDay: "Monday",
  mediumLongDay: "Wednesday",
  longRunDay: "Saturday",
  strengthDays: ["Thursday"],
  restDays: ["Sunday"],
  maxLongRunKm: 34,
  primaryRisks: "Injury and burnout",
  raceSpecifics: "Heat/humidity + very early start",
  fuelNotes: "Amino Vital AminoShot; refine carb/hr",
  adminNotes: "REPC 1-3 Oct at MITEC",
  constraints: "Protect shins and calves",
};

const plan = engine.buildTrainingPlan(profile);
assert.equal(plan.validation.errors.length, 0);
assert.equal(plan.weeks.length, 21);
assert.equal(plan.weeks.at(-1).phase, "Taper");
assert.ok(plan.weeks.every((week) => Number.isFinite(week.targetKm)));
assert.ok(plan.weeks.every((week) => week.sessions.every((session) => Number.isFinite(session.plannedKm) && session.plannedKm >= 0)));
assert.ok(plan.summary.peakKm <= 92);
assert.ok(plan.summary.peakKm > 70);
assert.equal(plan.summary.longRunCapKm, 34);
assert.equal(plan.summary.peakLongRunKm, 34);
assert.equal(Math.max(...plan.weeks.slice(0, -1).map((week) => week.sessions.find((session) => session.sessionType === "Long Run").plannedKm)), 34);
assert.ok(plan.goalPacePerKm.includes("4:02"));
const raceSession = plan.weeks.at(-1).sessions.find((session) => session.sessionType === "Race");
assert.equal(raceSession.day, "Sunday");
assert.equal(raceSession.plannedKm, 42.2);
assert.equal(plan.weeks.at(-1).longRunSummary, "42.2 km race");
const tsv = engine.planToTsv(plan);
const firstWorkout = plan.weeks[0].sessions.find((session) => !["Rest", "Strength", "Easy Run", "Medium-Long", "Long Run", "Race"].includes(session.sessionType));
assert.equal(firstWorkout.sessionType, "Easy Strides");
assert.ok(!firstWorkout.plan.includes("3 x 15 min tempo"));
const workoutTypes = new Set(
  plan.weeks
    .slice(0, -1)
    .flatMap((week) => week.sessions)
    .filter((session) => !["Rest", "Strength", "Easy Run", "Medium-Long", "Long Run", "Race"].includes(session.sessionType))
    .map((session) => session.sessionType),
);
assert.ok(workoutTypes.has("Track 400s"));
assert.ok(workoutTypes.has("Track 800s"));
assert.ok(workoutTypes.has("Track 1K Repeats"));
assert.ok(tsv.includes("\tMarathon Training Plan"));
assert.ok(tsv.includes("\tWeek 1\t11 May\t12 May\t13 May\t14 May\t15 May\t16 May\t17 May"));
assert.ok(tsv.includes("\tType\tEasy Strides\tEasy Run\tMedium-Long\tStrength"));
assert.ok(tsv.includes("\tDistance (km)\t10\t4\t9\t0\t4\t22.5\t0\t=SUM(C15:I15)"));
assert.ok(tsv.includes("\tType\tSharpen\tEasy Run\tEasy Run\tStrength\tEasy Run\tRest\tRace"));
assert.ok(tsv.includes("\tDistance (km)\t6\t2\t2\t0\t2\t0\t42.2\t=SUM(C215:I215)"));
assert.ok(tsv.includes("\tActual\t"));
assert.ok(tsv.includes("\tRemarks\t"));
assert.ok(tsv.includes("=SUM(C15:I15)"));
assert.ok(engine.planToCsv(plan).includes('"","Marathon Training Plan"'));
assert.ok(!/\b(Focus|Fuel|Risk|Adjust)\b/.test(tsv));
assert.equal((tsv.match(/\bAdmin\b/g) || []).length, 1);

const beginnerProfile = {
  ...profile,
  athleteName: "New Runner",
  raceName: "First Marathon",
  goalTime: "",
  goalDescription: "Finish comfortably",
  currentWeeklyKm: 24,
  longestRecentRunKm: 10,
  currentMarathonPace: "",
  runsPerWeek: 4,
  runningAbility: "beginner",
  trainingVolume: "gradual",
  difficulty: "balanced",
  maxLongRunKm: "",
  primaryRisks: "",
  raceSpecifics: "",
  fuelNotes: "",
  adminNotes: "",
  constraints: "",
};
const beginnerPlan = engine.buildTrainingPlan(beginnerProfile);
assert.equal(beginnerPlan.validation.errors.length, 0);
const beginnerWorkout = beginnerPlan.weeks[0].sessions.find((session) => !["Rest", "Strength", "Easy Run", "Medium-Long", "Long Run"].includes(session.sessionType));
assert.equal(beginnerWorkout.sessionType, "Easy Strides");
assert.ok(beginnerWorkout.plannedKm <= 5);
assert.ok(beginnerWorkout.plan.includes("relaxed strides"));
const beginnerWorkoutTypes = new Set(
  beginnerPlan.weeks
    .slice(0, -1)
    .flatMap((week) => week.sessions)
    .filter((session) => !["Rest", "Strength", "Easy Run", "Medium-Long", "Long Run", "Race"].includes(session.sessionType))
    .map((session) => session.sessionType),
);
assert.ok(beginnerWorkoutTypes.has("Intro Track Strides"));
for (const trackType of ["Track 400s", "Track 800s", "Track 1K Repeats", "Track 1600s"]) {
  assert.ok(!beginnerWorkoutTypes.has(trackType), `beginner plan should not include ${trackType}`);
}
const beginnerText = beginnerPlan.weeks.flatMap((week) => week.sessions).map((session) => session.plan).join("\n");
for (const phrase of ["3 x 15 min tempo", "4 x 2 km controlled threshold", "8 x 800 m", "3 x 5 km at marathon effort", "progression, last 5 km steady"]) {
  assert.ok(!beginnerText.includes(phrase), `beginner plan should not include ${phrase}`);
}

const invalid = engine.buildTrainingPlan({ ...profile, raceName: "", currentWeeklyKm: 0 });
assert.ok(invalid.validation.errors.length >= 2);

console.log(`smoke ok: ${plan.weeks.length} weeks, peak ${plan.summary.peakKm} km`);
