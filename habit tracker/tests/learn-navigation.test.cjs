const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

test('Learn & Remember is easy to reach without adding a sixth mobile bottom tab', () => {
  assert.match(html, /data-view="learn"[^>]*>.*?Learn &amp; Remember/s);
  assert.match(app, /<button class="learn-entry" data-goto="learn">/);
  assert.match(fs.readFileSync(path.join(root, 'spiritual.css'), 'utf8'), /\.learn-nav-item\{display:none\}/);
});

test('Learn hub links to three hadith collections and provides complete sourced Dhikr, Du’a, and Notes', () => {
  for (const section of ['hadith', 'dhikr', 'dua', 'notes']) assert.match(app, new RegExp(`data-learn-section="${section}"`));
  for (const book of ['https://sunnah.com/bukhari', 'https://sunnah.com/muslim', 'https://sunnah.com/tirmidhi']) assert.ok(app.includes(book));
  assert.match(html, /spiritual-content\.js/);
  assert.match(app, /Seen-Arabic Adhkar database/);
  assert.match(app, /complete OpenDua Hisn al-Muslim catalogue is bundled/);
  assert.match(app, /data-adhkar-count/);
  assert.match(app, /count_description/);
  assert.match(app, /Timing, virtue &amp; source evidence/);
  assert.match(app, /Where a precise time is not specified in this record, none is inferred/);
});

test('Notes screen includes create, edit, delete, and save-state behavior', () => {
  assert.match(app, /data-note-form/);
  assert.match(app, /data-edit-note/);
  assert.match(app, /data-delete-note/);
  assert.match(app, /state\.learnNotes\.push/);
  assert.match(app, /note\.title=title;note\.body=body/);
  assert.match(app, /save\(\);toast\('Note deleted'\)/);
});
