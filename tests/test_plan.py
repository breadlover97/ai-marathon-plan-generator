from dataclasses import replace
from datetime import date

import pytest

from marathon_generator.models import Difficulty, RunnerProfile, RunningAbility, TrainingVolume
from marathon_generator.plan import build_training_plan


def profile() -> RunnerProfile:
    return RunnerProfile(
        athlete_name="Runner",
        race_name="City Marathon",
        start_date=date(2026, 5, 11),
        race_date=date(2026, 10, 4),
        current_weekly_km=52,
        longest_recent_run_km=21,
        runs_per_week=5,
        running_ability=RunningAbility.ADVANCED,
        training_volume=TrainingVolume.PROGRESSIVE,
        difficulty=Difficulty.CHALLENGING,
        goal_time="02:50:00",
        max_long_run_km=34,
    )


def test_plan_has_expected_week_count() -> None:
    plan = build_training_plan(profile())
    assert len(plan.weeks) == 21
    assert plan.weeks[-1].phase == "Taper"


def test_long_run_is_capped_before_race_week() -> None:
    plan = build_training_plan(profile())
    pre_race_long_runs = [
        session.planned_km
        for week in plan.weeks[:-1]
        for session in week.sessions
        if session.session_type == "Long Run"
    ]
    assert max(pre_race_long_runs) <= 34


def test_long_run_reaches_configured_cap_before_taper() -> None:
    plan = build_training_plan(profile())
    pre_race_long_runs = [
        session.planned_km
        for week in plan.weeks[:-1]
        for session in week.sessions
        if session.session_type == "Long Run"
    ]
    assert max(pre_race_long_runs) == 34


def test_long_run_above_hard_safety_cap_is_reduced() -> None:
    runner = replace(profile(), max_long_run_km=40)
    plan = build_training_plan(runner)
    pre_race_long_runs = [
        session.planned_km
        for week in plan.weeks[:-1]
        for session in week.sessions
        if session.session_type == "Long Run"
    ]
    assert max(pre_race_long_runs) <= 34.5
    assert any("Max long run capped" in warning for warning in plan.plan_warnings)


def test_race_week_uses_actual_race_date_not_long_run_day() -> None:
    plan = build_training_plan(profile())
    race_session = next(session for session in plan.weeks[-1].sessions if session.session_type == "Race")
    assert race_session.day == "Sunday"
    assert race_session.planned_km == 42.2
    assert plan.weeks[-1].long_run_summary == "42.2 km race"
    assert all(
        session.planned_km > 0
        for session in plan.weeks[-1].sessions
        if session.session_type not in {"Rest", "Strength"}
    )


def test_schedule_conflicts_are_rejected() -> None:
    runner = replace(profile(), rest_days=("Saturday",))
    with pytest.raises(ValueError, match="Key run days cannot also be rest days"):
        build_training_plan(runner)


def test_planned_totals_are_reasonable() -> None:
    plan = build_training_plan(profile())
    totals = [week.target_km for week in plan.weeks]
    assert min(totals) > 40
    assert max(totals) <= 92
    assert totals[-1] >= 42.195
