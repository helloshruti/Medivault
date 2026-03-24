from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = "new docs uploaded"
os.makedirs(UPLOAD_DIR, exist_ok=True)

import json
from typing import List, Optional
from uuid import uuid4
from pydantic import BaseModel
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class FamilyMember(BaseModel):
    id: str
    name: str
    relation: str
    age: int
    gender: str
    color: str
    initials: str
    active: bool
    medications: int
    symptoms: int
    documents: int

# User authentication

class User(BaseModel):
    id: str
    email: str
    name: str
    hashed_password: str

USERS_FILE = "users_data.json"

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def load_users() -> List[User]:
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, "r") as f:
            data = json.load(f)
            return [User(**item) for item in data]
    return []

def save_users(users: List[User]) -> None:
    with open(USERS_FILE, "w") as f:
        json.dump([user.dict() for user in users], f, indent=2)

def get_user_by_email(email: str) -> Optional[User]:
    users = load_users()
    for user in users:
        if user.email.lower() == email.lower():
            return user
    return None

# Data storage
DATA_FILE = "family_data.json"

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return [
      {
        "id": "1",
        "name": "Tanishka",
        "relation": "You",
        "age": 25,
        "gender": "Female",
        "color": "blue",
        "initials": "T",
        "active": True,
        "medications": 3,
        "symptoms": 3,
        "documents": 5,
      },
      {
        "id": "2",
        "name": "Shruti",
        "relation": "Sister",
        "age": 22,
        "gender": "Female",
        "color": "purple",
        "initials": "S",
        "active": False,
        "medications": 2,
        "symptoms": 1,
        "documents": 3,
      },
      {
        "id": "3",
        "name": "Trisha",
        "relation": "Mother",
        "age": 52,
        "gender": "Female",
        "color": "pink",
        "initials": "Tr",
        "active": False,
        "medications": 5,
        "symptoms": 2,
        "documents": 8,
      },
    ]

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump([m.dict() for m in data], f, indent=2)

@app.post("/signup")
def signup(payload: dict):
    email = payload.get("email")
    name = payload.get("name")
    password = payload.get("password")

    if not email or not password or not name:
        raise HTTPException(status_code=400, detail="Missing required fields")

    existing = get_user_by_email(email)
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    user = User(
        id=str(uuid4()),
        email=email,
        name=name,
        hashed_password=get_password_hash(password),
    )
    users = load_users()
    users.append(user)
    save_users(users)
    return {"id": user.id, "email": user.email, "name": user.name}

@app.post("/login")
def login(payload: dict):
    email = payload.get("email")
    password = payload.get("password")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Missing credentials")

    user = get_user_by_email(email)
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {"id": user.id, "email": user.email, "name": user.name}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_location = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"filename": file.filename, "location": file_location, "message": "File uploaded successfully"}

@app.get("/family", response_model=List[FamilyMember])
def get_family():
    return load_data()

@app.post("/family")
def update_family(members: List[FamilyMember]):
    save_data(members)
    return {"message": "Family data updated"}

# Medication Data Sorage
MEDS_FILE = "medications_data.json"

class Medication(BaseModel):
    id: str
    name: str
    dosage: str
    frequency: str
    timeOfDay: str
    active: bool
    takenToday: bool = False

def load_meds():
    if os.path.exists(MEDS_FILE):
        with open(MEDS_FILE, "r") as f:
            return json.load(f)
    return [
        {
            "id": "1",
            "name": "Lisinopril",
            "dosage": "10mg",
            "frequency": "once",
            "timeOfDay": "morning",
            "active": True,
            "takenToday": False
        },
        {
            "id": "2",
            "name": "Metformin",
            "dosage": "800mg",
            "frequency": "twice",
            "timeOfDay": "morning",
            "active": True,
            "takenToday": False
        }
    ]

def save_meds(data):
    with open(MEDS_FILE, "w") as f:
        json.dump([m.dict() for m in data], f, indent=2)

@app.get("/medications", response_model=List[Medication])
def get_medications():
    return load_meds()

@app.post("/medications")
def update_medications(meds: List[Medication]):
    save_meds(meds)
    return {"message": "Medications updated"}

# Symptom Data Storage
SYMPTOMS_FILE = "symptoms_data.json"

class Symptom(BaseModel):
    id: str
    profileId: str
    type: str
    description: str
    severity: int
    duration: str
    notes: str
    date: str

def load_symptoms():
    if os.path.exists(SYMPTOMS_FILE):
        with open(SYMPTOMS_FILE, "r") as f:
            return json.load(f)
    return []

def save_symptoms(data):
    with open(SYMPTOMS_FILE, "w") as f:
        json.dump([s.dict() for s in data], f, indent=2)

@app.get("/symptoms", response_model=List[Symptom])
def get_symptoms():
    return load_symptoms()

@app.post("/symptoms")
def update_symptoms(symptoms: List[Symptom]):
    save_symptoms(symptoms)
    return {"message": "Symptoms updated"}

@app.get("/")
def read_root():
    return {"message": "Medivault Backend is running"}
