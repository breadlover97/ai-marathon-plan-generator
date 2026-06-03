from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from marathon_generator.export_google_sheet import export_plan_xlsx
from marathon_generator.plan import build_training_plan, load_profile


def main() -> None:
    profile = load_profile(ROOT / "examples" / "tai_zhi_sckl_2026.json")
    plan = build_training_plan(profile)
    output = export_plan_xlsx(plan, ROOT / "outputs" / "sample_marathon_plan.xlsx")
    print(output)


if __name__ == "__main__":
    main()

