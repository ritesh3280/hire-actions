from __future__ import annotations

import io
import datetime as dt
import re
from typing import Any
from bson import ObjectId
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from config import get_settings
from db import close_db, get_db, get_next_short_id
from models import CandidateDB, CandidateOut, JobCreate, JobDB, JobOut
from services.resume_parse import parse_resume
from services.embedding import embed_text
from services.skills_extract import extract_required_skills
from services.intent_parser import parse_intent
from services.executor import execute_action
from services.llm_client import llm_client


settings = get_settings()
app = FastAPI(title="HireFlow Actions", version="0.1.0")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


class ConversationTurn(BaseModel):
	role: str  # "user" or "assistant"
	content: str


class VoicePayload(BaseModel):
	audio_base64: str | None = None
	transcript: str | None = None
	conversation_history: list[ConversationTurn] = []


class CandidateQuestionPayload(BaseModel):
	question: str = Field(..., min_length=3, max_length=800)


@app.on_event("shutdown")
async def shutdown_db_client() -> None:
	await close_db()


@app.get("/health")
async def health() -> dict[str, str]:
	return {"status": "ok"}


@app.post("/candidates", response_model=CandidateOut)
async def create_candidate(
	name: str = Form(...),
	email: str = Form(...),
	pipeline_stage: str | None = Form(None),
	priority: str | None = Form(None),
	resume: UploadFile = File(...),
):
	db = await get_db()
	contents = await resume.read()
	try:
		text = await parse_resume(file=io.BytesIO(contents), filename=resume.filename or "resume.txt")
	except Exception as exc:  # noqa: BLE001
		raise HTTPException(status_code=400, detail=str(exc))
	embedding = embed_text(text)
	short_id = await get_next_short_id(db, "candidate_short_id")
	candidate_doc = {
		"name": name,
		"email": email,
		"short_id": short_id,
		"resume_text": text,
		"embedding_768": embedding,
		"pipeline_stage": pipeline_stage,
		"priority": priority,
		"created_at": dt.datetime.utcnow(),
	}
	try:
		result = await db.candidates.insert_one(candidate_doc)
	except DuplicateKeyError as exc:  # noqa: BLE001
		raise HTTPException(status_code=400, detail="Candidate with this email already exists") from exc
	candidate_doc["_id"] = result.inserted_id
	candidate = CandidateDB(**candidate_doc)
	return CandidateOut(
		id=str(candidate.id),
		short_id=candidate.short_id,
		name=candidate.name,
		email=candidate.email,
		resume_text=candidate.resume_text,
		embedding_768=candidate.embedding_768,
		pipeline_stage=candidate.pipeline_stage,
		priority=candidate.priority,
		created_at=candidate.created_at,
	)


def _extract_email_from_text(text: str) -> str | None:
	"""Extract first email address from text."""
	email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
	match = re.search(email_pattern, text)
	return match.group(0) if match else None


def _extract_name_from_text(text: str, filename: str) -> str:
	"""Extract name from resume text or filename."""
	lines = text.strip().split('\n')
	# Usually the name is in the first few lines
	for line in lines[:5]:
		clean = line.strip()
		# Skip empty lines and lines that look like headers
		if not clean or len(clean) < 2 or len(clean) > 50:
			continue
		# Skip lines that are likely section headers
		if clean.upper() in ['SUMMARY', 'EXPERIENCE', 'EDUCATION', 'SKILLS', 'CONTACT', 'OBJECTIVE']:
			continue
		# Skip lines with too many special characters
		if sum(1 for c in clean if not c.isalnum() and c not in ' .-\'') > 3:
			continue
		# This is likely the name if it's mostly letters
		if sum(1 for c in clean if c.isalpha() or c == ' ') / len(clean) > 0.7:
			return clean
	
	# Fallback: use filename
	base = filename.rsplit('.', 1)[0] if '.' in filename else filename
	# Clean up filename (remove underscores, numbers)
	name = re.sub(r'[_\-]', ' ', base)
	name = re.sub(r'\d+', '', name)
	name = ' '.join(word.capitalize() for word in name.split())
	return name or "Unknown Candidate"


@app.post("/candidates/bulk")
async def bulk_upload_candidates(
	resumes: list[UploadFile] = File(...),
):
	"""Upload multiple resumes at once. Name and email are auto-extracted from resume content."""
	db = await get_db()
	results: list[dict[str, Any]] = []
	
	for resume in resumes:
		try:
			contents = await resume.read()
			text = await parse_resume(file=io.BytesIO(contents), filename=resume.filename or "resume.txt")
			
			# Auto-extract name and email
			extracted_email = _extract_email_from_text(text)
			extracted_name = _extract_name_from_text(text, resume.filename or "candidate")
			
			# Generate unique email if not found
			if not extracted_email:
				# Create a placeholder email from name
				safe_name = re.sub(r'[^a-zA-Z]', '', extracted_name.lower())[:20]
				extracted_email = f"{safe_name}_{dt.datetime.utcnow().strftime('%H%M%S')}@unknown.resume"
			
			embedding = embed_text(text)
			short_id = await get_next_short_id(db, "candidate_short_id")
			
			candidate_doc = {
				"name": extracted_name,
				"email": extracted_email,
				"short_id": short_id,
				"resume_text": text,
				"embedding_768": embedding,
				"pipeline_stage": "applied",
				"priority": None,
				"created_at": dt.datetime.utcnow(),
			}
			
			try:
				result = await db.candidates.insert_one(candidate_doc)
				candidate_doc["_id"] = result.inserted_id
				candidate = CandidateDB(**candidate_doc)
				results.append({
					"status": "success",
					"filename": resume.filename,
					"candidate": {
						"id": str(candidate.id),
						"short_id": candidate.short_id,
						"name": candidate.name,
						"email": candidate.email,
					}
				})
			except DuplicateKeyError:
				results.append({
					"status": "error",
					"filename": resume.filename,
					"error": f"Candidate with email '{extracted_email}' already exists"
				})
		except Exception as exc:
			results.append({
				"status": "error",
				"filename": resume.filename,
				"error": str(exc)
			})
	
	return {
		"total": len(resumes),
		"successful": sum(1 for r in results if r["status"] == "success"),
		"failed": sum(1 for r in results if r["status"] == "error"),
		"results": results
	}


@app.get("/candidates")
async def list_candidates(pipeline_stage: str | None = None, priority: str | None = None) -> list[dict[str, Any]]:
	db = await get_db()
	filters: dict[str, Any] = {}
	if pipeline_stage:
		filters["pipeline_stage"] = pipeline_stage
	if priority:
		filters["priority"] = priority
	cursor = db.candidates.find(filters)
	candidates = []
	async for doc in cursor:
		c = CandidateDB(**doc)
		candidates.append(
			{
				"id": str(c.id),
				"short_id": c.short_id,
				"name": c.name,
				"email": c.email,
				"pipeline_stage": c.pipeline_stage,
				"priority": c.priority,
				"resume_text": c.resume_text,
				"created_at": c.created_at,
			}
		)
	return candidates


@app.get("/candidates/{candidate_identifier}")
async def get_candidate(candidate_identifier: str) -> dict[str, Any]:
	"""Get a single candidate by ID, short_id, or name."""
	db = await get_db()
	c = await _find_candidate(db, candidate_identifier)
	if not c:
		raise HTTPException(status_code=404, detail="Candidate not found")
	return {
		"id": str(c.id),
		"short_id": c.short_id,
		"name": c.name,
		"email": c.email,
		"pipeline_stage": c.pipeline_stage,
		"priority": c.priority,
		"resume_text": c.resume_text,
		"notes": c.notes,
		"score_history": c.score_history,
		"stage_history": c.stage_history,
		"created_at": c.created_at,
		"updated_at": c.updated_at,
	}


@app.post("/jobs", response_model=JobOut)
async def create_job(payload: JobCreate):
	db = await get_db()
	skills = await extract_required_skills(payload.title, payload.description)
	embed_text_input = f"{payload.title}\nSkills: {', '.join(skills)}\n{payload.description[:1000]}"
	embedding = embed_text(embed_text_input)
	job_doc = {
		"short_id": await get_next_short_id(db, "job_short_id"),
		"title": payload.title,
		"description": payload.description,
		"required_skills": skills,
		"embedding_768": embedding,
		"created_at": dt.datetime.utcnow(),
	}
	result = await db.jobs.insert_one(job_doc)
	job_doc["_id"] = result.inserted_id
	job = JobDB(**job_doc)
	return JobOut(
		id=str(job.id),
		short_id=job.short_id,
		title=job.title,
		description=job.description,
		required_skills=job.required_skills,
		embedding_768=job.embedding_768,
		created_at=job.created_at,
	)


@app.get("/jobs")
async def list_jobs() -> list[dict[str, Any]]:
	db = await get_db()
	cursor = db.jobs.find()
	jobs: list[dict[str, Any]] = []
	async for doc in cursor:
		j = JobDB(**doc)
		jobs.append(
			{
				"id": str(j.id),
				"title": j.title,
				"required_skills": j.required_skills,
				"created_at": j.created_at,
			}
		)
	return jobs


@app.delete("/candidates/{candidate_id}")
async def delete_candidate(candidate_id: str) -> dict[str, str]:
	"""Delete a candidate by ID."""
	db = await get_db()
	try:
		result = await db.candidates.delete_one({"_id": ObjectId(candidate_id)})
	except Exception:
		raise HTTPException(status_code=400, detail="Invalid candidate ID")
	if result.deleted_count == 0:
		raise HTTPException(status_code=404, detail="Candidate not found")
	return {"status": "deleted", "id": candidate_id}


@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str) -> dict[str, str]:
	"""Delete a job by ID."""
	db = await get_db()
	try:
		result = await db.jobs.delete_one({"_id": ObjectId(job_id)})
	except Exception:
		raise HTTPException(status_code=400, detail="Invalid job ID")
	if result.deleted_count == 0:
		raise HTTPException(status_code=404, detail="Job not found")
	return {"status": "deleted", "id": job_id}


@app.get("/action-logs")
async def list_action_logs(limit: int = 50, action_type: str | None = None) -> list[dict[str, Any]]:
	"""Fetch recent action logs for the Action Logs dashboard."""
	db = await get_db()
	filters: dict[str, Any] = {}
	if action_type:
		filters["action_type"] = action_type
	cursor = db.action_logs.find(filters).sort("created_at", -1).limit(limit)
	logs: list[dict[str, Any]] = []
	async for doc in cursor:
		logs.append({
			"id": str(doc["_id"]),
			"action_type": doc.get("action_type"),
			"params": doc.get("params"),
			"status": doc.get("status"),
			"output": doc.get("output"),
			"created_at": doc.get("created_at"),
		})
	return logs


@app.post("/actions/voice")
async def actions_voice(payload: VoicePayload):
	db = await get_db()
	transcript = payload.transcript
	if not transcript and payload.audio_base64:
		try:
			transcript = await llm_client.transcribe_audio_base64(payload.audio_base64)
		except Exception as exc:  # noqa: BLE001
			raise HTTPException(status_code=400, detail=f"Transcription failed: {exc}")
	if not transcript:
		raise HTTPException(status_code=400, detail="Either transcript or audio_base64 required")
	# Convert conversation history to list of dicts for intent parser
	history = [{"role": turn.role, "content": turn.content} for turn in payload.conversation_history]
	intent = await parse_intent(transcript, conversation_history=history)
	result = await execute_action(db, intent)
	return {"intent_json": intent, "execution_result": result, "transcript": transcript}


@app.post("/candidates/{candidate_identifier}/qa")
async def candidate_question(candidate_identifier: str, payload: CandidateQuestionPayload) -> dict[str, Any]:
	db = await get_db()
	candidate = await _find_candidate(db, candidate_identifier)
	if not candidate:
		raise HTTPException(status_code=404, detail="Candidate not found")
	question = payload.question.strip()
	if not question:
		raise HTTPException(status_code=400, detail="Question cannot be empty")
	resume = candidate.resume_text or ""
	prompt = (
		"You are helping a recruiter understand a candidate. Answer the question using ONLY the resume text. "
		"If the answer is not present, say you cannot find it. Keep replies under 120 words."
	)
	try:
		answer_raw = await llm_client.chat(
			prompt=prompt,
			system="Provide concise, factual responses derived from the resume context.",
			messages=[
				{
					"role": "user",
					"content": f"Resume:\n{resume}\n\nQuestion:\n{question}",
				}
			],
		)
	except Exception as exc:  # noqa: BLE001
		raise HTTPException(status_code=502, detail=f"LLM request failed: {exc}")
	answer = answer_raw.strip() if isinstance(answer_raw, str) else str(answer_raw)
	log_payload = {
		"action_type": "candidate_qa",
		"params": {"candidate_identifier": candidate_identifier, "question": question},
		"status": "ok",
		"output": {"answer": answer},
		"created_at": dt.datetime.utcnow(),
	}
	await db.action_logs.insert_one(log_payload)
	return {
		"candidate": {
			"id": str(candidate.id),
			"short_id": candidate.short_id,
			"name": candidate.name,
			"email": candidate.email,
		},
		"question": question,
		"answer": answer,
	}


# Needed for resume parsing using BytesIO


async def _find_candidate(db, identifier: str) -> CandidateDB | None:
	ident = (identifier or "").strip()
	if not ident:
		return None
	doc = None
	try:
		doc = await db.candidates.find_one({"_id": ObjectId(ident)})
	except Exception:  # noqa: BLE001
		pass
	if not doc:
		try:
			short_id = int(ident)
			doc = await db.candidates.find_one({"short_id": short_id})
		except Exception:  # noqa: BLE001
			pass
	if not doc and "@" in ident:
		doc = await db.candidates.find_one({"email": ident})
	if not doc:
		doc = await db.candidates.find_one({"name": {"$regex": f"^{re.escape(ident)}$", "$options": "i"}})
	if not doc:
		return None
	return CandidateDB(**doc)
