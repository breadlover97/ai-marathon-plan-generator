from datetime import date

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


def test_planned_totals_are_reasonable() -> None:
    plan = build_training_plan(profile())
    totals = [week.target_km for week in plan.weeks]
    assert min(totals) > 40
    assert max(totals) <= 92
    assert totals[-1] >= 42.195

