# HireActions - Voice-Powered Recruiting

A voice-first recruiting assistant that lets you manage candidates and jobs using natural language. Say "Find React developers with 3 years experience" and instantly get ranked results. No clicking, no forms—just speak.

## Quick Start

```bash
git clone https://github.com/ritesh3280/hire-actions
cd hire-actions
cp .env.example .env          # Add your OPENAI_API_KEY
./setup.sh                    # Installs dependencies & starts servers
```

Open **http://localhost:3000** and click the mic button.

---

## Voice Commands

| Say this | What happens |
|----------|--------------|
| "Create a Senior Python Developer job" | Creates job with auto-extracted skills |
| "Find React developers with 3 years experience" | Searches and ranks candidates by match |
| "Score John for the Backend role" | Generates 0-100 score with rubric |
| "Generate screening questions for Sarah" | Creates personalized interview questions |
| "Move Sarah to interview" | Updates pipeline stage |
| "Email the top candidate about an interview" | Drafts scheduling email |
| "Find Python devs and move the top one to screening" | Chained: search → move |
| "Search React developers and score the best one" | Chained: search → score |

---

## Why I Built This

**The Problem**: Recruiting workflows are fragmented, clicking through tabs, filling forms, copy-pasting between tools. Voice is underutilized despite being our most natural interface.

**The Insight**: Recruiting has a constrained action space (search, score, move, email) with high semantic complexity (job requirements, candidate qualifications). This is the perfect domain for voice + LLM: natural language handles the complexity while a finite set of actions keeps execution reliable.

**Why Voice Shines Here**:
1. **Speed**: "Find Python devs with AWS experience" is faster than clicking filters
2. **Context**: Voice naturally handles compound requests ("...and move the top one to screening")
3. **Hands-free**: Recruiters often multitask, reviewing resumes while updating pipelines

**My Background in Voice Interfaces**: This builds on my prior work exploring voice + AI:
- **Clueless** (2nd Place Wispr Flow Track @ HackMIT) - Voice-powered web navigation using knowledge graphs
- **SolSpeak** (2nd Place @ HackNYU) - Phone-call DeFi trading via voice AI
- **Tax Daddy** (3rd Place @ Hacklytics Georgia Tech) - Multi-agentic voice system for tax document Q&A and form filling

Each project taught me something: Clueless showed me the power of constraining action spaces; SolSpeak proved voice works for high-stakes actions when trust is established; Tax Daddy demonstrated multi-agent orchestration for document understanding. HireActions synthesizes these learnings into a focused vertical.

## Prompt Engineering

### Intent Parsing Strategy

The core challenge: convert freeform voice → structured action. I use a two-stage approach:

**Stage 1: Action Classification**
```
System: You are an intent parser for a recruiting app.
Available actions: search_candidates, score_candidate, move_candidate, 
                   email_candidate, create_job, generate_screening_questions

Parse the user's voice command into:
- action: one of the above
- params: extracted parameters
- also_do: array of chained follow-up actions (if compound command)
```

**Key Design Decisions**:

1. **Constrained output schema**: I force JSON output with a strict schema. This trades flexibility for reliability—the LLM can't hallucinate new actions.

2. **Chained actions via `also_do`**: Compound commands like "Find devs and email the top one" are parsed into a primary action + chained actions. The executor resolves references ("top one" → actual candidate ID) after the primary action completes.

3. **Context injection**: Recent candidates/jobs are injected into the prompt so the LLM can resolve pronouns ("score *them*", "move *her* to interview").

**Stage 2: Specialized Generation**
For actions like `score_candidate` and `generate_screening_questions`, a second LLM call generates rich output using the candidate's resume + job requirements as context.

---

## Codebase Walkthrough

```
hire-actions/
├── backend/
│   ├── main.py                 # FastAPI routes
│   ├── services/
│   │   ├── intent_parser.py    # Voice → structured intent (LLM)
│   │   ├── executor.py         # Intent → database actions
│   │   ├── embedding.py        # Semantic search with SentenceTransformers
│   │   └── llm_client.py       # OpenAI
│   └── models.py               # Pydantic schemas
│
├── frontend/
│   ├── components/
│   │   ├── voice/
│   │   │   └── FloatingMic.tsx # Recording + transcription
│   │   ├── ExecutionResult.tsx # Renders action results
│   │   └── PipelineView.tsx    # Pipeline View
│   └── app/
│       └── page.tsx            # Dashboard
```

### Request Flow

```
User speaks → OpenAI Whisper transcribes → POST /actions/voice
    ↓
intent_parser.py: GPT-4o-mini extracts {action, params, also_do}
    ↓
executor.py: Runs action (e.g., search_candidates)
    - Embeds query with SentenceTransformers
    - Computes cosine similarity against candidate embeddings
    - Returns ranked results
    ↓
If also_do exists: resolve references ("top one" → candidate_id), execute chained actions
    ↓
Frontend renders ExecutionResult with candidate cards / scores / emails
```

### Key Files

| File | What it does |
|------|--------------|
| `intent_parser.py` | LLM prompt + JSON schema enforcement for action parsing |
| `executor.py` | Action dispatch + chained action resolution |
| `embedding.py` | SentenceTransformers embeddings for semantic candidate search |
| `FloatingMic.tsx` | OpenAI Whisper integration + real-time transcription display |
| `ExecutionResult.tsx` | Renderer for different action results |

---

## Tech Stack

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS
- **Backend:** FastAPI, Python 3.11, Pydantic
- **Database:** MongoDB Atlas (cloud-hosted)
- **AI:** OpenAI GPT-4o-mini for intent parsing, SentenceTransformers for embeddings
- **Voice:** OpenAI Whisper

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/actions/voice` | Process voice command |
| GET | `/candidates` | List candidates |
| POST | `/candidates/bulk` | Upload resumes |
| GET | `/jobs` | List jobs |

---
