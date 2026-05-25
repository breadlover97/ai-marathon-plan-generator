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
assert.ok(plan.weeks.every((week) => Number.isInteger(week.targetKm)));
assert.ok(plan.weeks.every((week) => week.sessions.every((session) => Number.isInteger(session.plannedKm))));
assert.ok(plan.summary.peakKm <= 92);
assert.ok(plan.summary.peakKm > 70);
assert.ok(plan.goalPacePerKm.includes("4:02"));
const tsv = engine.planToTsv(plan);
assert.ok(tsv.includes("\tMarathon Training Plan"));
assert.ok(tsv.includes("\tWeek 1\t11 May\t12 May\t13 May\t14 May\t15 May\t16 May\t17 May"));
assert.ok(tsv.includes("\tType\tTempo\tEasy Run\tMedium-Long\tStrength"));
assert.ok(tsv.includes("\tDistance (km)\t10\t5\t9\t0\t5\t21\t0\t=SUM(C15:I15)"));
assert.ok(tsv.includes("\tActual\t"));
assert.ok(tsv.includes("\tRemarks\t"));
assert.ok(tsv.includes("=SUM(C15:I15)"));
assert.ok(engine.planToCsv(plan).includes('"","Marathon Training Plan"'));
assert.ok(!/\b(Focus|Fuel|Risk|Adjust)\b/.test(tsv));
assert.equal((tsv.match(/\bAdmin\b/g) || []).length, 1);

const invalid = engine.buildTrainingPlan({ ...profile, raceName: "", currentWeeklyKm: 0 });
assert.ok(invalid.validation.errors.length >= 2);

console.log(`smoke ok: ${plan.weeks.length} weeks, peak ${plan.summary.peakKm} km`);
