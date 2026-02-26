"""
Dissertation Experiment Scorer - FastAPI Backend
"""
import os
import sys
import tempfile
import shutil
from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import bcrypt
from jose import JWTError, jwt

# Add scripts path for qualtrics_cleanup
sys.path.insert(0, '/home/silver/clawd/scripts')
from qualtrics_cleanup import process_csv

# ============================================
# CONFIG
# ============================================

SECRET_KEY = os.environ.get("JWT_SECRET", "dissertation-scorer-secret-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Approved users (email -> hashed password)
# Password: admin
USERS = {
    "projectskyfall24@gmail.com": {
        "name": "Kai",
        "password_hash": bcrypt.hashpw(b"admin", bcrypt.gensalt()).decode()
    }
}

# ============================================
# MODELS
# ============================================

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    name: str

class UserInfo(BaseModel):
    email: str
    name: str

# ============================================
# APP SETUP
# ============================================

app = FastAPI(title="Dissertation Scorer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Will be restricted in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# ============================================
# AUTH HELPERS
# ============================================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserInfo:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None or email not in USERS:
            raise HTTPException(status_code=401, detail="Invalid token")
        return UserInfo(email=email, name=USERS[email]["name"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============================================
# ROUTES
# ============================================

@app.get("/health")
async def health():
    return {"status": "ok", "service": "dissertation-scorer"}

@app.post("/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    email = request.email.lower().strip()
    
    if email not in USERS:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user = USERS[email]
    if not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": email})
    return TokenResponse(access_token=access_token, name=user["name"])

@app.get("/auth/me", response_model=UserInfo)
async def get_me(user: UserInfo = Depends(get_current_user)):
    return user

@app.post("/process/csv")
async def process_csv_file(
    file: UploadFile = File(...),
    output_format: str = "xlsx",
    user: UserInfo = Depends(get_current_user)
):
    """Process uploaded CSV file and return cleaned/scored output."""
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Please upload a CSV file")
    
    # Create temp directory for processing
    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = Path(tmpdir) / "input.csv"
        output_ext = "xlsx" if output_format == "xlsx" else "csv"
        output_path = Path(tmpdir) / f"scored_output.{output_ext}"
        
        # Save uploaded file
        with open(input_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Process the file
        try:
            process_csv(str(input_path), str(output_path))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
        
        if not output_path.exists():
            raise HTTPException(status_code=500, detail="Processing failed - no output generated")
        
        # Read output file and return
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if output_ext == "xlsx" else "text/csv"
        
        # Copy to a persistent temp location for download
        final_output = tempfile.NamedTemporaryFile(delete=False, suffix=f".{output_ext}")
        shutil.copy(output_path, final_output.name)
        
        return FileResponse(
            final_output.name,
            media_type=media_type,
            filename=f"scored_results.{output_ext}"
        )

@app.get("/help/export")
async def help_export(user: UserInfo = Depends(get_current_user)):
    """Return instructions for exporting from Qualtrics."""
    return {
        "title": "How to Export from Qualtrics",
        "steps": [
            "1. Log in to your Qualtrics account",
            "2. Open your survey project",
            "3. Click 'Data & Analysis' in the top navigation",
            "4. Click 'Export & Import' → 'Export Data'",
            "5. Select 'CSV' as the format",
            "6. Choose 'Download all fields' or select the fields you need",
            "7. Click 'Download' and save the file",
            "8. Upload the CSV file here for processing"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
