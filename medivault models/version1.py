# -------------------------------------------------------
# MEDIVAULT - LAB REPORT CLASSIFIER
# TF-IDF + Random Forest + OCR Fallback
# -------------------------------------------------------

import os
import re
import pickle
import logging
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

from pdfminer.high_level import extract_text as pdf_extract_text
from pdf2image import convert_from_path
import pytesseract

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.pipeline import Pipeline

from imblearn.over_sampling import SMOTE


# -------------------------------------------------------
# SETUP LOGGING
# -------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)


# -------------------------------------------------------
# PATH CONFIG (PORTABLE – WORKS ON MAC/WINDOWS)
# -------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "labdata")
MODEL_PATH = os.path.join(BASE_DIR, "lab_pipeline.pkl")


# -------------------------------------------------------
# STEP 1: EXTRACT TEXT FROM PDF (PDFMiner + OCR)
# -------------------------------------------------------
def extract_text_from_pdf(pdf_path):
    text = ""

    try:
        text = pdf_extract_text(pdf_path) or ""
    except Exception as e:
        logging.warning(f"PDFMiner failed for {pdf_path}: {e}")

    if not text.strip():
        logging.info(f"Using OCR for {os.path.basename(pdf_path)}")
        try:
            pages = convert_from_path(pdf_path, dpi=300)
            text = "\n".join(
                pytesseract.image_to_string(page) for page in pages
            )
        except Exception as e:
            logging.error(f"OCR failed for {pdf_path}: {e}")
            text = ""

    return text


# -------------------------------------------------------
# STEP 2: CLEAN TEXT
# -------------------------------------------------------
def clean_text(text):
    text = re.sub(r'\n+', ' ', text)
    text = re.sub(r'[^A-Za-z0-9\s\.%]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(
        r'\b(reference|range|value|test|patient|report)\b',
        '',
        text,
        flags=re.IGNORECASE
    )
    return text.lower().strip()


# -------------------------------------------------------
# STEP 3: LOAD DATASET
# -------------------------------------------------------
def load_dataset():
    data, labels = [], []

    for folder, label in [("normal", 0), ("abnormal", 1)]:
        folder_path = os.path.join(DATA_DIR, folder)

        if not os.path.isdir(folder_path):
            logging.warning(f"Folder not found: {folder_path}")
            continue

        for file in os.listdir(folder_path):
            if file.lower().endswith(".pdf"):
                pdf_path = os.path.join(folder_path, file)

                text = extract_text_from_pdf(pdf_path)
                text = clean_text(text)

                if text:
                    data.append(text)
                    labels.append(label)
                else:
                    logging.warning(f"Empty text skipped: {file}")

    logging.info(
        f"Loaded {len(data)} reports "
        f"({labels.count(0)} normal, {labels.count(1)} abnormal)"
    )

    return data, labels


# -------------------------------------------------------
# STEP 4: TRAIN MODEL
# -------------------------------------------------------
def train_model():
    data, labels = load_dataset()

    if len(data) < 4:
        raise ValueError("❌ Not enough data. Add at least 2 normal and 2 abnormal PDFs.")

    vectorizer = TfidfVectorizer(
        stop_words="english",
        max_features=1000,
        ngram_range=(1, 2)
    )

    X = vectorizer.fit_transform(data)
    y = np.array(labels)

    # Balance dataset
    X, y = SMOTE(random_state=42).fit_resample(X, y)
    logging.info(f"Balanced class distribution: {np.bincount(y)}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.3, random_state=42
    )

    model = RandomForestClassifier(
        n_estimators=100,
        random_state=42,
        class_weight="balanced"
    )

    model.fit(X_train, y_train)

    # Evaluation
    y_pred = model.predict(X_test)
    print("\n📊 Classification Report\n")
    print(classification_report(y_test, y_pred, target_names=["Normal", "Abnormal"]))

    cv_score = cross_val_score(model, X, y, cv=5).mean()
    print(f"✅ 5-Fold CV Accuracy: {cv_score:.3f}")

    # Confusion Matrix
    cm = confusion_matrix(y_test, y_pred)
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=["Normal", "Abnormal"],
        yticklabels=["Normal", "Abnormal"]
    )
    plt.title("Confusion Matrix")
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.show()

    # Save pipeline
    pipeline = Pipeline([
        ("tfidf", vectorizer),
        ("classifier", model)
    ])

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(pipeline, f)

    logging.info("✅ Model pipeline saved successfully")


# -------------------------------------------------------
# STEP 5: PREDICTION FUNCTION
# -------------------------------------------------------
def predict_report(pdf_path):
    if not os.path.exists(MODEL_PATH):
        return "❌ Model not trained yet."

    text = extract_text_from_pdf(pdf_path)
    text = clean_text(text)

    if not text:
        return "❌ Could not extract text from PDF."

    with open(MODEL_PATH, "rb") as f:
        pipeline = pickle.load(f)

    pred = pipeline.predict([text])[0]
    prob = pipeline.predict_proba([text])[0][1]

    return f"{'Abnormal' if pred else 'Normal'} (Confidence: {prob:.2f})"


# -------------------------------------------------------
# MAIN
# -------------------------------------------------------
if __name__ == "__main__":
    train_model()
