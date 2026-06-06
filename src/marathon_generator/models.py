from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import StrEnum


class RunningAbility(StrEnum):
    NEW = "new"
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    ELITE = "elite"
    ELITE_PLUS = "elite_plus"


class TrainingVolume(StrEnum):
    GRADUAL = "gradual"
    STEADY = "steady"
    PROGRESSIVE = "progressive"


class Difficulty(StrEnum):
    COMFORTABLE = "comfortable"
    BALANCED = "balanced"
    CHALLENGING = "challenging"


class RaceDistance(StrEnum):
    TEN_K = "10k"
    HALF_MARATHON = "half_marathon"
    MARATHON = "marathon"


WEEKDAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]


@dataclass(frozen=True)
class RunnerProfile:
    athlete_name: str
    race_name: str
    start_date: date
    race_date: date
    current_weekly_km: float
    longest_recent_run_km: float
    runs_per_week: int
    running_ability: RunningAbility
    training_volume: TrainingVolume
    difficulty: Difficulty
    goal_time: str | None = None
    goal_description: str = "Finish strong"
    current_marathon_pace: str | None = None
    race_distance: RaceDistance = RaceDistance.MARATHON
    workout_day: str = "Monday"
    medium_long_day: str = "Wednesday"
    long_run_day: str = "Saturday"
    strength_days: tuple[str, ...] = ("Thursday",)
    rest_days: tuple[str, ...] = ("Sunday",)
    max_long_run_km: float | None = None
    primary_risks: str = ""
    race_specifics: str = ""
    fuel_notes: str = ""
    admin_notes: str = ""
    constraints: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class Session:
    day: str
    session_type: str
    plan: str
    planned_km: float


@dataclass(frozen=True)
class TrainingWeek:
    week_number: int
    start_date: date
    end_date: date
    phase: str
    focus: str
    target_km: float
    long_run_summary: str
    key_sessions: str
    notes: str
    strength_note: str
    fuel_note: str
    risk_note: str
    race_fit: str
    adjust_note: str
    sessions: list[Session]


@dataclass(frozen=True)
class TrainingPlan:
    profile: RunnerProfile
    weeks: list[TrainingWeek]
    goal_pace_per_km: str | None
    current_marathon_pace: str | None
    race_distance_key: str = RaceDistance.MARATHON.value
    race_label: str = "Marathon"
    race_distance_km: float = 42.195
    plan_title: str = "Marathon Training Plan"
    plan_warnings: list[str] = field(default_factory=list)
