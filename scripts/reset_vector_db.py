import sys

sys.path.append("backend")

from app.seed_data import rebuild_vector_store  # noqa: E402


if __name__ == "__main__":
    rebuild_vector_store()
