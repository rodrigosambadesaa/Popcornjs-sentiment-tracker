# Obama 2012 victory speech — sentiment timeline

An accessible, modernized version of the original [Popcorn.js sentiment tracker](https://github.com/bertez/Popcornjs-sentiment-tracker) demo, created by bertez at the 2012 Mozilla Festival. This repository retains the **historical transcript and its timestamps** and replaces the old video/graph stack with the official [Barack Obama YouTube recording](https://www.youtube.com/watch?v=Wk17f6_4iW8) and dependency-light, synchronized SVG charts.

## What you can do

- Watch Obama's 2012 election-night victory speech using YouTube's privacy-enhanced embed.
- Track the **current sentence polarity** and **running cumulative sentiment** with two interactive charts.
- Seek backward and forward using either chart, the transcript progress slider, or the YouTube player. Repeated playback never double-counts sentences.
- Correct for a recording's different lead-in using the **video-to-transcript alignment** input. If the first words of the transcript occur 12 seconds into the YouTube video, enter `12`. The default is `0`; accurate synchronization may require manual adjustment.
- View the transcription and sentiment index for the **first approximately ten minutes** covered by the bundled dataset. The source transcript ends at 600.627 seconds, **not at the end of the complete video**.

The original Pattern/SentiWordNet score has deliberately been replaced by **VADER compound polarity**, which ranges between -1 and +1 for each fragment. New scores **are not numerically equivalent** to the legacy demo's scores. This is a lexicon-based description of the words, not a psychological measurement of Obama or his audience. The bundled transcript has historic transcription errors.

## Quick start

Requires Python 3.11+ (3.13 also tested in CI).

```bash
git clone https://github.com/rodrigosambadesaa/Popcornjs-sentiment-tracker.git
cd Popcornjs-sentiment-tracker
python -m venv .venv
# Linux/macOS:
source .venv/bin/activate
# On Windows, use: .venv\Scripts\activate
python -m pip install -r requirements.txt
python server.py
```

Open **http://127.0.0.1:8080**. Internet access is needed for playback on YouTube; the transcript, score calculation, graphs and CSS are locally served. YouTube embedding must be enabled by the recording's owner and by your network/browser.

## Architecture and API

- `server.py` — Flask 3.1 app, HTTP security headers, transcript validation and a read-only API.
- `helpers.py` — single cached VADER analyzer.
- `static/victory_speech.json` — original, time-coded transcript (unchanged).
- `static/timeline.js` — pure, binary-search timeline logic (independent of player).
- `static/app.js`, `static/styles.css`, `templates/video.html` — vanilla JavaScript, SVG and accessible page layout, without jQuery/Popcorn.js/D3.
- `GET /api/speech` — JSON object with `video_id`, `duration`, `events`; each event contains `start`, `end`, `text`, `score` and `cumulative`.
- `GET /sentiment/<sentence>` — backwards-compatible, bounded (500 characters), plain-text polarity response.

All data is loaded once from the local JSON file, and per-sentence scores are precomputed by the server. No per-caption network calls; rewinding simply recalculates the chart position. The player controller uses the YouTube IFrame API and provides a direct YouTube fallback.

## Test and security checks

```bash
python -m unittest discover -s tests -v
node --test tests/timeline.test.cjs
node --check static/app.js
python -m pip install pip-audit
python -m pip_audit -r requirements.txt
```

GitHub Actions checks Python 3.11/3.13, JavaScript tests/syntax, and dependency vulnerabilities. Dependabot checks dependencies and Actions weekly. Main improvements: current supported Flask, no Python 2-era packages, no cleartext HTTP scripts/video, no debug server, bounded legacy input, a strict CSP, anti-framing/nosniff headers, no HTML injection into captions, and no user accounts or personal-data collection.

For public hosting, serve the Flask app behind an HTTPS reverse proxy and a production WSGI server (e.g. Gunicorn). Configure `TRUSTED_HOSTS=example.com,www.example.com` appropriately. Do not expose Flask's development server to the Internet. See [SECURITY.md](SECURITY.md).

## Credits and historical sources

Video: [Barack Obama's verified YouTube channel](https://www.youtube.com/watch?v=Wk17f6_4iW8). Historical reference: [Miller Center / White House transcript](https://millercenter.org/the-presidency/presidential-speeches/november-6-2012-2012-election-night-victory-speech). Original demo: [bertez](https://github.com/bertez/Popcornjs-sentiment-tracker). Original authorship and prior history are retained.
