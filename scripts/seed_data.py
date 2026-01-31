import sys

sys.path.append("backend")

from app.seed_data import seed_database  # noqa: E402


if __name__ == "__main__":
    seed_database()
