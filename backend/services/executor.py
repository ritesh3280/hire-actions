from __future__ import annotations

import datetime as dt
from typing import Any
import re
from bson import ObjectId
from models import CandidateDB, JobDB
from services.embedding import embed_text, normalize_embedding
from services.similarity import cosine_similarity
from services.llm_client import llm_client
from services.gmail_service import send_email
from services.skills_extract import extract_required_skills
from db import get_next_short_id


async def execute_action(db, intent: dict[str, Any]) -> dict[str, Any]:
    action = intent.get("action")
    params = intent.get("params", {})
    also_do = intent.get("also_do") or params.get("also_do") or []
    
    # Execute primary action
    if action == "create_job":
        result = await _create_job(db, params)
    elif action == "search_candidates":
        result = await _search_candidates(db, params)
    elif action == "score_candidate":
        result = await _score_candidate(db, params)
    elif action == "generate_screening_questions":
        result = await _generate_questions(db, params)
    elif action == "email_candidate":
        result = await _email_candidate(db, params)
    elif action == "move_candidate":
        result = await _move_candidate(db, params)
    elif action == "navigate_dashboard":
        result = await _navigate_dashboard(db, params)
    else:
        return {"error": "unsupported_action"}
    
    # Execute chained actions (also_do)
    if also_do and isinstance(also_do, list):
        chained_results = []
        # Track context that accumulates across chained steps
        # Initialize with PRIMARY action's results
        chain_context = {
            "job_id": result.get("job_id") or result.get("short_id"),
            "job_title": result.get("title"),
            "candidate_id": None,
            "candidates": [],
        }
        
        # Include candidates from primary search results
        if result.get("candidates"):
            chain_context["candidates"] = result["candidates"]
            if result["candidates"]:
                chain_context["candidate_id"] = result["candidates"][0].get("candidate_id")
        
        # Include candidate from primary score/question/email results
        if result.get("candidate") and isinstance(result["candidate"], dict):
            chain_context["candidate_id"] = result["candidate"].get("id")
        
        for sub_intent in also_do:
            if isinstance(sub_intent, dict):
                sub_action = sub_intent.get("action")
                sub_params = sub_intent.get("params") or {}
                if not isinstance(sub_params, dict):
                    sub_params = {}
                # Copy params to avoid mutating original
                sub_params = dict(sub_params)
                
                # Use LLM to resolve any placeholder references
                sub_params = await _resolve_chain_params(sub_params, chain_context)
                
                if sub_action:
                    sub_result = await execute_action(db, {"action": sub_action, "params": sub_params})
                    chained_results.append({"action": sub_action, "result": sub_result})
                    
                    # Update chain context with this step's results
                    if sub_result and isinstance(sub_result, dict):
                        if "candidates" in sub_result and sub_result["candidates"]:
                            chain_context["candidates"] = sub_result["candidates"]
                            chain_context["candidate_id"] = sub_result["candidates"][0].get("candidate_id")
                        if "candidate_id" in sub_result:
                            chain_context["candidate_id"] = sub_result["candidate_id"]
                        if "job_id" in sub_result:
                            chain_context["job_id"] = sub_result["job_id"]
                        if "short_id" in sub_result and sub_action == "create_job":
                            chain_context["job_id"] = sub_result["short_id"]
        
        if chained_results:
            result["chained_actions"] = chained_results
    
    return result


async def _resolve_chain_params(params: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    """Resolve placeholder references in chained action params."""
    import json
    
    # Quick check: if params look complete (have valid IDs), skip resolution
    job_id = params.get("job_id")
    candidate_id = params.get("candidate_id")
    
    job_id_needs_resolve = job_id is None or (isinstance(job_id, str) and not _looks_like_id(job_id))
    candidate_id_needs_resolve = candidate_id is None or (isinstance(candidate_id, str) and not _looks_like_id(candidate_id))
    
    if not job_id_needs_resolve and not candidate_id_needs_resolve:
        return params  # Nothing to resolve
    
    # FAST PATH: Simple fallback resolution (no LLM call for common cases)
    # This handles 90%+ of chained action scenarios
    resolved_job_id = None
    resolved_candidate_id = None
    
    # Resolve job_id from context
    if job_id_needs_resolve:
        if context.get("job_id"):
            resolved_job_id = context["job_id"]
    
    # Resolve candidate_id from context
    if candidate_id_needs_resolve:
        candidates = context.get("candidates", [])
        
        # Check if there's a specific selector in the original param
        selector = str(candidate_id).lower() if candidate_id else ""
        
        if candidates:
            if selector in ("second", "2nd", "runner up", "runner-up"):
                # Pick second candidate
                if len(candidates) > 1:
                    resolved_candidate_id = candidates[1].get("candidate_id")
                else:
                    resolved_candidate_id = candidates[0].get("candidate_id")
            elif selector in ("third", "3rd"):
                # Pick third candidate
                if len(candidates) > 2:
                    resolved_candidate_id = candidates[2].get("candidate_id")
                else:
                    resolved_candidate_id = candidates[0].get("candidate_id")
            elif selector in ("all", "top", "top ones", "best"):
                # "all" or "top" means first one (we can't move multiple in one call)
                resolved_candidate_id = candidates[0].get("candidate_id")
            else:
                # Default: pick the first (best) candidate
                resolved_candidate_id = candidates[0].get("candidate_id")
        elif context.get("candidate_id"):
            # Fallback to candidate_id stored in context
            resolved_candidate_id = context["candidate_id"]
    
    # Apply simple resolutions
    if resolved_job_id is not None:
        params["job_id"] = resolved_job_id
    if resolved_candidate_id is not None:
        params["candidate_id"] = resolved_candidate_id
    
    # Check if we still need LLM resolution
    job_id = params.get("job_id")
    candidate_id = params.get("candidate_id")
    job_id_still_needs = job_id is None or (isinstance(job_id, str) and not _looks_like_id(job_id))
    candidate_id_still_needs = candidate_id is None or (isinstance(candidate_id, str) and not _looks_like_id(candidate_id))
    
    if not job_id_still_needs and not candidate_id_still_needs:
        return params  # Fast path resolved everything
    
    # SLOW PATH: Use LLM for complex resolution (rare cases)
    context_summary = []
    if context.get("job_id"):
        context_summary.append(f"Created job ID: {context['job_id']}")
    if context.get("job_title"):
        context_summary.append(f"Job title: {context['job_title']}")
    if context.get("candidates"):
        candidates_list = [
            f"  {i+1}. {c.get('name')} (ID: {c.get('candidate_id')}, similarity: {c.get('similarity', 0):.2f})"
            for i, c in enumerate(context["candidates"][:5])
        ]
        context_summary.append("Search results:\n" + "\n".join(candidates_list))
    if context.get("candidate_id"):
        context_summary.append(f"Current candidate ID: {context['candidate_id']}")
    
    if not context_summary:
        return params  # No context to resolve from
    
    prompt = f"""Given the chain context and the action params, resolve any placeholder references.

CHAIN CONTEXT:
{chr(10).join(context_summary)}

ACTION PARAMS:
{json.dumps(params, indent=2)}

RULES:
- If job_id is missing or a placeholder (like a title string), use the job ID from context
- If candidate_id is missing or a placeholder (like "top", "best", "first"), pick the best candidate from search results
- "top", "best", "first" = candidate with highest similarity score (first in list)
- "second", "runner up" = second highest similarity
- Return the resolved params as JSON

Return ONLY JSON with the resolved params. Keep all other fields unchanged."""

    try:
        resolved = await llm_client.chat(
            prompt=prompt,
            system="You resolve placeholder references in action params. Return ONLY valid JSON.",
            messages=[{"role": "user", "content": ""}],
            json_mode=True,
        )
        if isinstance(resolved, dict):
            # Merge resolved values back, preferring resolved values
            for key, value in resolved.items():
                if value is not None:
                    params[key] = value
    except Exception:
        # Already applied simple fallback above, just return
        pass
    
    return params


def _looks_like_id(value: Any) -> bool:
    """Check if a value looks like a valid ID (number, ObjectId, or short numeric string)."""
    if isinstance(value, int):
        return True
    if not isinstance(value, str):
        return False
    # Check if it's a number
    if value.isdigit():
        return True
    # Check if it looks like a MongoDB ObjectId (24 hex chars)
    if len(value) == 24 and all(c in '0123456789abcdef' for c in value.lower()):
        return True
    return False


async def _create_job(db, params: dict[str, Any]) -> dict[str, Any]:
    """Create a new job posting via voice command."""
    title = params.get("title")
    description = params.get("description") or ""
    
    if not title:
        return {"error": "Job title is required"}
    
    # Generate description if not provided
    if not description:
        desc_prompt = f"Write a brief 2-3 sentence job description for: {title}"
        try:
            desc_response = await llm_client.chat(
                prompt=desc_prompt,
                system="Write concise, professional job descriptions. No headers or formatting.",
                messages=[{"role": "user", "content": ""}],
            )
            description = desc_response.strip() if isinstance(desc_response, str) else ""
        except Exception:
            description = f"We are looking for a {title} to join our team."
    
    # Extract skills from title and description
    skills = await extract_required_skills(title, description)
    
    # Generate embedding
    embed_text_input = f"{title}\nSkills: {', '.join(skills)}\n{description[:1000]}"
    embedding = embed_text(embed_text_input)
    
    # Get next short_id
    short_id = await get_next_short_id(db, "job_short_id")
    
    job_doc = {
        "short_id": short_id,
        "title": title,
        "description": description,
        "required_skills": skills,
        "embedding_768": embedding,
        "created_at": dt.datetime.utcnow(),
    }
    
    result = await db.jobs.insert_one(job_doc)
    job_doc["_id"] = result.inserted_id
    
    # Log the action
    await db.action_logs.insert_one({
        "action_type": "create_job",
        "params": params,
        "status": "ok",
        "output": {"job_id": str(result.inserted_id), "short_id": short_id},
        "created_at": dt.datetime.utcnow(),
    })
    
    return {
        "job_id": str(result.inserted_id),
        "short_id": short_id,
        "title": title,
        "description": description,
        "required_skills": skills,
        "explanation": (
            f"Created job posting for '{title}' with ID #{short_id}. "
            f"Automatically extracted {len(skills)} required skills: {', '.join(skills[:5])}{'...' if len(skills) > 5 else ''}."
        ),
    }


async def _search_candidates(db, params: dict[str, Any]) -> dict[str, Any]:
    job_id = params.get("job_id")
    skills = params.get("skills") or []
    must_have = params.get("must_have") or []
    nice_to_have = params.get("nice_to_have") or []
    title_keywords = params.get("title_keywords") or []
    location_filter = params.get("location")
    years_exp_min = params.get("years_experience_min")
    seniority_filter = params.get("seniority")
    filters = params.get("filters", {})
    mongo_filters: dict[str, Any] = {}
    if "pipeline_stage" in filters:
        mongo_filters["pipeline_stage"] = filters["pipeline_stage"]
    if "priority" in filters:
        mongo_filters["priority"] = filters["priority"]

    # Build query embedding - support job lookup by ID, short_id, or title
    job = None
    if job_id:
        job_doc = await _get_job(db, job_id)
        if job_doc:
            job = JobDB(**job_doc)
            query_text = f"{job.title}\nSkills: {', '.join(job.required_skills)}\n{job.description[:800]}"
        else:
            query_text = " ".join(title_keywords + skills + must_have + nice_to_have)
    else:
        query_text = " ".join(title_keywords + skills + must_have + nice_to_have)
    q_embedding = embed_text(query_text)

    candidates_cursor = db.candidates.find(mongo_filters)
    candidates = [CandidateDB(**doc) async for doc in candidates_cursor]

    ranked: list[dict[str, Any]] = []
    skill_terms = [s.lower() for s in skills] if skills else []
    
    # Normalize location filter for matching
    location_lower = location_filter.lower().strip() if location_filter else None
    # Common location abbreviations
    location_variants = []
    if location_lower:
        location_variants.append(location_lower)
        # Handle state abbreviations
        state_map = {
            "maryland": "md", "california": "ca", "new york": "ny", "texas": "tx",
            "virginia": "va", "florida": "fl", "georgia": "ga", "washington": "wa",
            "massachusetts": "ma", "pennsylvania": "pa", "illinois": "il", "ohio": "oh",
        }
        for full, abbrev in state_map.items():
            if full in location_lower:
                location_variants.append(location_lower.replace(full, abbrev))
            if abbrev in location_lower.split():
                location_variants.append(location_lower.replace(abbrev, full))

    for c in candidates:
        resume_lower = c.resume_text.lower()
        
        # Location filter - check if location appears in resume
        if location_lower:
            location_match = any(loc in resume_lower for loc in location_variants)
            if not location_match:
                continue  # Skip candidates not in this location
        
        # Years experience filter - look for X years patterns
        if years_exp_min:
            exp_match = _extract_years_experience(resume_lower)
            if exp_match is None or exp_match < years_exp_min:
                continue  # Skip candidates with less experience
        
        # Seniority filter
        if seniority_filter:
            seniority_lower = seniority_filter.lower()
            if seniority_lower not in resume_lower:
                # Also check for title indicators
                seniority_indicators = {
                    "senior": ["senior", "sr.", "lead", "principal", "staff"],
                    "junior": ["junior", "jr.", "entry", "associate"],
                    "mid": ["mid-level", "mid level", "intermediate"],
                    "intern": ["intern", "internship", "co-op"],
                    "staff": ["staff", "principal", "distinguished"],
                }
                indicators = seniority_indicators.get(seniority_lower, [])
                if not any(ind in resume_lower for ind in indicators):
                    continue
        
        # Optional prefilter by skill term presence
        if skill_terms:
            matched = [s for s in skill_terms if s in resume_lower]
            if not matched:
                continue
        else:
            matched = []

        score = cosine_similarity(q_embedding, normalize_embedding(c.embedding_768, 768))
        ranked.append({
            "candidate_id": str(c.id),
            "name": c.name,
            "email": c.email,
            "pipeline_stage": c.pipeline_stage,
            "priority": c.priority,
            "similarity": score,
            "matched_skills": matched,
            "snippet": c.resume_text[:240],
        })

    ranked.sort(key=lambda x: x["similarity"], reverse=True)
    top_k = ranked[: min(len(ranked), params.get("top_k", 5))]
    summary = await _summarize_candidates(top_k)
    
    # Build explanation of WHY these results were returned
    why_parts = []
    if job:
        why_parts.append(f"matched against '{job.title}' (#{job.short_id}) requirements")
    elif job_id:
        why_parts.append(f"searched for job '{job_id}' (not found, using as keywords)")
    if skill_terms:
        why_parts.append(f"filtered for skills: {', '.join(skill_terms)}")
    if location_filter:
        why_parts.append(f"location: {location_filter}")
    if years_exp_min:
        why_parts.append(f"min {years_exp_min}+ years experience")
    if seniority_filter:
        why_parts.append(f"seniority: {seniority_filter}")
    if mongo_filters:
        filter_desc = ", ".join(f"{k}={v}" for k, v in mongo_filters.items())
        why_parts.append(f"with filters: {filter_desc}")
    why_parts.append(f"ranked by semantic similarity to query")
    explanation = f"Found {len(top_k)} candidates by " + ", ".join(why_parts) + "."
    
    return {"candidates": top_k, "summary": summary, "explanation": explanation, "job": {"id": str(job.id), "title": job.title, "short_id": job.short_id} if job else None}


def _extract_years_experience(text: str) -> float | None:
    """Extract years of experience from resume text."""
    import re
    from datetime import datetime
    
    max_years = None
    
    # Method 1: Explicit "X years experience" patterns
    explicit_patterns = [
        r'(\d+)\+?\s*years?\s*(?:of\s*)?(?:experience|exp)',
        r'(\d+)\+?\s*years?\s*(?:in\s+)?(?:software|engineering|development)',
        r'experience[:\s]+(\d+)\+?\s*years?',
        r'(\d+)\+?\s*yrs?\s*(?:of\s*)?(?:experience|exp)',
    ]
    for pattern in explicit_patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            try:
                years = float(match)
                if max_years is None or years > max_years:
                    max_years = years
            except ValueError:
                continue
    
    if max_years is not None:
        return max_years
    
    # Method 2: Calculate from job date ranges (e.g., "Jan 2020 - Present", "2019 - 2022")
    current_year = datetime.now().year
    date_patterns = [
        # "Mar 2025 – Present", "Dec 2024 – Present"
        r'(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*(\d{4})\s*[-–—]\s*(?:present|current|now)',
        # "2020 - Present", "2019 - present"
        r'(\d{4})\s*[-–—]\s*(?:present|current|now)',
        # "Aug 2023 – Dec 2026" (education/work ranges)
        r'(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*(\d{4})\s*[-–—]',
        # "2019 - 2022"
        r'(\d{4})\s*[-–—]\s*(\d{4})',
    ]
    
    earliest_year = None
    for pattern in date_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            try:
                if isinstance(match, tuple):
                    year = int(match[0])
                else:
                    year = int(match)
                # Only consider years that make sense (not too old, not future)
                if 2000 <= year <= current_year:
                    if earliest_year is None or year < earliest_year:
                        earliest_year = year
            except ValueError:
                continue
    
    if earliest_year:
        # Calculate experience from earliest work/project year
        max_years = float(current_year - earliest_year)
    
    return max_years


async def _summarize_candidates(candidates: list[dict[str, Any]]) -> str:
    if not candidates:
        return "No candidates found."
    prompt_lines = [
        "Summarize these top candidates for the recruiter in one short sentence.",
        "Format: count, key strengths, any risks."
    ]
    for c in candidates:
        prompt_lines.append(f"- {c['name']} ({c['similarity']:.2f}): {c['snippet']}")
    resp = await llm_client.chat(
        prompt="\n".join(prompt_lines),
        system="Short summary, one sentence.",
        messages=[{"role": "user", "content": ""}],
    )
    if isinstance(resp, str):
        return resp
    names = ", ".join(c["name"] for c in candidates)
    return f"Top {len(candidates)} candidates: {names}."


async def _score_candidate(db, params: dict[str, Any]) -> dict[str, Any]:
    cand_id = params.get("candidate_id")
    job_id = params.get("job_id")
    
    if not cand_id:
        return {"error": "candidate_id required. Specify which candidate to score."}
    
    cand_doc = await _get_candidate(db, cand_id)
    if not cand_doc:
        return {"error": f"Candidate '{cand_id}' not found"}
    
    # If no job_id specified, try to find the most relevant job
    job_doc = None
    auto_selected_job = False
    if job_id:
        job_doc = await _get_job(db, job_id)
    
    if not job_doc:
        # Try to find the most recently created job
        try:
            recent_job = await db.jobs.find_one(
                {}, 
                sort=[("created_at", -1)]
            )
            if recent_job:
                job_doc = recent_job
                auto_selected_job = True
        except Exception:
            pass
    
    if not job_doc:
        return {
            "error": "No job specified and no jobs found in the system. Please create a job first or specify which job to score against.",
            "hint": "Try: 'Create a Software Engineer job' first, or say 'Score this candidate for job 1'"
        }
    
    candidate = CandidateDB(**cand_doc)
    job = JobDB(**job_doc)
    llm_result = await _score_with_llm(candidate, job)
    result = llm_result or _score_fallback(candidate, job)
    
    # Add candidate and job details
    result["candidate"] = {
        "id": str(candidate.id),
        "name": candidate.name,
        "email": candidate.email,
        "pipeline_stage": candidate.pipeline_stage,
        "priority": candidate.priority,
    }
    result["job"] = {
        "id": str(job.id),
        "short_id": job.short_id,
        "title": job.title,
        "required_skills": job.required_skills[:8] if job.required_skills else [],
    }
    
    # Add explanation
    auto_note = " (Auto-selected most recent job since none was specified.)" if auto_selected_job else ""
    result["explanation"] = (
        f"Scored {candidate.name} against '{job.title}' position using a 4-part rubric: "
        f"skills match, experience relevance, project impact, and communication clarity. "
        f"Each category is worth 25 points for a maximum of 100.{auto_note}"
    )

    # Persist score history and action log
    score_entry = {
        "candidate_id": cand_id,
        "job_id": job_id,
        "result": result,
        "created_at": dt.datetime.utcnow(),
    }
    await db.candidates.update_one({"_id": candidate.id}, {"$push": {"score_history": score_entry}})
    await db.action_logs.insert_one(
        {
            "action_type": "score_candidate",
            "params": params,
            "status": "ok",
            "output": result,
            "created_at": dt.datetime.utcnow(),
        }
    )
    return result


async def _generate_questions(db, params: dict[str, Any]) -> dict[str, Any]:
    cand_id = params.get("candidate_id")
    job_id = params.get("job_id")
    
    if not cand_id:
        return {"error": "candidate_id required. Specify which candidate to generate questions for."}
    
    cand_doc = await _get_candidate(db, cand_id)
    if not cand_doc:
        return {"error": f"Candidate '{cand_id}' not found"}
    
    # If no job_id specified, try to find the most relevant job
    job_doc = None
    auto_selected_job = False
    if job_id:
        job_doc = await _get_job(db, job_id)
    
    if not job_doc:
        # Try to find the most recently created job
        try:
            recent_job = await db.jobs.find_one(
                {}, 
                sort=[("created_at", -1)]
            )
            if recent_job:
                job_doc = recent_job
                auto_selected_job = True
        except Exception:
            pass
    
    if not job_doc:
        return {
            "error": "No job specified and no jobs found in the system. Please create a job first.",
            "hint": "Try: 'Create a Software Engineer job' first"
        }
    
    candidate = CandidateDB(**cand_doc)
    job = JobDB(**job_doc)
    llm_result = await _questions_with_llm(candidate, job)
    result = llm_result or _questions_fallback(candidate, job)
    
    # Add candidate and job info to result
    result["candidate"] = {
        "id": str(candidate.id),
        "name": candidate.name,
        "email": candidate.email,
    }
    result["job"] = {
        "id": str(job.id),
        "short_id": job.short_id,
        "title": job.title,
    }
    
    # Add explanation
    auto_note = " (Auto-selected most recent job since none was specified.)" if auto_selected_job else ""
    result["explanation"] = (
        f"Generated personalized screening questions for {candidate.name} based on "
        f"their resume and the '{job.title}' job requirements. Each question targets "
        f"specific skills or experiences mentioned in their background.{auto_note}"
    )
    
    # Save questions to candidate's notes
    questions_note = {
        "type": "screening_questions",
        "job_id": str(job.id),
        "job_title": job.title,
        "questions": result.get("questions", []),
        "created_at": dt.datetime.utcnow(),
    }
    await db.candidates.update_one(
        {"_id": candidate.id},
        {
            "$push": {"notes": questions_note},
            "$set": {"updated_at": dt.datetime.utcnow()}
        }
    )
    
    await db.action_logs.insert_one(
        {
            "action_type": "generate_screening_questions",
            "params": params,
            "status": "ok",
            "output": result,
            "created_at": dt.datetime.utcnow(),
        }
    )
    return result


async def _email_candidate(db, params: dict[str, Any]) -> dict[str, Any]:
    cand_id = params.get("candidate_id")
    window = params.get("requested_time_window") or params.get("time_window")
    job_id = params.get("job_id")
    if not cand_id:
        return {"error": "candidate_id required"}
    cand_doc = await _get_candidate(db, cand_id)
    if not cand_doc:
        return {"error": "candidate not found"}
    candidate = CandidateDB(**cand_doc)
    job = None
    if job_id:
        job_doc = await _get_job(db, job_id)
        if job_doc:
            job = JobDB(**job_doc)

    email_payload = await _email_with_llm(candidate, job, window)
    if email_payload is None:
        email_payload = _email_fallback(candidate, job, window)

    send_result = await send_email(candidate.email, email_payload["subject"], email_payload["body"])
    result = {
        "sent": bool(send_result.get("sent")),
        "to": candidate.email,
        "subject": email_payload["subject"],
        "body": email_payload["body"],
        "message_id": send_result.get("message_id"),
    }
    
    # Add explanation
    window_text = f" for {window}" if window else ""
    job_text = f" about the '{job.title}' position" if job else ""
    result["explanation"] = (
        f"Drafted and sent an interview scheduling email to {candidate.name}{job_text}{window_text}. "
        f"The email was personalized based on their background and our company's tone."
    )
    
    status = "sent" if result["sent"] else "not_sent"
    await db.action_logs.insert_one(
        {
            "action_type": "email_candidate",
            "params": params,
            "status": status,
            "output": result,
            "created_at": dt.datetime.utcnow(),
        }
    )
    
    # Auto-move candidate to interview stage when sending interview email
    if result["sent"]:
        await _auto_move_to_stage(db, candidate, "interview", "Automatically moved after interview email sent")
        result["auto_moved_to"] = "interview"
    
    return result


VALID_STAGES = {"sourcing", "applied", "screening", "interview", "offer", "hired", "rejected"}

async def _move_candidate(db, params: dict[str, Any]) -> dict[str, Any]:
    """Move a candidate to a different pipeline stage."""
    cand_id = params.get("candidate_id")
    target_stage = params.get("stage", "").lower().strip()
    
    if not cand_id:
        return {"error": "candidate_id required"}
    
    if not target_stage:
        return {"error": "stage required (sourcing, applied, screening, interview, offer, hired, rejected)"}
    
    # Normalize stage names
    stage_aliases = {
        "screen": "screening",
        "interviewing": "interview",
        "interviews": "interview",
        "offering": "offer",
        "offered": "offer",
        "hiring": "hired",
        "reject": "rejected",
        "pass": "rejected",
        "decline": "rejected",
    }
    target_stage = stage_aliases.get(target_stage, target_stage)
    
    if target_stage not in VALID_STAGES:
        return {"error": f"Invalid stage. Must be one of: {', '.join(sorted(VALID_STAGES))}"}
    
    cand_doc = await _get_candidate(db, cand_id)
    if not cand_doc:
        return {"error": "candidate not found"}
    
    candidate = CandidateDB(**cand_doc)
    old_stage = candidate.pipeline_stage or "none"
    
    # Update the candidate's stage
    await db.candidates.update_one(
        {"_id": candidate.id},
        {
            "$set": {
                "pipeline_stage": target_stage,
                "updated_at": dt.datetime.utcnow(),
            },
            "$push": {
                "stage_history": {
                    "from_stage": old_stage,
                    "to_stage": target_stage,
                    "moved_at": dt.datetime.utcnow(),
                    "reason": params.get("reason", "Voice command"),
                }
            }
        }
    )
    
    result = {
        "candidate_id": str(candidate.id),
        "candidate_name": candidate.name,
        "from_stage": old_stage,
        "to_stage": target_stage,
        "explanation": f"Moved {candidate.name} from '{old_stage}' to '{target_stage}' stage.",
    }
    
    await db.action_logs.insert_one({
        "action_type": "move_candidate",
        "params": params,
        "status": "ok",
        "output": result,
        "created_at": dt.datetime.utcnow(),
    })
    
    return result


async def _auto_move_to_stage(db, candidate: CandidateDB, target_stage: str, reason: str) -> None:
    """Helper to automatically move a candidate to a stage (used by other actions)."""
    old_stage = candidate.pipeline_stage or "none"
    if old_stage == target_stage:
        return  # Already in this stage
    
    await db.candidates.update_one(
        {"_id": candidate.id},
        {
            "$set": {
                "pipeline_stage": target_stage,
                "updated_at": dt.datetime.utcnow(),
            },
            "$push": {
                "stage_history": {
                    "from_stage": old_stage,
                    "to_stage": target_stage,
                    "moved_at": dt.datetime.utcnow(),
                    "reason": reason,
                }
            }
        }
    )


async def _navigate_dashboard(db, params: dict[str, Any]) -> dict[str, Any]:
    transcript = params.get("transcript") or params.get("query")
    requested_view = params.get("view")
    requested_filters = params.get("filters") if isinstance(params.get("filters"), dict) else {}

    llm_result = await _navigate_with_llm(transcript) if transcript else None
    result = llm_result or _navigate_fallback(transcript)

    mapped_view = _normalize_view(requested_view) if requested_view else None
    if mapped_view:
        result["view"] = mapped_view

    # Always normalize and merge filters from params
    normalized_request_filters = _normalize_filters(requested_filters) if requested_filters else {}
    existing_filters = result.get("filters", {})
    if isinstance(existing_filters, dict):
        existing_filters = _normalize_filters(existing_filters)
    else:
        existing_filters = {}
    
    # Merge: params filters take precedence
    merged_filters = {**existing_filters}
    for k, v in normalized_request_filters.items():
        if v is not None:
            merged_filters[k] = v
    result["filters"] = merged_filters

    # Add explanation
    view_name = result.get("view", "pipeline")
    filters = result.get("filters", {})
    active_filters = {k: v for k, v in filters.items() if v}
    if active_filters:
        filter_desc = ", ".join(f"{k}={v}" for k, v in active_filters.items())
    else:
        filter_desc = "none"
    result["explanation"] = (
        f"Navigating to the {view_name} view with filters: {filter_desc}. "
        f"This shows the candidates matching your specified criteria."
    )

    await db.action_logs.insert_one(
        {
            "action_type": "navigate_dashboard",
            "params": params,
            "status": "ok",
            "output": result,
            "created_at": dt.datetime.utcnow(),
        }
    )
    return result


def _normalize_view(view: Any) -> str | None:
    if not isinstance(view, str):
        return None
    lowered = view.lower()
    if lowered in {"pipeline", "candidate_pipeline"}:
        return "pipeline"
    if lowered in {"candidates", "people"}:
        return "candidates"
    if lowered in {"jobs", "roles", "open_roles"}:
        return "jobs"
    return None


def _to_object_id(value: Any) -> ObjectId | None:
    try:
        return ObjectId(value)
    except Exception:
        return None


async def _get_candidate(db, identifier: Any) -> dict[str, Any] | None:
    # Handle direct integer input
    if isinstance(identifier, int):
        doc = await db.candidates.find_one({"short_id": identifier})
        if doc:
            return doc
    
    ident_str = str(identifier).strip()
    
    # 1. Try ObjectId first
    oid = _to_object_id(identifier)
    doc = await db.candidates.find_one({"_id": oid}) if oid else None
    if doc:
        return doc
    
    # 2. Try exact short_id if it's a pure number
    ident_int = _to_int(ident_str)
    if ident_int is not None:
        doc = await db.candidates.find_one({"short_id": ident_int})
        if doc:
            return doc
    
    # 3. Extract number from mixed identifier (e.g., "Hanani_ID_8", "candidate 8", "number 8")
    number_match = re.search(r'(\d+)', ident_str)
    if number_match:
        extracted_num = int(number_match.group(1))
        doc = await db.candidates.find_one({"short_id": extracted_num})
        if doc:
            return doc
    
    # 4. Case-insensitive exact name match
    doc = await db.candidates.find_one({"name": {"$regex": f"^{re.escape(ident_str)}$", "$options": "i"}})
    if doc:
        return doc
    
    # 5. Extract name part and try matching (remove numbers, IDs, underscores)
    name_part = re.sub(r'[_\d]+|ID|candidate|number|#', ' ', ident_str, flags=re.IGNORECASE).strip()
    name_part = ' '.join(name_part.split())  # Normalize whitespace
    if name_part and len(name_part) > 1:
        # Try exact match on cleaned name
        doc = await db.candidates.find_one({"name": {"$regex": f"^{re.escape(name_part)}$", "$options": "i"}})
        if doc:
            return doc
        # Try partial match (name contains the search term)
        doc = await db.candidates.find_one({"name": {"$regex": re.escape(name_part), "$options": "i"}})
        if doc:
            return doc
    
    # 6. Try partial match on original string (for single names like "Hanani")
    words = [w for w in ident_str.split() if len(w) > 2 and not w.isdigit()]
    for word in words:
        doc = await db.candidates.find_one({"name": {"$regex": re.escape(word), "$options": "i"}})
        if doc:
            return doc
    
    return None


async def _get_job(db, identifier: Any) -> dict[str, Any] | None:
    # Handle direct integer input
    if isinstance(identifier, int):
        doc = await db.jobs.find_one({"short_id": identifier})
        if doc:
            return doc
    
    oid = _to_object_id(identifier)
    doc = await db.jobs.find_one({"_id": oid}) if oid else None
    if doc:
        return doc
    ident_str = str(identifier).strip()
    ident_int = _to_int(ident_str)
    doc = await db.jobs.find_one({"short_id": ident_int}) if ident_int is not None else None
    if doc:
        return doc
    
    # Normalize common variations (backend/back-end, frontend/front-end, fullstack/full-stack)
    normalized = _normalize_job_title(ident_str)
    
    # Exact case-insensitive title match
    doc = await db.jobs.find_one({"title": {"$regex": f"^{re.escape(ident_str)}$", "$options": "i"}})
    if doc:
        return doc
    
    # Try with normalized title
    if normalized != ident_str:
        doc = await db.jobs.find_one({"title": {"$regex": f"^{re.escape(normalized)}$", "$options": "i"}})
        if doc:
            return doc
    
    # Partial title match (contains the search term)
    doc = await db.jobs.find_one({"title": {"$regex": re.escape(ident_str), "$options": "i"}})
    if doc:
        return doc
    
    # Try partial match with normalized title
    if normalized != ident_str:
        doc = await db.jobs.find_one({"title": {"$regex": re.escape(normalized), "$options": "i"}})
        if doc:
            return doc
    
    # Fuzzy match: search term words appear in title (with normalization)
    words = [w for w in normalized.lower().split() if len(w) > 2]
    if words:
        # Match jobs where title contains all significant words
        regex_pattern = ".*".join(re.escape(w) for w in words)
        doc = await db.jobs.find_one({"title": {"$regex": regex_pattern, "$options": "i"}})
        if doc:
            return doc
    
    # Last resort: flexible regex that handles hyphen variations
    flexible_pattern = ident_str.lower()
    flexible_pattern = re.sub(r'back-?end', 'back-?end', flexible_pattern)
    flexible_pattern = re.sub(r'front-?end', 'front-?end', flexible_pattern)
    flexible_pattern = re.sub(r'full-?stack', 'full-?stack', flexible_pattern)
    doc = await db.jobs.find_one({"title": {"$regex": flexible_pattern, "$options": "i"}})
    
    return doc


def _normalize_job_title(title: str) -> str:
    """Normalize job title variations (backend/back-end, etc.)"""
    normalized = title
    # Normalize to hyphenated versions (more common in job titles)
    normalized = re.sub(r'\bbackend\b', 'back-end', normalized, flags=re.IGNORECASE)
    normalized = re.sub(r'\bfrontend\b', 'front-end', normalized, flags=re.IGNORECASE)
    normalized = re.sub(r'\bfullstack\b', 'full-stack', normalized, flags=re.IGNORECASE)
    return normalized


def _to_int(val: str) -> int | None:
    try:
        return int(val)
    except Exception:
        return None


async def _score_with_llm(candidate: CandidateDB, job: JobDB) -> dict[str, Any] | None:
    prompt = (
        "Score the candidate against the job. Return ONLY JSON with fields: "
        "overall_score (0-100), rubric (skills_match, experience_relevance, project_impact, communication_clarity) each 0-25, "
        "strengths (array of strings), concerns (array of strings), final_explanation (string)."
    )
    try:
        resp = await llm_client.chat(
            prompt=prompt,
            system="ONLY JSON. No prose.",
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Job title: {job.title}\nRequired skills: {', '.join(job.required_skills)}\n"
                        f"Job description: {job.description}\nCandidate resume: {candidate.resume_text}"
                    ),
                }
            ],
            json_mode=True,
        )
        if isinstance(resp, dict):
            # Basic shape check
            rubric = resp.get("rubric", {}) if isinstance(resp.get("rubric"), dict) else {}
            if {
                "skills_match",
                "experience_relevance",
                "project_impact",
                "communication_clarity",
            }.issubset(rubric.keys()):
                return resp
    except Exception:
        return None
    return None


def _score_fallback(candidate: CandidateDB, job: JobDB) -> dict[str, Any]:
    resume_lower = candidate.resume_text.lower()
    skills = [s.lower() for s in job.required_skills]
    overlap = sum(1 for s in skills if s in resume_lower)
    skills_match = 25 * overlap / max(1, len(skills)) if skills else 15

    cand_vec = normalize_embedding(candidate.embedding_768, 768)
    job_vec = normalize_embedding(job.embedding_768, 768)
    similarity = cosine_similarity(cand_vec, job_vec)
    similarity = max(0.0, min(1.0, similarity))
    experience_relevance = similarity * 25
    project_impact = min(25.0, skills_match * 0.8 + experience_relevance * 0.2)
    communication_clarity = 15.0  # heuristic placeholder

    rubric = {
        "skills_match": round(skills_match, 1),
        "experience_relevance": round(experience_relevance, 1),
        "project_impact": round(project_impact, 1),
        "communication_clarity": round(communication_clarity, 1),
    }
    overall_score = round(min(100.0, sum(rubric.values())), 1)
    strengths = [f"Overlap on {overlap} skills"] if overlap else ["Resume length OK"]
    concerns = [] if overlap else ["Low skill overlap"]
    return {
        "overall_score": overall_score,
        "rubric": rubric,
        "strengths": strengths,
        "concerns": concerns,
        "final_explanation": "Heuristic score based on skill overlap and embedding similarity.",
    }


async def _questions_with_llm(candidate: CandidateDB, job: JobDB) -> dict[str, Any] | None:
    prompt = (
        "Generate exactly three personalized screening questions for this candidate. "
        "Return ONLY JSON with key 'questions' mapping to an array of three objects each containing "
        "question, evaluates, good_signal."
    )
    try:
        resp = await llm_client.chat(
            prompt=prompt,
            system="ONLY JSON. No prose.",
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Job title: {job.title}\nRequired skills: {', '.join(job.required_skills)}\n"
                        f"Job description: {job.description}\nCandidate resume: {candidate.resume_text}"
                    ),
                }
            ],
            json_mode=True,
        )
        if isinstance(resp, dict):
            questions = resp.get("questions")
            if isinstance(questions, list) and len(questions) == 3:
                valid = all(
                    isinstance(q, dict)
                    and {"question", "evaluates", "good_signal"}.issubset(q.keys())
                    for q in questions
                )
                if valid:
                    return {"questions": questions}
    except Exception:
        return None
    return None


def _questions_fallback(candidate: CandidateDB, job: JobDB) -> dict[str, Any]:
    skills = job.required_skills[:3] if job.required_skills else []
    resume_snippets = _extract_project_sentences(candidate.resume_text, 3)
    questions = []
    templates = [
        (
            "Can you walk me through a project where you applied {skill}?",
            "practical experience with {skill}",
            "Candidate explains specific contributions, metrics, and lessons learned.",
        ),
        (
            "How would you tackle a new feature request that impacts both frontend and backend components?",
            "system thinking and collaboration",
            "Describes breaking work into milestones, aligning stakeholders, and testing strategy.",
        ),
        (
            "Tell me about a time you improved the performance or reliability of an application.",
            "ownership and impact",
            "Provides concrete before/after metrics and proactive follow-up.",
        ),
    ]
    for idx in range(3):
        skill = skills[idx] if idx < len(skills) else None
        question_template, evaluates, good_signal = templates[idx]
        question = question_template.format(skill=skill or "the relevant skillset")
        if skill:
            evaluates = evaluates.replace("{skill}", skill)
        if resume_snippets and idx < len(resume_snippets):
            question += f" I noticed you mentioned: {resume_snippets[idx]}"
        questions.append(
            {
                "question": question,
                "evaluates": evaluates,
                "good_signal": good_signal,
            }
        )
    return {"questions": questions}


def _extract_project_sentences(resume_text: str, limit: int) -> list[str]:
    sentences = [s.strip() for s in resume_text.split('.') if s.strip()]
    project_sentences = [s for s in sentences if "project" in s.lower()][:limit]
    return project_sentences


async def _email_with_llm(
    candidate: CandidateDB,
    job: JobDB | None,
    window: dict[str, Any] | None,
) -> dict[str, str] | None:
    window_text = _format_time_window(window)
    job_text = (
        f"Job title: {job.title}\nJob description: {job.description}\nRequired skills: {', '.join(job.required_skills)}"
        if job
        else ""
    )
    prompt = (
        "Draft a concise, professional interview scheduling email from Wispr (a voice AI company). "
        "Sign off as 'The Wispr Recruiting Team'. "
        "Use the provided time window to propose 2-3 options and ask for the candidate's availability. "
        "Return ONLY JSON with keys subject and body."
    )
    try:
        resp = await llm_client.chat(
            prompt=prompt,
            system="ONLY JSON. No prose.",
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Candidate name: {candidate.name}\nCandidate email: {candidate.email}\n"
                        f"Time window: {window_text}\n{job_text}\nResume: {candidate.resume_text}"
                    ),
                }
            ],
            json_mode=True,
        )
        if isinstance(resp, dict) and {"subject", "body"}.issubset(resp.keys()):
            return {"subject": str(resp["subject"]), "body": str(resp["body"])}
    except Exception:
        return None
    return None


def _email_fallback(
    candidate: CandidateDB,
    job: JobDB | None,
    window: dict[str, Any] | None,
) -> dict[str, str]:
    subject = f"Interview availability – {job.title}" if job else "Interview availability"
    window_text = _format_time_window(window)
    job_line = f" for the {job.title}" if job else ""
    body_lines = [
        f"Hi {candidate.name},",
        "",
        f"Hope you're doing well. I'd love to schedule a conversation{job_line}.",
    ]
    if window_text:
        body_lines.append(f"I'm available {window_text}. Let me know which option works best or share alternatives.")
    else:
        body_lines.append("Let me know some times that work for you this week and I can confirm.")
    body_lines.extend(
        [
            "",
            "Looking forward to connecting!",
            "",
            "Best regards,",
            "The Wispr Recruiting Team",
        ]
    )
    return {"subject": subject, "body": "\n".join(body_lines)}


def _format_time_window(window: dict[str, Any] | str | None) -> str:
    if not window:
        return ""
    # Handle string input (e.g., "next week", "tomorrow afternoon")
    if isinstance(window, str):
        return window
    if not isinstance(window, dict):
        return str(window)
    date = window.get("date")
    start = window.get("start_hour")
    end = window.get("end_hour")
    timezone = window.get("timezone") or "local time"
    parts: list[str] = []
    if date:
        parts.append(date)
    if start is not None and end is not None:
        parts.append(f"between {_humanize_hour(start)} and {_humanize_hour(end)}")
    if timezone:
        parts.append(timezone)
    return " ".join(parts).strip()


def _humanize_hour(hour: Any) -> str:
    try:
        hour_int = int(hour)
    except Exception:
        return str(hour)
    hour_int = hour_int % 24
    suffix = "AM" if hour_int < 12 else "PM"
    display = hour_int % 12 or 12
    return f"{display} {suffix}"


async def _navigate_with_llm(transcript: str | None) -> dict[str, Any] | None:
    if not transcript:
        return None
    prompt = (
        "You are a navigation intent parser. Return ONLY JSON with keys view (pipeline|candidates|jobs) "
        "and filters (object with optional pipeline_stage, priority, search_text)."
    )
    try:
        resp = await llm_client.chat(
            prompt=prompt,
            system="ONLY JSON. No prose.",
            messages=[{"role": "user", "content": transcript}],
            json_mode=True,
        )
        if isinstance(resp, dict) and resp.get("view") in {"pipeline", "candidates", "jobs"}:
            filters = resp.get("filters") if isinstance(resp.get("filters"), dict) else {}
            normalized = _normalize_filters(filters)
            return {"view": resp["view"], "filters": normalized}
    except Exception:
        return None
    return None


def _navigate_fallback(transcript: str | None) -> dict[str, Any]:
    text = (transcript or "").lower()
    view = "pipeline"
    if "job" in text:
        view = "jobs"
    elif "candidate" in text or "people" in text:
        view = "candidates"

    filters: dict[str, Any] = {"pipeline_stage": None, "priority": None, "search_text": None}
    for stage in ["sourcing", "applied", "screening", "interview", "offer", "hired"]:
        if stage in text:
            filters["pipeline_stage"] = stage
            break
    for priority in ["high", "medium", "low"]:
        if priority in text:
            filters["priority"] = priority
            break
    keywords = ["react", "python", "fastapi", "design", "frontend", "backend"]
    matched = [word for word in keywords if word in text]
    if matched:
        filters["search_text"] = " ".join(matched)
    return {"view": view, "filters": filters}


def _normalize_filters(filters: dict[str, Any]) -> dict[str, Any]:
    # Handle ALL possible keys from LLM for pipeline stage
    pipeline_stage = (
        filters.get("pipeline_stage") or 
        filters.get("stage") or 
        filters.get("status") or 
        filters.get("pipeline_state") or
        filters.get("state") or
        filters.get("pipeline_status")
    )
    priority = filters.get("priority") or filters.get("level")
    search_text = filters.get("search_text") or filters.get("query") or filters.get("search") or filters.get("keyword")
    
    # Normalize pipeline_stage values
    if isinstance(pipeline_stage, str):
        stage_lower = pipeline_stage.lower()
        valid_stages = ["sourcing", "applied", "screening", "interview", "offer", "hired"]
        pipeline_stage = stage_lower if stage_lower in valid_stages else None
    else:
        pipeline_stage = None
    
    priority = priority.lower() if isinstance(priority, str) and priority.lower() in {"high", "medium", "low"} else None
    search_text = search_text if isinstance(search_text, str) else None
    return {
        "pipeline_stage": pipeline_stage,
        "priority": priority,
        "search_text": search_text,
    }
