"""
Early-access waitlist endpoint — no auth required.
Stores submissions in .data/early_access.json alongside the DB file.
"""
import json
import logging
import os
import uuid
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/early-access", tags=["early-access"])

# Resolve path relative to the project data directory.
_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", ".data")
_DATA_FILE = os.path.join(_DATA_DIR, "early_access.json")


class EarlyAccessRequest(BaseModel):
    email: str
    company: str = ""


@router.post("")
async def submit_early_access(req: EarlyAccessRequest):
    entry = {
        "id": str(uuid.uuid4()),
        "email": req.email.strip().lower(),
        "company": req.company.strip(),
        "submitted_at": datetime.utcnow().isoformat() + "Z",
    }

    try:
        os.makedirs(_DATA_DIR, exist_ok=True)
        try:
            with open(_DATA_FILE, "r") as f:
                data: list = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            data = []

        # Deduplicate by email — update existing rather than duplicate.
        existing = next((i for i, e in enumerate(data) if e.get("email") == entry["email"]), None)
        if existing is not None:
            data[existing].update({"company": entry["company"], "updated_at": entry["submitted_at"]})
        else:
            data.append(entry)

        with open(_DATA_FILE, "w") as f:
            json.dump(data, f, indent=2)

        logger.info("Early-access signup: %s (%s)", entry["email"], entry["company"] or "—")
    except Exception as exc:
        logger.warning("Failed to persist early-access entry: %s", exc)

    return {"status": "submitted", "message": "Thank you — we'll be in touch."}
