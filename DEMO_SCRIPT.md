# HireFlow Voice Assistant Demo Script

## Overview
This demo showcases HireFlow's voice-driven recruiting platform. The system enables recruiters to manage candidates, jobs, and the hiring pipeline entirely through voice commands with intelligent context awareness.

---

## Prerequisites

Before the demo:
1. Have backend running: `uvicorn main:app --reload --port 8000`
2. Have frontend running: `npm run dev`
3. Pre-seed some test data (optional but recommended):
   - Upload 3-5 candidate resumes
   - Create 1-2 job postings

---

## Demo Flow (Killer 6-Step Sequence)

### Step 1: Create a New Job
**Voice Command:**
> "Add a new job for Senior Frontend Engineer"

**What Happens:**
- System creates job posting
- Automatically extracts required skills from title
- Generates job embedding for candidate matching

**Expected Response:**
- Job created with ID
- Skills extracted: React, TypeScript, JavaScript, CSS, HTML
- Confirmation beep plays

**Why Explanation Shown:**
> "Created a new job posting for Senior Frontend Engineer and extracted 5 required skills from the role description."

---

### Step 2: Find Candidates for That Role (Context Memory)
**Voice Command:**
> "Find candidates for that role"

**What Happens:**
- System uses conversation memory to understand "that role" = Senior Frontend Engineer
- Searches candidates by semantic similarity to job requirements
- Ranks by skill match and experience relevance

**Expected Response:**
- Top 5 matching candidates
- Similarity scores
- Matched skills highlighted

**Why Explanation Shown:**
> "Found 5 candidates by matched against job #2 requirements, ranked by semantic similarity to query."

---

### Step 3: Score the Top Candidate (Context Memory)
**Voice Command:**
> "Score the top candidate"

**What Happens:**
- System understands "top candidate" from previous search results
- Generates detailed scoring rubric (0-100)
- Evaluates: skills match, experience relevance, project impact, communication

**Expected Response:**
- Overall score (e.g., 82/100)
- Rubric breakdown
- Strengths & concerns listed

**Why Explanation Shown:**
> "Scored Alex Chen against 'Senior Frontend Engineer' position using a 4-part rubric: skills match, experience relevance, project impact, and communication clarity."

---

### Step 4: Generate Interview Questions
**Voice Command:**
> "Generate interview questions for them"

**What Happens:**
- Creates 3 personalized screening questions
- Questions target specific resume items
- Each question includes what it evaluates and good signals

**Expected Response:**
```
1. "Tell me about your experience building component libraries with React..."
   - Evaluates: Technical depth in React
   - Good signal: Mentions testing, documentation, reusability

2. "You mentioned migrating a legacy system to TypeScript..."
   - Evaluates: Problem-solving approach
   - Good signal: Discusses trade-offs, team coordination

3. "How do you approach performance optimization in large SPAs?"
   - Evaluates: Performance expertise
   - Good signal: Specific tools, metrics, real examples
```

**Why Explanation Shown:**
> "Generated personalized screening questions for Alex Chen based on their resume and the 'Senior Frontend Engineer' job requirements."

---

### Step 5: Email to Schedule Interview
**Voice Command:**
> "Email them to schedule an interview next Tuesday"

**What Happens:**
- Drafts professional interview invitation
- Personalizes based on candidate and job
- Sends via Gmail integration (if configured)

**Expected Response:**
- Email preview shown
- Subject: "Interview Invitation - Senior Frontend Engineer at [Company]"
- Body includes: greeting, role mention, proposed time, next steps

**Why Explanation Shown:**
> "Drafted and sent an interview scheduling email to Alex Chen about the 'Senior Frontend Engineer' position for next Tuesday."

---

### Step 6: Navigate Dashboard with Filters
**Voice Command:**
> "Show me high priority candidates in screening"

**What Happens:**
- Navigates to pipeline view
- Applies filters: priority=high, pipeline_stage=screening
- Updates dashboard in real-time

**Expected Response:**
- Page navigates to /pipeline
- Filters applied automatically
- Only matching candidates shown

**Why Explanation Shown:**
> "Navigating to the pipeline view with filters: priority=high, pipeline_stage=screening. This shows the candidates matching your specified criteria."

---

## Demo Tips

### Conversation Memory Demonstrations
Show how the system remembers context:
- "Find React developers" → "Score the first one" → "Email them"
- "Show me job 1" → "Find candidates for it" → "Generate questions for the top match"

### Voice Feedback
Point out the audio cues:
- **Beep (rising tone)**: Recording started
- **Double beep (ascending)**: Command processed successfully
- **Descending tone**: Error occurred

### Why Explanations
Highlight the transparency:
- Every action shows reasoning
- Helps recruiters understand AI decisions
- Builds trust in automation

---

## Backup Commands (If Demo Goes Off-Script)

| Scenario | Command |
|----------|---------|
| List all jobs | "Show me all open jobs" |
| Search by skill | "Find Python developers with 5 years experience" |
| Filter pipeline | "Show high priority candidates" |
| Reset context | Click "Clear" in the overlay |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No audio feedback | Check browser audio permissions |
| "Microphone not supported" | Use Chrome/Edge, not Safari |
| Context not working | Check conversation history count in overlay |
| Commands not recognized | Speak clearly, avoid background noise |

---

## Key Selling Points

1. **Voice-First UX**: Hands-free recruiting workflow
2. **Context Memory**: Natural conversation flow with references
3. **Explainable AI**: Every action shows reasoning
4. **Audio Feedback**: Professional UX polish
5. **Multi-Action Flow**: Complete hiring workflow in 6 commands

---

## Sample Candidate Data for Demo

For best results, upload candidates with these profiles:

1. **Frontend Expert** (matches Senior Frontend role)
   - Skills: React, TypeScript, Next.js, Tailwind
   - Experience: 5+ years

2. **Backend Developer** (contrast candidate)
   - Skills: Python, FastAPI, PostgreSQL
   - Experience: 4 years

3. **Full Stack** (partial match)
   - Skills: React, Node.js, MongoDB
   - Experience: 3 years

This creates variety in search results and scoring comparisons.
