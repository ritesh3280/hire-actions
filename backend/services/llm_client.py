from __future__ import annotations

import base64
from typing import Any
import openai
from config import get_settings

_settings = get_settings()


class LLMClient:
    def __init__(self) -> None:
        if _settings.openai_api_key:
            openai.api_key = _settings.openai_api_key
        self.model = _settings.llm_model

    async def chat(
        self,
        prompt: str,
        messages: list[dict[str, str]],
        system: str | None = None,
        json_mode: bool = False,
    ) -> Any:
        if not _settings.openai_api_key:
            return self._fallback_chat(messages, json_mode)
        body = {
            "model": self.model,
            "messages": ([{"role": "system", "content": system}] if system else [])
            + ([{"role": "system", "content": prompt}] if prompt else [])
            + messages,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        resp = await openai.AsyncOpenAI().chat.completions.create(**body)  # type: ignore[arg-type]
        content = resp.choices[0].message.content
        if json_mode and content:
            return self._safe_json(content)
        return content

    async def transcribe_audio_base64(self, audio_base64: str) -> str:
        if not _settings.openai_api_key:
            return ""  # fallback silent
        audio_bytes = base64.b64decode(audio_base64)
        # Whisper API expects file-like object; using a simple approach here
        resp = await openai.AsyncOpenAI().audio.transcriptions.create(
            model="whisper-1", file=("audio.wav", audio_bytes, "audio/wav")
        )
        return resp.text  # type: ignore[no-any-return]

    def _fallback_chat(self, messages: list[dict[str, str]], json_mode: bool) -> Any:
        user_content = messages[-1]["content"] if messages else ""
        if json_mode:
            return {"action": "search_candidates", "params": {"query": user_content}}
        return f"LLM unavailable. Echo: {user_content}"

    def _safe_json(self, content: str) -> Any:
        import json

        try:
            return json.loads(content)
        except Exception:
            return content


llm_client = LLMClient()
