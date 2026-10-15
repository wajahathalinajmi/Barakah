const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'spiritual.js'), 'utf8');
const chapters = [{ number: 1, englishName: 'Fixture Surah', name: 'سورة تجريبية', englishNameTranslation: 'Test chapter', numberOfAyahs: 2, revelationType: 'Meccan' }];

function createReader(options = {}) {
  const requests = [], elements = new Map();
  const json = data => ({ ok: true, json: async () => ({ code: 200, status: 'OK', data }) });
  const fetch = async url => {
    requests.push(url);
    if (url.endsWith('/surah')) return json(chapters);
    if (url.endsWith('/surah/1/quran-uthmani')) return json({ ayahs: [
      { number: 1, numberInSurah: 1, text: 'SURAH_FIXTURE_LINE_ONE', page: 1 },
      { number: 2, numberInSurah: 2, text: 'SURAH_FIXTURE_LINE_TWO', page: 1 }
    ] });
    if (url.endsWith('/surah/1/en.sahih')) return json({ ayahs: [
      { text: 'TRANSLATION_FIXTURE_MUST_NOT_APPEAR_IN_MUSHAF' }, { text: 'VERSE_MODE_TRANSLATION' }
    ] });
    if (url.endsWith('/surah/1/ar.alafasy')) return json({ ayahs: [{ audio: '' }, { audio: '' }] });
    if (url.endsWith('/surah/1/quran-tajweed')) return json({ ayahs: [
      { numberInSurah: 1, text: '[h:9421[سُورَة] [n:1234[فِيكُمْ بِهِ]' },
      { numberInSurah: 2, text: 'آيَةٌ' }
    ] });
    if (url.endsWith('/page/1/quran-uthmani')) return json({ ayahs: [
      { number: 1, numberInSurah: 1, text: 'UTHMANI_PAGE_FIXTURE', page: 1, surah: { number: 1 } },
      { number: 2, numberInSurah: 1, text: 'SECOND_SURAH_SAME_PAGE', page: 1, surah: { number: 2 } }
    ] });
    if (url.endsWith('/page/1/quran-tajweed')) return json({ ayahs: [
      { number: 1, numberInSurah: 1, text: 'PREFIX [h:9421[TAJWEED_TOKEN] <script>alert(1)</script>', page: 1, surah: { number: 1 } }
    ] });
    if (url.endsWith('/page/2/quran-uthmani')) return json({ ayahs: [
      { number: 3, numberInSurah: 3, text: 'NEXT_PAGE_FIXTURE', page: 2, surah: { number: 1 } }
    ] });
    if (decodeURIComponent(url).includes('/api/qdc/tafsirs/169/by_ayah/1:2')) return { ok: true, json: async () => ({ tafsir: {
      resource_id: 169, resource_name: 'Ibn Kathir (Abridged)', slug: 'en-tafisr-ibn-kathir',
      verses: { '1:2': { id: 22 } },
      text: '<h2>TAFSIR_FIXTURE</h2><p><strong>Detailed source text.</strong><a href="javascript:alert(1)">unsafe link</a><img src=x onerror=alert(1)></p><script>alert(1)</script>'
    } }) };
    throw new Error('Unexpected request: ' + url);
  };
  const document = { querySelector: selector => elements.get(selector) || null, querySelectorAll: selector => elements.get(selector) || [], getElementById: id => elements.get(id) || null };
  const window = {};
  vm.runInNewContext(source, { window, document, fetch, console, Date: options.Date || Date, setTimeout: () => 1, clearTimeout: () => {} });
  return { reader: window.BarakahSpiritual, requests, elements, window };
}

async function settle() { await new Promise(resolve => setImmediate(resolve)); }

async function renderReady(mode = 'mushaf', overrides = {}) {
  const { reader, requests } = createReader();
  const state = { quran: { mode, lastSurah: 1, bookmarks: [], mushafScript: 'uthmani', ...overrides } };
  reader.renderQuran(state); // loads chapter list
  await settle();
  reader.renderQuran(state); // loads selected surah metadata
  await settle();
  reader.renderQuran(state); // requests canonical Mushaf page when selected
  await settle();
  return { html: reader.renderQuran(state), state, requests };
}

test('Mushaf renders a page-based Arabic-only layout, including all ayahs returned for the page', async () => {
  const { html, requests } = await renderReady();
  assert.match(html, /class="mushaf-book-page"/);
  assert.match(html, /UTHMANI_PAGE_FIXTURE/);
  assert.match(html, /SECOND_SURAH_SAME_PAGE/);
  assert.match(html, /Page<select id="mushaf-page-select"/);
  assert.match(html, /of 604/);
  assert.doesNotMatch(html, /TRANSLATION_FIXTURE_MUST_NOT_APPEAR_IN_MUSHAF|VERSE_MODE_TRANSLATION/);
  assert.doesNotMatch(html, /data-bookmark=|data-word=|data-read-position=|quran-audio|verse-translation/);
  assert.ok(requests.some(url => url.endsWith('/page/1/quran-uthmani')));
});

test('Mushaf script selector loads source-coded Tajweed and safely escapes text', async () => {
  const { reader, requests } = createReader();
  const state = { quran: { mode: 'mushaf', lastSurah: 1, bookmarks: [], mushafScript: 'tajweed' } };
  reader.renderQuran(state); await settle();
  reader.renderQuran(state); await settle();
  reader.renderQuran(state); await settle();
  const html = reader.renderQuran(state);
  assert.match(html, /Tajweed color-coded/);
  assert.match(html, /value="uthmani"/);
  assert.match(html, /value="tajweed" selected/);
  assert.match(html, /class="tajweed-rule tajweed-ham-wasl"/);
  assert.match(html, /title="Hamzat ul Wasl"/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /VERSE_MODE_TRANSLATION|verse-translation|data-bookmark=/);
  assert.ok(requests.some(url => url.endsWith('/page/1/quran-tajweed')));
});

test('Mushaf page navigation requests the next canonical page', async () => {
  const { reader, requests } = createReader();
  const state = { quran: { mode: 'mushaf', lastSurah: 1, bookmarks: [], mushafScript: 'uthmani', page: 2 } };
  reader.renderQuran(state); await settle();
  reader.renderQuran(state); await settle();
  reader.renderQuran(state); await settle();
  const html = reader.renderQuran(state);
  assert.match(html, /NEXT_PAGE_FIXTURE/);
  assert.match(html, /aria-label="Qur’an Mushaf page 2"/);
  assert.ok(requests.some(url => url.endsWith('/page/2/quran-uthmani')));
});

test('changing the Mushaf selector updates the selected edition and requests its data', async () => {
  const { reader, requests, elements } = createReader();
  const state = { quran: { mode: 'mushaf', lastSurah: 1, bookmarks: [], mushafScript: 'uthmani' } };
  reader.renderQuran(state); await settle();
  reader.renderQuran(state); await settle();
  reader.renderQuran(state); await settle();
  reader.renderQuran(state);
  const control = { handlers: {}, addEventListener(type, handler) { this.handlers[type] = handler; } };
  elements.set('mushaf-script', control);
  reader.bindQuran({ state, render: () => reader.renderQuran(state), toast: () => {} });
  control.handlers.change({ target: { value: 'tajweed' } });
  await settle();
  const html = reader.renderQuran(state);
  assert.equal(state.quran.mushafScript, 'tajweed');
  assert.match(html, /class="tajweed-rule tajweed-ham-wasl"/);
  assert.ok(requests.some(url => url.endsWith('/page/1/quran-tajweed')));
});

test('verse-by-verse mode remains a separate translated and interactive reading view', async () => {
  const { html, requests } = await renderReady('verse');
  assert.match(html, /VERSE_MODE_TRANSLATION/);
  assert.match(html, /data-word=/);
  assert.match(html, /data-bookmark=/);
  assert.match(html, /data-read-position=/);
  assert.doesNotMatch(html, /mushaf-book-page/);
  assert.ok(!requests.some(url => url.includes('/page/')));
});

test('verse-by-verse Tajweed removes source annotations even when a color span crosses word spaces', async () => {
  const { reader, requests } = createReader();
  const state = { quran: { mode: 'verse', lastSurah: 1, bookmarks: [], tajweedEnabled: true } };
  reader.renderQuran(state); await settle();
  reader.renderQuran(state); await settle();
  reader.renderQuran(state); await settle();
  const html = reader.renderQuran(state);
  assert.match(html, /class="tajweed-rule tajweed-ham-wasl"/);
  assert.match(html, /class="tajweed-rule tajweed-madda-normal"/);
  assert.match(html, /data-verse="1:1"/);
  assert.match(html, /Show Tajweed rules/);
  assert.match(html, /aria-pressed="true"/);
  assert.doesNotMatch(html, /\[h:9421|\[n:1234|9421|1234/);
  assert.ok(requests.some(url => url.endsWith('/surah/1/quran-tajweed')));
});

test('Surah picker suggests typo-tolerant English matches and selects the chosen surah', async () => {
  const { reader, elements } = createReader();
  const state = { quran: { mode: 'mushaf', lastSurah: 1, bookmarks: [] } };
  reader.renderQuran(state); await settle();
  reader.renderQuran(state); await settle();
  const input = { value: 'Fxture Surah', handlers: {}, attrs: {}, addEventListener(type, fn) { this.handlers[type] = fn; }, setAttribute(name, value) { this.attrs[name] = value; }, removeAttribute(name) { delete this.attrs[name]; } };
  const results = { hidden: true, innerHTML: '', handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; }, querySelectorAll() { return []; } };
  elements.set('surah-search-input', input);
  elements.set('surah-search-results', results);
  const context = { state, render: () => reader.renderQuran(state), toast: () => {} };
  reader.bindQuran(context);
  input.handlers.input();
  assert.equal(results.hidden, false);
  assert.match(results.innerHTML, /data-select-surah="1"/);
  assert.match(results.innerHTML, /Fixture Surah/);
  const selected = { dataset: { selectSurah: '1' } };
  results.handlers.click({ target: { closest: () => selected } });
  assert.equal(state.quran.lastSurah, 1);
  assert.equal(input.value, '');
});

test('Tajweed toggle enables and disables color-coded verse text', async () => {
  const { reader, elements, requests } = createReader();
  const state = { quran: { mode: 'verse', lastSurah: 1, bookmarks: [] } };
  reader.renderQuran(state); await settle();
  reader.renderQuran(state); await settle();
  let html = reader.renderQuran(state);
  const context = { state, render: () => { html = reader.renderQuran(state); }, toast: () => {} };
  const enable = { handler: null, addEventListener(type, fn) { this.handler = fn; } };
  elements.set('[data-toggle-tajweed]', enable);
  reader.bindQuran(context);
  enable.handler();
  assert.equal(state.quran.tajweedEnabled, true);
  await settle();
  html = reader.renderQuran(state);
  assert.match(html, /class="tajweed-rule tajweed-ham-wasl"/);
  assert.match(html, /aria-pressed="true"/);
  assert.ok(requests.some(url => url.endsWith('/surah/1/quran-tajweed')));

  const disable = { handler: null, addEventListener(type, fn) { this.handler = fn; } };
  elements.set('[data-toggle-tajweed]', disable);
  reader.bindQuran(context);
  disable.handler();
  assert.equal(state.quran.tajweedEnabled, false);
  html = reader.renderQuran(state);
  assert.match(html, /aria-pressed="false"/);
  assert.doesNotMatch(html, /class="tajweed-rule/);
});

test('each verse has a Tafsir action that opens the matching Ibn Kathir detail screen safely', async () => {
  const { reader, requests, elements } = createReader();
  const state = { quran: { mode: 'verse', lastSurah: 1, bookmarks: [] } };
  let html = '';
  const context = { state, render: () => { html = reader.renderQuran(state); }, toast: () => {} };
  reader.renderQuran(state); await settle();
  reader.renderQuran(state); await settle();
  html = reader.renderQuran(state);
  assert.match(html, /data-tafsir="1:2"/);
  assert.match(html, /Open Tafsir Ibn Kathir for ayah 1:2/);
  const action = { dataset: { tafsir: '1:2' }, handlers: {}, addEventListener(type, handler) { this.handlers[type] = handler; } };
  elements.set('[data-tafsir]', [action]);
  reader.bindQuran(context);
  action.handlers.click();
  assert.match(html, /Tafsir Ibn Kathir/);
  await settle();
  html = reader.renderQuran(state);
  assert.match(html, /TAFSIR_FIXTURE/);
  assert.match(html, /Detailed source text\./);
  assert.match(html, /\(abridged English\)/);
  assert.match(html, /quran.com\/1:2\/tafsirs\/en-tafisr-ibn-kathir/);
  assert.doesNotMatch(html, /<script>|onerror=|href="javascript:/i);
  assert.ok(requests.some(url => decodeURIComponent(url).includes('/api/qdc/tafsirs/169/by_ayah/1:2')));
});

test('Home rotates verified hadith by local calendar day and links to its source', () => {
  const fixed = day => class extends Date { constructor(...args) { super(...(args.length ? args : [day])); } };
  const one = createReader({ Date: fixed('2026-10-15T12:00:00') }).reader.renderHome({});
  const two = createReader({ Date: fixed('2026-10-16T12:00:00') }).reader.renderHome({});
  assert.notEqual(one.match(/<blockquote>(.*?)<\/blockquote>/)?.[1], two.match(/<blockquote>(.*?)<\/blockquote>/)?.[1]);
  assert.match(one, /Hadith of the day/);
  assert.match(one, /https:\/\/sunnah\.com\/(bukhari|muslim):/);
  assert.doesNotMatch(one, /Do good deeds properly, sincerely and moderately/);
});

test('Home renders named tasbeeh counters and tap-to-count controls, not a plus-one button', () => {
  const { reader } = createReader();
  const html = reader.renderHome({});
  assert.match(html, /data-tasbeeh-tap="starter-subhanallah"/);
  assert.match(html, /SubhanAllah/);
  assert.match(html, /Tap anywhere here to count/);
  assert.match(html, /data-tasbeeh-form/);
  assert.doesNotMatch(html, /\+1/);
});

test('tasbeeh tap increments and persists its count; add and delete manage named counters', () => {
  const { reader, elements, window } = createReader();
  const state = {};
  let saves = 0, renders = 0;
  window.BARAKAH_SAVE_STATE = () => saves++;
  const tap = { dataset: { tasbeehTap: 'starter-subhanallah' }, addEventListener(type, handler) { this.handler = handler; } };
  const form = { addEventListener(type, handler) { this.handler = handler; } };
  const remove = { dataset: { tasbeehDelete: 'starter-subhanallah' }, addEventListener(type, handler) { this.handler = handler; } };
  elements.set('[data-tasbeeh-tap]', [tap]); elements.set('[data-tasbeeh-delete]', [remove]); elements.set('[data-tasbeeh-form]', form);
  reader.bindHome({ state, render: () => renders++, toast: () => {} });
  tap.handler();
  assert.equal(state.tasbeeh[0].count, 1);
  assert.equal(saves, 1);
  form.handler({ preventDefault() {}, currentTarget: { elements: { name: { value: 'Salawat' } } } });
  assert.deepEqual(Array.from(state.tasbeeh, item => item.name), ['SubhanAllah', 'Salawat']);
  assert.equal(saves, 2);
  remove.handler();
  assert.deepEqual(Array.from(state.tasbeeh, item => item.name), ['Salawat']);
  assert.equal(renders, 3);
});

test('dhikr screen shares counters with Home and starts a named counter only once', () => {
  const { reader } = createReader();
  const state = {};
  const first = reader.addDhikrCounter(state, 'SubhanAllah wa bihamdihi');
  const second = reader.addDhikrCounter(state, ' subhanallah wa bihamdihi ');
  const html = reader.renderDhikr(state);
  assert.equal(first.id, second.id);
  assert.equal(state.tasbeeh.length, 2); // starter counter plus the selected dhikr
  assert.match(html, /SubhanAllah wa bihamdihi/);
  assert.match(html, /data-tasbeeh-tap=/);
  assert.match(html, /data-tasbeeh-form/);
});
