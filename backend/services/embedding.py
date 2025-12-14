from __future__ import annotations

import numpy as np
from sentence_transformers import SentenceTransformer
from config import get_settings

_settings = get_settings()
_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(_settings.embedding_model)
    return _model


def normalize_embedding(vec: list[float], length: int = 768) -> list[float]:
    sanitized: list[float] = []
    for v in vec:
        if np.isfinite(v):
            sanitized.append(float(v))
    if len(sanitized) >= length:
        sanitized = sanitized[:length]
    else:
        sanitized.extend([0.0] * (length - len(sanitized)))
    return sanitized


def embed_text(text: str) -> list[float]:
    model = _get_model()
    raw_vec = model.encode([text], normalize_embeddings=True)[0].tolist()
    return normalize_embedding(raw_vec, 768)
