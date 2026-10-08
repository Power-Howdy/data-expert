@echo off
echo Starting Data Expert System...

echo.
echo ================================
echo Starting Backend (FastAPI)...
echo ================================
cd backend
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate
pip install -r requirements.txt
start "Data Expert Backend" cmd /k "uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo.
echo ================================
echo Starting Frontend (React + Vite)...
echo ================================
cd ..\frontend
if not exist node_modules (
    echo Installing dependencies...
    npm install
)
start "Data Expert Frontend" cmd /k "npm run dev"

echo.
echo ================================
echo Data Expert System Started!
echo ================================
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo API Docs: http://localhost:8000/docs
echo.
pause