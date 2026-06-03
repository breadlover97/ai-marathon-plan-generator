"""Marathon training plan generator."""

from .models import RunnerProfile, TrainingPlan
from .plan import build_training_plan

__all__ = ["RunnerProfile", "TrainingPlan", "build_training_plan"]

