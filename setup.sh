#!/bin/bash
# HireFlow Setup Script
# =====================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}🎙️  HireFlow Setup${NC}"
echo "===================="
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

command -v python3 >/dev/null 2>&1 || { echo -e "${RED}❌ Python 3 required${NC}"; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}❌ Node.js required${NC}"; exit 1; }

echo -e "   Python: ${GREEN}✓${NC}"
echo -e "   Node.js: ${GREEN}✓${NC}"
echo ""

# Check .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📝 Creating .env from .env.example...${NC}"
    cp .env.example .env
    echo ""
    echo -e "${RED}⚠️  IMPORTANT: Edit .env and add your OpenAI API key!${NC}"
    echo ""
    read -p "Press Enter after updating .env..."
    echo ""
fi

# Setup Backend
echo -e "${BLUE}🐍 Setting up backend...${NC}"
cd backend
python3 -m venv venv 2>/dev/null || true
source venv/bin/activate
pip install -r requirements.txt --quiet
echo -e "   ${GREEN}✓${NC} Backend ready"
cd ..

# Setup Frontend
echo -e "${BLUE}📦 Setting up frontend...${NC}"
cd frontend
npm install --silent 2>/dev/null
echo -e "   ${GREEN}✓${NC} Frontend ready"
cd ..

echo ""
echo -e "${BLUE}🚀 Starting servers...${NC}"
echo ""

# Start backend
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000 2>&1 &
BACKEND_PID=$!
cd ..

sleep 2

# Start frontend
cd frontend
npm run dev 2>&1 &
FRONTEND_PID=$!
cd ..

sleep 3

echo ""
echo -e "${GREEN}=========================================="
echo "✅ HireFlow is running!"
echo "==========================================${NC}"
echo ""
echo -e "🌐 Open: ${BLUE}http://localhost:3000${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Cleanup
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
