#!/bin/bash
# HireFlow Quick Setup Script
# Run this after cloning the repository

set -e

echo "🎙️ HireFlow Setup"
echo "=================="
echo ""

# Check for required tools
command -v python3 >/dev/null 2>&1 || { echo "❌ Python 3 is required but not installed."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }

echo "✅ Prerequisites check passed"
echo ""

# Check for .env file
if [ ! -f ".env" ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env and add your OpenAI API key"
    echo "   Open .env and set: OPENAI_API_KEY=sk-your-key-here"
    echo ""
    read -p "Press Enter after you've updated .env, or Ctrl+C to exit..."
fi

# Setup Backend
echo ""
echo "🐍 Setting up Python backend..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -q -r requirements.txt
echo "✅ Backend dependencies installed"

# Start backend in background
echo "🚀 Starting backend server..."
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Setup Frontend
echo ""
echo "📦 Setting up Next.js frontend..."
cd frontend
npm install --silent
echo "✅ Frontend dependencies installed"

# Start frontend
echo "🚀 Starting frontend server..."
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "=========================================="
echo "✅ HireFlow is running!"
echo "=========================================="
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔌 Backend:  http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait and cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
