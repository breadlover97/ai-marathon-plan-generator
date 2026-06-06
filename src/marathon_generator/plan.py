from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path

from .models import (
    Difficulty,
    RaceDistance,
    RunnerProfile,
    RunningAbility,
    Session,
    TrainingPlan,
    TrainingVolume,
    TrainingWeek,
    WEEKDAYS,
)
from .paces import HALF_MARATHON_KM, MARATHON_KM, TEN_K_KM, goal_pace_from_goal, pace_band


ABILITY_PEAK_KM = {
    RunningAbility.NEW: 45,
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
    RunningAbility.NEW: 0,
    RunningAbility.BEGINNER: 1,
    RunningAbility.INTERMEDIATE: 2,
    RunningAbility.ADVANCED: 3,
    RunningAbility.ELITE: 4,
    RunningAbility.ELITE_PLUS: 5,
}

WORKOUT_LOAD = {
    RunningAbility.NEW: {"share": 0.12, "floor": 1, "cap": 4},
    RunningAbility.BEGINNER: {"share": 0.14, "floor": 4, "cap": 7.5},
    RunningAbility.INTERMEDIATE: {"share": 0.17, "floor": 5.5, "cap": 11},
    RunningAbility.ADVANCED: {"share": 0.20, "floor": 7, "cap": 16},
    RunningAbility.ELITE: {"share": 0.21, "floor": 8, "cap": 18},
    RunningAbility.ELITE_PLUS: {"share": 0.22, "floor": 9, "cap": 20},
}

MEDIUM_LONG_LOAD = {
    RunningAbility.NEW: {"share": 0.14, "floor": 1, "cap": 7},
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


@dataclass(frozen=True)
class RaceConfig:
    key: RaceDistance
    label: str
    title: str
    distance_km: float
    build_phase: str
    peak_scale: float
    natural_peak_long: float
    natural_peak_short: float
    long_run_target_share: float
    long_run_max_share: float
    min_long_run_cap_km: float
    hard_long_run_cap_km: float
    default_long_run_caps: dict[RunningAbility, float] | None
    race_week_volume_floor: float
    race_week_volume_share: float
    easy_band: tuple[float, float]
    tempo_band: tuple[float, float]
    interval_band: tuple[float, float]
    race_execution: str


RACE_CONFIGS = {
    RaceDistance.TEN_K: RaceConfig(
        key=RaceDistance.TEN_K,
        label="10K",
        title="10K Training Plan",
        distance_km=TEN_K_KM,
        build_phase="Speed Build",
        peak_scale=0.72,
        natural_peak_long=1.25,
        natural_peak_short=1.15,
        long_run_target_share=0.34,
        long_run_max_share=0.42,
        min_long_run_cap_km=6,
        hard_long_run_cap_km=18,
        default_long_run_caps={
            RunningAbility.BEGINNER: 8,
            RunningAbility.NEW: 8,
            RunningAbility.INTERMEDIATE: 11,
            RunningAbility.ADVANCED: 14,
            RunningAbility.ELITE: 16,
            RunningAbility.ELITE_PLUS: 18,
        },
        race_week_volume_floor=6,
        race_week_volume_share=0.45,
        easy_band=(1.25, 1.55),
        tempo_band=(1.03, 1.10),
        interval_band=(0.94, 1.00),
        race_execution="10K pacing: controlled first 3 km, commit after 7 km",
    ),
    RaceDistance.HALF_MARATHON: RaceConfig(
        key=RaceDistance.HALF_MARATHON,
        label="Half Marathon",
        title="Half Marathon Training Plan",
        distance_km=HALF_MARATHON_KM,
        build_phase="Endurance Build",
        peak_scale=0.86,
        natural_peak_long=1.35,
        natural_peak_short=1.20,
        long_run_target_share=0.38,
        long_run_max_share=0.45,
        min_long_run_cap_km=10,
        hard_long_run_cap_km=24,
        default_long_run_caps={
            RunningAbility.BEGINNER: 15,
            RunningAbility.NEW: 14,
            RunningAbility.INTERMEDIATE: 18,
            RunningAbility.ADVANCED: 21,
            RunningAbility.ELITE: 23,
            RunningAbility.ELITE_PLUS: 24,
        },
        race_week_volume_floor=8,
        race_week_volume_share=0.52,
        easy_band=(1.22, 1.48),
        tempo_band=(0.98, 1.05),
        interval_band=(0.90, 0.97),
        race_execution="half-marathon pacing and controlled fueling",
    ),
    RaceDistance.MARATHON: RaceConfig(
        key=RaceDistance.MARATHON,
        label="Marathon",
        title="Marathon Training Plan",
        distance_km=MARATHON_KM,
        build_phase="Marathon Build",
        peak_scale=1.0,
        natural_peak_long=1.45,
        natural_peak_short=1.25,
        long_run_target_share=0.43,
        long_run_max_share=0.46,
        min_long_run_cap_km=10,
        hard_long_run_cap_km=MARATHON_KM * 0.82,
        default_long_run_caps=None,
        race_week_volume_floor=12,
        race_week_volume_share=0.60,
        easy_band=(1.25, 1.45),
        tempo_band=(0.92, 0.97),
        interval_band=(0.85, 0.90),
        race_execution="rehearsed fueling and pacing",
    ),
}


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
        race_distance=RaceDistance(data.get("race_distance", RaceDistance.MARATHON.value)),
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
    config = _race_config(profile)
    total_weeks = ((profile.race_date - profile.start_date).days // 7) + 1
    goal_pace = goal_pace_from_goal(profile.goal_time, config.distance_km)
    weekly_targets = _weekly_targets(profile, total_weeks)
    long_targets = _long_run_targets(profile, weekly_targets, total_weeks)

    weeks: list[TrainingWeek] = []
    for index in range(total_weeks):
        week_number = index + 1
        week_start = profile.start_date + timedelta(days=index * 7)
        week_end = week_start + timedelta(days=6)
        phase = _phase_for_week(profile, week_number, total_weeks)
        target_km = weekly_targets[index]
        long_km = long_targets[index]
        sessions = _sessions_for_week(profile, week_number, total_weeks, phase, target_km, long_km, goal_pace)
        weeks.append(
            TrainingWeek(
                week_number=week_number,
                start_date=week_start,
                end_date=week_end,
                phase=phase,
                focus=_focus_for_week(profile, phase, week_number, total_weeks),
                target_km=round(sum(s.planned_km for s in sessions), 1),
                long_run_summary=_long_run_summary(sessions, profile.long_run_day),
                key_sessions=_key_sessions(sessions),
                notes=_notes_for_week(profile, phase, week_number, total_weeks),
                strength_note=_strength_note(profile),
                fuel_note=_fuel_note(profile, phase, week_number, total_weeks),
                risk_note=_risk_note(profile),
                race_fit=_race_fit(profile, phase, week_number, total_weeks),
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
        race_distance_key=config.key.value,
        race_label=config.label,
        race_distance_km=config.distance_km,
        plan_title=config.title,
        plan_warnings=warnings,
    )


def _parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def _validate_profile(profile: RunnerProfile) -> list[str]:
    warnings: list[str] = []
    config = _race_config(profile)
    if profile.race_date < profile.start_date:
        raise ValueError("race_date must be after start_date")
    total_weeks = ((profile.race_date - profile.start_date).days // 7) + 1
    if profile.runs_per_week < 3:
        warnings.append(f"Fewer than 3 runs per week is usually not enough for a {config.label} race-specific plan.")
    if profile.runs_per_week > 7:
        raise ValueError("runs_per_week cannot exceed 7")
    if profile.current_weekly_km < 0:
        raise ValueError("current_weekly_km must be 0 km or higher")
    if profile.longest_recent_run_km < 0:
        raise ValueError("longest_recent_run_km must be 0 km or higher")
    if profile.max_long_run_km is not None and profile.max_long_run_km < config.min_long_run_cap_km:
        raise ValueError(f"max_long_run_km must be at least {config.min_long_run_cap_km:g} km for a {config.label} plan")
    if profile.max_long_run_km and profile.max_long_run_km > config.hard_long_run_cap_km:
        warnings.append(f"Max long run capped at {_round_distance(config.hard_long_run_cap_km):g} km for {config.label} safety.")
    if _low_base_profile(profile):
        warnings.append("Little or no running base detected. The plan starts with run-walk volume and keeps workouts effort-based until consistency is established.")
        if config.key == RaceDistance.MARATHON and total_weeks < 24:
            warnings.append("A marathon from little or no base is high risk on this timeline. Extend the plan if possible, or consider a 10K/half-marathon stepping stone.")
    if profile.running_ability in {RunningAbility.NEW, RunningAbility.BEGINNER} and profile.difficulty == Difficulty.CHALLENGING:
        warnings.append("New and beginner plans keep workouts conservative even when difficulty is challenging.")
    if profile.current_weekly_km > 0 and profile.longest_recent_run_km > profile.current_weekly_km * 0.75:
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
    config = _race_config(profile)
    raw_current = _current_weekly_km(profile)
    current = _planning_start_km(profile, config)
    peak_cap = ABILITY_PEAK_KM[profile.running_ability] * VOLUME_MULTIPLIER[profile.training_volume] * config.peak_scale
    natural_peak = profile.current_weekly_km * (config.natural_peak_long if total_weeks >= 14 else config.natural_peak_short)
    long_run_peak_floor = _effective_long_run_cap(profile) / config.long_run_target_share
    peak = min(peak_cap, max(current * 1.15, natural_peak, long_run_peak_floor))
    start = current if _low_base_profile(profile) else max(raw_current * 0.95, raw_current - 5)

    taper_weeks = _taper_weeks(profile, total_weeks)
    build_weeks = max(total_weeks - taper_weeks, 1)
    targets: list[float] = []
    last_build = start

    for week in range(1, build_weeks + 1):
        progress = (week - 1) / max(build_weeks - 1, 1)
        ideal = start + (peak - start) * progress
        if week % 4 == 0 and week < build_weeks:
            target = max(start * 0.92, last_build * 0.82)
        else:
            max_build_step = _low_base_weekly_step(config) if _low_base_profile(profile) else last_build * 0.08
            target = min(ideal, last_build + max(max_build_step, last_build * 0.08))
            last_build = target
        target = max(target, start * 0.88)
        targets.append(round(target, 1))

    taper = _taper_targets(profile, config, peak, taper_weeks)
    targets.extend(round(value, 1) for value in taper)
    return targets[:total_weeks]


def _long_run_targets(profile: RunnerProfile, weekly_targets: list[float], total_weeks: int) -> list[float]:
    config = _race_config(profile)
    cap = _effective_long_run_cap(profile)
    recent = _planning_recent_long_run_km(profile, config)
    start = min(max(recent + _long_run_start_add(profile, config), recent * 1.1), cap)
    taper_weeks = _taper_weeks(profile, total_weeks)
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
        weekly_limit = weekly_targets[week - 1] * config.long_run_max_share
        if week == build_weeks and weekly_limit >= cap:
            target = cap
        target = min(target, weekly_limit, cap)
        long_runs.append(_round_distance(target))

    long_runs.extend(_taper_long_runs(config, cap, taper_weeks))
    return long_runs[:total_weeks]


def _default_long_run_cap(profile: RunnerProfile) -> float:
    config = _race_config(profile)
    if config.default_long_run_caps:
        return config.default_long_run_caps[profile.running_ability]
    return min(MARATHON_KM * 0.80, ABILITY_PEAK_KM[profile.running_ability] * 0.40)


def _effective_long_run_cap(profile: RunnerProfile) -> float:
    config = _race_config(profile)
    requested_cap = profile.max_long_run_km if profile.max_long_run_km is not None else _default_long_run_cap(profile)
    return min(requested_cap, config.hard_long_run_cap_km)


def _race_config(profile: RunnerProfile) -> RaceConfig:
    return RACE_CONFIGS.get(profile.race_distance, RACE_CONFIGS[RaceDistance.MARATHON])


def _current_weekly_km(profile: RunnerProfile) -> float:
    return profile.current_weekly_km if math.isfinite(profile.current_weekly_km) and profile.current_weekly_km > 0 else 0


def _recent_long_run_km(profile: RunnerProfile) -> float:
    return profile.longest_recent_run_km if math.isfinite(profile.longest_recent_run_km) and profile.longest_recent_run_km > 0 else 0


def _low_base_profile(profile: RunnerProfile) -> bool:
    return profile.running_ability == RunningAbility.NEW or _current_weekly_km(profile) < 5 or _recent_long_run_km(profile) < 3


def _planning_start_km(profile: RunnerProfile, config: RaceConfig) -> float:
    current = _current_weekly_km(profile)
    if not _low_base_profile(profile):
        return current
    if config.key == RaceDistance.TEN_K:
        return max(current, 3)
    if config.key == RaceDistance.HALF_MARATHON:
        return max(current, 4)
    return max(current, 5)


def _planning_recent_long_run_km(profile: RunnerProfile, config: RaceConfig) -> float:
    recent = _recent_long_run_km(profile)
    if not _low_base_profile(profile):
        return recent
    if config.key == RaceDistance.TEN_K:
        return max(recent, 1)
    if config.key == RaceDistance.HALF_MARATHON:
        return max(recent, 2)
    return max(recent, 3)


def _low_base_weekly_step(config: RaceConfig) -> float:
    if config.key == RaceDistance.TEN_K:
        return 2
    if config.key == RaceDistance.HALF_MARATHON:
        return 2.5
    return 3


def _low_base_race_week_floor(config: RaceConfig) -> float:
    if config.key == RaceDistance.TEN_K:
        return 3
    if config.key == RaceDistance.HALF_MARATHON:
        return 5
    return 6


def _taper_weeks(profile: RunnerProfile, total_weeks: int) -> int:
    config = _race_config(profile)
    if config.key == RaceDistance.MARATHON:
        return 3 if total_weeks >= 16 else 2
    if config.key == RaceDistance.HALF_MARATHON:
        return 2 if total_weeks >= 8 else 1
    return 2 if total_weeks >= 7 else 1


def _taper_targets(profile: RunnerProfile, config: RaceConfig, peak: float, taper_weeks: int) -> list[float]:
    race_week_floor = _low_base_race_week_floor(config) if _low_base_profile(profile) else config.race_week_volume_floor
    race_week_share = min(config.race_week_volume_share, 0.45) if _low_base_profile(profile) else config.race_week_volume_share
    race_week_target = max(config.distance_km + race_week_floor, peak * race_week_share)
    if taper_weeks == 3:
        return [peak * 0.72, peak * 0.50, race_week_target]
    if taper_weeks == 2:
        return [peak * 0.55, race_week_target]
    return [race_week_target]


def _taper_long_runs(config: RaceConfig, cap: float, taper_weeks: int) -> list[float]:
    race_distance = _round_distance(config.distance_km)
    if taper_weeks == 3:
        return [_round_distance(cap * 0.65), _round_distance(cap * 0.45), race_distance]
    if taper_weeks == 2:
        return [_round_distance(cap * 0.55), race_distance]
    return [race_distance]


def _long_run_start_add(profile: RunnerProfile, config: RaceConfig) -> float:
    if _low_base_profile(profile):
        return 1
    if config.key == RaceDistance.TEN_K:
        return 2
    if config.key == RaceDistance.HALF_MARATHON:
        return 2.5
    return 3


def _round_distance(value: float) -> float:
    if not math.isfinite(value) or value <= 0:
        return 0
    return round(value)


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
    config = _race_config(profile)
    race_week = week_number == total_weeks
    race_day = WEEKDAYS[profile.race_date.weekday()] if race_week else None
    phase_week_number = _phase_week_number(profile, week_number, total_weeks)
    day_types = {day: "Rest" for day in WEEKDAYS}
    if not race_week or profile.workout_day != race_day:
        day_types[profile.workout_day] = _workout_type(profile, phase, phase_week_number, race_week)
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
    if race_week:
        race_index = WEEKDAYS.index(race_day)
        for day in WEEKDAYS[race_index + 1 :]:
            day_types[day] = "Rest"

    run_days = [day for day in WEEKDAYS if day_types[day] not in {"Rest", "Strength"}]
    while len(run_days) < profile.runs_per_week:
        for candidate in WEEKDAYS:
            if race_week and WEEKDAYS.index(candidate) > WEEKDAYS.index(race_day):
                continue
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
    easy_km = _round_distance(easy_budget / max(len(easy_days), 1))

    sessions: list[Session] = []
    for day in WEEKDAYS:
        session_type = day_types[day]
        if session_type == "Rest":
            sessions.append(Session(day, "Rest", "Full rest", 0))
        elif session_type == "Strength":
            sessions.append(Session(day, "Strength", _strength_plan(profile), 0))
        elif session_type == "Medium-Long":
            sessions.append(Session(day, session_type, _medium_long_plan(profile, phase), _round_distance(medium_km)))
        elif session_type in {"Long Run", "Race"}:
            planned_km = _round_distance(config.distance_km) if session_type == "Race" else _round_distance(long_km)
            sessions.append(Session(day, session_type, _long_run_plan(profile, phase, week_number, total_weeks, long_km, goal_pace), planned_km))
        elif session_type == "Easy Run":
            sessions.append(Session(day, session_type, _easy_plan(week_number), easy_km))
        else:
            sessions.append(Session(day, session_type, _workout_plan(profile, session_type, phase, goal_pace), _round_distance(workout_km)))
    return sessions


def _phase_for_week(profile: RunnerProfile, week_number: int, total_weeks: int) -> str:
    config = _race_config(profile)
    taper_weeks = _taper_weeks(profile, total_weeks)
    if week_number > total_weeks - taper_weeks:
        return "Taper"
    ratio = week_number / max(total_weeks, 1)
    if ratio <= 0.32:
        return "Base Build"
    if ratio <= 0.68:
        return config.build_phase
    return "Race Specific"


def _phase_week_number(profile: RunnerProfile, week_number: int, total_weeks: int) -> int:
    phase = _phase_for_week(profile, week_number, total_weeks)
    start_week = week_number
    while start_week > 1 and _phase_for_week(profile, start_week - 1, total_weeks) == phase:
        start_week -= 1
    return week_number - start_week + 1


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
    config = _race_config(profile)
    if race_week:
        return "Sharpen"
    if profile.running_ability == RunningAbility.NEW:
        if phase == "Base Build":
            return "Run-Walk"
        if phase == config.build_phase:
            return _cycle(["Run-Walk", "Easy Strides", "Steady Intro", "Run-Walk"], week_number)
        if phase == "Race Specific":
            return _cycle([_race_rhythm_type(config), "Run-Walk", "Easy Strides", "Steady Intro"], week_number)
        return "Run-Walk"
    if profile.running_ability == RunningAbility.BEGINNER:
        if phase == "Base Build":
            return _cycle(["Easy Strides", "Short Fartlek", "Intro Track Strides", "Steady Intro"], week_number)
        if phase == config.build_phase:
            return _cycle(["Short Fartlek", "Hill Strides", "Intro Track Strides", "Steady Intro"], week_number)
        if phase == "Race Specific":
            return _cycle([_race_rhythm_type(config), "Short Fartlek", "Intro Track Strides", "Easy Strides"], week_number)
        return "Easy Strides"
    if profile.difficulty == Difficulty.COMFORTABLE:
        if phase == "Base Build":
            return _cycle(["Easy Strides", "Intro Track Strides", "Steady Intro", "Short Fartlek"], week_number)
        if phase == config.build_phase:
            return _cycle(["Steady Intro", "Track 400s", "Hill Strides", "Tempo Intro"], week_number)
        if phase == "Race Specific":
            return _cycle([_race_rhythm_type(config), "Track 400s", "Steady Intro", "Easy Strides"], week_number)
        return "Sharpen"
    if config.key == RaceDistance.TEN_K:
        if phase == "Base Build":
            return _cycle(["Easy Strides", "Tempo Intro", "Track 400s", "Steady-State"], week_number)
        if phase == config.build_phase:
            return _cycle(["Track 400s", "Cruise Intervals", "Hill Repeats", "Track 800s"], week_number)
        if phase == "Race Specific":
            return _cycle(["10K Pace Repeats", "Track 1K Repeats", "Tempo", "Track 400s"], week_number)
        return "Sharpen"
    if config.key == RaceDistance.HALF_MARATHON:
        if phase == "Base Build":
            return _cycle(["Easy Strides", "Tempo Intro", "Track 400s", "Steady-State"], week_number)
        if phase == config.build_phase:
            return _cycle(["Cruise Intervals", "Tempo", "Track 800s", "Hill Repeats"], week_number)
        if phase == "Race Specific":
            return _cycle(["Half Marathon Pace", "Cruise Intervals", "Tempo", "Track 1K Repeats"], week_number)
        return "Sharpen"
    if profile.running_ability == RunningAbility.INTERMEDIATE:
        if phase == "Base Build":
            return _cycle(["Easy Strides", "Tempo Intro", "Track 400s", "Steady-State"], week_number)
        if phase == config.build_phase:
            return _cycle(["Cruise Intervals", "Tempo", "Track 800s", "Hill Repeats"], week_number)
        if phase == "Race Specific":
            return _cycle(["Marathon Pace", "Track 1K Repeats", "Tempo", "Cruise Intervals"], week_number)
        return "Sharpen"
    if phase == "Base Build":
        return _cycle(["Easy Strides", "Tempo Intro", "Track 400s", "Steady-State"], week_number)
    if phase == config.build_phase:
        if ABILITY_RANK[profile.running_ability] >= 4:
            return _cycle(["Track 1K Repeats", "Tempo", "Hill Repeats", "Threshold"], week_number)
        return _cycle(["Track 800s", "Tempo", "Hill Repeats", "Cruise Intervals"], week_number)
    if phase == "Race Specific":
        if ABILITY_RANK[profile.running_ability] >= 4:
            return _cycle(["Marathon Pace", "Track 1600s", "Tempo", "Track 1K Repeats"], week_number)
        return _cycle(["Marathon Pace", "Track 1K Repeats", "Tempo", "Track 800s"], week_number)
    return "Sharpen"


def _race_rhythm_type(config: RaceConfig) -> str:
    if config.key == RaceDistance.TEN_K:
        return "10K Rhythm"
    if config.key == RaceDistance.HALF_MARATHON:
        return "Half Marathon Rhythm"
    return "Marathon Rhythm"


def _cycle(items: list[str], week_number: int) -> str:
    return items[(week_number - 1) % len(items)]


def _workout_plan(profile: RunnerProfile, session_type: str, phase: str, goal_pace: str | None) -> str:
    config = _race_config(profile)
    easy_band = pace_band(goal_pace, *config.easy_band)
    tempo_band = pace_band(goal_pace, *config.tempo_band)
    interval_band = pace_band(goal_pace, *config.interval_band)
    rank = ABILITY_RANK[profile.running_ability]
    conservative = rank <= 2 or profile.difficulty == Difficulty.COMFORTABLE
    challenging = profile.difficulty == Difficulty.CHALLENGING
    if session_type == "Run-Walk":
        return "Run-walk: repeat 2-4 min very easy jog + 1-2 min walk; stop while it still feels controlled (RPE 3-4/10)"
    if session_type == "Easy Strides":
        return f"Easy run + 6 x 20 sec relaxed strides, full easy recoveries ({easy_band})"
    if session_type == "Intro Track Strides":
        return "Track or flat path: 6 x 200 m smooth, 200 m walk-jog; never sprint (RPE 5-6/10)"
    if session_type == "Short Fartlek":
        return "WU + 8 x 1 min gently quicker, 2 min easy, CD (RPE 5-6/10)"
    if session_type == "Steady Intro":
        return f"WU + 3 x 5 min steady, 3 min easy, CD ({easy_band})"
    if session_type == "Hill Strides":
        return "Easy run + 6 x 20 sec relaxed hill strides, walk/jog down"
    if session_type == "Marathon Rhythm":
        return f"WU + 3 x 5 min comfortable marathon rhythm, 3 min easy, CD ({goal_pace or 'RPE 5-6/10'})"
    if session_type == "Half Marathon Rhythm":
        return f"WU + 3 x 5 min comfortable half-marathon rhythm, 3 min easy, CD ({goal_pace or 'RPE 5-6/10'})"
    if session_type == "10K Rhythm":
        return f"WU + 8 x 45 sec smooth 10K rhythm, 90 sec easy, CD ({goal_pace or 'RPE 6/10'})"
    if session_type == "Tempo Intro":
        if conservative:
            return f"WU + 3 x 5 min steady-tempo, 3 min easy, CD ({tempo_band})"
        if rank >= 4 and challenging:
            return f"WU + 3 x 8 min tempo, 3 min jog, CD ({tempo_band})"
        return f"WU + 2 x 10 min controlled tempo, 4 min jog, CD ({tempo_band})"
    if session_type == "Cruise Intervals":
        if conservative:
            return f"WU + 5 x 3 min controlled threshold, 2 min easy, CD ({tempo_band})"
        if rank >= 4 and challenging:
            return f"WU + 6 x 1 km threshold, 90 sec jog, CD ({tempo_band})"
        return f"WU + 4 x 1 km threshold, 90 sec jog, CD ({tempo_band})"
    if session_type == "Track 400s":
        if conservative:
            return "Track: WU + 6 x 400 m controlled, 200 m walk-jog, CD (RPE 6/10)"
        return f"Track: WU + 8 x 400 m controlled, 200 m jog, CD ({interval_band})"
    if session_type == "Track 800s":
        if conservative:
            return f"Track: WU + 5 x 800 m controlled, 400 m jog, CD ({interval_band})"
        reps = 8 if rank >= 4 and challenging else 6
        return f"Track: WU + {reps} x 800 m at 10K effort, 400 m jog, CD ({interval_band})"
    if session_type == "Track 1K Repeats":
        if conservative:
            return f"Track: WU + 4 x 1 km controlled, 2 min jog, CD ({interval_band})"
        reps = 6 if rank >= 4 and challenging else 5
        return f"Track: WU + {reps} x 1 km at 10K effort, 2 min jog, CD ({interval_band})"
    if session_type == "Track 1600s":
        reps = 4 if rank >= 4 and challenging else 3
        return f"Track: WU + {reps} x 1600 m controlled threshold, 400 m jog, CD ({tempo_band})"
    if session_type == "10K Pace Repeats":
        if conservative:
            return f"WU + 6 x 2 min at controlled 10K effort, 2 min easy, CD ({goal_pace or 'RPE 7/10'})"
        if rank >= 4 and challenging:
            return f"Track: WU + 5 x 1 km at 10K effort, 2 min jog, CD ({goal_pace or 'RPE 7-8/10'})"
        return f"Track: WU + 4 x 1 km at 10K effort, 2 min jog, CD ({goal_pace or 'RPE 7/10'})"
    if session_type == "Half Marathon Pace":
        if conservative:
            return f"WU + 3 x 8 min half-marathon rhythm, 3 min easy, CD ({goal_pace or 'RPE 6/10'})"
        if rank >= 4 and challenging:
            return f"WU + 3 x 3 km at half-marathon effort, 1 km easy, CD ({goal_pace or 'RPE 6-7/10'})"
        return f"WU + 2 x 3 km at half-marathon effort, 1 km easy, CD ({goal_pace or 'RPE 6-7/10'})"
    if session_type == "Threshold":
        if conservative:
            return f"WU + 5 x 3 min controlled threshold, 2 min easy, CD ({tempo_band})"
        if rank >= 4 and challenging:
            return f"WU + 4 x 2 km controlled threshold, jog recoveries, CD ({tempo_band})"
        if profile.difficulty == Difficulty.BALANCED:
            return f"WU + 3 x 1.5 km controlled threshold, jog recoveries, CD ({tempo_band})"
        return f"WU + 4 x 1.5 km controlled threshold, jog recoveries, CD ({tempo_band})"
    if session_type == "Tempo":
        if conservative:
            return f"WU + 3 x 6 min controlled steady effort, 3 min easy, CD ({tempo_band})"
        if rank >= 4 and challenging:
            return f"WU + 3 x 15 min tempo, 4 min jog, CD ({tempo_band})"
        if profile.difficulty == Difficulty.BALANCED:
            return f"WU + 2 x 12 min tempo, 4 min jog, CD ({tempo_band})"
        return f"WU + 2 x 15 min tempo, 4 min jog, CD ({tempo_band})"
    if session_type == "Steady-State":
        if conservative:
            return f"WU + 3 x 8 min steady, 3 min jog, CD ({easy_band})"
        if rank >= 4 and challenging:
            return f"WU + 2 x 20 min steady, 5 min jog, CD ({easy_band})"
        return f"WU + 2 x 15 min steady, 5 min jog, CD ({easy_band})"
    if session_type == "Intervals":
        if conservative:
            return f"WU + 6 x 400 m controlled, 400 m easy, CD ({interval_band})"
        reps = 8 if rank >= 4 and challenging else 6
        return f"WU + {reps} x 800 m controlled reps, 400 m jog, CD ({interval_band})"
    if session_type == "Hill Repeats":
        if conservative:
            return "WU + 8 x 45 sec uphill controlled, jog down, CD (RPE-based)"
        return "WU + 10 x 75 sec uphill strong, jog down, CD (RPE-based)"
    if session_type == "Marathon Pace":
        if conservative:
            return f"WU + 3 x 8 min marathon rhythm, 3 min easy, CD ({goal_pace or 'RPE 6/10'})"
        if rank >= 4 and challenging:
            return f"WU + 3 x 5 km at marathon effort, 1 km easy, CD ({goal_pace or 'RPE 6-7/10'})"
        if profile.difficulty == Difficulty.BALANCED:
            return f"WU + 2 x 4 km at marathon effort, 1 km easy, CD ({goal_pace or 'RPE 6-7/10'})"
        return f"WU + 2 x 5 km at marathon effort, 1 km easy, CD ({goal_pace or 'RPE 6-7/10'})"
    if session_type == "Sharpen":
        return "Short easy run + 6 relaxed strides"
    return "Controlled quality session"


def _easy_plan(week_number: int) -> str:
    return "Easy aerobic + 6 strides" if week_number % 2 else "Easy aerobic"


def _medium_long_plan(profile: RunnerProfile, phase: str) -> str:
    if profile.running_ability == RunningAbility.NEW:
        return "Short easy run-walk, conversational throughout"
    if profile.running_ability == RunningAbility.BEGINNER or profile.difficulty == Difficulty.COMFORTABLE:
        return "Medium-long easy, conversational throughout"
    if phase == "Race Specific":
        return "Medium-long easy with last 20 min steady if fresh"
    if phase == "Taper":
        return "Reduced medium-long, relaxed and conversational"
    return "Medium-long easy, finish relaxed"


def _long_run_plan(profile: RunnerProfile, phase: str, week_number: int, total_weeks: int, distance: float, goal_pace: str | None) -> str:
    config = _race_config(profile)
    if week_number == total_weeks:
        return f"{_format_km(_round_distance(config.distance_km))} km race day: execute {config.race_execution}"
    if phase == "Base Build":
        return f"{_format_km(distance)} km easy, no pace pressure"
    if profile.running_ability == RunningAbility.NEW:
        return f"{_format_km(distance)} km run-walk easy; keep breathing controlled and finish fresh"
    if profile.running_ability == RunningAbility.BEGINNER or profile.difficulty == Difficulty.COMFORTABLE:
        if phase in {config.build_phase, "Race Specific"}:
            return f"{_format_km(distance)} km easy with relaxed race-specific awareness; keep the finish controlled"
        return f"{_format_km(distance)} km easy, conversational throughout"
    if config.key == RaceDistance.TEN_K:
        if phase == "Race Specific" and week_number % 2 == 1:
            return f"{_format_km(distance)} km easy with 6 x 45 sec at 10K rhythm in the second half"
        if week_number % 3 == 0:
            return f"{_format_km(distance)} km progression, last 2-3 km steady"
        return f"{_format_km(distance)} km easy, relaxed finish"
    if config.key == RaceDistance.HALF_MARATHON:
        if phase == "Race Specific" and week_number % 2 == 1:
            hm_block = max(4, round(distance * 0.25))
            return f"{_format_km(distance)} km with {hm_block} km total at half-marathon effort ({goal_pace or 'RPE 6-7/10'})"
        if week_number % 3 == 0:
            return f"{_format_km(distance)} km progression, last 4 km steady"
        return f"{_format_km(distance)} km easy with hydration practice"
    quality_share = DIFFICULTY_LONG_RUN_QUALITY[profile.difficulty]
    if phase == "Race Specific" and week_number % 2 == 1:
        minimum_block = 4 if ABILITY_RANK[profile.running_ability] <= 2 else 6
        mp_block = max(minimum_block, round(distance * quality_share * 0.35))
        return f"{_format_km(distance)} km with {mp_block} km total at marathon effort ({goal_pace or 'RPE 6-7/10'})"
    if week_number % 3 == 0:
        steady_finish = 3 if ABILITY_RANK[profile.running_ability] <= 2 else 5
        return f"{_format_km(distance)} km progression, last {steady_finish} km steady"
    return f"{_format_km(distance)} km easy with fueling test"


def _strength_plan(profile: RunnerProfile) -> str:
    if profile.difficulty == Difficulty.CHALLENGING:
        return "Legs/core strength: calves, split squats, bridges, planks, mobility"
    return "Running strength + mobility, keep it submaximal"


def _focus_for_week(profile: RunnerProfile, phase: str, week_number: int, total_weeks: int) -> str:
    config = _race_config(profile)
    if week_number == total_weeks:
        return "Race week: stay fresh, protect sleep, execute the plan."
    if phase == "Base Build":
        return "Build durable rhythm without chasing pace."
    if phase == config.build_phase:
        return "Develop speed endurance without turning every run hard." if config.key == RaceDistance.TEN_K else "Increase repeatable volume and controlled quality."
    if phase == "Race Specific":
        return "Practice marathon rhythm, fueling, and late-run control." if config.key == RaceDistance.MARATHON else f"Practice {config.label} rhythm and race-specific control."
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
    config = _race_config(profile)
    if week_number == total_weeks:
        return "Use rehearsed race fueling only"
    if config.key == RaceDistance.TEN_K:
        return profile.fuel_notes or "Keep hydration simple; practice pre-race breakfast and fluids"
    if phase in {config.build_phase, "Race Specific"}:
        return profile.fuel_notes or "Practice carbs and fluids during long run"
    return "Start noting tolerance"


def _risk_note(profile: RunnerProfile) -> str:
    return profile.primary_risks or "Reduce volume first if pain or fatigue spikes"


def _race_fit(profile: RunnerProfile, phase: str, week_number: int, total_weeks: int) -> str:
    config = _race_config(profile)
    if week_number == total_weeks:
        return "Race execution"
    if phase == "Base Build":
        return "Build gradually"
    if phase == config.build_phase:
        return "Speed endurance" if config.key == RaceDistance.TEN_K else "Durability"
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
