import re
import nltk

nltk.download("stopwords", quiet=True)
nltk.download("punkt", quiet=True)

from nltk.corpus import stopwords

_STOPWORDS = set(stopwords.words("english"))
_CLEAN_RE = re.compile(r"[^a-zA-Z0-9\s]")


def clean_text(text: str) -> str:
    text = text.lower()
    text = _CLEAN_RE.sub(" ", text)
    tokens = text.split()
    tokens = [t for t in tokens if t not in _STOPWORDS and len(t) > 1]
    return " ".join(tokens)
