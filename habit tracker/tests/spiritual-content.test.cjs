const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(__dirname, '..', 'spiritual-content.js'), 'utf8');

function contentClient(fetchImpl) {
  const window = {};
  vm.runInNewContext(source, { window, fetch: fetchImpl });
  return window.BarakahContent;
}

test('bundled morning/evening adhkar includes the full source collection with repeat counts and citations', async () => {
  const calls = [];
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/morning-evening-adhkar-en.json'), 'utf8'));
  const api = contentClient(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => data };
  });

  const records = await api.loadAdhkar();
  assert.equal(records.length, 34);
  assert.equal(records.filter(record => Number(record.type) === 0 || Number(record.type) === 1).length, 26);
  assert.equal(records.filter(record => Number(record.type) === 0 || Number(record.type) === 2).length, 24);
  assert.ok(records.every(record => record.content && record.translation && record.source && record.count !== undefined));
  assert.equal(calls[0].url, 'data/morning-evening-adhkar-en.json');
  assert.equal(calls[0].options.headers.Accept, 'application/json');
});

test('bundled Hisn al-Muslim catalogue exposes complete chapters, local search, and entry detail', async () => {
  const calls = [];
  const api = contentClient(async url => {
    calls.push(url);
    const file = url.endsWith('open-dua-0.0.4.json') ? 'data/open-dua-0.0.4.json' : 'data/morning-evening-adhkar-en.json';
    return { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) };
  });

  const chapters = await api.loadDuaChapters();
  assert.equal(chapters.length, 132);
  const morningEvening = chapters.find(chapter => chapter.id === 'chapter-000027');
  assert.equal(morningEvening.entryCount, 24);
  assert.equal((await api.loadDuaChapterEntries(morningEvening.id)).length, 24);
  assert.equal((await api.searchDuas('morning and evening')).length, 24);
  const entry = await api.loadDuaEntry('entry-000076');
  assert.equal(entry.sourceReference, '76');
  assert.equal(entry.variations[0].steps[0].items[0].times, 3);
  assert.deepEqual(calls, ['data/open-dua-0.0.4.json']);
});

test('adhkar file fetch failures are surfaced instead of showing an empty collection as complete', async () => {
  const api = contentClient(async () => ({ ok: false, status: 503 }));
  await assert.rejects(api.loadAdhkar(), /503/);
});
