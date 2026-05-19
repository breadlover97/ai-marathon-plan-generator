(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.MarathonEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const MARATHON_KM = 42.195;
  const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const ABILITY_PEAK_KM = {
    beginner: 50,
    intermediate: 68,
    advanced: 88,
    elite: 110,
    elite_plus: 130,
  };

  const VOLUME_MULTIPLIER = {
    gradual: 0.86,
    steady: 0.95,
    progressive: 1.04,
  };

  const DIFFICULTY_LONG_RUN_QUALITY = {
    comfortable: 0.25,
    balanced: 0.45,
    challenging: 0.65,
  };

  function parseDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  function isoDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function formatShortDate(date) {
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
  }

  function parseTimeToSeconds(value) {
    if (!value) return null;
    const parts = value.split(":").map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  }

  function parsePaceToSeconds(value) {
    if (!value) return null;
    const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function formatPace(secondsPerKm) {
    if (!Number.isFinite(secondsPerKm)) return "by RPE";
    const rounded = Math.round(secondsPerKm);
    return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")} / km`;
  }

  function marathonPaceFromGoal(goalTime) {
    const seconds = parseTimeToSeconds(goalTime);
    if (!seconds) return null;
    return formatPace(seconds / MARATHON_KM);
  }

  function paceBand(anchorPace, lowFactor, highFactor) {
    const seconds = parsePaceToSeconds(anchorPace || "");
    if (!seconds) return "by RPE";
    return `${formatPace(seconds * lowFactor)} to ${formatPace(seconds * highFactor)}`;
  }

  function validateProfile(profile) {
    const errors = [];
    const warnings = [];

    if (!profile.raceName) errors.push("Race name is required.");
    if (!profile.startDate) errors.push("Start date is required.");
    if (!profile.raceDate) errors.push("Race date is required.");
    if (!profile.currentWeeklyKm || Number(profile.currentWeeklyKm) <= 0) errors.push("Current weekly distance is required.");
    if (!profile.longestRecentRunKm || Number(profile.longestRecentRunKm) <= 0) errors.push("Longest recent run is required.");
    if (!profile.runsPerWeek || Number(profile.runsPerWeek) < 3) errors.push("Choose at least 3 running days per week.");
    if (!profile.runningAbility) errors.push("Running ability is required.");
    if (!profile.workoutDay) errors.push("Workout day is required.");
    if (!profile.mediumLongDay) errors.push("Medium-long day is required.");
    if (!profile.longRunDay) errors.push("Long-run day is required.");
    if (!profile.trainingVolume) errors.push("Training volume is required.");
    if (!profile.difficulty) errors.push("Difficulty is required.");

    if (profile.startDate && profile.raceDate && parseDate(profile.raceDate) < parseDate(profile.startDate)) {
      errors.push("Race date must be after the plan start date.");
    }

    const keyDays = [profile.workoutDay, profile.mediumLongDay, profile.longRunDay].filter(Boolean);
    if (new Set(keyDays).size !== keyDays.length) {
      errors.push("Workout, medium-long, and long-run days must be different.");
    }

    for (const day of keyDays) {
      if ((profile.restDays || []).includes(day)) errors.push("Key run days cannot also be rest days.");
      if ((profile.strengthDays || []).includes(day)) errors.push("Key run days cannot also be strength-only days.");
    }

    if (profile.currentWeeklyKm && profile.longestRecentRunKm && Number(profile.longestRecentRunKm) > Number(profile.currentWeeklyKm) * 0.75) {
      warnings.push("Your longest recent run is high relative to weekly distance. The plan will keep build weeks conservative.");
    }

    if (profile.injuryNotes) {
      warnings.push("Injury notes were provided. The plan will prioritize volume control over extra intensity.");
    }

    return { errors, warnings };
  }

  function buildTrainingPlan(profile) {
    const validation = validateProfile(profile);
    if (validation.errors.length) {
      return { profile, weeks: [], validation, goalPacePerKm: null, summary: null };
    }

    const startDate = parseDate(profile.startDate);
    const raceDate = parseDate(profile.raceDate);
    const totalWeeks = Math.floor((raceDate - startDate) / (7 * 24 * 60 * 60 * 1000)) + 1;
    const goalPacePerKm = marathonPaceFromGoal(profile.goalTime);
    const weeklyTargets = weeklyTargetsFor(profile, totalWeeks);
    const longRunTargets = longRunTargetsFor(profile, weeklyTargets, totalWeeks);
    const weeks = [];

    for (let index = 0; index < totalWeeks; index += 1) {
      const weekNumber = index + 1;
      const phase = phaseForWeek(weekNumber, totalWeeks);
      const weekStart = addDays(startDate, index * 7);
      const weekEnd = addDays(weekStart, 6);
      const sessions = sessionsForWeek(profile, weekNumber, totalWeeks, phase, weeklyTargets[index], longRunTargets[index], goalPacePerKm);
      const targetKm = round1(sessions.reduce((sum, session) => sum + session.plannedKm, 0));
      weeks.push({
        weekNumber,
        startDate: isoDate(weekStart),
        endDate: isoDate(weekEnd),
        dateRange: `${formatShortDate(weekStart)}-${formatShortDate(weekEnd)}`,
        phase,
        focus: focusForWeek(phase, weekNumber, totalWeeks),
        targetKm,
        longRunSummary: longRunSummary(sessions, profile.longRunDay),
        keySessions: keySessions(sessions),
        notes: notesForWeek(profile, phase, weekNumber, totalWeeks),
        strengthNote: strengthNote(profile),
        fuelNote: fuelNote(profile, phase, weekNumber, totalWeeks),
        riskNote: riskNote(profile),
        raceFit: raceFit(phase, weekNumber, totalWeeks),
        adjustNote: adjustNote(profile),
        sessions,
      });
    }

    const peakKm = Math.max(...weeks.map((week) => week.targetKm));
    return {
      profile,
      weeks,
      validation,
      goalPacePerKm,
      summary: {
        totalWeeks,
        peakKm,
        startKm: weeks[0].targetKm,
        raceWeekKm: weeks[weeks.length - 1].targetKm,
        longRunCapKm: Number(profile.maxLongRunKm) || defaultLongRunCap(profile),
      },
    };
  }

  function weeklyTargetsFor(profile, totalWeeks) {
    const current = Number(profile.currentWeeklyKm);
    const ability = profile.runningAbility || "intermediate";
    const volume = profile.trainingVolume || "steady";
    const peakCap = ABILITY_PEAK_KM[ability] * VOLUME_MULTIPLIER[volume];
    const naturalPeak = current * (totalWeeks >= 18 ? 1.45 : 1.25);
    const peak = Math.min(peakCap, Math.max(current * 1.15, naturalPeak));
    const start = Math.max(current * 0.95, current - 5);
    const taperWeeks = totalWeeks >= 16 ? 3 : 2;
    const buildWeeks = Math.max(totalWeeks - taperWeeks, 1);
    const targets = [];
    let lastBuild = start;

    for (let week = 1; week <= buildWeeks; week += 1) {
      const progress = (week - 1) / Math.max(buildWeeks - 1, 1);
      const ideal = start + (peak - start) * progress;
      let target;
      if (week % 4 === 0) {
        target = Math.max(start * 0.92, lastBuild * 0.82);
      } else {
        target = Math.min(ideal, lastBuild * 1.08);
        lastBuild = target;
      }
      targets.push(round1(Math.max(target, start * 0.88)));
    }

    const taper = taperWeeks === 3 ? [peak * 0.72, peak * 0.5, Math.max(MARATHON_KM + 12, peak * 0.6)] : [peak * 0.55, Math.max(MARATHON_KM + 10, peak * 0.6)];
    return targets.concat(taper.map(round1)).slice(0, totalWeeks);
  }

  function longRunTargetsFor(profile, weeklyTargets, totalWeeks) {
    const cap = Math.min(Number(profile.maxLongRunKm) || defaultLongRunCap(profile), MARATHON_KM * 0.82);
    const recent = Number(profile.longestRecentRunKm);
    const start = Math.min(Math.max(recent + 3, recent * 1.1), cap);
    const taperWeeks = totalWeeks >= 16 ? 3 : 2;
    const buildWeeks = Math.max(totalWeeks - taperWeeks, 1);
    const longRuns = [];
    let lastBuild = start;

    for (let week = 1; week <= buildWeeks; week += 1) {
      const progress = (week - 1) / Math.max(buildWeeks - 1, 1);
      const ideal = start + (cap - start) * progress;
      let target;
      if (week % 4 === 0) {
        target = Math.max(start * 0.85, lastBuild * 0.72);
      } else {
        target = Math.min(ideal, lastBuild + 2.5);
        lastBuild = target;
      }
      longRuns.push(Math.round(Math.min(target, weeklyTargets[week - 1] * 0.43, cap)));
    }

    const taper = taperWeeks === 3 ? [Math.round(cap * 0.65), Math.round(cap * 0.45), MARATHON_KM] : [Math.round(cap * 0.5), MARATHON_KM];
    return longRuns.concat(taper).slice(0, totalWeeks);
  }

  function defaultLongRunCap(profile) {
    const ability = profile.runningAbility || "intermediate";
    return Math.min(MARATHON_KM * 0.8, ABILITY_PEAK_KM[ability] * 0.4);
  }

  function sessionsForWeek(profile, weekNumber, totalWeeks, phase, targetKm, longKm, goalPace) {
    const raceWeek = weekNumber === totalWeeks;
    const dayTypes = Object.fromEntries(WEEKDAYS.map((day) => [day, "Rest"]));
    dayTypes[profile.workoutDay || "Monday"] = workoutType(phase, weekNumber, raceWeek);
    dayTypes[profile.mediumLongDay || "Wednesday"] = "Medium-Long";
    dayTypes[profile.longRunDay || "Saturday"] = raceWeek ? "Race" : "Long Run";
    for (const day of profile.strengthDays || []) dayTypes[day] = "Strength";
    for (const day of profile.restDays || []) dayTypes[day] = "Rest";

    const runDays = WEEKDAYS.filter((day) => !["Rest", "Strength"].includes(dayTypes[day]));
    while (runDays.length < Number(profile.runsPerWeek)) {
      const candidate = WEEKDAYS.find((day) => !runDays.includes(day) && !(profile.restDays || []).includes(day) && dayTypes[day] === "Rest");
      if (!candidate) break;
      dayTypes[candidate] = "Easy Run";
      runDays.push(candidate);
    }

    const workoutKm = raceWeek ? 0 : Math.max(7, Math.min(targetKm * 0.2, 16));
    let mediumKm = raceWeek ? 0 : Math.max(8, Math.min(targetKm * 0.18, 18));
    if (Number(profile.runsPerWeek) <= 4) mediumKm *= 0.75;
    const easyBudget = Math.max(targetKm - longKm - workoutKm - mediumKm, 0);
    const easyDays = runDays.filter((day) => dayTypes[day] === "Easy Run");
    const easyKm = round1(easyBudget / Math.max(easyDays.length, 1));

    return WEEKDAYS.map((day) => {
      const sessionType = dayTypes[day];
      if (sessionType === "Rest") return session(day, "Rest", "Full rest", 0);
      if (sessionType === "Strength") return session(day, "Strength", strengthPlan(profile), 0);
      if (sessionType === "Medium-Long") return session(day, sessionType, mediumLongPlan(phase), round1(mediumKm));
      if (["Long Run", "Race"].includes(sessionType)) return session(day, sessionType, longRunPlan(profile, phase, weekNumber, totalWeeks, longKm, goalPace), round1(longKm));
      if (sessionType === "Easy Run") return session(day, sessionType, weekNumber % 2 ? "Easy aerobic + 6 strides" : "Easy aerobic", easyKm);
      return session(day, sessionType, workoutPlan(sessionType, goalPace), round1(workoutKm));
    });
  }

  function session(day, sessionType, plan, plannedKm) {
    return { day, sessionType, plan, plannedKm };
  }

  function phaseForWeek(weekNumber, totalWeeks) {
    if (weekNumber > totalWeeks - 3) return "Taper";
    const ratio = weekNumber / Math.max(totalWeeks, 1);
    if (ratio <= 0.32) return "Base Build";
    if (ratio <= 0.68) return "Marathon Build";
    return "Race Specific";
  }

  function workoutType(phase, weekNumber, raceWeek) {
    if (raceWeek) return "Sharpen";
    if (phase === "Base Build") return ["Threshold", "Tempo", "Steady-State"][weekNumber % 3];
    if (phase === "Marathon Build") return ["Intervals", "Tempo", "Hill Repeats", "Threshold"][weekNumber % 4];
    if (phase === "Race Specific") return ["Marathon Pace", "Tempo", "Intervals"][weekNumber % 3];
    return "Sharpen";
  }

  function workoutPlan(sessionType, goalPace) {
    const easyBand = paceBand(goalPace, 1.25, 1.45);
    const tempoBand = paceBand(goalPace, 0.92, 0.97);
    const intervalBand = paceBand(goalPace, 0.85, 0.9);
    const plans = {
      Threshold: `WU + 4 x 2 km controlled threshold, jog recoveries, CD (${tempoBand})`,
      Tempo: `WU + 3 x 15 min tempo, 4 min jog, CD (${tempoBand})`,
      "Steady-State": `WU + 2 x 20 min steady, 5 min jog, CD (${easyBand})`,
      Intervals: `WU + 8 x 800 m controlled reps, 400 m jog, CD (${intervalBand})`,
      "Hill Repeats": "WU + 10 x 75 sec uphill strong, jog down, CD (RPE-based)",
      "Marathon Pace": `WU + 3 x 5 km at marathon effort, 1 km easy, CD (${goalPace || "RPE 6-7/10"})`,
      Sharpen: "Short easy run + 6 relaxed strides",
    };
    return plans[sessionType] || "Controlled quality session";
  }

  function mediumLongPlan(phase) {
    if (phase === "Race Specific") return "Medium-long easy with last 20 min steady if fresh";
    if (phase === "Taper") return "Reduced medium-long, relaxed and conversational";
    return "Medium-long easy, finish relaxed";
  }

  function longRunPlan(profile, phase, weekNumber, totalWeeks, distance, goalPace) {
    if (weekNumber === totalWeeks) return `${MARATHON_KM.toFixed(1)} km race day: execute rehearsed fueling and pacing`;
    if (phase === "Base Build") return `${Math.round(distance)} km easy, no pace pressure`;
    const qualityShare = DIFFICULTY_LONG_RUN_QUALITY[profile.difficulty || "balanced"];
    if (phase === "Race Specific" && weekNumber % 2 === 1) {
      const mpBlock = Math.max(6, Math.round(distance * qualityShare * 0.35));
      return `${Math.round(distance)} km with ${mpBlock} km total at marathon effort (${goalPace || "RPE 6-7/10"})`;
    }
    if (weekNumber % 3 === 0) return `${Math.round(distance)} km progression, last 5 km steady`;
    return `${Math.round(distance)} km easy with fueling test`;
  }

  function strengthPlan(profile) {
    return profile.difficulty === "challenging"
      ? "Legs/core strength: calves, split squats, bridges, planks, mobility"
      : "Running strength + mobility, keep it submaximal";
  }

  function focusForWeek(phase, weekNumber, totalWeeks) {
    if (weekNumber === totalWeeks) return "Race week: stay fresh, protect sleep, execute the plan.";
    if (phase === "Base Build") return "Build durable rhythm without chasing pace.";
    if (phase === "Marathon Build") return "Increase repeatable volume and controlled quality.";
    if (phase === "Race Specific") return "Practice marathon rhythm, fueling, and late-run control.";
    return "Reduce volume while keeping the legs responsive.";
  }

  function notesForWeek(profile, phase, weekNumber, totalWeeks) {
    if (weekNumber === totalWeeks) return "Nothing new. Keep easy runs easy and trust the taper.";
    if (weekNumber % 4 === 0 && phase !== "Taper") return "Deload week. Let the reduced distance absorb the previous block.";
    if (profile.constraints) return `Watch: ${profile.constraints}`;
    return "Keep all easy days honest and log sleep, soreness, and energy.";
  }

  function fuelNote(profile, phase, weekNumber, totalWeeks) {
    if (weekNumber === totalWeeks) return "Use rehearsed race fueling only";
    if (phase === "Marathon Build" || phase === "Race Specific") return profile.fuelNotes || "Practice carbs and fluids during long run";
    return "Start noting tolerance";
  }

  function riskNote(profile) {
    return profile.primaryRisks || profile.injuryNotes || "Reduce volume first if pain or fatigue spikes";
  }

  function raceFit(phase, weekNumber, totalWeeks) {
    if (weekNumber === totalWeeks) return "Race execution";
    if (phase === "Base Build") return "Build gradually";
    if (phase === "Marathon Build") return "Durability";
    if (phase === "Race Specific") return "Specific fitness";
    return "Freshen up";
  }

  function adjustNote(profile) {
    if (profile.primaryRisks) return `Cut volume first if ${profile.primaryRisks.toLowerCase()} risk rises`;
    if (profile.injuryNotes) return "Cut volume first if pain returns";
    return "Cut volume before adding intensity";
  }

  function strengthNote(profile) {
    const days = (profile.strengthDays || []).join(", ") || "as scheduled";
    return `${days} strength: calves, glutes, single-leg control, core, mobility`;
  }

  function longRunSummary(sessions, longRunDay) {
    const longRun = sessions.find((item) => item.day === longRunDay) || sessions.find((item) => item.sessionType === "Long Run" || item.sessionType === "Race");
    return longRun ? `${longRun.plannedKm} km ${longRun.sessionType.toLowerCase()}` : "Not scheduled";
  }

  function keySessions(sessions) {
    return sessions
      .filter((session) => !["Rest", "Strength", "Easy Run"].includes(session.sessionType))
      .map((session) => session.sessionType)
      .join("; ");
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function planToTsv(plan) {
    return planToSheetRows(plan).map((row) => row.map(cleanTsvCell).join("\t")).join("\n");
  }

  function planToCsv(plan) {
    return planToSheetRows(plan).map((row) => row.map(cleanCsvCell).join(",")).join("\n");
  }

  function planToSheetRows(plan) {
    const profile = plan.profile;
    const rows = [
      ["", "Marathon Training Plan", "", "", "", "", "", "", "", "", "", "Race", profile.raceName || "", "", "", ""],
      ["", "Start", profile.startDate || "", "", "Race Day", profile.raceDate || "", "", "Goal", profile.goalDescription || profile.goalTime || "", "", "", "", "", "", "", ""],
      [
        "",
        "Current baseline",
        `${profile.currentWeeklyKm || ""} km/week; ${profile.longestRecentRunKm || ""} km long run`,
        "",
        "Goal pace",
        plan.goalPacePerKm || "Not set",
        "",
        "Current MP",
        profile.currentMarathonPace || "Not set",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
      [
        "",
        "Default week shape",
        `${profile.workoutDay || "Workout"} workout, ${profile.mediumLongDay || "medium-long"} medium-long, ${profile.longRunDay || "long run"} long run`,
        "",
        "Race specifics",
        profile.raceSpecifics || "",
        "",
        "Admin",
        profile.adminNotes || "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
      ["", "Use", "Enter actual run notes in the Actual, Distance, and Remarks rows. Planned totals calculate from day columns.", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      [],
      ["", "Plan KPI", "Formula", "", "Value", "", "Notes"],
      ["", "Training weeks", "", "", plan.weeks.length, "", `${profile.startDate || ""} to ${profile.raceDate || ""}`],
      ["", "Peak planned week", "", "", plan.summary ? plan.summary.peakKm : "", "", "Based on weekly planned distance totals"],
      [],
    ];

    for (const week of plan.weeks) {
      const startRow = rows.length + 1;
      const plannedDistanceRow = startRow + 4;
      const actualDistanceRow = startRow + 6;

      rows.push(["", `Week ${week.weekNumber}`, ...week.sessions.map((session) => sessionDateLabel(week.startDate, session.day)), "", "", "", "", "", ""]);
      rows.push(["", week.weekNumber, ...week.sessions.map((session) => `${shortDay(session.day)} ${sessionDateLabel(week.startDate, session.day)}`), "Total", "", "Phase", week.phase, "Target km", week.targetKm]);
      rows.push(["", "Type", ...week.sessions.map((session) => session.sessionType), "", "", "Key sessions", week.keySessions, "Long run", week.longRunSummary]);
      rows.push(["", "Plan", ...week.sessions.map((session) => session.plan), "", "", "Date range", week.dateRange, "Admin", profile.adminNotes || ""]);
      rows.push(["", "Distance (km)", ...week.sessions.map((session) => session.plannedKm), `=SUM(C${plannedDistanceRow}:I${plannedDistanceRow})`, "", "", "", "", ""]);
      rows.push(["", "Actual", ...week.sessions.map(() => ""), "", "", "", "", "", ""]);
      rows.push(["", "Distance (km)", ...week.sessions.map(() => ""), `=SUM(C${actualDistanceRow}:I${actualDistanceRow})`, "", "", "", "", "", ""]);
      rows.push(["", "Remarks", ...week.sessions.map(() => ""), "", "", "", "", "", ""]);
      rows.push([]);
      rows.push([]);
    }

    return rows;
  }

  function sessionDateLabel(weekStartDate, day) {
    const offset = WEEKDAYS.indexOf(day);
    return formatShortDate(addDays(parseDate(weekStartDate), offset));
  }

  function shortDay(day) {
    return day.slice(0, 3);
  }

  function cleanTsvCell(cell) {
    return String(cell ?? "").replaceAll("\t", " ").replaceAll("\n", " ");
  }

  function cleanCsvCell(cell) {
    return `"${cleanTsvCell(cell).replaceAll('"', '""')}"`;
  }

  return {
    WEEKDAYS,
    MARATHON_KM,
    buildTrainingPlan,
    validateProfile,
    planToTsv,
    planToCsv,
    marathonPaceFromGoal,
  };
});
