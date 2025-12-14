from __future__ import annotations

import json
import re
from typing import Any, Literal
from pydantic import BaseModel, Field, ValidationError
from services.llm_client import llm_client

SUPPORTED_ACTIONS = {
    "create_job",
    "search_candidates",
    "score_candidate",
    "generate_screening_questions",
    "email_candidate",
    "move_candidate",
    "navigate_dashboard",
    "clarify",
}


class SearchParams(BaseModel):
    job_id: str | int | None = None
    skills: list[str] = []
    must_have: list[str] = []
    nice_to_have: list[str] = []
    title_keywords: list[str] = []
    years_experience_min: float | None = None
    location: str | None = None
    seniority: Literal["intern", "junior", "mid", "senior", "staff"] | None = None
    top_k: int = 5


class AlsoDoIntent(BaseModel):
    """Sub-intent for chained actions."""
    action: str
    params: dict[str, Any] = {}


class Intent(BaseModel):
    action: Literal[
        "create_job",
        "search_candidates",
        "score_candidate",
        "generate_screening_questions",
        "email_candidate",
        "move_candidate",
        "navigate_dashboard",
        "clarify",
    ]
    params: dict[str, Any]
    also_do: list[AlsoDoIntent] | None = Field(default=None, description="Chained actions to perform after primary action")
    confidence: float = Field(0.7, ge=0.0, le=1.0)
    reasoning: str = Field("", description="Explanation of why this action was chosen")


async def parse_intent(transcript: str, conversation_history: list[dict[str, str]] | None = None) -> dict[str, Any]:
    normalized = _normalize_transcript(transcript)
    primary_raw = await _ask_llm_primary(normalized, conversation_history or [])
    parsed = _coerce_intent(primary_raw)
    if parsed:
        return parsed

    fix_raw = await _ask_llm_fix(primary_raw or normalized)
    parsed = _coerce_intent(fix_raw)
    if parsed:
        return parsed

    return {
        "action": "clarify",
        "params": {"question": "Please clarify your request."},
        "confidence": 0.0,
    }


def _coerce_intent(raw: Any) -> dict[str, Any] | None:
    try:
        if isinstance(raw, str):
            raw = json.loads(raw)
        intent = Intent.model_validate(raw)
        if intent.action == "search_candidates":
            params = SearchParams.model_validate(intent.params)
            payload = params.model_dump()
            job_id = payload.get("job_id")
            if isinstance(job_id, int):
                payload["job_id"] = str(job_id)
            intent.params = payload
        
        result = intent.model_dump()
        # Ensure also_do is properly included (even if None, exclude from output)
        if result.get("also_do") is None:
            result.pop("also_do", None)
        return result
    except (ValidationError, json.JSONDecodeError):
        return None


async def _ask_llm_primary(transcript: str, conversation_history: list[dict[str, str]]) -> Any:
    prompt = (
        "You are an intent parser for a recruiting assistant. "
        "Return ONLY JSON with fields: action, params, also_do (optional array of chained actions), confidence (0..1), reasoning (short explanation). "
        "Supported actions: create_job, search_candidates, score_candidate, generate_screening_questions, "
        "email_candidate, navigate_dashboard, clarify. "
        "\n\nACTION REQUIREMENTS:"
        "\n- create_job: params must include 'title', optionally 'description'"
        "\n- search_candidates: params can include:"
        "\n    - job_id: match against a specific job (can be short_id number OR job title string)"
        "\n    - IMPORTANT: 'for job X' or 'for the X role' → set job_id to X (title or ID)"
        "\n    - skills: technical skills to match (e.g., ['Python', 'AWS'])"
        "\n    - must_have: required skills/qualifications"
        "\n    - nice_to_have: preferred but not required"
        "\n    - years_experience_min: NUMERIC minimum years (e.g., 'one year' → 1, '5 years' → 5, 'at least 3 years' → 3)"
        "\n    - seniority: 'intern', 'junior', 'mid', 'senior', or 'staff'"
        "\n    - location: city/region filter"
        "\n    - title_keywords: job title search terms"
        "\n- score_candidate: params MUST include both 'candidate_id' AND 'job_id'"
        "\n- generate_screening_questions: params MUST include both 'candidate_id' AND 'job_id'"
        "\n- email_candidate: params must include 'candidate_id', optionally 'job_id' and 'time_window'"
        "\n- move_candidate: params must include 'candidate_id' and 'stage' (one of: sourcing, applied, screening, interview, offer, hired, rejected)"
        "\n- navigate_dashboard: params include 'view' and 'filters'"
        "\n\nID FORMAT - CRITICAL:"
        "\n- candidate_id: Use the SHORT NUMBER (e.g., 7, 8, 12) OR the candidate's name (e.g., 'John Smith')"
        "\n- job_id: Use the SHORT NUMBER (e.g., 1, 2, 3) OR the job title (e.g., 'Senior Backend Developer')"
        "\n- 'candidate 7' or 'candidate number 7' → candidate_id: 7"
        "\n- 'job Senior Backend Developer' → job_id: 'Senior Backend Developer'"
        "\n- NEVER make up IDs like '7ddb123' or '674c982' - use simple numbers or exact names/titles"
        "\n\nMULTI-STEP COMMANDS - CRITICAL:"
        "\n- When user says 'and' followed by another action, use 'also_do' array"
        "\n- also_do format: [{\"action\": \"action_name\", \"params\": {...}}]"
        "\n- Common patterns:"
        "\n  - 'find X and move to screening' → search_candidates + also_do: [{\"action\": \"move_candidate\", \"params\": {\"stage\": \"screening\"}}]"
        "\n  - 'search for Y and move the top one to interview' → search_candidates + also_do: [{\"action\": \"move_candidate\", \"params\": {\"stage\": \"interview\"}}]"
        "\n  - 'I like this candidate' / 'looks promising' / 'interesting' → move_candidate with stage: screening"
        "\n  - 'schedule interview' / 'send interview email' → email_candidate (auto-moves to interview)"
        "\n  - 'make them an offer' / 'extend offer' → move_candidate with stage: offer"
        "\n  - 'hire them' / 'let's hire' → move_candidate with stage: hired"
        "\n  - 'reject' / 'pass on this candidate' → move_candidate with stage: rejected"
        "\n\nIMPLICIT STAGE DETECTION:"
        "\n- Positive sentiment ('I like', 'looks good', 'promising', 'great fit') + candidate context → move to screening"
        "\n- Interview-related ('interview', 'schedule', 'call') → move to interview"
        "\n- Offer-related ('offer', 'extend offer', 'make an offer') → move to offer"
        "\n- Hire-related ('hire', 'onboard', 'bring them on') → move to hired"
        "\n\nNUMERIC EXTRACTION - CRITICAL:"
        "\n- 'one year' / '1 year' → years_experience_min: 1"
        "\n- 'two years' / '2 years' → years_experience_min: 2"
        "\n- 'at least 5 years' / 'minimum 5 years' → years_experience_min: 5"
        "\n- 'must have Python' / 'require AWS' → must_have: ['Python'] or ['AWS']"
        "\n- 'preferably knows React' / 'nice to have Docker' → nice_to_have: ['React'] or ['Docker']"
        "\n\nCONTEXT RESOLUTION:"
        "\n- 'pick the best one', 'score the top candidate', 'score them', 'the first one' → score_candidate with candidate_id from search results"
        "\n- 'that job', 'the role', 'this position' → use job_id from recently created/mentioned job"
        "\n- 'them', 'this candidate', 'the top one' → use first candidate_id from search results"
        "\n\nLook in conversation history for:"
        "\n- Job IDs: 'Created job...with ID #X' or 'Searched against job ID #X'"
        "\n- Candidate IDs: 'Top results: 1. Name (ID: X, score: Y)'"
        "\n\nALWAYS extract IDs from context. Use the candidate_id value, not the name. "
        "NEVER use action=clarify if IDs are present in conversation history."
    )
    # Build messages with conversation context
    messages: list[dict[str, str]] = []
    # Include up to last 3 turns of history for context
    recent_history = conversation_history[-6:] if conversation_history else []
    for turn in recent_history:
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": transcript})
    
    try:
        return await llm_client.chat(
            prompt=prompt,
            system="ONLY JSON. No prose. For candidate_id and job_id: use simple SHORT NUMBERS (7, 8, 12) or exact names/titles. NEVER make up IDs like '7ddb123'. 'candidate 7' → candidate_id: 7. 'job Senior Backend Developer' → job_id: 'Senior Backend Developer'.",
            messages=messages,
            json_mode=True,
        )
    except Exception:
        return None


async def _ask_llm_fix(previous: Any) -> Any:
    text = previous if isinstance(previous, str) else json.dumps(previous or {})
    prompt = (
        "Fix this to valid JSON matching the intent schema. If impossible, set action=clarify and include a question."
    )
    try:
        return await llm_client.chat(
            prompt=prompt,
            system="ONLY JSON. No prose.",
            messages=[{"role": "user", "content": text}],
            json_mode=True,
        )
    except Exception:
        return None


_WORD_NUMBER_PATTERN = re.compile(
    r"\b(zero|one|two|too|three|four|five|six|seven|eight|nine|ten)\b",
    flags=re.IGNORECASE,
)

_WORD_TO_DIGIT = {
    "zero": "0",
    "one": "1",
    "two": "2",
    "too": "2",
    "three": "3",
    "four": "4",
    "five": "5",
    "six": "6",
    "seven": "7",
    "eight": "8",
    "nine": "9",
    "ten": "10",
}


def _normalize_transcript(text: str) -> str:
    def _replace(match: re.Match[str]) -> str:
        word = match.group(0).lower()
        return _WORD_TO_DIGIT.get(word, match.group(0))

    return _WORD_NUMBER_PATTERN.sub(_replace, text)
