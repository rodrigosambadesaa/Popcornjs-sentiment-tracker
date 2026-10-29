"""Read-only Flask application for the 2012 Obama victory-speech timeline."""
import json
import math
import os
from functools import lru_cache
from pathlib import Path

from flask import Flask, Response, abort, jsonify, render_template, request

from helpers import sentiment_score

VIDEO_ID = "Wk17f6_4iW8"
TRANSCRIPT_PATH = Path(__file__).resolve().parent / "static" / "victory_speech.json"
MAX_SENTENCE_LENGTH = 500
MAX_SEGMENTS = 1000

CSP = "; ".join((
    "default-src 'none'",
    "script-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://s.ytimg.com",
    "style-src 'self'",
    "img-src 'self' data: https://i.ytimg.com",
    "connect-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
    "font-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
))


@lru_cache(maxsize=1)
def load_speech() -> dict:
    """Validate the trusted transcript and score it once, not per video event."""
    with TRANSCRIPT_PATH.open(encoding="utf-8") as handle:
        raw = json.load(handle)
    if not isinstance(raw, list) or not 1 <= len(raw) <= MAX_SEGMENTS:
        raise ValueError("Transcript must contain 1 to 1000 segments")

    events = []
    previous_end = 0.0
    cumulative = 0.0
    for item in raw:
        if not isinstance(item, dict):
            raise ValueError("Invalid transcript segment")
        start, end, sentence = item.get("start"), item.get("end"), item.get("text")
        if any(isinstance(value, bool) or not isinstance(value, (int, float))
               or not math.isfinite(value) for value in (start, end)):
            raise ValueError("Invalid segment timestamps")
        if not (0 <= start < end <= 86400) or start < previous_end - 0.001:
            raise ValueError("Overlapping or invalid transcript timestamps")
        if not isinstance(sentence, str) or not 1 <= len(sentence) <= MAX_SENTENCE_LENGTH:
            raise ValueError("Invalid segment text")
        score = sentiment_score(sentence)
        cumulative += score
        events.append({
            "start": start,
            "end": end,
            "text": sentence,
            "score": round(score, 4),
            "cumulative": round(cumulative, 4),
        })
        previous_end = end
    return {"events": events, "duration": previous_end, "video_id": VIDEO_ID}


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 4096
    app.json.sort_keys = False

    trusted_hosts = os.environ.get("TRUSTED_HOSTS", "").strip()
    if trusted_hosts:
        app.config["TRUSTED_HOSTS"] = [
            host.strip() for host in trusted_hosts.split(",") if host.strip()
        ]

    @app.after_request
    def apply_security_headers(response: Response) -> Response:
        response.headers["Content-Security-Policy"] = CSP
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if request.is_secure:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    @app.get("/")
    def index():
        return render_template("video.html", video_id=VIDEO_ID)

    @app.get("/api/speech")
    def speech():
        response = jsonify(load_speech())
        response.headers["Cache-Control"] = "public, max-age=3600"
        return response

    @app.get("/sentiment/<path:sentence>")
    def legacy_sentiment(sentence: str):
        """Retain the old read-only API without unbounded user input."""
        if not sentence or len(sentence) > MAX_SENTENCE_LENGTH:
            abort(414)
        response = Response(format(sentiment_score(sentence), ".4f"),
                            mimetype="text/plain")
        response.headers["Cache-Control"] = "no-store"
        return response

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "8080")), debug=False)
