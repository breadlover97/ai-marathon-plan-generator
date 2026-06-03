# Research Notes

## Product inspiration

Runna's experience is strong because it separates high-level onboarding from deeper preferences. The user can create a plan quickly, then tune plan volume, difficulty, running ability, schedule, and pace targets later.

Useful Runna references:

- Training preferences: https://support.runna.com/en/articles/10393191-how-to-use-training-preferences
- Mileage calculation: https://support.runna.com/en/articles/14666572-how-runna-calculates-your-mileage-and-how-to-adjust-it
- Running ability: https://support.runna.com/en/articles/6205993-adjusting-your-running-ability
- Plan start timing: https://support.runna.com/en/articles/8975784-when-should-i-start-my-runna-plan
- Build weeks and progressive overload: https://support.runna.com/en/articles/15013260-what-is-a-build-week-understanding-progressive-overload-in-your-running-plan
- Long-run structure: https://support.runna.com/en/articles/9357249-understanding-the-long-runs-in-your-runna-plan
- Marathon guide: https://support.runna.com/en/articles/6186980-the-ultimate-marathon-training-guide
- Strength frequency: https://support.runna.com/en/articles/8216254-choosing-your-strength-goal-and-training-frequency
- Target race time prediction: https://support.runna.com/en/articles/6251445-how-is-my-target-race-time-predicted

## What the tool should ask

### Goal and event

- Race distance.
- Race name.
- Race date.
- Target finish time, if any.
- Priority: finish healthy, PB, aggressive goal, podium or placing.
- Race surface, elevation, climate, and start time.
- Whether there are tune-up races or unavailable weeks.

### Current fitness

- Current weekly mileage.
- Longest run in the last 4-6 weeks.
- How many weeks/months the runner has been consistent.
- Current longest comfortable single run.
- Recent race result or time trial.
- Current easy pace or conversational pace.
- Current marathon-pace estimate, if known.

### Running background

Runna's ability model is useful as a simple selector:

- Beginner: can complete 5 km without stopping.
- Intermediate: regularly runs at least 5 km, but not much structured training.
- Advanced: regularly runs at least 10 km and has some structured workouts.
- Elite: regularly runs half marathon distance or further and is comfortable with intervals.
- Elite Plus: consistently running around 80-100 km per week.

### Availability and preferences

- Runs per week.
- Preferred workout day.
- Preferred long-run day.
- Preferred strength days.
- Rest day constraints.
- Maximum time available on weekdays and weekends.
- Tolerance for treadmill, hills, track, heat, and early starts.

### Training preferences

Mirror Runna's two-layer control:

- Training volume: gradual, steady, progressive.
- Difficulty: comfortable, balanced, challenging.
- Advanced controls:
  - max long-run distance
  - max easy-run distance
  - max hard-session distance
  - hard runs per week
  - long-run difficulty
  - long-run structure

### Recovery and risk

- Recent injuries, pain areas, and time since last injury.
- Sleep quality and stress.
- Strength-training experience.
- Cross-training availability.
- Travel, work spikes, and other blocked weeks.
- Shoes, terrain, and injury triggers.

### Output preference

- Units: km or miles.
- Pace mode: target pace, RPE, heart rate, or hybrid.
- Sheet start day.
- Which columns and notes to show.
- Whether to include strength, mobility, fuel, and admin reminders.

## How inputs translate into plan levers

| Input | Plan lever |
| --- | --- |
| Race date and start date | Number of weeks, phase lengths, taper timing |
| Current weekly mileage | Initial weekly target |
| Longest recent run | Initial long-run distance |
| Running ability | Total volume scale, long-run cap, workout complexity |
| Runs per week | How weekly distance is distributed |
| Training volume | Build rate and peak mileage |
| Difficulty | Hard-session count, rep volume, long-run intensity |
| Recent race time or target time | Pace targets |
| Injury and stress | Conservative caps, deload frequency, notes |
| Race climate and terrain | Workout notes, RPE fallback, heat-specific guidance |
| Strength preference | Strength frequency and placement |

## UX decisions to replicate

- Start with the minimum viable onboarding, then expose advanced controls.
- Treat ability, training volume, and difficulty as separate knobs.
- Make the plan explainable: every week should have a phase, focus, key sessions, and adjustment guidance.
- Keep the output editable. The Google Sheet should invite logging actual distance and remarks.
- Regenerate safely when preferences change.

