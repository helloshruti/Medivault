import os
import re
import pickle

from pdfminer.high_level import extract_text as pdf_extract_text
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report


# ---------- STEP 1: EXTRACT TEXT FROM PDF ----------
def extract_text_from_pdf(pdf_path):
    try:
        text = pdf_extract_text(pdf_path) or ""
    except Exception as e:
        print(f"PDFMiner error for {pdf_path}: {e}")
        text = ""

    # OCR fallback if text extraction fails
    if not text.strip():
        try:
            from pdf2image import convert_from_path
            import pytesseract

            tess_path = os.environ.get("TESSERACT_PATH")
            if tess_path:
                pytesseract.pytesseract.tesseract_cmd = tess_path

            pages = convert_from_path(pdf_path, dpi=300)
            text = "\n".join(pytesseract.image_to_string(p) for p in pages)

        except Exception as e:
            print(f"OCR failed for {pdf_path}: {e}")
            return ""

    return text


# ---------- STEP 2: CLEAN TEXT ----------
def clean_text(text):
    text = re.sub(r'\n+', ' ', text)
    text = re.sub(r'[^A-Za-z0-9\s\.]', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.lower().strip()


# ---------- STEP 3: LOAD DATA (macOS-safe paths) ----------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "labdata")

data, labels = [], []

for folder, label in [("normal", 0), ("abnormal", 1)]:
    folder_path = os.path.join(DATA_DIR, folder)

    if not os.path.isdir(folder_path):
        print(f"Warning: Folder not found: {folder_path}")
        continue

    for file in os.listdir(folder_path):
        if file.lower().endswith(".pdf"):
            pdf_path = os.path.join(folder_path, file)

            text = extract_text_from_pdf(pdf_path)
            text = clean_text(text)

            if not text:
                print(f"Skipping empty report: {file}")
                continue

            data.append(text)
            labels.append(label)

print(f"Loaded {len(data)} reports: {labels.count(0)} normal, {labels.count(1)} abnormal")


# ---------- SAFETY CHECK ----------
if len(data) < 2:
    raise ValueError("Not enough reports to train the model. Add more PDFs.")


# ---------- STEP 4: FEATURE EXTRACTION ----------
vectorizer = TfidfVectorizer(
    stop_words="english",
    max_features=500,
    ngram_range=(1, 2)
)
X = vectorizer.fit_transform(data)


# ---------- STEP 5: SPLIT DATA ----------
X_train, X_test, y_train, y_test = train_test_split(
    X, labels, test_size=0.3, random_state=42, stratify=labels
)


# ---------- STEP 6: TRAIN MODEL ----------
model = LogisticRegression(max_iter=1000)
model.fit(X_train, y_train)


# ---------- STEP 7: EVALUATE ----------
y_pred = model.predict(X_test)
print("\nModel Evaluation:\n")
print(classification_report(y_test, y_pred, target_names=["Normal", "Abnormal"]))


# ---------- STEP 8: SAVE MODEL ----------
pickle.dump(model, open("lab_model.pkl", "wb"))
pickle.dump(vectorizer, open("tfidf.pkl", "wb"))
print("\nModel and vectorizer saved successfully!")


# ---------- STEP 9: TEST ON NEW FILE ----------
def predict_report(pdf_file):
    text = extract_text_from_pdf(pdf_file)
    text = clean_text(text)

    if not text:
        return "Unable to classify (empty report)"

    X_new = vectorizer.transform([text])
    pred = model.predict(X_new)[0]
    return "Abnormal" if pred == 1 else "Normal"
