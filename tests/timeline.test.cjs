const test = require('node:test');
const assert = require('node:assert/strict');
const timeline = require('../static/timeline.js');
const events = [
  {start: 0, end: 5, score: 0.5, cumulative: 0.5},
  {start: 5, end: 10, score: -0.2, cumulative: 0.3},
  {start: 12, end: 15, score: 0.1, cumulative: 0.4}
];

test('uses completed sentences without accumulating multiple times', () => {
  const duringFirst = timeline.snapshot(events, 3);
  assert.equal(duringFirst.completed, 0);
  assert.equal(duringFirst.currentScore, 0.5);
  assert.equal(timeline.snapshot(events, 5).cumulative, 0.5);
  assert.equal(timeline.snapshot(events, 11).cumulative, 0.3);
  assert.equal(timeline.snapshot(events, 13).completed, 2);
  assert.equal(timeline.snapshot(events, 20).completed, 3);
});

test('backward seeks and replay cannot double count', () => {
  assert.equal(timeline.snapshot(events, 14).cumulative, 0.3);
  assert.equal(timeline.snapshot(events, 4).cumulative, 0);
  assert.equal(timeline.snapshot(events, 14).cumulative, 0.3);
});

test('gaps, empty input, negative times and invalid time are safe', () => {
  assert.equal(timeline.snapshot(events, 11).active, null);
  assert.equal(timeline.snapshot([], 30).cumulative, 0);
  assert.equal(timeline.snapshot(events, -12).time, 0);
  assert.equal(timeline.snapshot(events, NaN).time, 0);
});

test('calibration affects time mapping symmetrically when nonnegative', () => {
  assert.equal(timeline.speechTime(20, 7), 13);
  assert.equal(timeline.videoTime(13, 7), 20);
  assert.equal(timeline.videoTime(0, -4), 0);
  assert.equal(timeline.formatTime(600.627), '10:00');
});
