from __future__ import annotations

from typing import BinaryIO
from PyPDF2 import PdfReader


async def parse_resume(file: BinaryIO, filename: str) -> str:
    name = (filename or "").lower()
    if name.endswith(".txt"):
        content = file.read().decode("utf-8", errors="ignore")
        return content.strip()
    if name.endswith(".pdf"):
        reader = PdfReader(file)
        text_parts: list[str] = []
        for page in reader.pages:
            text_parts.append(page.extract_text() or "")
        return "\n".join(text_parts).strip()
    raise ValueError("Unsupported resume format; use .txt or .pdf")
