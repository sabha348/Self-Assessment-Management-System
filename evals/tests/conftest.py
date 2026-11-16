import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "rag_service"))
sys.path.insert(0, str(ROOT / "evals" / "retrieval"))
sys.path.insert(0, str(ROOT / "rag_service"))  # for tests.fakes / tests.pdf_factory
