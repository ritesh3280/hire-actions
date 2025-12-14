from __future__ import annotations

import datetime as dt
import secrets
from typing import Any
from config import get_settings, GmailConfig

_settings = get_settings()
_gmail = GmailConfig(
    client_id=_settings.gmail_client_id,
    client_secret=_settings.gmail_client_secret,
    refresh_token=_settings.gmail_refresh_token,
    sender=_settings.gmail_sender,
)


async def send_email(to: str, subject: str, body: str) -> dict[str, Any]:
    if not (
        _settings.gmail_enabled
        and all([_gmail.client_id, _gmail.client_secret, _gmail.refresh_token, _gmail.sender])
    ):
        return {"sent": False, "message_id": None}

    # Placeholder for real Gmail API send. Replace with actual integration when creds available.
    message_id = f"dry-{secrets.token_hex(8)}"
    return {"sent": True, "message_id": message_id}
