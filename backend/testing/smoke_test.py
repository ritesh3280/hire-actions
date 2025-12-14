"""Simple terminal smoke test for HireFlow Actions API.

Run:
    uvicorn main:app --reload --port 8000
    python testing/smoke_test.py --base-url http://127.0.0.1:8000
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import uuid
from pathlib import Path

import httpx

BASE_DIR = Path(__file__).resolve().parent
RESUME_PATH = BASE_DIR / "resume.txt"
NAMES = ["Aditya", "Jamie", "Taylor", "Riley", "Jordan"]


def assert_embedding(vec: list[float], expected_len: int = 768) -> None:
    if not isinstance(vec, list) or len(vec) != expected_len:
        raise AssertionError(f"embedding length {len(vec) if isinstance(vec, list) else 'n/a'} != {expected_len}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="API base URL")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    client = httpx.Client(timeout=30.0)

    print("[1] GET /health ...", end=" ")
    r = client.get(f"{base}/health")
    r.raise_for_status()
    print(r.json())

    # Upload one job
    print("[2] POST /jobs ...", end=" ")
    job_payload = {
        "title": "Software Engineer Intern",
        "description": "Intern to build features in Python, FastAPI, React. Basic SQL, Git, teamwork.",
    }
    r = client.post(f"{base}/jobs", json=job_payload)
    r.raise_for_status()
    job = r.json()
    assert_embedding(job["embedding_768"])
    job_id = job["id"]
    print({"id": job_id, "skills": job.get("required_skills")})

    # Upload five candidates with randomized emails
    candidate_ids = []
    files = {"resume": (RESUME_PATH.name, RESUME_PATH.read_bytes(), "text/plain")}
    for idx, name in enumerate(NAMES, start=1):
        print(f"[3.{idx}] POST /candidates ({name}) ...", end=" ")
        data = {"name": name, "email": f"{name.lower()}+{uuid.uuid4().hex[:6]}@example.com"}
        r = client.post(f"{base}/candidates", data=data, files=files)
        r.raise_for_status()
        cand = r.json()
        assert_embedding(cand["embedding_768"])
        candidate_ids.append(cand["id"])
        print({"id": cand["id"], "short_id": cand.get("short_id"), "email": cand["email"]})

    print("[4] POST /actions/voice (transcript) ...", end=" ")
    voice_payload = {
        "transcript": "Find full stack candidates with Python and FastAPI",
    }
    r = client.post(f"{base}/actions/voice", json=voice_payload)
    r.raise_for_status()
    voice = r.json()
    if "intent_json" not in voice or "execution_result" not in voice:
        raise AssertionError("voice response missing intent or result")
    print({"intent": voice.get("intent_json", {}).get("action")})

    print("[5] GET /candidates ...", end=" ")
    r = client.get(f"{base}/candidates")
    r.raise_for_status()
    c_list = r.json()
    for cid in candidate_ids:
        if not any(c.get("id") == cid for c in c_list):
            raise AssertionError(f"candidate {cid} not listed")
    print(f"count={len(c_list)}")

    print("[6] GET /jobs ...", end=" ")
    r = client.get(f"{base}/jobs")
    r.raise_for_status()
    j_list = r.json()
    if not any(j.get("id") == job_id for j in j_list):
        raise AssertionError("job not listed")
    print(f"count={len(j_list)}")

    print("All smoke tests passed ✅")
    return 0


if __name__ == "__main__":
    sys.exit(main())
