"""Behavioral and security regression tests, runnable with unittest."""
import unittest

from helpers import sentiment_score
from server import VIDEO_ID, app, load_speech


class SentimentTrackerTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_home_renders_youtube_player_container(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(VIDEO_ID.encode(), response.data)
        self.assertIn(b'id="player"', response.data)
        self.assertNotIn(b"http://popcornjs.org", response.data)

    def test_transcript_timing_and_cumulative_scores(self):
        payload = self.client.get("/api/speech").get_json()
        self.assertEqual(payload["video_id"], VIDEO_ID)
        self.assertGreater(len(payload["events"]), 50)
        self.assertAlmostEqual(payload["duration"], payload["events"][-1]["end"])
        previous_end = 0.0
        running = 0.0
        for event in payload["events"]:
            self.assertGreaterEqual(event["start"], previous_end - 0.001)
            self.assertGreater(event["end"], event["start"])
            self.assertLessEqual(abs(event["score"]), 1.0)
            running += event["score"]
            self.assertAlmostEqual(event["cumulative"], running, delta=0.01)
            previous_end = event["end"]

    def test_polarity(self):
        self.assertGreater(sentiment_score("I love this wonderful result!"), 0)
        self.assertLess(sentiment_score("I hate this horrible disaster."), 0)

    def test_legacy_endpoint_is_bounded_and_plain_text(self):
        response = self.client.get("/sentiment/great%20news")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "text/plain")
        self.assertGreater(float(response.get_data(as_text=True)), 0)
        self.assertEqual(self.client.get("/sentiment/" + "x" * 501).status_code, 414)
        xss = self.client.get("/sentiment/%3Cscript%3Ealert(1)%3C/script%3E")
        self.assertNotIn(b"<script>", xss.data)

    def test_security_headers_on_success_and_errors(self):
        for route in ("/", "/api/speech", "/no-such-page"):
            response = self.client.get(route)
            headers = response.headers
            self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
            self.assertEqual(headers["X-Frame-Options"], "DENY")
            self.assertIn("frame-ancestors 'none'", headers["Content-Security-Policy"])
            self.assertNotIn("'unsafe-inline'", headers["Content-Security-Policy"])
            self.assertNotIn("'unsafe-eval'", headers["Content-Security-Policy"])
            self.assertEqual(headers["Referrer-Policy"], "strict-origin-when-cross-origin")

    def test_api_does_not_depend_on_request_parameters(self):
        self.assertEqual(self.client.get("/api/speech?sentence=%3Cscript%3E").status_code, 200)
        self.assertEqual(load_speech(), load_speech())


if __name__ == "__main__":
    unittest.main()
