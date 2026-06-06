# Training Methodology

This generator uses a coach-designed deterministic structure. AI can help interpret user intent, but the safety rules below should stay deterministic.

## Core rules

- Start from the runner's current sustainable weekly mileage, not from the target race alone.
- Treat race distance as a primary input. A 10K plan, half-marathon plan, and marathon plan should not share the same long-run cap, taper, or race-specific workout mix.
- Build with progressive overload.
- Keep most running easy.
- Start each plan with controlled quality, even for advanced runners.
- Add deload weeks every 3-5 weeks.
- Taper before race day.
- Cap the longest run according to race distance and runner profile.
- Prefer reducing volume before increasing intensity when fatigue, pain, heat, or life stress rises.

## Phase model

For race plans:

- Base: re-establish routine, aerobic volume, strides, light threshold.
- 10K Speed Build: progressive mileage, controlled track/interval exposure, hills, and tempo support.
- Half Marathon Endurance Build: progressive mileage, threshold work, medium-long runs, and half-marathon rhythm.
- Marathon Build: progressive mileage, medium-long runs, threshold/tempo, and durability.
- Specific: race-pace work and distance-specific long-run quality.
- Taper: reduce volume, keep controlled intensity, arrive fresh.

Ability and difficulty adjust what "quality" means:

- Beginner plans start with relaxed strides, short fartlek, introductory track strides, and short steady introductions instead of formal tempo, threshold, or interval workouts.
- Comfortable plans keep workouts controlled even for stronger runners; challenging plans may use longer tempo, threshold, track interval, or marathon-pace blocks only when the ability profile can support them.
- Beginner long runs stay easy, with fueling practice added before pace-specific long-run quality.

## Weekly structure

Default structure, matching the provided sheet:

- Monday: quality workout.
- Tuesday: easy run.
- Wednesday: medium-long run.
- Thursday: strength or mobility.
- Friday: easy run.
- Saturday: long run.
- Sunday: rest or recovery.

The final app should let the user move these days during onboarding.

## Mileage progression

The generator derives weekly targets from:

- current weekly mileage
- available weeks
- training volume preference
- running ability
- taper timing
- race week

General limits:

- Build weeks should rarely increase more than 8-10%.
- Deload weeks intentionally reduce distance.
- Shorter plans may need faster progression, but should warn the user when the race date is too soon.

## Workout distribution

The generator uses these rough shares for a 5-run week:

- Long run: 35-42% of weekly distance.
- Main quality workout: 14-22%, with beginner plans near the lower end.
- Medium-long run: 16-20%, with lower floors for beginner and lower-frequency plans.
- Easy runs: remaining distance.
- Strength sessions: 0 km, scheduled away from the hardest run days where possible.

## Intensity and pace model

Paces are anchored to target marathon pace or a predicted marathon pace from a recent race.

- Easy: conversational, roughly 125-145% of marathon pace.
- Steady: controlled aerobic work, roughly 110-118%.
- Marathon pace: goal pace.
- Tempo: comfortably hard, roughly 92-97%.
- Intervals: harder reps, roughly 85-90%.

The product should let users switch to RPE when terrain, heat, or fatigue makes exact pace less useful.

For beginner profiles, early quality sessions should be described mainly by RPE and feel:

- Strides: relaxed, fast-but-smooth, full easy recovery.
- Short fartlek: gently quicker, never straining.
- Intro track strides: smooth 200 m reps with walk-jog recovery, never sprinting.
- Steady intro: controlled, able to settle back to easy running quickly.

Track sessions are introduced progressively:

- Beginner: track or flat-path 200 m strides only.
- Comfortable: controlled 400 m repeats can appear after base rhythm is established.
- Intermediate: 400 m in base, 800 m in build, 1 km repeats in race-specific weeks.
- Advanced and elite: 800 m, 1 km, and 1600 m track sessions can appear, but week one still starts with strides or tempo intro rather than a large tempo block.

## Long-run model

Long runs rotate through:

- unstructured easy
- progression
- steady blocks
- race-pace practice

Race-pace long runs appear mainly in the specific phase and are scaled down for intermediate runners. Beginner and comfortable profiles should stay easy-first and use long runs for durability and fueling practice before pace pressure.

Generated session distances are rounded to the nearest whole kilometre for practical planning and cleaner Google Sheets exports. Exact race distances are still used for pace calculations, but the displayed planned distance uses the whole-km convention.

Distance-specific long-run intent:

- 10K: long runs can exceed race distance, but they stay primarily aerobic. Race-specific work belongs in shorter quality sessions, with occasional short rhythm pickups inside long runs.
- Half marathon: long runs usually progress toward roughly 15-21 km depending on ability and weekly volume. Specific long runs may include controlled half-marathon-effort blocks.
- Marathon: long runs are capped around 75-80% of marathon distance unless a coach deliberately overrides it. Specific long runs may include marathon-effort blocks and fueling practice.

## Race-week model

- Race day is placed on the actual race date, not the preferred long-run day.
- If race day is midweek, post-race days are rest/recovery in the generated plan.
- 10K race week keeps only a short sharpening session plus easy running before race day.
- Half marathon race week preserves freshness while retaining small aerobic touches before race day.
- Marathon race week prioritizes freshness, sleep, fueling, and simple execution.

## Research review

Reviewed on 2026-06-03:

- Hal Higdon Novice 1 keeps first-marathon training simple: four weekly runs, easy midweek running, conversational long runs, stepback weeks, and no formal track/tempo session in the public schedule.
- B.A.A. Level One is more performance-oriented than a pure novice plan, but still begins with easy/aerobic runs before introducing short hill/track intervals such as 200 m hills and 1 km repeats.
- PubMed-indexed reviews support caution with novice runners: novice injury incidence is materially higher than recreational runners, and training-load changes or interval work can be associated with injury risk.
- Elite-runner literature supports periodized hard/easy training and use of tempo plus interval sessions, but that evidence should not be copied directly into beginner plans.

## Strength model

For marathon training:

- 1 session per week: maintenance and injury-prevention minimum.
- 2 sessions per week: balanced development.
- 3 sessions per week: only if recovery and time are strong.

For race-focused plans, prioritize legs, calves, glutes, core, and mobility.
