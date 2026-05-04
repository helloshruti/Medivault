from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, HTMLResponse
from dotenv import load_dotenv
import os
import shutil
import json
import requests
import hashlib
import sqlite3
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
import base64

# ─── OCR / Document Classification ──────────────────────────────────────────

_TESS_CMD = shutil.which("tesseract") or "/opt/homebrew/bin/tesseract"


def _run_tesseract(img) -> str:
    """Run pytesseract with the explicit Homebrew binary path."""
    try:
        import pytesseract
        pytesseract.pytesseract.tesseract_cmd = _TESS_CMD
        return pytesseract.image_to_string(img)
    except Exception as e:
        print(f"[OCR] pytesseract error: {e}")
        return ""


def _extract_text(file_path: str) -> str:
    """Extract text from a PDF or image file. Returns lowercase string."""
    ext = os.path.splitext(file_path)[1].lower()
    text = ""

    if ext == ".pdf":
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
        except Exception as e:
            print(f"[OCR] pdfplumber error: {e}")

        # If pdfplumber got nothing (scanned PDF), try image-based OCR via pdf2image
        if not text.strip():
            try:
                from pdf2image import convert_from_path
                from PIL import Image
                images = convert_from_path(file_path, first_page=1, last_page=3)
                for img in images:
                    text += _run_tesseract(img) + "\n"
            except Exception as e:
                print(f"[OCR] pdf2image fallback error: {e}")

    if ext in (".jpg", ".jpeg", ".png"):
        from PIL import Image
        img = Image.open(file_path)
        text = _run_tesseract(img)

    print(f"[OCR] Extracted text snippet: {text[:200].strip()!r}")
    return text.lower()


_KEYWORDS = {
    "lab": [
        "hemoglobin", "hb", "wbc", "rbc", "cbc", "glucose", "creatinine",
        "bilirubin", "platelet", "lab report", "test result", "blood test",
        "urine test", "hba1c", "cholesterol", "lipid", "serum", "plasma",
        "specimen", "reference range", "normal range", "pathology", "laboratory",
        "complete blood count", "thyroid", "tsh", "t3", "t4",
    ],
    "prescription": [
        "prescribed", "prescription", "rx", "tablet", "capsule", "syrup",
        "dosage", "dose", "twice daily", "once daily", "morning", "evening",
        "refill", "physician", "pharmacist", "pharmacy", "take one", "take two",
        "directions", "sig:", "dispense", "repeat",
    ],
    "imaging": [
        "charge", "bill", "tax", "account number", "invoice", "total amount",
        "due amount", "patient id", "admission date", "consultation fee",
        "service charges", "insurance details", "payment method", "hospital bill",
        "billing", "receipt", "amount due", "payment", "statement",
        "x-ray", "xray", "mri", "ct scan", "ultrasound", "radiology", "imaging",
    ],
    "discharge": [
        "discharge summary", "date of discharge", "date of admission",
        "final diagnosis", "provisional diagnosis", "treatment given",
        "procedure performed", "hospital course", "condition at discharge",
        "discharge instructions", "medications on discharge", "follow-up advice",
        "consultant name", "patient details", "ward", "case summary",
        "admitted", "inpatient", "length of stay",
    ],
    "insurance": [
        "insurance claim", "policy number", "claim number", "insured name",
        "policyholder", "coverage", "sum insured", "claim amount",
        "reimbursement", "cashless claim", "tpa", "third party administrator",
        "pre-authorization", "approval", "deductible", "co-payment",
        "beneficiary", "claim form", "settlement", "claim status",
        "policy", "premium", "insurance", "insured", "copay", "network",
    ],
    "vaccination": [
        "vaccine", "vaccination", "immunization", "dose", "booster",
        "vaccination date", "next dose due", "vaccine name", "batch number",
        "lot number", "manufacturer", "immunization record",
        "vaccination certificate", "clinic name", "healthcare provider",
        "injection site", "administered", "immunised", "covid", "influenza",
        "hepatitis", "mmr", "tdap", "varicella", "polio", "dpt",
    ],
}


def classify_document(file_path: str) -> str:
    """Return the best-matching doc_type based on OCR keyword scoring."""
    text = _extract_text(file_path)
    if not text.strip():
        return "unidentified"

    scores = {k: sum(1 for kw in kws if kw in text) for k, kws in _KEYWORDS.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "unidentified"


_TIME_MAP = {
    "breakfast": "morning", "morning": "morning",
    "9:00 am": "morning", "8:00 am": "morning", "10:00 am": "morning",
    "lunch": "noon", "noon": "noon", "12:00 pm": "noon",
    "afternoon": "afternoon", "3:00 pm": "afternoon", "2:00 pm": "afternoon",
    "evening": "evening", "6:00 pm": "evening", "5:00 pm": "evening",
    "dinner": "night", "night": "night", "bedtime": "night",
    "8:00 pm": "night", "9:00 pm": "night", "10:00 pm": "night",
}

_FREQ_MAP = {
    "once daily": "once", "once a day": "once", "od": "once",
    "twice daily": "twice", "twice a day": "twice", "bd": "twice", "bid": "twice",
    "three times": "three", "thrice": "three", "tds": "three", "tid": "three",
    "as needed": "asneeded", "prn": "asneeded", "as required": "asneeded",
}


def parse_medications_from_text(text: str, profile_id: str) -> list:
    """
    Extract medication entries from prescription OCR text.
    Handles numbered lines like:
      1. Paracetol-500 — 1 tablet after breakfast (9:00 AM)
      2. Coughnil Syrup — 10 ml after dinner (8:00 PM)
    """
    import re
    medications = []
    text_lower = text.lower()
    lines = text.split("\n")

    for line in lines:
        line = line.strip()
        # Only process numbered medication lines
        m = re.match(r"^\d+[.)]\s+(.+)", line)
        if not m:
            continue

        content = m.group(1).strip()
        content_lower = content.lower()

        # Split on em-dash, regular dash used as separator, or colon
        parts = re.split(r"\s*[—–\-]\s*", content, maxsplit=1)
        name = parts[0].strip()
        rest = parts[1].strip() if len(parts) > 1 else content

        # Clean up: remove leading numbers that bled into the name
        name = re.sub(r"^\d+\.\s*", "", name).strip()
        if not name or len(name) < 2:
            continue

        # Dosage: first numeric+unit pattern in rest (or full content)
        dosage_match = re.search(
            r"(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|tablet|tab|capsule|cap|drop|puff|unit)s?)",
            rest, re.IGNORECASE
        )
        dosage = dosage_match.group(1).strip() if dosage_match else "As prescribed"

        # Time of day
        time_of_day = "morning"
        for keyword, slot in _TIME_MAP.items():
            if keyword in content_lower:
                time_of_day = slot
                break

        # Frequency
        frequency = "once"
        for keyword, freq in _FREQ_MAP.items():
            if keyword in content_lower:
                frequency = freq
                break

        med_id = hashlib.md5(
            f"{name}{profile_id}{datetime.now().isoformat()}".encode()
        ).hexdigest()[:9]

        medications.append({
            "id": med_id,
            "name": name,
            "dosage": dosage,
            "frequency": frequency,
            "timeOfDay": time_of_day,
            "active": True,
            "takenToday": False,
            "profileId": profile_id,
        })
        print(f"[PRESCRIPTION] Parsed: {name} | {dosage} | {time_of_day}")

    return medications

# Load environment variables
load_dotenv()

PINATA_JWT = (os.getenv("PINATA_JWT") or "").strip()
PINATA_GATEWAY_URL = os.getenv("PINATA_GATEWAY_URL", "https://gateway.pinata.cloud/ipfs")

# AES-256 encryption key (32 bytes). Loaded from .env or auto-generated once.
AES_KEY_HEX = os.getenv("AES_ENCRYPTION_KEY")
if AES_KEY_HEX:
    AES_KEY = bytes.fromhex(AES_KEY_HEX)
else:
    # Generate a key and persist it so it survives restarts
    AES_KEY = get_random_bytes(32)
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    with open(env_path, "a") as f:
        f.write(f"\nAES_ENCRYPTION_KEY={AES_KEY.hex()}\n")
    print(f"[SECURITY] Generated AES-256 key and saved to .env")

app = FastAPI()

# Configure CORS
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "https://medivault-beta.vercel.app",
    "https://medivault.vercel.app",
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


# ─── SQLite Security Database ────────────────────────────────────────────────

SECURITY_DB = "document_security.db"

def init_security_db():
    """Initialize SQLite database for document hash & encryption records."""
    conn = sqlite3.connect(SECURITY_DB)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS document_hashes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doc_id TEXT UNIQUE NOT NULL,
            filename TEXT NOT NULL,
            sha256_hash TEXT NOT NULL,
            doc_type TEXT NOT NULL,
            profile TEXT NOT NULL,
            pinata_cid TEXT,
            encrypted INTEGER DEFAULT 1,
            file_size INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

# Initialize on startup
init_security_db()


def store_hash_record(doc_id: str, filename: str, sha256_hash: str,
                      doc_type: str, profile: str, pinata_cid: str,
                      encrypted: bool, file_size: int):
    """Store a document's SHA-256 hash record in the SQLite security database."""
    conn = sqlite3.connect(SECURITY_DB)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO document_hashes
            (doc_id, filename, sha256_hash, doc_type, profile, pinata_cid, encrypted, file_size, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (doc_id, filename, sha256_hash, doc_type, profile, pinata_cid,
          1 if encrypted else 0, file_size, datetime.now().isoformat()))
    conn.commit()
    conn.close()


def get_hash_record(doc_id: str) -> Optional[dict]:
    """Retrieve a single hash record by doc_id."""
    conn = sqlite3.connect(SECURITY_DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM document_hashes WHERE doc_id = ?", (doc_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None


def get_all_hash_records() -> list:
    """Retrieve all hash records, newest first."""
    conn = sqlite3.connect(SECURITY_DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM document_hashes ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def delete_hash_record(doc_id: str):
    """Delete a hash record from the security database."""
    conn = sqlite3.connect(SECURITY_DB)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM document_hashes WHERE doc_id = ?", (doc_id,))
    conn.commit()
    conn.close()


# ─── AES-256-CBC Encryption / Decryption ─────────────────────────────────────

def encrypt_file(file_path: str) -> str:
    """
    Encrypt a file using AES-256-CBC.
    Returns the path to the encrypted file.
    Format: [16-byte IV][encrypted data]
    """
    iv = get_random_bytes(16)
    cipher = AES.new(AES_KEY, AES.MODE_CBC, iv)

    with open(file_path, "rb") as f:
        plaintext = f.read()

    # PKCS7 padding to AES block size (16 bytes)
    pad_len = 16 - (len(plaintext) % 16)
    plaintext += bytes([pad_len]) * pad_len

    ciphertext = cipher.encrypt(plaintext)

    encrypted_path = file_path + ".enc"
    with open(encrypted_path, "wb") as f:
        f.write(iv + ciphertext)

    return encrypted_path


def decrypt_bytes(encrypted_data: bytes) -> bytes:
    """
    Decrypt AES-256-CBC encrypted data.
    Expects format: [16-byte IV][encrypted data]
    """
    iv = encrypted_data[:16]
    ciphertext = encrypted_data[16:]

    cipher = AES.new(AES_KEY, AES.MODE_CBC, iv)
    plaintext = cipher.decrypt(ciphertext)

    # Remove PKCS7 padding
    pad_len = plaintext[-1]
    plaintext = plaintext[:-pad_len]

    return plaintext

# ─── Pinata IPFS Upload Helper ───────────────────────────────────────────────

def upload_to_pinata(file_path: str, file_name: str) -> dict:
    """Upload a file to Pinata IPFS and return CID + gateway URL."""
    url = "https://api.pinata.cloud/pinning/pinFileToIPFS"

    headers = {
        "Authorization": f"Bearer {PINATA_JWT}"
    }

    # Pinata metadata
    pinata_metadata = json.dumps({
        "name": file_name,
        "keyvalues": {
            "app": "MediVault",
            "uploadedAt": datetime.now().isoformat()
        }
    })

    pinata_options = json.dumps({
        "cidVersion": 1
    })

    with open(file_path, "rb") as f:
        files = {
            "file": (file_name, f),
        }
        data = {
            "pinataMetadata": pinata_metadata,
            "pinataOptions": pinata_options
        }

        response = requests.post(url, files=files, data=data, headers=headers)

    if response.status_code == 200:
        result = response.json()
        cid = result["IpfsHash"]
        gateway_url = f"{PINATA_GATEWAY_URL}/{cid}"
        return {
            "success": True,
            "cid": cid,
            "gateway_url": gateway_url,
            "pin_size": result.get("PinSize", 0),
            "timestamp": result.get("Timestamp", "")
        }
    else:
        return {
            "success": False,
            "error": response.text,
            "status_code": response.status_code
        }


def compute_sha256(file_path: str) -> str:
    """Compute SHA-256 hash of a file for integrity verification."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def user_dir(user: Optional[str]) -> str:
    """Return (and create) a per-user data directory."""
    if not user:
        return "."
    safe = user.replace("@", "_at_").replace(".", "_")
    path = os.path.join("user_data", safe)
    os.makedirs(path, exist_ok=True)
    return path


# ─── Document Metadata Storage ───────────────────────────────────────────────

def docs_file(user: Optional[str] = None) -> str:
    return os.path.join(user_dir(user), "documents_data.json")

class DocumentMeta(BaseModel):
    id: str
    filename: str
    doc_type: str  # prescription, lab, imaging, discharge, insurance, vaccination
    profile: str   # self, sister, mother, etc.
    cid: str
    gateway_url: str
    sha256: str
    size: int
    uploaded_at: str

def load_documents(user: Optional[str] = None) -> list:
    f = docs_file(user)
    if os.path.exists(f):
        with open(f, "r") as fh:
            return json.load(fh)
    return []

def save_documents(docs: list, user: Optional[str] = None):
    with open(docs_file(user), "w") as f:
        json.dump(docs, f, indent=2)


# ─── Upload Endpoint (Pinata IPFS) ───────────────────────────────────────────

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    doc_type: str = Form("auto"),
    profile: str = Form("self"),
    user: str = Form("")
):
    """
    Upload a medical document with full security:
    1. Save locally as temp
    2. Auto-classify via OCR if doc_type == "auto"
    3. Compute SHA-256 hash of ORIGINAL file (integrity fingerprint)
    4. Encrypt the file with AES-256-CBC
    5. Upload ENCRYPTED file to Pinata IPFS
    6. Store SHA-256 hash in SQLite security database
    7. Store document metadata in JSON
    8. Return document info
    """
    # Step 1: Save file locally (temp)
    filename = file.filename or "unnamed_document"
    file_location = os.path.join(UPLOAD_DIR, filename)
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    original_size = os.path.getsize(file_location)

    # Step 2: Auto-classify via OCR when requested; also cache extracted text
    auto_detected = False
    _ocr_text = ""
    if doc_type == "auto":
        _ocr_text = _extract_text(file_location)
        scores = {k: sum(1 for kw in kws if kw in _ocr_text) for k, kws in _KEYWORDS.items()}
        best = max(scores, key=scores.get)
        doc_type = best if scores[best] > 0 else "lab"
        auto_detected = True
        print(f"[OCR] Auto-classified '{filename}' as '{doc_type}'")

    # Step 3: Compute SHA-256 hash of the ORIGINAL file before encryption
    sha256_hash = compute_sha256(file_location)

    # Step 3: Encrypt the file with AES-256-CBC
    encrypted_path = encrypt_file(file_location)

    # Step 4: Upload the ENCRYPTED file to Pinata IPFS
    pinata_result = upload_to_pinata(encrypted_path, filename + ".enc")

    # Clean up encrypted temp file
    if os.path.exists(encrypted_path):
        os.remove(encrypted_path)

    if not pinata_result["success"]:
        return {
            "success": False,
            "error": f"Pinata upload failed: {pinata_result.get('error', 'Unknown error')}",
            "filename": filename
        }

    # Step 5: Generate doc ID
    doc_id = hashlib.md5(f"{filename}{datetime.now().isoformat()}".encode()).hexdigest()[:12]

    # Step 6: Store SHA-256 hash record in SQLite security database
    store_hash_record(
        doc_id=doc_id,
        filename=filename,
        sha256_hash=sha256_hash,
        doc_type=doc_type,
        profile=profile,
        pinata_cid=pinata_result["cid"],
        encrypted=True,
        file_size=original_size
    )

    # Step 7: Store document metadata in JSON (for quick listing)
    doc_meta = {
        "id": doc_id,
        "filename": filename,
        "doc_type": doc_type,
        "profile": profile,
        "cid": pinata_result["cid"],
        "gateway_url": pinata_result["gateway_url"],
        "sha256": sha256_hash,
        "size": original_size,
        "encrypted": True,
        "uploaded_at": datetime.now().isoformat()
    }

    docs = load_documents(user=user)
    docs.insert(0, doc_meta)  # newest first
    save_documents(docs, user=user)

    # ── If this is a prescription, parse and auto-add medications ─────────────
    extracted_medications = []
    if doc_type == "prescription":
        # Use cached OCR text if available, otherwise re-extract
        ocr_text = _ocr_text if _ocr_text else _extract_text(file_location)
        extracted_medications = parse_medications_from_text(ocr_text, profile)
        if extracted_medications:
            all_meds = load_meds_raw(user=user)
            # Avoid duplicates: skip if same name+profile already exists
            existing_names = {m["name"].lower() for m in all_meds if m.get("profileId") == profile}
            new_meds = [m for m in extracted_medications if m["name"].lower() not in existing_names]
            if new_meds:
                save_meds_raw(all_meds + new_meds, user=user)
                print(f"[PRESCRIPTION] Added {len(new_meds)} medication(s) for profile {profile}")

    return {
        "success": True,
        "filename": filename,
        "cid": pinata_result["cid"],
        "gateway_url": pinata_result["gateway_url"],
        "sha256": sha256_hash,
        "doc_id": doc_id,
        "doc_type": doc_type,
        "auto_detected": auto_detected,
        "encrypted": True,
        "extracted_medications": extracted_medications,
        "message": "File encrypted with AES-256, uploaded to IPFS, and SHA-256 hash stored in database"
    }


# ─── Documents List Endpoint ─────────────────────────────────────────────────

@app.get("/documents")
def get_documents(profile: Optional[str] = None, doc_type: Optional[str] = None, user: Optional[str] = None):
    """
    Retrieve all stored document metadata.
    Optionally filter by profile or document type.
    Each document includes its Pinata gateway URL for retrieval.
    """
    docs = load_documents(user)

    if profile and profile != "all":
        docs = [d for d in docs if d["profile"] == profile]

    if doc_type and doc_type != "all":
        docs = [d for d in docs if d["doc_type"] == doc_type]

    return docs


# ─── Document Stats Endpoint (must be before {doc_id} routes) ────────────────

@app.get("/documents/stats/summary")
def get_document_stats(profile: Optional[str] = None, user: Optional[str] = None):
    """Get document count by type for category display."""
    docs = load_documents(user)

    if profile and profile != "all":
        docs = [d for d in docs if d["profile"] == profile]

    stats = {
        "lab": 0,
        "prescription": 0,
        "imaging": 0,
        "discharge": 0,
        "insurance": 0,
        "vaccination": 0,
        "unidentified": 0,
        "total": len(docs)
    }

    for doc in docs:
        dtype = doc.get("doc_type", "unidentified")
        if dtype in stats:
            stats[dtype] += 1
        else:
            stats["unidentified"] += 1

    return stats


# ─── Document Decryption Proxy (must be before {doc_id} catch-all) ───────────

MIME_TYPES = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".webp": "image/webp",
}

@app.get("/documents/{doc_id}/view")
def view_document(doc_id: str, user: Optional[str] = None):
    """
    Fetch an encrypted document from Pinata, decrypt it with AES-256,
    and return the original file to the user.
    This is the only way to view documents since they are stored encrypted.
    """
    # Find document metadata
    docs = load_documents(user)
    doc = None
    for d in docs:
        if d["id"] == doc_id:
            doc = d
            break

    if not doc:
        return {"error": "Document not found"}

    # Fetch the encrypted file from Pinata
    try:
        response = requests.get(doc["gateway_url"], timeout=30)
        if response.status_code != 200:
            return {"error": f"Failed to fetch from Pinata (HTTP {response.status_code})"}
    except requests.RequestException as e:
        return {"error": f"Failed to fetch from Pinata: {str(e)}"}

    encrypted_data = response.content

    # Check if document is encrypted (newer uploads)
    is_encrypted = doc.get("encrypted", False)

    if is_encrypted:
        try:
            decrypted_data = decrypt_bytes(encrypted_data)
        except Exception as e:
            return {"error": f"Decryption failed: {str(e)}"}
    else:
        # Legacy documents uploaded before encryption was added
        decrypted_data = encrypted_data

    # Determine content type from original filename
    filename = doc["filename"]
    ext = os.path.splitext(filename)[1].lower()
    content_type = MIME_TYPES.get(ext, "application/octet-stream")

    return Response(
        content=decrypted_data,
        media_type=content_type,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
        }
    )


# ─── Single Document & Delete (after /view to avoid route conflicts) ─────────

@app.get("/documents/{doc_id}")
def get_document(doc_id: str, user: Optional[str] = None):
    """Get a single document's metadata by ID."""
    docs = load_documents(user)
    for doc in docs:
        if doc["id"] == doc_id:
            return doc
    return {"error": "Document not found"}


class DocTypeUpdate(BaseModel):
    doc_type: str

@app.patch("/documents/{doc_id}")
def update_document_type(doc_id: str, body: DocTypeUpdate, user: Optional[str] = None):
    """Manually update a document's type (used for unidentified docs)."""
    docs = load_documents(user)
    updated = False
    for doc in docs:
        if doc["id"] == doc_id:
            doc["doc_type"] = body.doc_type
            updated = True
            break
    if not updated:
        return {"error": "Document not found"}
    save_documents(docs, user)
    return {"message": "Document type updated", "doc_type": body.doc_type}


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str, user: Optional[str] = None):
    """Delete a document's metadata and its hash record."""
    docs = load_documents(user)
    docs = [d for d in docs if d["id"] != doc_id]
    save_documents(docs, user)
    # Also remove from the security hash database
    delete_hash_record(doc_id)
    return {"message": "Document and hash record removed"}


# ─── Security / Hash Verification Endpoints ─────────────────────────────────

@app.get("/security/hashes")
def list_hash_records():
    """List all SHA-256 hash records from the security database."""
    return get_all_hash_records()


@app.get("/security/dashboard", response_class=HTMLResponse)
def security_dashboard():
    """Visual HTML dashboard showing all document hash records in a table."""
    records = get_all_hash_records()
    total = len(records)

    rows_html = ""
    for i, r in enumerate(records, 1):
        encrypted_badge = (
            '<span style="background:#059669;color:white;padding:2px 8px;border-radius:4px;font-size:11px;">AES-256</span>'
            if r["encrypted"]
            else '<span style="background:#dc2626;color:white;padding:2px 8px;border-radius:4px;font-size:11px;">No</span>'
        )
        file_size_kb = round(r["file_size"] / 1024, 1)
        rows_html += f"""
        <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;">{i}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:11px;color:#2563eb;">{r["doc_id"]}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:500;">{r["filename"]}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
                <span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:4px;font-size:11px;text-transform:uppercase;">{r["doc_type"]}</span>
            </td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:11px;color:#374151;word-break:break-all;">{r["sha256_hash"]}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:10px;color:#6b7280;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="{r["pinata_cid"]}">{r["pinata_cid"][:20]}...</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">{encrypted_badge}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;">{r["profile"]}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;">{file_size_kb} KB</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;white-space:nowrap;">{r["created_at"][:19].replace("T", " ")}</td>
        </tr>"""

    if not rows_html:
        rows_html = """
        <tr>
            <td colspan="10" style="padding:40px;text-align:center;color:#9ca3af;">No hash records yet. Upload a document to see it here.</td>
        </tr>"""

    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MediVault - Security Hash Records</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; color: #111827; }}
            .container {{ max-width: 1400px; margin: 0 auto; padding: 24px; }}
            .header {{ background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
            .header h1 {{ font-size: 22px; margin-bottom: 4px; }}
            .header p {{ color: #6b7280; font-size: 14px; }}
            .stats {{ display: flex; gap: 16px; margin-bottom: 20px; }}
            .stat-card {{ background: white; border-radius: 12px; padding: 20px; flex: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
            .stat-card .label {{ font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }}
            .stat-card .value {{ font-size: 28px; font-weight: 700; margin-top: 4px; }}
            .table-wrap {{ background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
            table {{ width: 100%; border-collapse: collapse; }}
            th {{ padding: 12px; text-align: left; background: #f9fafb; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }}
            tr:hover {{ background: #f9fafb; }}
            .refresh {{ display:inline-block; margin-top:12px; padding:8px 16px; background:#2563eb; color:white; border:none; border-radius:6px; cursor:pointer; font-size:13px; text-decoration:none; }}
            .refresh:hover {{ background:#1d4ed8; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>MediVault Security Dashboard</h1>
                <p>SHA-256 hash records & AES-256 encryption audit log for all uploaded medical documents</p>
                <a href="/security/dashboard" class="refresh">Refresh</a>
            </div>

            <div class="stats">
                <div class="stat-card">
                    <div class="label">Total Records</div>
                    <div class="value" style="color:#2563eb;">{total}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Encrypted (AES-256)</div>
                    <div class="value" style="color:#059669;">{sum(1 for r in records if r["encrypted"])}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Unencrypted (Legacy)</div>
                    <div class="value" style="color:#dc2626;">{sum(1 for r in records if not r["encrypted"])}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Total Size</div>
                    <div class="value" style="color:#7c3aed;">{round(sum(r["file_size"] for r in records) / 1024, 1)} KB</div>
                </div>
            </div>

            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th style="text-align:center;">#</th>
                            <th>Doc ID</th>
                            <th>Filename</th>
                            <th>Type</th>
                            <th>SHA-256 Hash</th>
                            <th>Pinata CID</th>
                            <th style="text-align:center;">Encrypted</th>
                            <th style="text-align:center;">Profile</th>
                            <th>Size</th>
                            <th>Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows_html}
                    </tbody>
                </table>
            </div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)


@app.get("/security/hashes/{doc_id}")
def get_hash(doc_id: str):
    """Get a specific document's hash record."""
    record = get_hash_record(doc_id)
    if not record:
        return {"error": "Hash record not found"}
    return record


@app.get("/security/verify/{doc_id}")
def verify_document_integrity(doc_id: str):
    """
    Verify a document's integrity:
    1. Fetch the encrypted file from Pinata
    2. Decrypt it
    3. Compute SHA-256 of the decrypted file
    4. Compare with the stored hash in the security database
    """
    # Get the stored hash record
    record = get_hash_record(doc_id)
    if not record:
        return {"error": "No hash record found for this document", "verified": False}

    # Get document metadata
    docs = load_documents()
    doc = None
    for d in docs:
        if d["id"] == doc_id:
            doc = d
            break

    if not doc:
        return {"error": "Document metadata not found", "verified": False}

    # Fetch from Pinata
    try:
        response = requests.get(doc["gateway_url"], timeout=30)
        if response.status_code != 200:
            return {"error": "Failed to fetch from Pinata", "verified": False}
    except requests.RequestException as e:
        return {"error": f"Network error: {str(e)}", "verified": False}

    encrypted_data = response.content
    is_encrypted = doc.get("encrypted", False)

    if is_encrypted:
        try:
            decrypted_data = decrypt_bytes(encrypted_data)
        except Exception as e:
            return {"error": f"Decryption failed: {str(e)}", "verified": False}
    else:
        decrypted_data = encrypted_data

    # Compute SHA-256 of decrypted data
    current_hash = hashlib.sha256(decrypted_data).hexdigest()
    stored_hash = record["sha256_hash"]

    return {
        "verified": current_hash == stored_hash,
        "doc_id": doc_id,
        "filename": record["filename"],
        "stored_hash": stored_hash,
        "computed_hash": current_hash,
        "match": current_hash == stored_hash,
        "encrypted": is_encrypted,
        "checked_at": datetime.now().isoformat()
    }


# ─── Family Data ─────────────────────────────────────────────────────────────

def family_file(user: Optional[str] = None) -> str:
    return os.path.join(user_dir(user), "family_data.json")

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

REGISTERED_USERS_CSV = "user_data/registered_users.csv"

def register_user(email: str):
    """Track first-time users in a CSV. Creates the file if it doesn't exist."""
    os.makedirs("user_data", exist_ok=True)
    existing = set()
    if os.path.exists(REGISTERED_USERS_CSV):
        with open(REGISTERED_USERS_CSV, "r") as f:
            for line in f:
                parts = line.strip().split(",")
                if parts:
                    existing.add(parts[0])
    if email not in existing:
        with open(REGISTERED_USERS_CSV, "a") as f:
            from datetime import datetime
            f.write(f"{email},{datetime.utcnow().isoformat()}\n")

def is_registered_user(email: str) -> bool:
    if not os.path.exists(REGISTERED_USERS_CSV):
        return False
    with open(REGISTERED_USERS_CSV, "r") as f:
        for line in f:
            parts = line.strip().split(",")
            if parts and parts[0] == email:
                return True
    return False

def load_data(user: Optional[str] = None):
    f = family_file(user)
    if os.path.exists(f):
        with open(f, "r") as f:
            return json.load(f)
    return []

def save_data(data, user: Optional[str] = None):
    with open(family_file(user), "w") as f:
        json.dump([m.dict() for m in data], f, indent=2)

@app.get("/family", response_model=List[FamilyMember])
def get_family(user: Optional[str] = None):
    if user:
        register_user(user)
    return load_data(user)

@app.post("/family")
def update_family(members: List[FamilyMember], user: Optional[str] = None):
    save_data(members, user)
    return {"message": "Family data updated"}

# ─── Medication Data Storage ─────────────────────────────────────────────────

def meds_file(user: Optional[str] = None) -> str:
    return os.path.join(user_dir(user), "medications_data.json")

class Medication(BaseModel):
    id: str
    name: str
    dosage: str
    frequency: str
    timeOfDay: str
    active: bool
    takenToday: bool = False
    profileId: str = "1"

def load_meds_raw(user: Optional[str] = None) -> list:
    f = meds_file(user)
    if os.path.exists(f):
        with open(f, "r") as f:
            return json.load(f)
    return [
        {"id": "1", "name": "Lisinopril", "dosage": "10mg", "frequency": "once",
         "timeOfDay": "morning", "active": True, "takenToday": False, "profileId": "1"},
        {"id": "2", "name": "Metformin", "dosage": "800mg", "frequency": "twice",
         "timeOfDay": "morning", "active": True, "takenToday": False, "profileId": "1"},
    ]

def save_meds_raw(data: list, user: Optional[str] = None):
    with open(meds_file(user), "w") as f:
        json.dump(data, f, indent=2)

@app.get("/medications", response_model=List[Medication])
def get_medications(profile: Optional[str] = None, user: Optional[str] = None):
    meds = load_meds_raw(user)
    if profile:
        meds = [m for m in meds if m.get("profileId", "1") == profile]
    return meds

@app.post("/medications")
def update_medications(meds: List[Medication], profile: Optional[str] = None, user: Optional[str] = None):
    all_meds = load_meds_raw(user)
    if profile:
        # Keep other profiles' meds, replace current profile's meds
        kept = [m for m in all_meds if m.get("profileId", "1") != profile]
        incoming = [{**m.dict(), "profileId": profile} for m in meds]
        save_meds_raw(kept + incoming, user)
    else:
        save_meds_raw([m.dict() for m in meds], user)
    return {"message": "Medications updated"}

# ─── Symptom Data Storage ────────────────────────────────────────────────────

def symptoms_file(user: Optional[str] = None) -> str:
    return os.path.join(user_dir(user), "symptoms_data.json")

class Symptom(BaseModel):
    id: str
    profileId: str
    type: str
    description: str
    severity: int
    duration: str
    notes: str
    date: str

def load_symptoms(user: Optional[str] = None):
    f = symptoms_file(user)
    if os.path.exists(f):
        with open(f, "r") as f:
            return json.load(f)
    return []

def save_symptoms(data, user: Optional[str] = None):
    with open(symptoms_file(user), "w") as f:
        json.dump([s.dict() for s in data], f, indent=2)

@app.get("/symptoms", response_model=List[Symptom])
def get_symptoms(user: Optional[str] = None):
    return load_symptoms(user)

@app.post("/symptoms")
def update_symptoms(symptoms: List[Symptom], user: Optional[str] = None):
    save_symptoms(symptoms, user)
    return {"message": "Symptoms updated"}

# ─── Vitals → Dataset Append ─────────────────────────────────────────────────

DATASET_PATH = os.path.join(os.path.dirname(__file__), "..", "medivault models", "DB PRED", "dataset1.csv")

class VitalsRecord(BaseModel):
    bp: str = "120/80"
    highChol: str = "No"
    bmi: str = "22"
    smoker: str = "No"
    physActivity: str = "Yes"
    fruits: str = "Yes"
    veggies: str = "Yes"
    hvyAlcohol: str = "No"
    age: Optional[int] = None
    gender: Optional[str] = None

def _yn(val: str) -> int:
    return 1 if str(val).strip().lower() == "yes" else 0

def _age_category(age: Optional[int]) -> int:
    if not age: return 0
    if age <= 24: return 1
    if age <= 29: return 2
    if age <= 34: return 3
    if age <= 39: return 4
    if age <= 44: return 5
    if age <= 49: return 6
    if age <= 54: return 7
    if age <= 59: return 8
    if age <= 64: return 9
    if age <= 69: return 10
    if age <= 74: return 11
    if age <= 79: return 12
    return 13

@app.post("/vitals/record")
def record_vitals(v: VitalsRecord):
    """Map user vitals to dataset columns and append a row to dataset1.csv."""
    try:
        bp_sys = int(v.bp.split("/")[0])
    except Exception:
        bp_sys = 120
    high_bp = 1 if bp_sys >= 130 else 0

    try:
        bmi_val = float(v.bmi)
    except Exception:
        bmi_val = 22.0

    sex = 1 if str(v.gender or "").strip().lower() in ("male", "m") else 0
    age_cat = _age_category(v.age)

    row = [
        0,                   # Diabetes_012 — unknown at input time
        high_bp,             # HighBP
        _yn(v.highChol),     # HighChol
        round(bmi_val, 1),   # BMI
        _yn(v.smoker),       # Smoker
        _yn(v.physActivity), # PhysActivity
        _yn(v.fruits),       # Fruits
        _yn(v.veggies),      # Veggies
        _yn(v.hvyAlcohol),   # HvyAlcoholConsump
        sex,                 # Sex
        age_cat,             # Age
    ]

    dataset_path = os.path.normpath(DATASET_PATH)
    if not os.path.exists(dataset_path):
        return {"error": f"Dataset not found at {dataset_path}"}

    with open(dataset_path, "a", newline="") as f:
        import csv
        writer = csv.writer(f)
        writer.writerow(row)

    return {"message": "Vitals appended to dataset", "row": row}


@app.get("/")
def read_root():
    return {"message": "Medivault Backend is running"}


# ─── Medical Chatbot (Groq) ───────────────────────────────────────────────────

SYSTEM_PROMPT = (
    "You are MediVault AI, a helpful medical assistant. "
    "Answer questions clearly and concisely about medications, symptoms, conditions, and general health. "
    "Always remind users to consult a doctor for personal medical advice. "
    "Keep answers under 150 words. Do not use bullet points unless listing more than 3 items."
)

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
def chat(req: ChatRequest):
    from groq import Groq
    from fastapi.responses import StreamingResponse

    def generate():
        try:
            client = Groq(api_key=os.getenv("GROQ_API_KEY"))
            stream = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": req.message},
                ],
                max_tokens=200,
                stream=True,
            )
            for chunk in stream:
                token = chunk.choices[0].delta.content or ""
                if token:
                    yield token
        except Exception as e:
            yield f"Something went wrong: {str(e)}"

    return StreamingResponse(generate(), media_type="text/plain")
