# 🎙️ HireFlow - Voice-Powered Recruiting Platform

A voice-first recruiting assistant that lets you manage candidates and jobs using natural language commands.

## ✨ Features

- **🎤 Voice Commands** - Control everything with natural language
- **📊 Candidate Pipeline** - Visual Kanban-style candidate tracking
- **🎯 AI Scoring** - Score candidates against job requirements
- **📝 Screening Questions** - Auto-generate personalized interview questions
- **📧 Email Integration** - Draft and send interview scheduling emails
- **📁 Bulk Upload** - Drag & drop multiple resumes at once
- **🔗 Chained Actions** - "Find Python devs and move the top one to screening"

## 🚀 Quick Start (2 minutes)

### 1. Clone & Setup

```bash
git clone https://github.com/ritesh3280/hire-actions

# Copy environment file and add your OpenAI key
cp .env.example .env
# Edit .env and set: OPENAI_API_KEY=sk-your-key-here
```

### 2. Run Setup Script

```bash
./setup.sh
```

This will:
- ✅ Install Python dependencies
- ✅ Install Node.js dependencies  
- ✅ Start the backend (port 8000)
- ✅ Start the frontend (port 3000)

### 3. Open the App

Visit **http://localhost:3000** and start using voice commands!

## 🎤 Voice Commands Examples

| What you say | What happens |
|--------------|--------------|
| "Create a Senior Python Developer job" | Creates job with auto-extracted skills |
| "Find React developers with 3 years experience" | Searches and ranks candidates |
| "Score John for the Backend role" | Scores candidate against job requirements |
| "Generate screening questions for candidate 5" | Creates personalized interview questions |
| "Move Sarah to interview" | Updates pipeline stage |
| "Find Python devs and move the top one to screening" | Chained action - search + move |
| "I like this candidate" | Smart move to screening stage |
| "Email the top candidate about an interview" | Drafts interview scheduling email |


### Tech Stack

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS
- **Backend:** FastAPI, Python 3.11, Pydantic
- **Database:** MongoDB Atlas (cloud-hosted)
- **AI:** OpenAI GPT-4o-mini for intent parsing, SentenceTransformers for embeddings
- **Voice:** Web Speech API


## 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/actions/voice` | Process voice command |
| GET | `/candidates` | List all candidates |
| POST | `/candidates` | Create candidate |
| POST | `/candidates/bulk` | Bulk upload resumes |
| GET | `/jobs` | List all jobs |
| POST | `/jobs` | Create job |
| GET | `/action-logs` | View action history |

## 🎯 Key Features Explained

### Voice Command Chaining
Say compound commands like:
- "Find backend developers and score the best one"
- "Search for React developers and move top ones to screening"

### Smart Context Resolution
The system remembers context from previous commands:
- "Score them for the Senior role" (uses candidate from previous search)
- "Move them to interview" (uses last mentioned candidate)

### Auto Job Selection
When scoring without specifying a job, the system automatically uses the most recently created job.

## 🧪 Sample Data

The shared MongoDB instance includes:
- **17 sample candidates** with resume data
- **3 job postings** for testing
- Ready-to-use for immediate testing


## 📝 License

MIT License - feel free to use for any purpose.
