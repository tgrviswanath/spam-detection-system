import os
import joblib
from app.core.preprocess import clean_text

_MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models")
_model = None
_vectorizer = None


def _load():
    global _model, _vectorizer
    if _model is None:
        _model = joblib.load(os.path.join(_MODEL_DIR, "model.pkl"))
        _vectorizer = joblib.load(os.path.join(_MODEL_DIR, "vectorizer.pkl"))


def predict(text: str) -> dict:
    _load()
    cleaned = clean_text(text)
    vec = _vectorizer.transform([cleaned])
    label = _model.predict(vec)[0]
    proba = _model.predict_proba(vec)[0]
    classes = _model.classes_.tolist()
    confidence = float(proba[classes.index(label)])
    return {
        "label": label,
        "is_spam": label == "spam",
        "confidence": round(confidence, 4),
        "scores": {c: round(float(p), 4) for c, p in zip(classes, proba)},
    }
