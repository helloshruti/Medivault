from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil

app = FastAPI()

# Configure CORS
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = "new docs uploaded"
os.makedirs(UPLOAD_DIR, exist_ok=True)

import json
from typing import List
from pydantic import BaseModel

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
