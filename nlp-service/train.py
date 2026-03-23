"""
Train spam classifier on SMS Spam Collection dataset.
Dataset auto-downloaded from UCI via pandas.
Run: python train.py
"""
import os
import pandas as pd
import joblib
import nltk
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

nltk.download("stopwords", quiet=True)
nltk.download("punkt", quiet=True)

from app.core.preprocess import clean_text

DATA_URL = (
    "https://raw.githubusercontent.com/justmarkham/pycon-2016-tutorial/"
    "master/data/sms.tsv"
)
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)


def main():
    print("Loading SMS Spam Collection dataset...")
    df = pd.read_csv(DATA_URL, sep="\t", header=None, names=["label", "text"])
    df["clean"] = df["text"].apply(clean_text)

    X_train, X_test, y_train, y_test = train_test_split(
        df["clean"], df["label"], test_size=0.2, random_state=42, stratify=df["label"]
    )

    vectorizer = TfidfVectorizer(max_features=10000, ngram_range=(1, 2))
    model = MultinomialNB(alpha=0.1)

    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)
    model.fit(X_train_vec, y_train)

    print(classification_report(y_test, model.predict(X_test_vec)))

    joblib.dump(model, os.path.join(MODEL_DIR, "model.pkl"))
    joblib.dump(vectorizer, os.path.join(MODEL_DIR, "vectorizer.pkl"))
    print(f"Model saved to {MODEL_DIR}")


if __name__ == "__main__":
    main()
