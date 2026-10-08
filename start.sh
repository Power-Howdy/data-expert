#!/bin/bash
echo "Starting Data Expert System..."

echo ""
echo "================================"
echo "Starting Backend (FastAPI)..."
echo "================================"
cd backend
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

echo ""
echo "================================"
echo "Starting Frontend (React + Vite)..."
echo "================================"
cd ../frontend
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
npm run dev &
FRONTEND_PID=$!

echo ""
echo "================================"
echo "Data Expert System Started!"
echo "================================"
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait