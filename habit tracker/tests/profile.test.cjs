const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function bootProfileApp() {
  const elements = new Map(), events = {}, dataset = {};
  const makeElement = () => ({
    textContent: '', innerHTML: '', value: '', disabled: false, title: '', attrs: {}, handlers: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, handler) { this.handlers[type] = handler; },
    setAttribute(name, value) { this.attrs[name] = value; }
  });
  const selectors = ['#top-date','#section-title','#view-container','#toast','.profile-name','.profile-mark','.profile','.profile-launch','#habit-form','#close-dialog','#cancel-dialog','#habit-dialog','#today-button','#appearance-select','#profile-name-input','#profile-email','[data-save-profile]'];
  selectors.forEach(selector => elements.set(selector, makeElement()));
  const sidebarProfile = elements.get('.profile');
  sidebarProfile.dataset = { view: 'profile' };
  const navProfile = makeElement(); navProfile.dataset = { view: 'profile' };
  const signout = makeElement();
  const document = {
    documentElement: { dataset },
    querySelector: selector => elements.get(selector) || null,
    querySelectorAll: selector => selector === '.nav-item' ? [navProfile] : selector === '[data-view]' ? [navProfile, sidebarProfile] : selector === '[data-profile-signout]' ? [signout] : []
  };
  const user = { email: 'reader@example.test', created_at: '2025-01-01T00:00:00Z', user_metadata: { full_name: 'Reader' } };
  let signoutCalls = 0, profileUpdates = [];
  const window = {
    BARAKAH_USER: user,
    BARAKAH_INITIAL_STATE: { habits: [{ id: 'fajr', name: 'Fajr prayer', category: 'Prayer', goal: 'On time', icon: '☾' }], logs: {}, appearance: 'light', profile: {}, quran: {} },
    BARAKAH_PERSIST: async () => ({ error: null }),
    BARAKAH_UPDATE_PROFILE: async name => { profileUpdates.push(name); user.user_metadata.full_name = name; },
    BARAKAH_SIGNOUT: async () => { signoutCalls++; },
    BarakahSpiritual: { dailyNote: () => ({ title: 'Note', body: 'A reflection.' }), renderHome: () => '', bindHome() {}, bindProfile() {} },
    BarakahRewards: { currentStreak: () => 0 },
    addEventListener() {}
  };
  vm.runInNewContext(appSource, {
    window, document, Date, setTimeout: () => 1, clearTimeout() {},
    localStorage: { getItem: () => null, setItem() {} },
    confirm: () => true,
    crypto: { randomUUID: () => 'new-habit-id' }
  });
  return { document, elements, navProfile, sidebarProfile, signout, user, dataset, get signoutCalls() { return signoutCalls; }, profileUpdates };
}

test('sidebar profile control opens account details without signing out', () => {
  const app = bootProfileApp();
  app.sidebarProfile.onclick();
  const html = app.elements.get('#view-container').innerHTML;
  assert.match(html, /Account details/);
  assert.match(html, /reader@example\.test/);
  assert.match(html, /data-profile-signout/);
  assert.doesNotMatch(html, /Supabase account email confirmation flow/);
  assert.equal(app.signoutCalls, 0);
});

test('profile name save updates the signed-in display name', async () => {
  const app = bootProfileApp();
  app.navProfile.onclick();
  const input = app.elements.get('#profile-name-input');
  input.value = 'Updated name';
  await app.elements.get('[data-save-profile]').handlers.click();
  assert.deepEqual(app.profileUpdates, ['Updated name']);
  assert.match(app.elements.get('#view-container').innerHTML, /Updated name/);
});

test('appearance control switches the app to dark theme', () => {
  const app = bootProfileApp();
  app.navProfile.onclick();
  app.elements.get('#appearance-select').handlers.change({ target: { value: 'dark' } });
  assert.equal(app.dataset.theme, 'dark');
});

test('sign-out is a separate profile action and the sidebar profile icon uses an Arabic initial', () => {
  const app = bootProfileApp();
  assert.match(indexSource, /class="profile-mark"[^>]*>ب<\/span>/);
  app.navProfile.onclick();
  app.signout.onclick();
  return Promise.resolve().then(() => assert.equal(app.signoutCalls, 1));
});
