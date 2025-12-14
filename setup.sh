#!/bin/bash
# HireFlow Setup Script
# =====================
# One-command setup for the HireFlow voice recruiting platform

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}🎙️  HireFlow Setup${NC}"
echo "===================="
echo ""

# Check for required tools
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is required but not installed.${NC}"
    echo "   Download from: https://python.org/"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is required but not installed.${NC}"
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)

echo -e "   Python: ${GREEN}✓${NC} v$PYTHON_VERSION"
echo -e "   Node.js: ${GREEN}✓${NC} v$(node -v)"
echo ""

# Check for .env file
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}📝 Creating .env from .env.example...${NC}"
        cp .env.example .env
        echo ""
        echo -e "${RED}⚠️  IMPORTANT: Edit .env and add your OpenAI API key!${NC}"
        echo "   Open .env and set: OPENAI_API_KEY=sk-your-key-here"
        echo ""
        read -p "Press Enter after updating .env (or Ctrl+C to exit)..."
        echo ""
    else
        echo -e "${RED}❌ No .env.example found!${NC}"
        exit 1
    fi
fi

# Setup Backend
echo -e "${BLUE}🐍 Setting up Python backend...${NC}"
cd backend

if [ ! -d "venv" ]; then
    echo "   Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "   Installing dependencies (this may take a minute)..."
pip install --upgrade pip -q 2>/dev/null
pip install -r requirements.txt -q 2>/dev/null

echo -e "   ${GREEN}✓${NC} Backend dependencies installed"
echo ""

# Pre-download the embedding model (optional but better UX)
echo -e "${BLUE}📦 Pre-loading AI models...${NC}"
python3 -c "
import os
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
import warnings
warnings.filterwarnings('ignore')
from sentence_transformers import SentenceTransformer
print('   Downloading embedding model (first time only)...')
model = SentenceTransformer('all-mpnet-base-v2')
print('   ✓ Model ready')
" 2>/dev/null || echo "   (Models will download on first use)"
echo ""

cd ..

# Setup Frontend
echo -e "${BLUE}📦 Setting up Next.js frontend...${NC}"
cd frontend
echo "   Installing dependencies..."
npm install --silent 2>/dev/null
echo -e "   ${GREEN}✓${NC} Frontend dependencies installed"
cd ..
echo ""

# Start services
echo -e "${BLUE}🚀 Starting services...${NC}"
echo ""

# Start backend in background
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Give backend a moment to start
sleep 2

# Start frontend in background  
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
sleep 3

echo ""
echo -e "${GREEN}=========================================="
echo "✅ HireFlow is running!"
echo "==========================================${NC}"
echo ""
echo -e "🌐 Frontend: ${BLUE}http://localhost:3000${NC}"
echo -e "🔌 Backend:  ${BLUE}http://localhost:8000${NC}"
echo ""
echo "📖 Voice Commands to try:"
echo '   • "Create a Senior Python Developer job"'
echo '   • "Find React developers"'
echo '   • "Score candidate 1 for job 1"'
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for either process to exit
wait
