/* Browser controller: no jQuery, Popcorn.js, D3, inline scripts or HTML injection. */
(function () {
  "use strict";

  var timeline = window.SentimentTimeline;
  var NS = "http://www.w3.org/2000/svg";
  var el = {
    player: document.getElementById("player"),
    status: document.getElementById("player-status"),
    play: document.getElementById("play-pause"),
    subtitle: document.getElementById("subtitle"),
    score: document.getElementById("score"),
    total: document.getElementById("total"),
    completed: document.getElementById("segment-count"),
    duration: document.getElementById("duration"),
    scrub: document.getElementById("scrub"),
    time: document.getElementById("time-label"),
    offset: document.getElementById("sync-offset"),
    reset: document.getElementById("reset-offset"),
    cumulativeChart: document.getElementById("cumulative-chart"),
    sentenceChart: document.getElementById("sentence-chart")
  };
  var events = [];
  var duration = 0;
  var charts = [];
  var player = null;
  var ready = false;
  var offset = 0;
  var poll = null;
  var currentTime = 0;

  function setStatus(message) {
    el.status.textContent = message;
  }

  function formatValue(value) {
    return (value >= 0 ? "+" : "") + Number(value).toFixed(2);
  }

  function setTone(element, value) {
    element.dataset.tone = value > 0.005 ? "positive" :
      value < -0.005 ? "negative" : "neutral";
  }

  function svgElement(tag, attributes, content) {
    var element = document.createElementNS(NS, tag);
    Object.keys(attributes).forEach(function (name) {
      element.setAttribute(name, String(attributes[name]));
    });
    if (content !== undefined) element.textContent = content;
    return element;
  }

  function makeChart(svg, key, height) {
    var left = 65;
    var right = 976;
    var top = 17;
    var bottom = height - 36;
    var values = events.map(function (event) { return event[key]; });
    var low = key === "score" ? -1 : Math.min(0, ...values);
    var high = key === "score" ? 1 : Math.max(0, ...values);
    if (key !== "score") {
      low = Math.floor(low - 1);
      high = Math.ceil(high + 1);
    }
    var spread = Math.max(1, high - low);
    var x = function (time) {
      return left + (right - left) * Math.min(duration, Math.max(0, time)) / duration;
    };
    var y = function (value) {
      return bottom - (value - low) * (bottom - top) / spread;
    };
    var makePath = function (points) {
      return points.map(function (point, index) {
        return (index === 0 ? "M" : "L") +
          x(point[0]).toFixed(2) + "," + y(point[1]).toFixed(2);
      }).join(" ");
    };

    svg.replaceChildren();
    for (var i = 0; i <= 4; i += 1) {
      var value = low + spread * i / 4;
      var yy = y(value);
      svg.append(svgElement("line", {
        x1: left, y1: yy, x2: right, y2: yy, class: "chart-grid"
      }));
      svg.append(svgElement("text", {
        x: left - 10, y: yy + 4, "text-anchor": "end", class: "chart-axis"
      }, (key === "score" ? value.toFixed(1) : value.toFixed(1))));
    }
    for (var j = 0; j <= 5; j += 1) {
      var time = duration * j / 5;
      svg.append(svgElement("text", {
        x: x(time), y: height - 11, "text-anchor": "middle", class: "chart-axis"
      }, timeline.formatTime(time)));
    }
    var points = [[0, 0]].concat(events.map(function (event) {
      return [event.end, event[key]];
    }));
    svg.append(svgElement("path", { d: makePath(points), class: "chart-full" }));
    var played = svgElement("path", { d: "", class: "chart-played" });
    svg.append(played);
    var marker = svgElement("line", {
      x1: x(0), y1: top, x2: x(0), y2: bottom, class: "chart-marker"
    });
    svg.append(marker);
    var dot = svgElement("circle", {
      cx: x(0), cy: y(0), r: 5, class: "chart-dot"
    });
    svg.append(dot);

    svg.addEventListener("click", function (event) {
      var box = svg.getBoundingClientRect();
      var position = (event.clientX - box.left) / box.width * 1000;
      var fraction = Math.max(0, Math.min(1, (position - left) / (right - left)));
      seek(duration * fraction);
    });

    return function (time, snap) {
      var clamped = Math.min(duration, Math.max(0, time));
      var completed = events.slice(0, snap.completed);
      var score = key === "score"
        ? (completed.length ? completed[completed.length - 1].score : 0)
        : snap.cumulative;
      var previous = [[0, 0]].concat(completed.map(function (event) {
        return [event.end, event[key]];
      }));
      previous.push([clamped, score]);
      played.setAttribute("d", makePath(previous));
      marker.setAttribute("x1", x(clamped));
      marker.setAttribute("x2", x(clamped));
      dot.setAttribute("cx", x(clamped));
      dot.setAttribute("cy", y(score));
    };
  }

  function render(time) {
    currentTime = Math.max(0, Number.isFinite(time) ? time : 0);
    var capped = Math.min(duration, currentTime);
    var snap = timeline.snapshot(events, capped);
    var score = snap.currentScore;
    el.scrub.value = String(capped);
    el.scrub.setAttribute("aria-valuetext", timeline.formatTime(capped));
    el.time.textContent = timeline.formatTime(capped) + " / " + timeline.formatTime(duration);
    el.completed.textContent = snap.completed + " / " + events.length;
    el.score.textContent = score === null ? "—" : formatValue(score);
    setTone(el.score, score === null ? 0 : score);
    el.total.textContent = formatValue(snap.cumulative);
    setTone(el.total, snap.cumulative);

    if (currentTime > duration + 0.1) {
      el.subtitle.textContent = "The original transcript ends here; the video continues without sentiment scoring.";
    } else if (snap.active) {
      el.subtitle.textContent = snap.active.text;
    } else if (snap.completed === events.length) {
      el.subtitle.textContent = "End of the available transcript.";
    } else if (snap.completed === 0) {
      el.subtitle.textContent = "Press play to follow the speech sentence by sentence.";
    } else {
      el.subtitle.textContent = "Pause in the transcript.";
    }
    charts.forEach(function (draw) { draw(capped, snap); });
  }

  function updateFromVideo() {
    if (!ready || !player || typeof player.getCurrentTime !== "function") return;
    var seconds = Number(player.getCurrentTime());
    if (Number.isFinite(seconds)) render(timeline.speechTime(seconds, offset));
  }

  function seek(time) {
    if (!events.length) return;
    var target = Math.max(0, Math.min(duration, time));
    if (ready && player && typeof player.seekTo === "function") {
      player.seekTo(timeline.videoTime(target, offset), true);
    }
    render(target);
  }

  function stopPolling() {
    if (poll !== null) {
      window.clearInterval(poll);
      poll = null;
    }
  }

  function playerFailed() {
    stopPolling();
    ready = false;
    el.play.disabled = true;
    setStatus("YouTube cannot be embedded here. Use 'Open on YouTube'.");
  }

  window.onYouTubeIframeAPIReady = function () {
    if (!events.length || !window.YT || !window.YT.Player) {
      playerFailed();
      return;
    }
    try {
      player = new window.YT.Player("player", {
        host: "https://www.youtube-nocookie.com",
        videoId: el.player.dataset.videoId,
        playerVars: { playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: function () {
            ready = true;
            el.play.disabled = false;
            el.scrub.disabled = false;
            setStatus("Video ready · press play");
            updateFromVideo();
          },
          onStateChange: function (event) {
            updateFromVideo();
            stopPolling();
            if (event.data === window.YT.PlayerState.PLAYING) {
              el.play.textContent = "Pause video";
              setStatus("Playing · timeline synchronized");
              poll = window.setInterval(updateFromVideo, 250);
            } else {
              el.play.textContent = "Play video";
              if (event.data === window.YT.PlayerState.ENDED) {
                setStatus("Video ended");
              } else if (ready) {
                setStatus("Paused");
              }
            }
          },
          onError: playerFailed
        }
      });
    } catch (error) {
      playerFailed();
    }
  };

  function loadYouTube() {
    var script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = playerFailed;
    document.head.append(script);
  }

  el.play.addEventListener("click", function () {
    if (!ready) return;
    if (player.getPlayerState() === window.YT.PlayerState.PLAYING) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  });

  el.scrub.addEventListener("input", function () {
    render(Number(el.scrub.value));
  });
  el.scrub.addEventListener("change", function () {
    seek(Number(el.scrub.value));
  });

  function applyOffset(value) {
    if (!Number.isFinite(value)) return;
    offset = Math.max(-180, Math.min(180, value));
    el.offset.value = String(offset);
    if (ready) updateFromVideo();
    else render(currentTime);
  }
  el.offset.addEventListener("change", function () {
    applyOffset(Number(el.offset.value));
  });
  el.reset.addEventListener("click", function () { applyOffset(0); });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) updateFromVideo();
  });

  async function initialize() {
    try {
      var response = await fetch("/api/speech", { credentials: "same-origin" });
      if (!response.ok) throw new Error("Transcript request failed");
      var payload = await response.json();
      if (!Array.isArray(payload.events) || !payload.events.length ||
          !Number.isFinite(payload.duration) || payload.duration <= 0 ||
          payload.video_id !== el.player.dataset.videoId) {
        throw new Error("Invalid transcript response");
      }
      events = payload.events;
      duration = payload.duration;
      el.duration.textContent = timeline.formatTime(duration);
      el.scrub.max = String(duration);
      charts = [
        makeChart(el.cumulativeChart, "cumulative", 235),
        makeChart(el.sentenceChart, "score", 185)
      ];
      render(0);
      setStatus("Loading YouTube player…");
      loadYouTube();
    } catch (error) {
      setStatus("Transcript unavailable. Please refresh to retry.");
      el.subtitle.textContent = "Unable to load the speech dataset.";
      el.play.disabled = true;
    }
  }

  initialize();
})();
