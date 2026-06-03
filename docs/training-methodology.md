# Training Methodology

This generator uses a coach-designed deterministic structure. AI can help interpret user intent, but the safety rules below should stay deterministic.

## Core rules

- Start from the runner's current sustainable weekly mileage, not from the target race alone.
- Build with progressive overload.
- Keep most running easy.
- Add deload weeks every 3-5 weeks.
- Taper before race day.
- Cap the longest run around 75-80% of marathon distance unless a coach deliberately overrides it.
- Prefer reducing volume before increasing intensity when fatigue, pain, heat, or life stress rises.

## Phase model

For a marathon plan of 16-26 weeks:

- Base: re-establish routine, aerobic volume, strides, light threshold.
- Build: progressive mileage, medium-long runs, threshold and tempo.
- Specific: marathon-pace work, fueling practice, long-run quality.
- Taper: reduce volume, keep controlled intensity, arrive fresh.

Ability and difficulty adjust what "quality" means:

- Beginner plans start with relaxed strides, short fartlek, and short steady introductions instead of formal tempo, threshold, or interval workouts.
- Comfortable plans keep workouts controlled even for stronger runners; challenging plans may use longer tempo, threshold, interval, or marathon-pace blocks only when the ability profile can support them.
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
- Steady intro: controlled, able to settle back to easy running quickly.

## Long-run model

Long runs rotate through:

- unstructured easy
- progression
- steady blocks
- race-pace practice

Race-pace long runs appear mainly in the specific phase and are scaled down for intermediate runners. Beginner and comfortable profiles should stay easy-first and use long runs for durability and fueling practice before pace pressure.

## Strength model

For marathon training:

- 1 session per week: maintenance and injury-prevention minimum.
- 2 sessions per week: balanced development.
- 3 sessions per week: only if recovery and time are strong.

For race-focused plans, prioritize legs, calves, glutes, core, and mobility.
