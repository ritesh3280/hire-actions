#!/bin/bash
# HireFlow Setup Script

echo ""
echo "🎙️  HireFlow Setup"
echo "===================="
echo ""

# Check for required tools
echo "Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required. Install from https://python.org/"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Install from https://nodejs.org/"
    exit 1
fi

echo "   ✓ Python $(python3 --version | cut -d' ' -f2)"
echo "   ✓ Node $(node -v)"
echo ""

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check for .env
if [ ! -f ".env" ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your OpenAI API key!"
    echo "   nano .env"
    echo ""
    read -p "Press Enter after updating .env (or Ctrl+C to exit)..."
    echo ""
fi

# Setup Backend
echo "🐍 Setting up backend..."
cd "$SCRIPT_DIR/backend"

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt -q
echo "   ✓ Backend dependencies installed"

cd "$SCRIPT_DIR"

# Setup Frontend
echo "📦 Setting up frontend..."
cd "$SCRIPT_DIR/frontend"
npm install --silent
echo "   ✓ Frontend dependencies installed"

cd "$SCRIPT_DIR"
echo ""
echo "🚀 Starting servers..."
echo ""

# Start backend
cd "$SCRIPT_DIR/backend"
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

# Wait a bit for frontend
sleep 3

echo ""
echo "=========================================="
echo "✅ HireFlow is running!"
echo "=========================================="
echo ""
echo "🌐 Open: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Handle shutdown
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup INT TERM

# Keep running
wait $BACKEND_PID $FRONTEND_PID
