# AI Marathon Plan Generator

An early-stage marathon training program generator inspired by high-quality running apps such as Runna.

The product goal is simple:

1. Ask the runner the right questions.
2. Turn those answers into safe training levers.
3. Generate a Google Sheets-ready plan that follows the user's existing "Training Plan" format.

## Current scope

- Research-backed intake schema for marathon plan generation.
- Deterministic training-plan engine for weekly mileage, workout types, deloads, taper, long runs, and strength slots.
- Google Sheets-ready `.xlsx` exporter matching the provided workbook structure:
  - top briefing area
  - weekly blocks
  - Mon-Sun session columns
  - planned distance and actual distance rows
  - weekly totals
  - side panels for phase, focus, long run, notes, fuel, risk, and race fit

## Repository layout

```text
docs/
  research.md              Research notes and source-backed product decisions
  training-methodology.md  Training rules used by the generator
examples/
  tai_zhi_sckl_2026.json   Example runner profile
src/marathon_generator/
  models.py                Intake and training-plan dataclasses
  paces.py                 Pace and race-time helpers
  plan.py                  Training plan builder
  export_google_sheet.py   XLSX export shaped for native Google Sheets import
scripts/
  generate_sample.py       Builds an example workbook
tests/
  test_plan.py             Safety and structure checks
```

## Quick start

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python scripts/generate_sample.py
pytest
```

The generated workbook is saved to `outputs/sample_marathon_plan.xlsx`.

## AI design

The first version separates AI from the training engine:

- AI is best used to interpret messy user answers, ask follow-up questions, explain why the plan was built a certain way, and adapt notes.
- The training engine owns safety-sensitive logic such as weekly progression, deloads, taper, long-run caps, and workout distribution.

That split keeps the end product flexible while avoiding the worst failure mode of an AI coach: confident but unsafe training load.

