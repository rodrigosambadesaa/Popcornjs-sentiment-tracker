/* Pure timeline logic: usable in both browsers and Node's test runner. */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.SentimentTimeline = api;
  }
})(typeof window === "undefined" ? globalThis : window, function () {
  "use strict";

  function snapshot(events, seconds) {
    var time = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    var lo = 0;
    var hi = events.length;
    while (lo < hi) {
      var mid = Math.floor((lo + hi) / 2);
      if (events[mid].end <= time) lo = mid + 1;
      else hi = mid;
    }
    var completed = lo;
    var candidate = events[completed];
    var active = candidate && candidate.start <= time && time < candidate.end
      ? candidate : null;
    return {
      time: time,
      completed: completed,
      cumulative: completed ? events[completed - 1].cumulative : 0,
      active: active,
      currentScore: active ? active.score : null
    };
  }

  function speechTime(videoSeconds, offset) {
    return Math.max(0, videoSeconds - offset);
  }

  function videoTime(speechSeconds, offset) {
    return Math.max(0, speechSeconds + offset);
  }

  function formatTime(seconds) {
    var whole = Math.floor(Math.max(0, seconds));
    return Math.floor(whole / 60) + ":" + String(whole % 60).padStart(2, "0");
  }

  return { snapshot: snapshot, speechTime: speechTime, videoTime: videoTime, formatTime: formatTime };
});
