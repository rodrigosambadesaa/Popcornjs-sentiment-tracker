"""Small, deterministic sentiment-scoring adapter for English transcripts."""
from functools import lru_cache

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


@lru_cache(maxsize=1)
def _analyzer():
    return SentimentIntensityAnalyzer()


def sentiment_score(text: str) -> float:
    """Return VADER's compound polarity in the inclusive interval [-1, 1]."""
    if not isinstance(text, str):
        raise TypeError("text must be a string")
    return _analyzer().polarity_scores(text)["compound"]
