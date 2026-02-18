
import os
import re
import sys
import time
import json
import pickle
import logging
import platform
import getpass
import warnings
from datetime import datetime
from collections import Counter

# Numeric / ML imports
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# PDF / OCR imports (used for PDF text extraction and OCR fallback)
# Note: If you don't need PDF features, you may safely remove these imports.
try:
    from pdfminer.high_level import extract_text as pdf_extract_text
except Exception:
    # pdfminer may be missing in some environments (common on fresh setups).
    # We keep fallback logic inside extract_text_from_pdf so the script still runs.
    pdf_extract_text = None  # safe placeholder

try:
    from pdf2image import convert_from_path
except Exception:
    convert_from_path = None  # fallback placeholder

try:
    import pytesseract
except Exception:
    pytesseract = None  # fallback placeholder

# Scikit-learn and imbalanced-learn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.pipeline import Pipeline

# SMOTE for balancing
try:
    from imblearn.over_sampling import SMOTE
except Exception:
    SMOTE = None  # will be handled gracefully later

# ------------------------------
# 1. Logging & Warnings Setup
# ------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("LabReportClassifier")
warnings.filterwarnings("ignore")

# ------------------------------
# 2. Module-level Constants & Config
# ------------------------------
PROJECT_NAME = "LabReportClassifier"
PIPELINE_FILENAME = "lab_pipeline.pkl"
BASE_DIR = "/Volumes/Rahul's SSD/SHRUTI - WIN2MAC/WIN TO MAC/CAPSTONE PROJECT/labdata"
NORMAL_DIR = os.path.join(BASE_DIR, "normal")
ABNORMAL_DIR = os.path.join(BASE_DIR, "abnormal")

DEFAULT_BASE_PATH = BASE_DIR
DEFAULT_TEST_PDF = os.path.join(os.path.dirname(BASE_DIR), "test_report.pdf")
MINIMUM_REQUIRED_REPORTS = 4  # safety check to avoid training on too little data
RANDOM_STATE = 42

# TF-IDF parameters (kept modest for speed)
TFIDF_PARAMS = dict(stop_words='english', max_features=1000, ngram_range=(1, 2))

# RandomForest parameters (kept reproducible)
RF_PARAMS = dict(n_estimators=100, random_state=RANDOM_STATE, class_weight='balanced')

# ------------------------------
# 3. Utility: ASCII Banner & Meta
# ------------------------------
BANNER = r"""                                  

  Lab Report Classifier - TF-IDF + RandomForest
  Expanded for demonstration: includes diagnostics, helpers, and logging
"""

def print_banner():
    """Print a decorative banner — useful for viva demos."""
    print(BANNER)
    logger.info(f"Starting {PROJECT_NAME} at {datetime.now().isoformat()}")

# ------------------------------
# 4. Environment & Dependency Checks (Non-invasive)
# ------------------------------
def check_environment():
    """
    Prints useful environment information for debugging.
    This function is purely diagnostic and does not change program state.
    """
    info = {
        "python_version": sys.version.replace("\n", " "),
        "platform": platform.platform(),
        "processor": platform.processor(),
        "current_user": getpass.getuser(),
        "working_directory": os.getcwd(),
        "timestamp": datetime.now().isoformat(),
    }
    logger.info("Environment check:")
    for k, v in info.items():
        logger.info(f"  {k}: {v}")
    # Check optional dependencies
    deps = {
        "pdfminer": pdf_extract_text is not None,
        "pdf2image": convert_from_path is not None,
        "pytesseract": pytesseract is not None,
        "imblearn.SMOTE": SMOTE is not None,
    }
    logger.info("Dependency availability:")
    for k, v in deps.items():
        logger.info(f"  {k}: {'Present' if v else 'Missing'}")
    return info, deps

# ------------------------------
# 5. Robust PDF text extraction with OCR fallback
# ------------------------------
def extract_text_from_pdf(pdf_path):
    """
    Extract text from a PDF using pdfminer as first choice, then fallback to OCR
    using pdf2image + pytesseract if necessary.

    The function is resilient: if libraries are missing or extraction fails,
    it returns an empty string (handled by the calling code).
    """
    text = ""
    # Attempt 1: pdfminer (fast, preserves text)
    if pdf_extract_text is not None:
        try:
            text = pdf_extract_text(pdf_path) or ""
            if text and text.strip():
                logger.info(f"Extracted text with pdfminer from {pdf_path}")
                return text
        except Exception as e:
            logger.warning(f"pdfminer extraction failed for {pdf_path}: {e}")

    # Attempt 2: OCR fallback (pdf2image + pytesseract)
    if convert_from_path is not None and pytesseract is not None:
        try:
            logger.info(f"Attempting OCR for {pdf_path}")
            # Optionally detect TESSERACT_PATH from env
            tess_path = os.environ.get("TESSERACT_PATH")
            if tess_path:
                pytesseract.pytesseract.tesseract_cmd = tess_path
            pages = convert_from_path(pdf_path, dpi=300)
            ocr_texts = []
            for i, page in enumerate(pages):
                try:
                    page_text = pytesseract.image_to_string(page)
                    ocr_texts.append(page_text)
                except Exception as e:
                    logger.warning(f"OCR failed on page {i} of {pdf_path}: {e}")
            text = "\n".join(ocr_texts)
            if text and text.strip():
                logger.info(f"OCR completed for {pdf_path} (pages: {len(pages)})")
                return text
        except Exception as e:
            logger.error(f"Full OCR process failed for {pdf_path}: {e}")

    # Final fallback: empty string
    logger.warning(f"No text extracted from {pdf_path} (empty result).")
    return ""

# ------------------------------
# 6. Text Cleaning Utility
# ------------------------------
def clean_text(text):
    """
    Apply deterministic, explainable cleaning steps:
    - normalize newlines to spaces
    - remove unusual characters but keep numbers, letters, percent sign and dot
    - collapse multiple spaces
    - remove some common lab-report words to reduce noise
    - lowercase
    """
    if not text:
        return ""
    # Stepwise transformations with comments for viva explanation
    text = re.sub(r'\r\n', '\n', text)          # normalize windows newlines
    text = re.sub(r'\n+', ' ', text)            # collapse newlines
    text = re.sub(r'[^A-Za-z0-9\s\.%]', ' ', text)  # remove non-alphanum special chars except . and %
    text = re.sub(r'\s+', ' ', text)            # collapse whitespace
    # Remove frequently repeated words that add noise in lab reports
    text = re.sub(r'\b(reference|range|value|test|patient|normal|report|result|unit)\b', ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'\s+', ' ', text)            # collapse spaces created above
    return text.lower().strip()

# ------------------------------
# 7. Simple Helpers for Demonstration (Non-invasive)
# ------------------------------
def safe_mkdir(path):
    """Create directory if doesn't exist. Safe helper used in report generation."""
    try:
        os.makedirs(path, exist_ok=True)
    except Exception as e:
        logger.warning(f"Could not create directory {path}: {e}")

def short_hash(s, length=8):
    """Create a short deterministic hash for strings (useful for filenames)."""
    try:
        return str(abs(hash(s)))[:length]
    except Exception:
        return str(int(time.time()))[-length:]

def save_sample_report(text, folder="sample_reports"):
    """
    Save a small text file sampling the cleaned report for later inspection.
    This is only for developer convenience and does not affect model training.
    """
    safe_mkdir(folder)
    fname = f"sample_{short_hash(text)}.txt"
    path = os.path.join(folder, fname)
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(text[:2000])  # save first 2000 chars only
        logger.info(f"Saved sample report to {path}")
    except Exception as e:
        logger.warning(f"Failed to save sample report {path}: {e}")

# ------------------------------
# 8. Dataset Loading (from folders)
# ------------------------------
def load_reports_from_folders(base_path=DEFAULT_BASE_PATH):
    """
    Walk the base_path and collect PDF files from two subfolders:
      - normal   -> label 0
      - abnormal -> label 1

    Returns:
      data: list of cleaned text strings
      labels: list/array of integers (0/1)
    """
    data = []
    labels = []
    for folder, label in [("normal", 0), ("abnormal", 1)]:
        folder_path = os.path.join(base_path, folder)
        if not os.path.isdir(folder_path):
            logger.warning(f"Folder not found: {folder_path}")
            continue
        file_list = sorted(os.listdir(folder_path))
        for file in file_list:
            if file.lower().endswith(".pdf"):
                pdf_path = os.path.join(folder_path, file)
                try:
                    raw_text = extract_text_from_pdf(pdf_path)
                    cleaned = clean_text(raw_text)
                    if cleaned:
                        data.append(cleaned)
                        labels.append(label)
                        # save a sample for quick human inspection (non-invasive)
                        save_sample_report(cleaned)
                    else:
                        logger.warning(f"Empty or unreadable text from {pdf_path} (skipped).")
                except Exception as e:
                    logger.error(f"Error processing {pdf_path}: {e}")
    logger.info(f"Loaded {len(data)} reports: {labels.count(0)} normal, {labels.count(1)} abnormal")
    return data, labels

# ------------------------------
# 9. Data Inspection & Lightweight Stats (for viva)
# ------------------------------
def dataset_insights(data, labels):
    """
    Provide quick textual statistics about dataset, class balance, and average lengths.
    This function prints and returns a dict for later testing/inspection.
    """
    stats = {}
    stats['n_reports'] = len(data)
    if data:
        lengths = [len(d.split()) for d in data]
        stats['avg_words'] = sum(lengths) / len(lengths)
        stats['min_words'] = min(lengths)
        stats['max_words'] = max(lengths)
    else:
        stats['avg_words'] = stats['min_words'] = stats['max_words'] = 0
    stats['class_counts'] = dict(Counter(labels))
    logger.info("Dataset insights:")
    logger.info(f"  Total reports: {stats['n_reports']}")
    logger.info(f"  Average words per report: {stats['avg_words']:.1f}")
    logger.info(f"  Words (min, max): ({stats['min_words']}, {stats['max_words']})")
    logger.info(f"  Class distribution: {stats['class_counts']}")
    return stats

# ------------------------------
# 10. Feature Extraction Utility
# ------------------------------
def create_tfidf_vectorizer(params=None):
    """Return a new TF-IDF vectorizer configured for this project."""
    if params is None:
        params = TFIDF_PARAMS.copy()
    else:
        params = {**TFIDF_PARAMS, **params}
    v = TfidfVectorizer(**params)
    logger.info(f"TF-IDF Vectorizer created with params: {params}")
    return v

# ------------------------------
# 11. Balancing with SMOTE (safe wrapper)
# ------------------------------
def apply_smote(X, y, random_state=RANDOM_STATE):
    """
    Apply SMOTE to balance the dataset. If SMOTE is not available, return original X, y.
    This wrapper logs the before/after counts.
    """
    if SMOTE is None:
        logger.warning("SMOTE not available; skipping oversampling.")
        return X, y
    try:
        sm = SMOTE(random_state=random_state)
        X_res, y_res = sm.fit_resample(X, y)
        logger.info(f"SMOTE applied. Class counts after resampling: {np.bincount(y_res)}")
        return X_res, y_res
    except Exception as e:
        logger.error(f"SMOTE failed: {e} -- returning original data.")
        return X, y

# ------------------------------
# 12. Simple visualization helper (non-blocking)
# ------------------------------
def plot_confusion_matrix(cm, labels=["Normal", "Abnormal"], show=True, save_path=None):
    """
    Plot confusion matrix heatmap. If running in headless environment, saving may be used.
    """
    try:
        plt.figure(figsize=(5, 4))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=labels, yticklabels=labels)
        plt.title("Confusion Matrix")
        plt.xlabel("Predicted")
        plt.ylabel("Actual")
        plt.tight_layout()
        if save_path:
            plt.savefig(save_path)
            logger.info(f"Confusion matrix saved to {save_path}")
        if show:
            plt.show()
        else:
            plt.close()
    except Exception as e:
        logger.warning(f"Could not plot confusion matrix: {e}")

# ------------------------------
# 13. Explainability / Model Summary Helpers
# ------------------------------
def explain_model(feature_names, model, top_n=10):
    """
    Print the top features by importance from RandomForest.
    This is a simple, explainable demonstration and does not change predictions.
    """
    try:
        importances = model.feature_importances_
        indices = np.argsort(importances)[::-1][:top_n]
        top_features = [(feature_names[i], importances[i]) for i in indices]
        logger.info("Top feature importances (sample):")
        for fname, imp in top_features:
            logger.info(f"  {fname[:80]:80s} : {imp:.6f}")
        return top_features
    except Exception as e:
        logger.warning(f"Could not retrieve feature importances: {e}")
        return []

# ------------------------------
# 14. Training & Evaluation (Core - Do NOT modify outputs)
# ------------------------------
def train_and_evaluate(base_path=DEFAULT_BASE_PATH, save_pipeline=True):
    """
    Full pipeline to:
      - Load reports
      - Vectorize with TF-IDF
      - Apply SMOTE (if available)
      - Train RandomForest
      - Evaluate & save pipeline

    Returns:
      pipeline, vectorizer, model, X_test, y_test, y_pred
    """
    # Load data
    data, labels = load_reports_from_folders(base_path)
    if len(data) < MINIMUM_REQUIRED_REPORTS:
        raise ValueError(f"Not enough data to train the model. Found {len(data)} reports; need at least {MINIMUM_REQUIRED_REPORTS}.")

    # Dataset insights for viva
    dataset_stats = dataset_insights(data, labels)

    # Vectorization
    vectorizer = create_tfidf_vectorizer()
    X = vectorizer.fit_transform(data)
    y = np.array(labels)

    # Optionally apply SMOTE
    X_res, y_res = apply_smote(X, y)

    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(X_res, y_res, test_size=0.3, random_state=RANDOM_STATE)
    logger.info(f"Split data: Train={X_train.shape[0]}, Test={X_test.shape[0]}")

    # Model training (core logic retained)
    model = RandomForestClassifier(**RF_PARAMS)
    model.fit(X_train, y_train)
    logger.info("RandomForest training completed.")

    # Predictions & evaluation
    y_pred = model.predict(X_test)
    report_text = classification_report(y_test, y_pred, target_names=["Normal", "Abnormal"])
    logger.info("\nModel Evaluation:\n" + report_text)

    # Cross-validation (reliable performance estimate)
    try:
        cv_scores = cross_val_score(model, X_res, y_res, cv=5, scoring='accuracy')
        logger.info(f"Average 5-Fold CV Accuracy: {cv_scores.mean():.3f}")
    except Exception as e:
        logger.warning(f"Cross-validation failed: {e}")
        cv_scores = None

    # Confusion matrix plot
    cm = confusion_matrix(y_test, y_pred)
    try:
        plot_confusion_matrix(cm, labels=["Normal", "Abnormal"], show=False, save_path="confusion_matrix.png")
    except Exception:
        pass

    # Save pipeline (vectorizer + model) as before
    pipeline = Pipeline([
        ('tfidf', vectorizer),
        ('clf', model)
    ])
    if save_pipeline:
        try:
            with open(PIPELINE_FILENAME, "wb") as f:
                pickle.dump(pipeline, f)
            logger.info(f"Pipeline saved to {PIPELINE_FILENAME}")
        except Exception as e:
            logger.error(f"Failed to save pipeline: {e}")

    # Extra explainability snippet (safe)
    try:
        feature_names = vectorizer.get_feature_names_out()
        top_feats = explain_model(feature_names, model, top_n=10)
    except Exception:
        top_feats = []

    return {
        "pipeline": pipeline,
        "vectorizer": vectorizer,
        "model": model,
        "X_test": X_test,
        "y_test": y_test,
        "y_pred": y_pred,
        "confusion_matrix": cm,
        "cv_scores": cv_scores,
        "dataset_stats": dataset_stats,
        "top_features": top_feats
    }

# ------------------------------
# 15. Prediction Helper (Loads pipeline file)
# ------------------------------
def predict_report(pdf_file, pipeline_path=PIPELINE_FILENAME):
    """
    Predict whether a given PDF report is Normal or Abnormal using the saved pipeline.
    This function matches the previous behavior and returns the same formatted output.
    """
    # Extract & clean text
    text = extract_text_from_pdf(pdf_file)
    text = clean_text(text)
    if not text:
        return "Could not extract text from PDF"

    # Load pipeline
    try:
        loaded_pipeline = pickle.load(open(pipeline_path, "rb"))
    except Exception as e:
        logger.error(f"Could not load pipeline from {pipeline_path}: {e}")
        return "Model pipeline not found or could not be loaded."

    # Prediction & probability - ensure same ordering as training
    try:
        pred = loaded_pipeline.predict([text])[0]
        # predict_proba returns probabilities for both classes; find index for 'abnormal' label (1)
        if hasattr(loaded_pipeline, "predict_proba"):
            probs = loaded_pipeline.predict_proba([text])[0]
            # Defensive: if binary classifier, index 1 corresponds to class '1' (abnormal)
            prob_abnormal = probs[1] if len(probs) > 1 else probs[0]
        else:
            prob_abnormal = 0.0
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        return "Prediction error"

    return f"Prediction: {'Abnormal' if pred else 'Normal'} (Confidence: {prob_abnormal:.2f})"

# ------------------------------
# 16. Small CLI utilities (for local testing)
# ------------------------------
def run_training_cli(base_path=DEFAULT_BASE_PATH):
    """Wrapper to run train_and_evaluate with logging and timing for demo."""
    t0 = time.time()
    logger.info("Beginning training pipeline...")
    try:
        results = train_and_evaluate(base_path)
        t1 = time.time()
        logger.info(f"Training completed in {t1 - t0:.1f} seconds.")
        return results
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise

def run_prediction_cli(pdf_path=DEFAULT_TEST_PDF):
    """Wrapper to print prediction result for a given PDF (demo use)."""
    if not os.path.exists(pdf_path):
        logger.error(f"Test PDF not found: {pdf_path}")
        return f"No test file found. Please add one at: {pdf_path}"
    result = predict_report(pdf_path)
    print("\n🧾 Test Prediction Result:\n", result)
    return result

# ------------------------------
# 17. Extra Non-invasive Helper: Create a tiny HTML report (for display)
# ------------------------------
def create_html_summary(results, out_file="training_summary.html"):
    """
    Generate a tiny HTML summary file describing dataset and model results.
    This is purely presentational for viva/demo and does not impact training.
    """
    try:
        summary = {
            "timestamp": datetime.now().isoformat(),
            "dataset_stats": results.get("dataset_stats", {}),
            "cv_scores_mean": (np.mean(results["cv_scores"]) if results.get("cv_scores") is not None else None),
            "top_features": results.get("top_features", []),
        }
        html = "<html><head><meta charset='utf-8'><title>Training Summary</title></head><body>"
        html += f"<h1>{PROJECT_NAME} - Training Summary</h1>"
        html += f"<p>Generated: {summary['timestamp']}</p>"
        html += "<h2>Dataset Stats</h2><pre>" + json.dumps(summary["dataset_stats"], indent=2) + "</pre>"
        html += "<h2>CV Accuracy (mean)</h2><pre>" + str(summary["cv_scores_mean"]) + "</pre>"
        html += "<h2>Top Features</h2><pre>" + json.dumps(summary["top_features"], indent=2) + "</pre>"
        html += "</body></html>"
        with open(out_file, "w", encoding="utf-8") as f:
            f.write(html)
        logger.info(f"HTML summary created at {out_file}")
    except Exception as e:
        logger.warning(f"Failed to create HTML summary: {e}")

# ------------------------------
# 18. Non-invasive Demo: Print short usage instructions
# ------------------------------
USAGE_INSTRUCTIONS = """
flow of the algorithm

1. Training:


2. Predict:


3. Quick test using defaults:
   
"""

def print_usage():
    print(USAGE_INSTRUCTIONS)

# ------------------------------
# 19. A few extra "filler" functions (explainable in viva)
# ------------------------------
def demo_text_processing_pipeline(example_text):
    """
    Show the sequence of text-processing transformations for one example string.
    Useful to step through in viva to demonstrate cleaning behavior.
    """
    logger.info("Demo: showing text processing steps on sample input.")
    steps = []
    steps.append(("original", example_text))
    s1 = re.sub(r'\r\n', '\n', example_text)
    steps.append(("normalize_newline", s1))
    s2 = re.sub(r'\n+', ' ', s1)
    steps.append(("collapse_newlines", s2))
    s3 = re.sub(r'[^A-Za-z0-9\s\.%]', ' ', s2)
    steps.append(("remove_special_chars", s3))
    s4 = re.sub(r'\s+', ' ', s3)
    steps.append(("collapse_spaces", s4))
    s5 = re.sub(r'\b(reference|range|value|test|patient|normal|report|result|unit)\b', ' ', s4, flags=re.IGNORECASE)
    steps.append(("remove_noise_words", s5))
    s6 = re.sub(r'\s+', ' ', s5).strip().lower()
    steps.append(("final_cleaned", s6))
    for name, val in steps:
        logger.info(f"STEP [{name}]: {val[:120]}")
    return steps

def tiny_text_vector_demo(vectorizer, texts, num=3):
    """
    Show a small TF-IDF matrix snippet for a few texts for demonstration.
    """
    try:
        X = vectorizer.transform(texts)
        dense = X.toarray()
        for i in range(min(num, dense.shape[0])):
            logger.info(f"TF-IDF vector for document {i} (first 10 values): {dense[i][:10]}")
    except Exception as e:
        logger.warning(f"Could not show TF-IDF demo: {e}")

# ------------------------------
# 20. Main entrypoint (CLI-friendly)
# ------------------------------
def main(argv=None):
    print_banner()
    check_environment()

    if argv is None:
        argv = sys.argv[1:]

    # If no args provided, attempt default behavior
    if not argv:
        print_usage()
        # Try a safe attempt to train if data present
        try:
            results = run_training_cli(DEFAULT_BASE_PATH)
            create_html_summary(results)
            logger.info("Default run completed.")
        except Exception as e:
            logger.info("Default run could not train (insufficient data or error). See usage above.")
        return

    # Simple CLI parser for 'train' and 'predict'
    cmd = argv[0].lower()
    if cmd in ("train",):
        base_path = argv[1] if len(argv) > 1 else DEFAULT_BASE_PATH
        results = run_training_cli(base_path)
        create_html_summary(results)
        logger.info("Training pipeline finished.")
    elif cmd in ("predict", "test"):
        if len(argv) < 2:
            print("Please provide path to a PDF file for prediction.")
            print_usage()
            return
        pdf_path = argv[1]
        res = run_prediction_cli(pdf_path)
        logger.info(f"Prediction result: {res}")
    elif cmd in ("help", "--help", "-h"):
        print_usage()
    else:
        logger.info(f"Unknown command: {cmd}")
        print_usage()

# ------------------------------
# 21. Run main when executed as script
# ------------------------------
if __name__ == "__main__":
    main()

# ---------------------------------------------------------
# AUTO-PREDICTION ON test_report.pdf AFTER TRAINING
# ---------------------------------------------------------
try:
    TEST_FILE = "test_report.pdf"
    TEST_PATH = os.path.join(os.getcwd(), TEST_FILE)

    if os.path.exists(TEST_PATH):
        logger.info(f"Auto-Prediction: test_report.pdf found at {TEST_PATH}")

        # Load pipeline
        try:
            with open(PIPELINE_FILENAME, "rb") as f:
                pipeline = pickle.load(f)
        except Exception as e:
            logger.error(f"Could not load pipeline for auto-prediction: {e}")
            raise

        # Extract and clean text from test_report.pdf
        text = extract_text_from_pdf(TEST_PATH) or ""
        text = clean_text(text)
        if not text:
            logger.error("Auto-Prediction failed: No text extracted from test_report.pdf")
        else:
            # Predict
            pred = pipeline.predict([text])[0]
            label = "Normal" if pred == 0 else "Abnormal"

            logger.info(f"Auto-Prediction Result for test_report.pdf: {label}")
            print("\n------------------------------------------")
            print(f"AUTO-PREDICTION RESULT: {label.upper()}")
            print("---------`---------------------------------\n")
    else:
        logger.warning("Auto-Prediction skipped: test_report.pdf not found in project directory.")

except Exception as e:
    logger.error(f"Error during auto-prediction: {e}")

