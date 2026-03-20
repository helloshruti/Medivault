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

# Load environment variables
load_dotenv()

PINATA_JWT = os.getenv("PINATA_JWT")
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


# ─── Document Metadata Storage ───────────────────────────────────────────────

DOCS_FILE = "documents_data.json"

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

def load_documents() -> list:
    if os.path.exists(DOCS_FILE):
        with open(DOCS_FILE, "r") as f:
            return json.load(f)
    return []

def save_documents(docs: list):
    with open(DOCS_FILE, "w") as f:
        json.dump(docs, f, indent=2)


# ─── Upload Endpoint (Pinata IPFS) ───────────────────────────────────────────

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    doc_type: str = Form("prescription"),
    profile: str = Form("self")
):
    """
    Upload a medical document with full security:
    1. Save locally as temp
    2. Compute SHA-256 hash of ORIGINAL file (integrity fingerprint)
    3. Encrypt the file with AES-256-CBC
    4. Upload ENCRYPTED file to Pinata IPFS
    5. Store SHA-256 hash in SQLite security database
    6. Store document metadata in JSON
    7. Return document info
    """
    # Step 1: Save file locally (temp)
    filename = file.filename or "unnamed_document"
    file_location = os.path.join(UPLOAD_DIR, filename)
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    original_size = os.path.getsize(file_location)

    # Step 2: Compute SHA-256 hash of the ORIGINAL file before encryption
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

    docs = load_documents()
    docs.insert(0, doc_meta)  # newest first
    save_documents(docs)

    return {
        "success": True,
        "filename": filename,
        "cid": pinata_result["cid"],
        "gateway_url": pinata_result["gateway_url"],
        "sha256": sha256_hash,
        "doc_id": doc_id,
        "encrypted": True,
        "message": "File encrypted with AES-256, uploaded to IPFS, and SHA-256 hash stored in database"
    }


# ─── Documents List Endpoint ─────────────────────────────────────────────────

@app.get("/documents")
def get_documents(profile: Optional[str] = None, doc_type: Optional[str] = None):
    """
    Retrieve all stored document metadata.
    Optionally filter by profile or document type.
    Each document includes its Pinata gateway URL for retrieval.
    """
    docs = load_documents()

    if profile and profile != "all":
        docs = [d for d in docs if d["profile"] == profile]

    if doc_type and doc_type != "all":
        docs = [d for d in docs if d["doc_type"] == doc_type]

    return docs


# ─── Document Stats Endpoint (must be before {doc_id} routes) ────────────────

@app.get("/documents/stats/summary")
def get_document_stats(profile: Optional[str] = None):
    """Get document count by type for category display."""
    docs = load_documents()

    if profile and profile != "all":
        docs = [d for d in docs if d["profile"] == profile]

    stats = {
        "lab": 0,
        "prescription": 0,
        "imaging": 0,
        "discharge": 0,
        "insurance": 0,
        "vaccination": 0,
        "total": len(docs)
    }

    for doc in docs:
        dtype = doc.get("doc_type", "")
        if dtype in stats:
            stats[dtype] += 1

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
def view_document(doc_id: str):
    """
    Fetch an encrypted document from Pinata, decrypt it with AES-256,
    and return the original file to the user.
    This is the only way to view documents since they are stored encrypted.
    """
    # Find document metadata
    docs = load_documents()
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
def get_document(doc_id: str):
    """Get a single document's metadata by ID."""
    docs = load_documents()
    for doc in docs:
        if doc["id"] == doc_id:
            return doc
    return {"error": "Document not found"}


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    """Delete a document's metadata and its hash record."""
    docs = load_documents()
    docs = [d for d in docs if d["id"] != doc_id]
    save_documents(docs)
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

DATA_FILE = "family_data.json"

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

@app.get("/family", response_model=List[FamilyMember])
def get_family():
    return load_data()

@app.post("/family")
def update_family(members: List[FamilyMember]):
    save_data(members)
    return {"message": "Family data updated"}

# ─── Medication Data Storage ─────────────────────────────────────────────────

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

# ─── Symptom Data Storage ────────────────────────────────────────────────────

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
