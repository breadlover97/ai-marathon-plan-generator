from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path

from .models import (
    Difficulty,
    RunnerProfile,
    RunningAbility,
    Session,
    TrainingPlan,
    TrainingVolume,
    TrainingWeek,
    WEEKDAYS,
)
from .paces import MARATHON_KM, marathon_pace_from_goal, pace_band


ABILITY_PEAK_KM = {
    RunningAbility.BEGINNER: 50,
    RunningAbility.INTERMEDIATE: 68,
    RunningAbility.ADVANCED: 88,
    RunningAbility.ELITE: 110,
    RunningAbility.ELITE_PLUS: 130,
}

VOLUME_MULTIPLIER = {
    TrainingVolume.GRADUAL: 0.86,
    TrainingVolume.STEADY: 0.95,
    TrainingVolume.PROGRESSIVE: 1.04,
}

DIFFICULTY_LONG_RUN_QUALITY = {
    Difficulty.COMFORTABLE: 0.25,
    Difficulty.BALANCED: 0.45,
    Difficulty.CHALLENGING: 0.65,
}

ABILITY_RANK = {
    RunningAbility.BEGINNER: 0,
    RunningAbility.INTERMEDIATE: 1,
    RunningAbility.ADVANCED: 2,
    RunningAbility.ELITE: 3,
    RunningAbility.ELITE_PLUS: 4,
}

WORKOUT_LOAD = {
    RunningAbility.BEGINNER: {"share": 0.14, "floor": 4, "cap": 7.5},
    RunningAbility.INTERMEDIATE: {"share": 0.17, "floor": 5.5, "cap": 11},
    RunningAbility.ADVANCED: {"share": 0.20, "floor": 7, "cap": 16},
    RunningAbility.ELITE: {"share": 0.21, "floor": 8, "cap": 18},
    RunningAbility.ELITE_PLUS: {"share": 0.22, "floor": 9, "cap": 20},
}

MEDIUM_LONG_LOAD = {
    RunningAbility.BEGINNER: {"share": 0.16, "floor": 6, "cap": 12},
    RunningAbility.INTERMEDIATE: {"share": 0.17, "floor": 7, "cap": 15},
    RunningAbility.ADVANCED: {"share": 0.18, "floor": 8, "cap": 18},
    RunningAbility.ELITE: {"share": 0.19, "floor": 9, "cap": 20},
    RunningAbility.ELITE_PLUS: {"share": 0.20, "floor": 10, "cap": 22},
}

DIFFICULTY_WORKOUT_MULTIPLIER = {
    Difficulty.COMFORTABLE: 0.85,
    Difficulty.BALANCED: 0.95,
    Difficulty.CHALLENGING: 1.0,
}

LONG_RUN_TARGET_SHARE = 0.43
LONG_RUN_MAX_SHARE = 0.46
LONG_RUN_HARD_CAP_KM = MARATHON_KM * 0.82
MIN_LONG_RUN_CAP_KM = 10


def load_profile(path: str | Path) -> RunnerProfile:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return RunnerProfile(
        athlete_name=data["athlete_name"],
        race_name=data["race_name"],
        start_date=_parse_date(data["start_date"]),
        race_date=_parse_date(data["race_date"]),
        current_weekly_km=float(data["current_weekly_km"]),
        longest_recent_run_km=float(data["longest_recent_run_km"]),
        runs_per_week=int(data["runs_per_week"]),
        running_ability=RunningAbility(data["running_ability"]),
        training_volume=TrainingVolume(data["training_volume"]),
        difficulty=Difficulty(data["difficulty"]),
        goal_time=data.get("goal_time"),
        goal_description=data.get("goal_description", "Finish strong"),
        current_marathon_pace=data.get("current_marathon_pace"),
        workout_day=data.get("workout_day", "Monday"),
        medium_long_day=data.get("medium_long_day", "Wednesday"),
        long_run_day=data.get("long_run_day", "Saturday"),
        strength_days=tuple(data.get("strength_days", ["Thursday"])),
        rest_days=tuple(data.get("rest_days", ["Sunday"])),
        max_long_run_km=data.get("max_long_run_km"),
        primary_risks=data.get("primary_risks", ""),
        race_specifics=data.get("race_specifics", ""),
        fuel_notes=data.get("fuel_notes", ""),
        admin_notes=data.get("admin_notes", ""),
        constraints=tuple(data.get("constraints", [])),
    )


def build_training_plan(profile: RunnerProfile) -> TrainingPlan:
    warnings = _validate_profile(profile)
    total_weeks = ((profile.race_date - profile.start_date).days // 7) + 1
    goal_pace = marathon_pace_from_goal(profile.goal_time)
    weekly_targets = _weekly_targets(profile, total_weeks)
    long_targets = _long_run_targets(profile, weekly_targets, total_weeks)

    weeks: list[TrainingWeek] = []
    for index in range(total_weeks):
        week_number = index + 1
        week_start = profile.start_date + timedelta(days=index * 7)
        week_end = week_start + timedelta(days=6)
        phase = _phase_for_week(week_number, total_weeks)
        target_km = weekly_targets[index]
        long_km = long_targets[index]
        sessions = _sessions_for_week(profile, week_number, total_weeks, phase, target_km, long_km, goal_pace)
        weeks.append(
            TrainingWeek(
                week_number=week_number,
                start_date=week_start,
                end_date=week_end,
                phase=phase,
                focus=_focus_for_week(phase, week_number, total_weeks),
                target_km=round(sum(s.planned_km for s in sessions), 1),
                long_run_summary=_long_run_summary(sessions, profile.long_run_day),
                key_sessions=_key_sessions(sessions),
                notes=_notes_for_week(profile, phase, week_number, total_weeks),
                strength_note=_strength_note(profile),
                fuel_note=_fuel_note(profile, phase, week_number, total_weeks),
                risk_note=_risk_note(profile),
                race_fit=_race_fit(phase, week_number, total_weeks),
                adjust_note=_adjust_note(profile),
                sessions=sessions,
            )
        )
    peak_long_run = max(
        (
            session.planned_km
            for week in weeks[:-1]
            for session in week.sessions
            if session.session_type == "Long Run"
        ),
        default=0,
    )
    effective_cap = _effective_long_run_cap(profile)
    if profile.max_long_run_km and peak_long_run < _round_distance(effective_cap) - 0.1:
        warnings.append(
            f"Peak long run is {peak_long_run:g} km because the weekly volume cap could not safely support "
            f"{_round_distance(effective_cap):g} km."
        )
    return TrainingPlan(
        profile=profile,
        weeks=weeks,
        goal_pace_per_km=goal_pace,
        current_marathon_pace=profile.current_marathon_pace,
        plan_warnings=warnings,
    )


def _parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def _validate_profile(profile: RunnerProfile) -> list[str]:
    warnings: list[str] = []
    if profile.race_date < profile.start_date:
        raise ValueError("race_date must be after start_date")
    if profile.runs_per_week < 3:
        warnings.append("Fewer than 3 runs per week is usually not enough for a marathon-specific plan.")
    if profile.runs_per_week > 7:
        raise ValueError("runs_per_week cannot exceed 7")
    if profile.current_weekly_km <= 0:
        raise ValueError("current_weekly_km must be greater than zero")
    if profile.longest_recent_run_km <= 0:
        raise ValueError("longest_recent_run_km must be greater than zero")
    if profile.max_long_run_km is not None and profile.max_long_run_km < MIN_LONG_RUN_CAP_KM:
        raise ValueError(f"max_long_run_km must be at least {MIN_LONG_RUN_CAP_KM:g} km")
    if profile.max_long_run_km and profile.max_long_run_km > LONG_RUN_HARD_CAP_KM:
        warnings.append(f"Max long run capped at {_round_distance(LONG_RUN_HARD_CAP_KM):g} km for marathon safety.")
    if profile.running_ability == RunningAbility.BEGINNER and profile.difficulty == Difficulty.CHALLENGING:
        warnings.append("Beginner plans keep workouts conservative even when difficulty is challenging.")
    if profile.longest_recent_run_km > profile.current_weekly_km * 0.75:
        warnings.append("Longest recent run is high relative to weekly distance. Build weeks will stay conservative.")
    days = {profile.workout_day, profile.medium_long_day, profile.long_run_day, *profile.strength_days, *profile.rest_days}
    unknown = sorted(day for day in days if day not in WEEKDAYS)
    if unknown:
        raise ValueError(f"Unknown weekday(s): {', '.join(unknown)}")
    key_days = [profile.workout_day, profile.medium_long_day, profile.long_run_day]
    if len(set(key_days)) != len(key_days):
        raise ValueError("workout_day, medium_long_day, and long_run_day must be different")
    rest_days = set(profile.rest_days)
    strength_days = set(profile.strength_days)
    for day in key_days:
        if day in rest_days:
            raise ValueError("Key run days cannot also be rest days")
        if day in strength_days:
            raise ValueError("Key run days cannot also be strength-only days")
    available_run_days = len([day for day in WEEKDAYS if day not in rest_days and day not in strength_days])
    if profile.runs_per_week > available_run_days:
        raise ValueError("runs_per_week exceeds available run days after rest and strength days")
    return warnings


def _weekly_targets(profile: RunnerProfile, total_weeks: int) -> list[float]:
    peak_cap = ABILITY_PEAK_KM[profile.running_ability] * VOLUME_MULTIPLIER[profile.training_volume]
    natural_peak = profile.current_weekly_km * (1.45 if total_weeks >= 18 else 1.25)
    long_run_peak_floor = _effective_long_run_cap(profile) / LONG_RUN_TARGET_SHARE
    peak = min(peak_cap, max(profile.current_weekly_km * 1.15, natural_peak, long_run_peak_floor))
    start = max(profile.current_weekly_km * 0.95, profile.current_weekly_km - 5)

    taper_weeks = 3 if total_weeks >= 16 else 2
    build_weeks = max(total_weeks - taper_weeks, 1)
    targets: list[float] = []
    last_build = start

    for week in range(1, build_weeks + 1):
        progress = (week - 1) / max(build_weeks - 1, 1)
        ideal = start + (peak - start) * progress
        if week % 4 == 0 and week < build_weeks:
            target = max(start * 0.92, last_build * 0.82)
        else:
            target = min(ideal, last_build * 1.08)
            last_build = target
        target = max(target, start * 0.88)
        targets.append(round(target, 1))

    if taper_weeks == 3:
        taper = [peak * 0.72, peak * 0.50, max(MARATHON_KM + 12, peak * 0.60)]
    else:
        taper = [peak * 0.55, max(MARATHON_KM + 10, peak * 0.60)]
    targets.extend(round(value, 1) for value in taper)
    return targets[:total_weeks]


def _long_run_targets(profile: RunnerProfile, weekly_targets: list[float], total_weeks: int) -> list[float]:
    cap = _effective_long_run_cap(profile)
    start = min(max(profile.longest_recent_run_km + 3, profile.longest_recent_run_km * 1.1), cap)
    taper_weeks = 3 if total_weeks >= 16 else 2
    build_weeks = max(total_weeks - taper_weeks, 1)
    long_runs: list[float] = []
    last_build = start

    for week in range(1, build_weeks + 1):
        progress = (week - 1) / max(build_weeks - 1, 1)
        ideal = start + (cap - start) * progress
        if week % 4 == 0 and week < build_weeks:
            target = max(start * 0.85, last_build * 0.72)
        else:
            target = min(ideal, last_build + 2.5)
            last_build = target
        weekly_limit = weekly_targets[week - 1] * LONG_RUN_MAX_SHARE
        if week == build_weeks and weekly_limit >= cap:
            target = cap
        target = min(target, weekly_limit, cap)
        long_runs.append(_round_distance(target))

    if taper_weeks == 3:
        long_runs.extend([_round_distance(cap * 0.65), _round_distance(cap * 0.45), MARATHON_KM])
    else:
        long_runs.extend([_round_distance(cap * 0.50), MARATHON_KM])
    return long_runs[:total_weeks]


def _default_long_run_cap(profile: RunnerProfile) -> float:
    return min(MARATHON_KM * 0.80, ABILITY_PEAK_KM[profile.running_ability] * 0.40)


def _effective_long_run_cap(profile: RunnerProfile) -> float:
    requested_cap = profile.max_long_run_km if profile.max_long_run_km is not None else _default_long_run_cap(profile)
    return min(requested_cap, LONG_RUN_HARD_CAP_KM)


def _round_distance(value: float) -> float:
    rounded = int(value * 2 + 0.5) / 2
    return int(rounded) if rounded.is_integer() else rounded


def _format_km(value: float) -> str:
    return f"{value:g}"


def _sessions_for_week(
    profile: RunnerProfile,
    week_number: int,
    total_weeks: int,
    phase: str,
    target_km: float,
    long_km: float,
    goal_pace: str | None,
) -> list[Session]:
    race_week = week_number == total_weeks
    race_day = WEEKDAYS[profile.race_date.weekday()] if race_week else None
    day_types = {day: "Rest" for day in WEEKDAYS}
    if not race_week or profile.workout_day != race_day:
        day_types[profile.workout_day] = _workout_type(profile, phase, week_number, race_week)
    if not race_week or profile.medium_long_day != race_day:
        day_types[profile.medium_long_day] = "Easy Run" if race_week else "Medium-Long"
    if race_week:
        day_types[race_day] = "Race"
    else:
        day_types[profile.long_run_day] = "Long Run"
    for day in profile.strength_days:
        if day == race_day:
            continue
        day_types[day] = "Strength"
    for day in profile.rest_days:
        if day == race_day:
            continue
        day_types[day] = "Rest"

    run_days = [day for day in WEEKDAYS if day_types[day] not in {"Rest", "Strength"}]
    while len(run_days) < profile.runs_per_week:
        for candidate in WEEKDAYS:
            if candidate not in run_days and candidate not in profile.rest_days and day_types[candidate] == "Rest":
                day_types[candidate] = "Easy Run"
                run_days.append(candidate)
                break
        else:
            break

    workout_km = _workout_distance(profile, target_km, long_km, race_week)
    medium_km = _medium_long_distance(profile, target_km, race_week)
    easy_budget = max(target_km - long_km - workout_km - medium_km, 0)
    easy_days = [day for day in run_days if day_types[day] == "Easy Run"]
    easy_km = round(easy_budget / max(len(easy_days), 1), 1)

    sessions: list[Session] = []
    for day in WEEKDAYS:
        session_type = day_types[day]
        if session_type == "Rest":
            sessions.append(Session(day, "Rest", "Full rest", 0))
        elif session_type == "Strength":
            sessions.append(Session(day, "Strength", _strength_plan(profile), 0))
        elif session_type == "Medium-Long":
            sessions.append(Session(day, session_type, _medium_long_plan(profile, phase), round(medium_km, 1)))
        elif session_type in {"Long Run", "Race"}:
            sessions.append(Session(day, session_type, _long_run_plan(profile, phase, week_number, total_weeks, long_km, goal_pace), round(long_km, 1)))
        elif session_type == "Easy Run":
            sessions.append(Session(day, session_type, _easy_plan(week_number), easy_km))
        else:
            sessions.append(Session(day, session_type, _workout_plan(profile, session_type, phase, goal_pace), round(workout_km, 1)))
    return sessions


def _phase_for_week(week_number: int, total_weeks: int) -> str:
    if week_number > total_weeks - 3:
        return "Taper"
    ratio = week_number / max(total_weeks, 1)
    if ratio <= 0.32:
        return "Base Build"
    if ratio <= 0.68:
        return "Marathon Build"
    return "Race Specific"


def _workout_distance(profile: RunnerProfile, target_km: float, long_km: float, race_week: bool) -> float:
    if race_week:
        return min(6, max(4, target_km - long_km))
    load = WORKOUT_LOAD[profile.running_ability]
    scaled = target_km * load["share"] * DIFFICULTY_WORKOUT_MULTIPLIER[profile.difficulty]
    return max(load["floor"], min(scaled, load["cap"]))


def _medium_long_distance(profile: RunnerProfile, target_km: float, race_week: bool) -> float:
    if race_week:
        return 0
    load = MEDIUM_LONG_LOAD[profile.running_ability]
    medium_km = max(load["floor"], min(target_km * load["share"], load["cap"]))
    if profile.runs_per_week <= 4:
        medium_km *= 0.75
    return medium_km


def _workout_type(profile: RunnerProfile, phase: str, week_number: int, race_week: bool) -> str:
    if race_week:
        return "Sharpen"
    if profile.running_ability == RunningAbility.BEGINNER:
        if phase == "Base Build":
            return _cycle(["Easy Strides", "Short Fartlek", "Steady Intro"], week_number)
        if phase == "Marathon Build":
            return _cycle(["Short Fartlek", "Hill Strides", "Steady Intro"], week_number)
        if phase == "Race Specific":
            return _cycle(["Marathon Rhythm", "Short Fartlek", "Easy Strides"], week_number)
        return "Easy Strides"
    if profile.difficulty == Difficulty.COMFORTABLE:
        if phase == "Base Build":
            return _cycle(["Easy Strides", "Steady Intro", "Short Fartlek"], week_number)
        if phase == "Marathon Build":
            return _cycle(["Steady Intro", "Hill Strides", "Tempo"], week_number)
        if phase == "Race Specific":
            return _cycle(["Marathon Rhythm", "Steady Intro", "Easy Strides"], week_number)
        return "Sharpen"
    if profile.running_ability == RunningAbility.INTERMEDIATE:
        if phase == "Base Build":
            return _cycle(["Easy Strides", "Tempo", "Steady-State"], week_number)
        if phase == "Marathon Build":
            return _cycle(["Threshold", "Tempo", "Hill Repeats", "Short Fartlek"], week_number)
        if phase == "Race Specific":
            return _cycle(["Marathon Pace", "Tempo", "Threshold"], week_number)
        return "Sharpen"
    if phase == "Base Build":
        return ["Threshold", "Tempo", "Steady-State"][week_number % 3]
    if phase == "Marathon Build":
        return ["Intervals", "Tempo", "Hill Repeats", "Threshold"][week_number % 4]
    if phase == "Race Specific":
        return ["Marathon Pace", "Tempo", "Intervals"][week_number % 3]
    return "Sharpen"


def _cycle(items: list[str], week_number: int) -> str:
    return items[(week_number - 1) % len(items)]


def _workout_plan(profile: RunnerProfile, session_type: str, phase: str, goal_pace: str | None) -> str:
    easy_band = pace_band(goal_pace, 1.25, 1.45)
    tempo_band = pace_band(goal_pace, 0.92, 0.97)
    interval_band = pace_band(goal_pace, 0.85, 0.90)
    rank = ABILITY_RANK[profile.running_ability]
    conservative = rank <= 1 or profile.difficulty == Difficulty.COMFORTABLE
    if session_type == "Easy Strides":
        return f"Easy run + 6 x 20 sec relaxed strides, full easy recoveries ({easy_band})"
    if session_type == "Short Fartlek":
        return "WU + 8 x 1 min gently quicker, 2 min easy, CD (RPE 5-6/10)"
    if session_type == "Steady Intro":
        return f"WU + 3 x 5 min steady, 3 min easy, CD ({easy_band})"
    if session_type == "Hill Strides":
        return "Easy run + 6 x 20 sec relaxed hill strides, walk/jog down"
    if session_type == "Marathon Rhythm":
        return f"WU + 3 x 5 min comfortable marathon rhythm, 3 min easy, CD ({goal_pace or 'RPE 5-6/10'})"
    if session_type == "Threshold":
        if conservative:
            return f"WU + 5 x 3 min controlled threshold, 2 min easy, CD ({tempo_band})"
        if profile.difficulty == Difficulty.BALANCED:
            return f"WU + 3 x 1.5 km controlled threshold, jog recoveries, CD ({tempo_band})"
        return f"WU + 4 x 2 km controlled threshold, jog recoveries, CD ({tempo_band})"
    if session_type == "Tempo":
        if conservative:
            return f"WU + 3 x 6 min controlled steady effort, 3 min easy, CD ({tempo_band})"
        if profile.difficulty == Difficulty.BALANCED:
            return f"WU + 2 x 12 min tempo, 4 min jog, CD ({tempo_band})"
        return f"WU + 3 x 15 min tempo, 4 min jog, CD ({tempo_band})"
    if session_type == "Steady-State":
        if conservative:
            return f"WU + 3 x 8 min steady, 3 min jog, CD ({easy_band})"
        return f"WU + 2 x 20 min steady, 5 min jog, CD ({easy_band})"
    if session_type == "Intervals":
        if conservative:
            return f"WU + 6 x 400 m controlled, 400 m easy, CD ({interval_band})"
        return f"WU + 8 x 800 m controlled reps, 400 m jog, CD ({interval_band})"
    if session_type == "Hill Repeats":
        if conservative:
            return "WU + 8 x 45 sec uphill controlled, jog down, CD (RPE-based)"
        return "WU + 10 x 75 sec uphill strong, jog down, CD (RPE-based)"
    if session_type == "Marathon Pace":
        if conservative:
            return f"WU + 3 x 8 min marathon rhythm, 3 min easy, CD ({goal_pace or 'RPE 6/10'})"
        if profile.difficulty == Difficulty.BALANCED:
            return f"WU + 2 x 4 km at marathon effort, 1 km easy, CD ({goal_pace or 'RPE 6-7/10'})"
        return f"WU + 3 x 5 km at marathon effort, 1 km easy, CD ({goal_pace or 'RPE 6-7/10'})"
    if session_type == "Sharpen":
        return "Short easy run + 6 relaxed strides"
    return "Controlled quality session"


def _easy_plan(week_number: int) -> str:
    return "Easy aerobic + 6 strides" if week_number % 2 else "Easy aerobic"


def _medium_long_plan(profile: RunnerProfile, phase: str) -> str:
    if profile.running_ability == RunningAbility.BEGINNER or profile.difficulty == Difficulty.COMFORTABLE:
        return "Medium-long easy, conversational throughout"
    if phase == "Race Specific":
        return "Medium-long easy with last 20 min steady if fresh"
    if phase == "Taper":
        return "Reduced medium-long, relaxed and conversational"
    return "Medium-long easy, finish relaxed"


def _long_run_plan(profile: RunnerProfile, phase: str, week_number: int, total_weeks: int, distance: float, goal_pace: str | None) -> str:
    if week_number == total_weeks:
        return f"Race day: {MARATHON_KM:.1f} km, execute fueling and pacing"
    if phase == "Base Build":
        return f"{_format_km(distance)} km easy, no pace pressure"
    if profile.running_ability == RunningAbility.BEGINNER or profile.difficulty == Difficulty.COMFORTABLE:
        if phase in {"Marathon Build", "Race Specific"}:
            return f"{_format_km(distance)} km easy with fueling practice; keep the finish relaxed"
        return f"{_format_km(distance)} km easy, conversational throughout"
    quality_share = DIFFICULTY_LONG_RUN_QUALITY[profile.difficulty]
    if phase == "Race Specific" and week_number % 2 == 1:
        minimum_block = 4 if ABILITY_RANK[profile.running_ability] <= 1 else 6
        mp_block = max(minimum_block, round(distance * quality_share * 0.35))
        return f"{_format_km(distance)} km with {mp_block} km total at marathon effort ({goal_pace or 'RPE 6-7/10'})"
    if week_number % 3 == 0:
        steady_finish = 3 if ABILITY_RANK[profile.running_ability] <= 1 else 5
        return f"{_format_km(distance)} km progression, last {steady_finish} km steady"
    return f"{_format_km(distance)} km easy with fueling test"


def _strength_plan(profile: RunnerProfile) -> str:
    if profile.difficulty == Difficulty.CHALLENGING:
        return "Legs/core strength: calves, split squats, bridges, planks, mobility"
    return "Running strength + mobility, keep it submaximal"


def _focus_for_week(phase: str, week_number: int, total_weeks: int) -> str:
    if week_number == total_weeks:
        return "Race week: stay fresh, protect sleep, execute the plan."
    if phase == "Base Build":
        return "Build durable rhythm without chasing pace."
    if phase == "Marathon Build":
        return "Increase repeatable volume and controlled quality."
    if phase == "Race Specific":
        return "Practice marathon rhythm, fueling, and late-run control."
    return "Reduce volume while keeping the legs responsive."


def _notes_for_week(profile: RunnerProfile, phase: str, week_number: int, total_weeks: int) -> str:
    if week_number == total_weeks:
        return "Nothing new. Keep easy runs easy and trust the taper."
    if week_number % 4 == 0 and phase != "Taper":
        return "Deload week. Let the reduced distance absorb the previous block."
    if profile.constraints:
        return f"Watch: {profile.constraints[0]}"
    return "Keep all easy days honest and log sleep, soreness, and energy."


def _fuel_note(profile: RunnerProfile, phase: str, week_number: int, total_weeks: int) -> str:
    if week_number == total_weeks:
        return "Use rehearsed race fueling only"
    if phase in {"Marathon Build", "Race Specific"}:
        return profile.fuel_notes or "Practice carbs and fluids during long run"
    return "Start noting tolerance"


def _risk_note(profile: RunnerProfile) -> str:
    return profile.primary_risks or "Reduce volume first if pain or fatigue spikes"


def _race_fit(phase: str, week_number: int, total_weeks: int) -> str:
    if week_number == total_weeks:
        return "Race execution"
    if phase == "Base Build":
        return "Build gradually"
    if phase == "Marathon Build":
        return "Durability"
    if phase == "Race Specific":
        return "Specific fitness"
    return "Freshen up"


def _adjust_note(profile: RunnerProfile) -> str:
    if profile.primary_risks:
        return f"Cut volume first if {profile.primary_risks.lower()} risk rises"
    return "Cut volume before adding intensity"


def _strength_note(profile: RunnerProfile) -> str:
    days = ", ".join(profile.strength_days) or "as scheduled"
    return f"{days} strength: calves, glutes, single-leg control, core, mobility"


def _long_run_summary(sessions: list[Session], long_run_day: str) -> str:
    session = next((session for session in sessions if session.day == long_run_day and session.session_type in {"Long Run", "Race"}), None)
    if session is None:
        session = next((session for session in sessions if session.session_type in {"Race", "Long Run"}), None)
    if session is None:
        return "Not scheduled"
    return f"{session.planned_km:g} km {session.session_type.lower()}"


def _key_sessions(sessions: list[Session]) -> str:
    key_types = [s.session_type for s in sessions if s.session_type not in {"Rest", "Strength", "Easy Run"}]
    return "; ".join(key_types)
