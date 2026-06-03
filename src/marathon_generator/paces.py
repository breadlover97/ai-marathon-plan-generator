from __future__ import annotations

import re
from math import pow

MARATHON_KM = 42.195


def parse_hhmmss(value: str) -> int:
    parts = value.strip().split(":")
    if len(parts) == 2:
        hours = 0
        minutes, seconds = parts
    elif len(parts) == 3:
        hours, minutes, seconds = parts
    else:
        raise ValueError(f"Invalid time value: {value}")
    return int(hours) * 3600 + int(minutes) * 60 + int(seconds)


def parse_pace(value: str) -> int:
    match = re.fullmatch(r"(\d{1,2}):(\d{2})", value.strip())
    if not match:
        raise ValueError(f"Invalid pace value: {value}")
    return int(match.group(1)) * 60 + int(match.group(2))


def format_pace(seconds_per_km: float) -> str:
    seconds = int(round(seconds_per_km))
    return f"{seconds // 60}:{seconds % 60:02d} / km"


def format_duration(total_seconds: float) -> str:
    seconds = int(round(total_seconds))
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hours}:{minutes:02d}:{secs:02d}"


def marathon_pace_from_goal(goal_time: str | None) -> str | None:
    if not goal_time:
        return None
    return format_pace(parse_hhmmss(goal_time) / MARATHON_KM)


def riegel_predict(seconds: int, from_distance_km: float, to_distance_km: float) -> int:
    return int(seconds * pow(to_distance_km / from_distance_km, 1.06))


def pace_band(anchor_pace: str | None, low_factor: float, high_factor: float) -> str:
    if not anchor_pace:
        return "by RPE"
    pace_seconds = parse_pace(anchor_pace.replace(" / km", ""))
    return f"{format_pace(pace_seconds * low_factor)} to {format_pace(pace_seconds * high_factor)}"

