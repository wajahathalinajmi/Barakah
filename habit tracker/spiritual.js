(() => {
  const API = 'https://api.alquran.cloud/v1';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let chapters = null, chapterRequest = null, chapterFailed = false, readerData = {}, readerErrors = {}, tajweedSurahData = {}, tajweedSurahRequests = {}, tajweedSurahErrors = {}, mushafPageCache = {}, mushafRequests = {}, mushafErrors = {}, tafsirCache = {}, tafsirRequests = {}, tafsirErrors = {}, prayerData = null, prayerKey = '';
  let callbacks = null, activeAudio = null, readObserver = null, lastProgressKey = '', dailyRefreshTimer = null;
  const ensure = state => { state.quran ||= {bookmarks:[],mode:'verse',lastSurah:1,progress:null}; state.quran.bookmarks ||= []; return state.quran; };
  const save = () => window.BARAKAH_SAVE_STATE?.();
  const apiJson = async url => { const response = await fetch(url); if (!response.ok) throw new Error('Content service returned ' + response.status); const body = await response.json(); if (body.code !== 200 || !body.data) throw new Error(body.status || 'Content could not be loaded'); return body.data; };
  const loadTafsir = async (key, render) => {
    if (tafsirCache[key]) return tafsirCache[key];
    if (!tafsirRequests[key]) tafsirRequests[key] = (async () => {
      const response = await fetch('https://api.qurancdn.com/api/qdc/tafsirs/169/by_ayah/' + encodeURIComponent(key) + '?locale=en');
      if (!response.ok) throw new Error('Tafsir could not be reached (' + response.status + ').');
      const body = await response.json(), entry = body?.tafsir;
      if (entry?.resource_id !== 169 || !entry.verses?.[key] || typeof entry.text !== 'string') throw new Error('Ibn Kathir tafsir is unavailable for this ayah.');
      tafsirCache[key] = { text: entry.text, resourceName: entry.resource_name || 'Ibn Kathir (Abridged)', slug: entry.slug || 'en-tafisr-ibn-kathir' };
      delete tafsirErrors[key]; return tafsirCache[key];
    })().catch(error => { tafsirErrors[key] = error.message || 'Tafsir could not be loaded.'; throw error; }).finally(() => { delete tafsirRequests[key]; });
    try { const entry = await tafsirRequests[key]; render?.(); return entry; } catch { render?.(); return null; }
  };
  function safeTafsirHtml(value) {
    const html = String(value ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|iframe|object|svg|math)[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    const allowed = new Set(['p','br','strong','b','em','i','u','ul','ol','li','blockquote','h1','h2','h3','h4','sup','sub','span']);
    return html.replace(/<\/?([a-z][\w-]*)\b[^>]*>/gi, (tag, name) => {
      const normalized = name.toLowerCase(); if (!allowed.has(normalized)) return '';
      return tag.startsWith('</') ? '</'+normalized+'>' : '<'+normalized+'>';
    });
  }
  const loadChapters = async render => {
    if (chapters) return chapters;
    if (!chapterRequest) chapterRequest = apiJson(API + '/surah').then(data => chapters = data).finally(() => chapterRequest = null);
    try { await chapterRequest; if (render) render(); } catch { chapterFailed = true; if (render) render(); }
    return chapters;
  };
  const loadSurah = async (id, render) => {
    if (readerData[id]) return readerData[id];
    const [arabic,english,audio] = await Promise.all([
      apiJson(API + '/surah/' + id + '/quran-uthmani'),
      apiJson(API + '/surah/' + id + '/en.sahih'),
      apiJson(API + '/surah/' + id + '/ar.alafasy')
    ]);
    if (!arabic.ayahs || !english.ayahs || !audio.ayahs) throw new Error('The Quran edition data is incomplete.');
    const verses = arabic.ayahs.map((ayah, i) => ({number:ayah.number, numberInSurah:ayah.numberInSurah, text:ayah.text, page:ayah.page, translation:english.ayahs[i]?.text || '', audio:audio?.ayahs[i]?.audio || '', key:id + ':' + ayah.numberInSurah}));
    readerData[id] = {arabic,english,verses};
    if (render) render();
    return readerData[id];
  };
  const loadMushafPage = async (page, script, render) => {
    const edition = script === 'tajweed' ? 'quran-tajweed' : 'quran-uthmani', key = page + ':' + edition;
    if (mushafPageCache[key]) return mushafPageCache[key];
    if (!mushafRequests[key]) mushafRequests[key] = apiJson(API + '/page/' + page + '/' + edition).then(data => {
      if (!Array.isArray(data.ayahs) || !data.ayahs.length) throw new Error('The Mushaf page is empty.');
      mushafPageCache[key] = data; delete mushafErrors[key]; return data;
    }).catch(error => { mushafErrors[key] = true; throw error; }).finally(() => { delete mushafRequests[key]; });
    try { const data = await mushafRequests[key]; if (render) render(); return data; } catch { if (render) render(); return null; }
  };
  const loadTajweedSurah = async (id, render) => {
    if (tajweedSurahData[id]) return tajweedSurahData[id];
    if (!tajweedSurahRequests[id]) tajweedSurahRequests[id] = apiJson(API + '/surah/' + id + '/quran-tajweed').then(data => {
      if (!Array.isArray(data.ayahs) || !readerData[id] || data.ayahs.length !== readerData[id].verses.length) throw new Error('The verified Tajweed text is incomplete.');
      const words = {}; data.ayahs.forEach((ayah,index)=>{const verse=readerData[id].verses[index];if(ayah.numberInSurah!==verse.numberInSurah||typeof ayah.text!=='string')throw new Error('The verified Tajweed text does not match this surah.');words[ayah.numberInSurah]=ayah.text;});
      tajweedSurahData[id]=words;delete tajweedSurahErrors[id];return words;
    }).catch(error=>{tajweedSurahErrors[id]=error.message||'Tajweed color text could not be loaded.';throw error;}).finally(()=>{delete tajweedSurahRequests[id];});
    try{const result=await tajweedSurahRequests[id];render?.();return result;}catch{render?.();return null;}
  };
  const tajweedRules = {
    h:['ham-wasl','#AAAAAA','Hamzat ul Wasl'], s:['slnt','#AAAAAA','Silent'], l:['slnt','#AAAAAA','Lam Shamsiyyah'],
    n:['madda-normal','#537FFF','Normal prolongation'], p:['madda-permissible','#4050FF','Permissible prolongation'],
    m:['madda-necessary','#000EBC','Necessary prolongation'], q:['qlq','#DD0008','Qalqalah'], o:['madda-obligatory','#2144C1','Obligatory prolongation'],
    c:['ikhf-shfw','#D500B7','Ikhafa Shafawi'], f:['ikhf','#9400A8','Ikhafa'], w:['idghm-shfw','#58B800','Idgham Shafawi'],
    i:['iqlb','#26BFFD','Iqlab'], a:['idgh-ghn','#169777','Idgham with Ghunnah'], u:['idgh-w-ghn','#169200','Idgham without Ghunnah'],
    d:['idgh-mus','#A1A1A1','Idgham Mutajanisayn'], b:['idgh-mut','#A1A1A1','Idgham Mutaqaribayn'], g:['ghn','#FF7E1E','Ghunnah']
  };
  function formatTajweed(text) {
    const token = /\[([a-z])(?::\d+)?\[([^\]]*)\]/g;
    const source = String(text ?? ''); let html = '', cursor = 0, match;
    while ((match = token.exec(source))) {
      html += esc(source.slice(cursor, match.index));
      const rule = tajweedRules[match[1]];
      html += rule ? '<span class="tajweed-rule tajweed-'+rule[0]+'" title="'+esc(rule[2])+'" style="color:'+rule[1]+'">'+esc(match[2])+'</span>' : esc(match[2]);
      cursor = token.lastIndex;
    }
    return html + esc(source.slice(cursor));
  }
  function formatTajweedWords(text, verse, focusIndex) {
    const source=String(text??''),token=/\[([a-z])(?::\d+)?\[([^\]]*)\]/g,segments=[];let cursor=0,current='',match;
    const append=(value,rule)=>{for(const part of String(value).split(/(\s+)/)){if(!part)continue;if(/^\s+$/.test(part)){if(current){segments.push(current);current='';}segments.push(esc(part));continue;}const color=rule?'<span class="tajweed-rule tajweed-'+rule[0]+'" title="'+esc(rule[2])+'" style="color:'+rule[1]+'">'+esc(part)+'</span>':esc(part);current+=color;}};
    while((match=token.exec(source))){append(source.slice(cursor,match.index));append(match[2],tajweedRules[match[1]]);cursor=token.lastIndex;}
    append(source.slice(cursor));if(current)segments.push(current);
    let wordIndex=0;return segments.map(segment=>{if(/^\s+$/.test(segment))return segment;const index=wordIndex++;return '<button class="arabic-word '+(index===focusIndex?'word-focused':'')+'" data-word="'+index+'" data-verse="'+esc(verse.key)+'" aria-label="Focus Arabic word '+(index+1)+' in ayah '+esc(verse.key)+'">'+segment+'</button>';}).join('');
  }
  function renderHome(state) {
    const q = ensure(state), loc = state.profile?.location;
    if (loc?.city && loc?.country) requestPrayer(loc, () => { if (callbacks?.render && document.querySelector('[data-prayer-card]')) callbacks.render(); });
    const times = prayerData && prayerKey === prayerCacheKey(loc) ? prayerData : null;
    const last = q.progress;
    const tasbeeh = ensureTasbeeh(state);
    const names = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];
    const cards = times ? names.map(name => '<div class="prayer-time"><span>'+name+'</span><strong>'+esc(times[name])+'</strong></div>').join('') : '';
    const hadith = dailyHadith();
    const tasbeehHtml = tasbeeh.length ? tasbeeh.map(item => '<article class="tasbeeh-item"><button class="tasbeeh-tap" data-tasbeeh-tap="'+esc(item.id)+'" aria-label="Tap to count '+esc(item.name)+', current count '+item.count+'"><span class="tasbeeh-name">'+esc(item.name)+'</span><strong class="tasbeeh-count">'+item.count+'</strong><span class="tasbeeh-hint">Tap anywhere here to count</span></button><button class="small-action delete tasbeeh-delete" data-tasbeeh-delete="'+esc(item.id)+'" aria-label="Delete '+esc(item.name)+'" title="Delete counter">×</button></article>').join('') : '<p class="tasbeeh-empty">Add a dhikr name to begin counting.</p>';
    return '<section class="section-heading"><div><h2>Prayer times</h2><p>'+(loc?.city ? esc(loc.city)+', '+esc(loc.country) : 'Set your location for today’s times')+'</p></div><button class="text-button" data-goto="profile">Settings ↗</button></section><section class="panel prayer-panel" data-prayer-card>'+(times ? '<div class="prayer-grid">'+cards+'</div><p class="source-note">Times from AlAdhan · '+esc(loc.methodName || 'Muslim World League')+' calculation</p>' : '<div class="prayer-empty"><span class="prayer-symbol">☾</span><div><strong>'+(loc?.city?'Loading today’s prayer times…':'Make prayer times personal')+'</strong><p>'+(loc?.city?'Prayer times are being fetched for your saved location.':'Choose your city and calculation method in Profile settings.')+'</p></div><button class="button secondary" data-goto="profile">'+(loc?.city?'Refresh settings':'Set location')+' ↗</button></div>')+'</section><section class="section-heading"><div><h2>Continue reading</h2><p>Your last saved Qur’an position</p></div></section><section class="panel continue-card"><div class="continue-mark">۞</div><div class="continue-copy"><strong>'+(last ? esc(last.surahName)+' · Ayah '+esc(last.ayah) : 'Begin with a moment of Qur’an')+'</strong><span>'+(last ? 'Your reading place is saved with your account.' : 'The reader opens with Al-Fātiḥah.')+'</span></div><button class="button primary" data-goto="quran">'+(last?'Resume':'Open reader')+' <span>↗</span></button></section><section class="section-heading"><div><h2>Tasbeeh</h2><p>Tap a counter to remember · totals stay saved</p></div></section><section class="panel tasbeeh-panel"><div class="tasbeeh-list">'+tasbeehHtml+'</div><form class="tasbeeh-add" data-tasbeeh-form><label class="sr-only" for="tasbeeh-name-input">Name for new dhikr counter</label><input class="text-input" id="tasbeeh-name-input" name="name" maxlength="40" placeholder="Name a dhikr to count" required><button class="button secondary" type="submit">Add counter</button></form></section>'+renderTasbeehHistory(state)+'<section class="section-heading"><div><h2>Hadith of the day</h2><p>A verified reminder for '+new Date().toLocaleDateString(undefined,{month:'long',day:'numeric'})+'</p></div></section><section class="panel hadith-card"><div class="hadith-mark">“</div><blockquote>'+esc(hadith.text)+'</blockquote><div class="hadith-source">'+esc(hadith.narrator)+' · '+esc(hadith.collection)+' · <a href="'+esc(hadith.url)+'" target="_blank" rel="noopener noreferrer">Read the source ↗</a></div></section>';
  }
  const dailyHadiths = [
    {text:'The most beloved action to Allah’s Messenger was that whose doer did it continuously and regularly.',narrator:'Narrated by ʿĀ’ishah',collection:'Sahih al-Bukhari 6462',url:'https://sunnah.com/bukhari:6462'},
    {text:'There are two blessings that many people are deceived into losing: health and free time.',narrator:'Narrated by Ibn ʿAbbās',collection:'Sahih al-Bukhari 6412',url:'https://sunnah.com/bukhari:6412'},
    {text:'Whoever believes in Allah and the Last Day should speak what is good or keep quiet.',narrator:'Narrated by Abu Hurairah',collection:'Sahih al-Bukhari 6018',url:'https://sunnah.com/bukhari:6018'},
    {text:'The most beloved things with which My slave comes nearer to Me are what I have enjoined upon him.',narrator:'Narrated by Abu Hurairah',collection:'Sahih al-Bukhari 6502',url:'https://sunnah.com/bukhari:6502'},
    {text:'Allah is at the back of a servant so long as the servant is at the back of his brother.',narrator:'Narrated by Abu Hurairah',collection:'Sahih Muslim 2699a',url:'https://sunnah.com/muslim:2699a'},
    {text:'The most beloved deed to Allah is the most regular and constant, even if it were little.',narrator:'Narrated by ʿĀ’ishah',collection:'Sahih al-Bukhari 6464',url:'https://sunnah.com/bukhari:6464'}
  ];
  function dailyHadith(date = new Date()) {
    const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    return dailyHadiths[((day % dailyHadiths.length) + dailyHadiths.length) % dailyHadiths.length];
  }
  const dailyNotes = [
    {title:'Begin again with intention.',body:'Choose one small act of worship you can return to today, and give it your full attention.'},
    {title:'Make space for gratitude.',body:'Pause for a moment and name one blessing you might otherwise have passed by.'},
    {title:'Let a small good deed be enough.',body:'What is one gentle, meaningful step you can take with the time and energy you have today?'},
    {title:'Carry kindness into the day.',body:'Think of one person who could use patience, encouragement, or a thoughtful word from you.'},
    {title:'Return without self-judgment.',body:'If a routine slipped, begin again from where you are. A fresh intention can start in this moment.'},
    {title:'Make your intention clear.',body:'Before your next task, take a breath and remember why you want to do it well.'},
    {title:'Notice the good you can sustain.',body:'A practice that fits your real life is one you can keep returning to. What feels sustainable today?'}
  ];
  function dailyNote(date = new Date()) {
    const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    return dailyNotes[((day % dailyNotes.length) + dailyNotes.length) % dailyNotes.length];
  }
  function localDayKey(date = new Date()) {
    return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  }
  function ensureTasbeeh(state) {
    if (!Array.isArray(state.tasbeeh)) state.tasbeeh = [{id:'starter-subhanallah',name:'SubhanAllah',count:0}];
    state.tasbeeh = state.tasbeeh.filter(item => item && typeof item === 'object' && item.id && typeof item.name === 'string');
    state.tasbeeh.forEach(item => { item.count = Number.isSafeInteger(item.count) && item.count >= 0 ? item.count : 0; });
    if (!Array.isArray(state.tasbeehHistory)) state.tasbeehHistory = [];
    state.tasbeehHistory = state.tasbeehHistory.filter(entry => entry && typeof entry.name === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && Number.isSafeInteger(entry.count) && entry.count > 0);
    return state.tasbeeh;
  }
  function recordTasbeehCount(state, item, date = new Date()) {
    ensureTasbeeh(state);
    const dateKey = localDayKey(date);
    let entry = state.tasbeehHistory.find(record => record.id === item.id && record.date === dateKey);
    if (!entry) {
      entry = {id:item.id,name:item.name,date:dateKey,count:0};
      state.tasbeehHistory.push(entry);
    }
    entry.name = item.name;
    entry.count += 1;
  }
  function renderTasbeehHistory(state) {
    const history = (Array.isArray(state.tasbeehHistory) ? state.tasbeehHistory : []).slice().sort((a,b) => b.date.localeCompare(a.date) || b.name.localeCompare(a.name)).slice(0,30);
    const rows = history.map(entry => {
      const date = new Date(entry.date+'T12:00:00');
      const label = localDayKey() === entry.date ? 'Today' : date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
      return '<article class="tasbeeh-history-row"><time>'+esc(label)+'</time><strong>'+esc(entry.name)+'</strong><span>'+entry.count.toLocaleString()+' '+(entry.count===1?'recitation':'recitations')+'</span></article>';
    }).join('');
    return '<section class="tasbeeh-history"><div class="section-heading"><div><h2>Remembered dhikr</h2><p>Your recent counts, kept by day and dhikr name</p></div></div><div class="panel tasbeeh-history-list">'+(rows||'<p class="tasbeeh-empty">Your counted dhikr will appear here with its name and daily total.</p>')+'</div></section>';
  }
  function addDhikrCounter(state, name) {
    const clean = String(name ?? '').trim().slice(0,40); if (!clean) return null;
    const items = ensureTasbeeh(state), existing = items.find(item => item.name.toLocaleLowerCase() === clean.toLocaleLowerCase());
    if (existing) return existing;
    const item = {id:'dhikr-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),name:clean,count:0}; items.push(item); return item;
  }
  function renderDhikr(state, featured = null) {
    const tasbeeh = ensureTasbeeh(state);
    const cards = tasbeeh.length ? tasbeeh.map(item => {const target=featured&&item.name.toLocaleLowerCase()===featured.counter.toLocaleLowerCase()?featured.target:0;const progress=target?Math.min(100,Math.round(item.count/target*100)):0;return '<article class="tasbeeh-item"><button class="tasbeeh-tap" data-tasbeeh-tap="'+esc(item.id)+'" aria-label="Tap to count '+esc(item.name)+', current count '+item.count+(target?', target '+target:'')+'"><span class="tasbeeh-name">'+esc(item.name)+'</span><strong class="tasbeeh-count">'+item.count+(target?' <small>/ '+target+'</small>':'')+'</strong>'+(target?'<span class="tasbeeh-progress"><i style="width:'+progress+'%"></i></span>':'')+'<span class="tasbeeh-hint">Tap anywhere here to count</span></button><button class="small-action delete tasbeeh-delete" data-tasbeeh-delete="'+esc(item.id)+'" aria-label="Delete '+esc(item.name)+'" title="Delete counter">×</button></article>'}).join('') : '<p class="tasbeeh-empty">Add a dhikr name to begin counting.</p>';
    return '<section class="panel tasbeeh-panel"><div class="tasbeeh-list">'+cards+'</div><form class="tasbeeh-add" data-tasbeeh-form><label class="sr-only" for="tasbeeh-name-input">Name for new dhikr counter</label><input class="text-input" id="tasbeeh-name-input" name="name" maxlength="40" placeholder="Name a dhikr to count" required><button class="button secondary" type="submit">Add counter</button></form></section>';
  }
  function prayerCacheKey(loc) { return loc ? [loc.city,loc.country,loc.method,new Date().toISOString().slice(0,10)].join('|') : ''; }
  async function requestPrayer(loc, rerender) {
    const key = prayerCacheKey(loc);
    if (!key || prayerKey === key || prayerKey === key + ':loading') return;
    prayerKey = key + ':loading';
    try {
      const date = new Date(), stamp = String(date.getDate()).padStart(2,'0')+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+date.getFullYear();
      const url = 'https://api.aladhan.com/v1/timingsByCity/'+stamp+'?city='+encodeURIComponent(loc.city)+'&country='+encodeURIComponent(loc.country)+'&method='+encodeURIComponent(loc.method || 3);
      const response = await fetch(url); if (!response.ok) throw new Error('Prayer times could not be reached.');
      const result = await response.json(); if (result.code !== 200) throw new Error('Prayer times are unavailable for this location.');
      prayerData = result.data.timings; prayerKey = key;
    } catch { prayerData = null; prayerKey = ''; }
    rerender?.();
  }
  const normalizeSurahName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\bsurah\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  function editDistance(a,b) { const row=Array.from({length:b.length+1},(_,i)=>i); for(let i=1;i<=a.length;i++){let diagonal=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const above=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));diagonal=above;}}return row[b.length]; }
  function rankSurahs(query) {
    const needle=normalizeSurahName(query); if(!needle||!chapters)return [];
    return chapters.map(chapter=>{const names=[chapter.englishName,chapter.englishNameTranslation].map(normalizeSurahName).filter(Boolean);let score=Infinity;for(const name of names){if(name===needle)score=0;else if(name.startsWith(needle))score=Math.min(score,.1);else if(name.includes(needle))score=Math.min(score,.2);for(const token of name.split(' ')){const dist=editDistance(needle,token);score=Math.min(score,dist+Math.abs(needle.length-token.length)*.15);}}return {chapter,score};}).filter(item=>item.score<=Math.max(2,needle.length*.42)||item.score<1).sort((a,b)=>a.score-b.score||a.chapter.number-b.chapter.number).slice(0,8).map(item=>item.chapter);
  }
  function surahSearchMarkup(chapter) { return '<div class="surah-search-wrap"><label class="reader-search surah-search" for="surah-search-input"><span aria-hidden="true">⌕</span><input id="surah-search-input" type="search" autocomplete="off" placeholder="Find a surah…" aria-label="Search surahs by English name" aria-expanded="false" aria-controls="surah-search-results"/><span class="sr-only">Current surah: '+(chapter?esc(chapter.englishName):'')+'</span></label><div id="surah-search-results" class="surah-search-results" role="listbox" hidden></div></div>'; }
  function renderQuran(state) {
    const q = ensure(state), id = Number(q.lastSurah || q.progress?.surahId || 1);
    if (q.tafsirKey) return renderTafsir(q);
    if (!chapters) { if(!chapterFailed) loadChapters(() => callbacks?.render()); return '<div class="page"><div class="page-title"><div><span class="eyebrow">THE NOBLE QUR’AN</span><h1>A place to return<span style="color:#9eaa74">.</span></h1><p class="subheading">Verified text and recitation</p></div></div><section class="panel reader-loading">'+(chapterFailed?'The surah list could not be reached. Check your connection, then refresh.':'Connecting to the Arabic text, translation, and recitation source…')+'</section></div>'; }
    if (chapters && !readerData[id] && !readerErrors[id]) { loadSurah(id, () => callbacks?.render()).catch(() => {readerErrors[id]=true;callbacks?.render();}); }
    const chapter = chapters?.find(x => x.number === id), data = readerData[id];
    const selectedMode = q.mode || 'verse';
    const script = q.mushafScript === 'tajweed' ? 'tajweed' : 'uthmani';
    const verseTajweedEnabled = selectedMode === 'verse' && q.tajweedEnabled === true;
    if (verseTajweedEnabled && data && !tajweedSurahData[id] && !tajweedSurahErrors[id] && !tajweedSurahRequests[id]) loadTajweedSurah(id,()=>callbacks?.render());
    if (selectedMode === 'mushaf' && data) {
      if (!Number.isInteger(Number(q.page)) || Number(q.page) < 1 || Number(q.page) > 604) q.page = data.verses[0]?.page || 1;
      const pageKey = q.page + ':' + (script === 'tajweed' ? 'quran-tajweed' : 'quran-uthmani');
      if (!mushafPageCache[pageKey] && !mushafErrors[pageKey] && !mushafRequests[pageKey]) loadMushafPage(q.page, script, () => callbacks?.render());
    }
    const verses = data?.verses || [];
    const bookmarks = q.bookmarks;
    const readerVerses = verses.map(v => verseHtml(v, bookmarks.includes(v.key), q.focus?.key === v.key ? q.focus.index : -1, verseTajweedEnabled ? tajweedSurahData[id]?.[v.numberInSurah] : null)).join('');
    const page = Number(q.page || data?.verses[0]?.page || 1), pageKey = page + ':' + (script === 'tajweed' ? 'quran-tajweed' : 'quran-uthmani');
    const pageData = mushafPageCache[pageKey];
    const mushafText = pageData?.ayahs.map(v => '<span class="mushaf-ayah" data-ayah-key="'+esc((v.surah?.number || id)+':'+v.numberInSurah)+'">'+(script === 'tajweed' ? formatTajweed(v.text) : esc(v.text))+' <span class="mushaf-ayah-marker">۞ '+esc(v.numberInSurah)+'</span></span>').join(' ') || '';
    const modeButton = mode => '<button class="reader-mode '+(selectedMode===mode?'selected':'')+'" data-reader-mode="'+mode+'">'+(mode==='mushaf'?'Mushaf pages':'Verse by verse')+'</button>';
    const top = '<div class="page quran-page"><div class="quran-heading"><div><span class="eyebrow">READ, LISTEN, RETURN</span><h1>The Qur’an<span style="color:#9eaa74">.</span></h1><p class="subheading">A quiet space for your recitation and reflection.</p></div>'+(selectedMode === 'verse' ? '<button class="button secondary" data-quran-bookmarks>♡ Saved ayahs ('+bookmarks.length+')</button>' : '')+'</div><section class="panel reader-toolbar">'+surahSearchMarkup(chapter)+'<div class="reader-modes">'+modeButton('mushaf')+modeButton('verse')+'</div>'+(selectedMode === 'mushaf' ? '<label class="mushaf-script-label" for="mushaf-script">Script<select id="mushaf-script" class="text-input"><option value="uthmani" '+(script==='uthmani'?'selected':'')+'>Uthmani Mushaf</option><option value="tajweed" '+(script==='tajweed'?'selected':'')+'>Tajweed color-coded</option></select></label>' : '<button type="button" class="button secondary tajweed-toggle '+(verseTajweedEnabled?'active':'')+'" data-toggle-tajweed aria-pressed="'+verseTajweedEnabled+'">۞ Show Tajweed rules</button>')+'</section>';
    const tajweedPanel = verseTajweedEnabled ? '<section class="tajweed-rules-panel" aria-label="Tajweed color key"><div class="tajweed-rules-heading"><strong>Tajweed color key</strong><span>'+(tajweedSurahErrors[id]?'Color-coded text is unavailable.':tajweedSurahData[id]?'Verified color-coded text is on.':'Loading verified color-coded text…')+'</span></div>'+Object.values(tajweedRules).map(rule=>'<span class="tajweed-key-item"><i style="background:'+rule[1]+'"></i>'+esc(rule[2])+'</span>').join('')+(tajweedSurahErrors[id]?'<button type="button" class="text-button" data-retry-tajweed>Retry</button>':'')+'</section>' : '';
    if (selectedMode === 'mushaf') {
      const error = mushafErrors[pageKey];
      return top+(pageData ? '<section class="mushaf-book-page" dir="rtl" lang="ar" aria-label="Qur’an Mushaf page '+page+'"><div class="mushaf-page-heading">'+(script==='tajweed'?'<span class="tajweed-edition-label">Color-coded Tajweed edition</span>':'<span>الرَّسْمُ العُثْمَانِيّ</span>')+'</div><div class="mushaf-page-text">'+mushafText+'</div><div class="mushaf-page-number" dir="ltr">'+page+'</div></section>' : '<section class="panel reader-loading">'+(error?'<p>This page could not be loaded.</p><button class="button secondary" data-retry-page>Retry page '+page+'</button>':'Loading Mushaf page '+page+'…')+'</section>')+'<nav class="mushaf-pagination" dir="ltr" aria-label="Mushaf pages"><button class="button secondary" data-page-step="-1" '+(page<=1?'disabled':'')+'>← Previous</button><label for="mushaf-page-select">Page<select id="mushaf-page-select" class="text-input">'+Array.from({length:604},(_,i)=>'<option value="'+(i+1)+'" '+(page===i+1?'selected':'')+'>'+(i+1)+'</option>').join('')+'</select> of 604</label><button class="button secondary" data-page-step="1" '+(page>=604?'disabled':'')+'>Next →</button></nav></div>';
    }
    return top+tajweedPanel+(chapter?'<section class="surah-title"><span class="surah-ornament">۞</span><div><span class="eyebrow">SURAH '+String(chapter.number).padStart(3,'0')+'</span><h2>'+esc(chapter.englishName)+'</h2><p>'+esc(chapter.englishNameTranslation)+' · '+chapter.numberOfAyahs+' ayahs · '+esc(chapter.revelationType)+'</p></div><div class="surah-arabic" lang="ar" dir="rtl">'+esc(chapter.name)+'</div></section>':'')+'<div class="reader-source-line">Arabic text and Saheeh International meaning · <a href="https://alquran.cloud/api" target="_blank" rel="noopener noreferrer">Al Quran Cloud source ↗</a></div>'+(q.showBookmarks?'<section class="bookmark-list" aria-label="Saved ayahs">'+(bookmarks.length?bookmarks.map(key=>'<button class="bookmark-link" data-open-bookmark="'+esc(key)+'">'+esc(key)+' ↗</button>').join(''):'<p>No ayahs saved yet.</p>')+'</section>':'')+(data ? '<audio class="quran-audio" controls preload="none" aria-label="Qur’an recitation playback"></audio><section class="quran-verses" dir="rtl" lang="ar">'+(readerVerses||'<div class="reader-empty" dir="ltr">No verses available for this surah.</div>')+'</section><p class="reader-credit">Translation: Saheeh International. Interpretive translations are meanings of the Qur’an, not the Arabic text.</p>' : '<section class="panel reader-loading">'+(readerErrors[id]?'<button class="button secondary" data-retry-surah>Retry loading this surah</button>':'Loading this surah…')+'</section>')+'</div>';
  }
  function renderTafsir(q) {
    const key = String(q.tafsirKey), match = /^([1-9]\d?):([1-9]\d*)$/.exec(key);
    if (!match || Number(match[1]) > 114) return '<div class="page quran-page"><button class="button secondary" data-tafsir-back>← Back to verses</button><section class="panel reader-loading">That ayah reference is not valid.</section></div>';
    const surahId=Number(match[1]),ayahNumber=Number(match[2]),chapter=chapters?.find(item=>item.number===surahId),verse=readerData[surahId]?.verses.find(item=>item.numberInSurah===ayahNumber),entry=tafsirCache[key];
    if (!entry && !tafsirErrors[key] && !tafsirRequests[key]) loadTafsir(key,()=>callbacks?.render());
    const link='https://quran.com/'+key+'/tafsirs/en-tafisr-ibn-kathir';
    return '<div class="page quran-page tafsir-page"><div class="tafsir-page-heading"><button class="button secondary" data-tafsir-back>← Back to verses</button><div><span class="eyebrow">QUR’AN COMMENTARY</span><h1>Tafsir Ibn Kathir<span style="color:#9eaa74">.</span></h1><p class="subheading">'+esc(chapter?.englishName||'Surah '+surahId)+' · Ayah '+ayahNumber+'</p></div></div>'+(verse?'<section class="panel tafsir-verse-context"><div class="tafsir-context-reference">'+esc(key)+'</div><p class="tafsir-context-arabic" dir="rtl" lang="ar">'+esc(verse.text)+'</p><p class="tafsir-context-translation">'+esc(verse.translation.replace(/<[^>]*>/g,''))+'</p></section>':'')+'<section class="panel tafsir-content-panel"><div class="tafsir-source-heading"><div><span class="eyebrow">DETAILED EXPLANATION</span><h2>Ibn Kathir <span>(abridged English)</span></h2></div><span class="tafsir-source-mark" aria-hidden="true">۞</span></div>'+(entry?'<article class="tafsir-content">'+safeTafsirHtml(entry.text)+'</article>':tafsirErrors[key]?'<div class="tafsir-error" role="status"><p>'+esc(tafsirErrors[key])+'</p><button class="button secondary" data-tafsir-retry>Retry tafsir</button></div>':'<div class="reader-loading" role="status" aria-live="polite">Loading verified Ibn Kathir commentary…</div>')+'<footer class="tafsir-attribution">Source: <a href="'+link+'" target="_blank" rel="noopener noreferrer">Quran.com · Tafsir Ibn Kathir (abridged) ↗</a></footer></section></div>';
  }
  function verseHtml(v, bookmarked, focusIndex, tajweedText) {
    const plainWords=v.text.split(/\s+/);
    const words = tajweedText ? formatTajweedWords(tajweedText,v,focusIndex) : plainWords.map((word,i)=>'<button class="arabic-word '+(i===focusIndex?'word-focused':'')+'" data-word="'+i+'" data-verse="'+esc(v.key)+'" aria-label="Focus Arabic word '+(i+1)+' in ayah '+esc(v.key)+'">'+esc(word)+'</button>').join(' ');
    const audioButton = v.audio ? '<button class="verse-action" data-play-verse="'+esc(v.audio)+'" aria-label="Play ayah '+esc(v.key)+'">▶ Listen</button>' : '';
    return '<article class="quran-verse" id="ayah-'+esc(v.key.replace(':','-'))+'" data-ayah-key="'+esc(v.key)+'"><div class="ayah-actions" dir="ltr"><span class="ayah-number">'+esc(v.key)+'</span>'+audioButton+'<button class="verse-action tafsir-action" data-tafsir="'+esc(v.key)+'" aria-label="Open Tafsir Ibn Kathir for ayah '+esc(v.key)+'"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 4.5c2.4-.8 4.7-.5 7 1v11c-2.3-1.5-4.6-1.8-7-1zM17 4.5c-2.4-.8-4.7-.5-7 1v11c2.3-1.5 4.6-1.8 7-1z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg><span>Tafsir</span></button><button class="verse-action '+(bookmarked?'saved':'')+'" data-bookmark="'+esc(v.key)+'" aria-label="'+(bookmarked?'Remove bookmark':'Bookmark')+' '+esc(v.key)+'">'+(bookmarked?'♥ Saved':'♡ Save')+'</button><button class="verse-action" data-read-position="'+esc(v.key)+'" aria-label="Save reading position at '+esc(v.key)+'">↗ Set last read</button></div><p class="arabic-verse" dir="rtl">'+words+' <span class="ayah-end">۞ '+esc(v.numberInSurah)+'</span></p><p class="verse-translation" dir="ltr">'+esc(v.translation.replace(/<[^>]*>/g,''))+'</p>'+(focusIndex>=0?'<div class="word-context" dir="ltr"><strong>Word '+(focusIndex+1)+' selected</strong><span>Arabic word focus · the translation below is for the complete ayah.</span></div>':'')+'</article>';
  }
  function bindHome(context) {
    callbacks=context; const loc=context.state.profile?.location; if (loc?.city && loc?.country) requestPrayer(loc,context.render);
    bindTasbeeh(context);
    clearTimeout(dailyRefreshTimer);
    const now=new Date(), next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,1);
    dailyRefreshTimer=setTimeout(()=>context.render(),Math.max(1000,next.getTime()-now.getTime()));
  }
  function bindDhikr(context) { callbacks=context; bindTasbeeh(context); }
  function bindTasbeeh(context) {
    document.querySelectorAll('[data-tasbeeh-tap]').forEach(button => button.addEventListener('click', () => {
      const item=ensureTasbeeh(context.state).find(entry=>entry.id===button.dataset.tasbeehTap); if(!item)return;
      item.count=(Number.isSafeInteger(item.count)&&item.count>=0?item.count:0)+1; recordTasbeehCount(context.state,item); save(); context.render();
    }));
    document.querySelectorAll('[data-tasbeeh-delete]').forEach(button => button.addEventListener('click', () => {
      context.state.tasbeeh=ensureTasbeeh(context.state).filter(item=>item.id!==button.dataset.tasbeehDelete); save(); context.render();
    }));
    document.querySelector('[data-tasbeeh-form]')?.addEventListener('submit', event => {
      event.preventDefault(); const input=event.currentTarget.elements.name, name=input.value.trim(); if(!name)return;
      addDhikrCounter(context.state,name); save(); context.render();
    });
  }
  function bindProfile(context) {
    callbacks=context;
    document.querySelector('[data-save-location]')?.addEventListener('click', () => {
      const city=document.getElementById('prayer-city').value.trim(), country=document.getElementById('prayer-country').value.trim(), method=Number(document.getElementById('prayer-method').value);
      if(!city||!country){context.toast('Enter both your city and country.');return;}
      context.state.profile ||= {}; context.state.profile.location={city,country,method,methodName:({1:'University of Islamic Sciences, Karachi',2:'ISNA',3:'Muslim World League',4:'Umm Al-Qura, Makkah',5:'Egyptian General Authority'})[method]};
      prayerData=null;prayerKey='';save();context.toast('Prayer location saved');context.render();
    });
  }
  function bindQuran(context) {
    callbacks=context; const q=ensure(context.state); q.mushafScript ||= 'uthmani';
    const renderAtCurrentPosition=()=>{const top=window.scrollY;context.render();window.scrollTo(0,top);};
    const surahInput=document.getElementById('surah-search-input'),surahResults=document.getElementById('surah-search-results');let activeSurahOption=-1;
    const drawSurahResults=()=>{if(!surahInput||!surahResults)return;const query=surahInput.value.trim();if(!query){surahResults.hidden=true;surahInput.setAttribute('aria-expanded','false');surahInput.removeAttribute('aria-activedescendant');return}const matches=rankSurahs(query);surahResults.innerHTML=matches.length?matches.map((item,index)=>'<button type="button" role="option" aria-selected="false" id="surah-option-'+item.number+'" class="surah-search-option" data-select-surah="'+item.number+'"><span class="surah-search-number">'+String(item.number).padStart(3,'0')+'</span><span class="surah-search-copy"><strong>'+esc(item.englishName)+'</strong><small>'+esc(item.englishNameTranslation)+'</small></span><span class="surah-search-arabic" lang="ar" dir="rtl">'+esc(item.name)+'</span></button>').join(''):'<div class="surah-search-empty">No close matches. Try another spelling.</div>';surahResults.hidden=false;surahInput.setAttribute('aria-expanded','true');activeSurahOption=-1;};
    surahInput?.addEventListener('input',drawSurahResults);
    surahInput?.addEventListener('keydown',event=>{const options=[...(surahResults?.querySelectorAll('[data-select-surah]')||[])];if(event.key==='Escape'){surahInput.value='';drawSurahResults();return}if(event.key==='ArrowDown'&&options.length){event.preventDefault();activeSurahOption=Math.min(options.length-1,activeSurahOption+1);options.forEach((option,index)=>{option.classList.toggle('active',index===activeSurahOption);option.setAttribute('aria-selected',String(index===activeSurahOption));});surahInput.setAttribute('aria-activedescendant',options[activeSurahOption].id);}if(event.key==='ArrowUp'&&options.length){event.preventDefault();activeSurahOption=Math.max(0,activeSurahOption-1);options.forEach((option,index)=>{option.classList.toggle('active',index===activeSurahOption);option.setAttribute('aria-selected',String(index===activeSurahOption));});surahInput.setAttribute('aria-activedescendant',options[activeSurahOption].id);}if(event.key==='Enter'&&options.length){event.preventDefault();options[activeSurahOption<0?0:activeSurahOption].click();}});
    surahResults?.addEventListener('click',event=>{const option=event.target.closest('[data-select-surah]');if(!option)return;q.lastSurah=Number(option.dataset.selectSurah);q.page=null;q.search='';surahInput.value='';save();context.render();});
    surahInput?.addEventListener('blur',()=>setTimeout(()=>{if(surahResults){surahResults.hidden=true;surahInput.setAttribute('aria-expanded','false');}},140));
    document.querySelector('[data-toggle-tajweed]')?.addEventListener('click',()=>{q.tajweedEnabled=!q.tajweedEnabled;save();context.render();});
    document.querySelector('[data-retry-tajweed]')?.addEventListener('click',()=>{delete tajweedSurahErrors[q.lastSurah];loadTajweedSurah(q.lastSurah,context.render);context.render();});
    document.querySelectorAll('[data-reader-mode]').forEach(button=>button.addEventListener('click',()=>{q.mode=button.dataset.readerMode;save();context.render();}));
    document.querySelectorAll('[data-tafsir]').forEach(button=>button.addEventListener('click',()=>{q.tafsirKey=button.dataset.tafsir;context.render();}));
    document.querySelector('[data-tafsir-back]')?.addEventListener('click',()=>{q.tafsirKey=null;q.mode='verse';context.render();});
    document.querySelector('[data-tafsir-retry]')?.addEventListener('click',()=>{const key=q.tafsirKey;delete tafsirErrors[key];loadTafsir(key,context.render);context.render();});
    document.getElementById('mushaf-script')?.addEventListener('change',event=>{q.mushafScript=event.target.value==='tajweed'?'tajweed':'uthmani';save();context.render();});
    document.querySelector('[data-retry-surah]')?.addEventListener('click',()=>{readerErrors[q.lastSurah]=false;loadSurah(q.lastSurah,context.render).catch(()=>{readerErrors[q.lastSurah]=true;context.render();});context.render();});
    document.querySelector('[data-retry-page]')?.addEventListener('click',()=>{const page=Number(q.page||1),edition=q.mushafScript==='tajweed'?'quran-tajweed':'quran-uthmani',key=page+':'+edition;delete mushafErrors[key];loadMushafPage(page,q.mushafScript,context.render);context.render();});
    const resetMobileMushafScroll=()=>{if(q.mode==='mushaf'&&window.matchMedia('(max-width: 620px)').matches)window.scrollTo(0,0);};
    document.querySelectorAll('[data-page-step]').forEach(button=>button.addEventListener('click',()=>{q.page=Math.min(604,Math.max(1,Number(q.page||1)+Number(button.dataset.pageStep)));save();context.render();resetMobileMushafScroll();}));
    document.getElementById('mushaf-page-select')?.addEventListener('change',event=>{q.page=Math.min(604,Math.max(1,Number(event.target.value)||1));save();context.render();resetMobileMushafScroll();});
    document.querySelectorAll('[data-word]').forEach(button=>button.addEventListener('click',()=>{q.focus={key:button.dataset.verse,index:Number(button.dataset.word)};renderAtCurrentPosition();}));
    document.querySelectorAll('[data-bookmark]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.bookmark;q.bookmarks=q.bookmarks.includes(key)?q.bookmarks.filter(x=>x!==key):[...q.bookmarks,key];save();renderAtCurrentPosition();context.toast(q.bookmarks.includes(key)?'Ayah saved':'Bookmark removed');}));
    document.querySelectorAll('[data-read-position]').forEach(button=>button.addEventListener('click',()=>{const [surahId,ayah]=button.dataset.readPosition.split(':').map(Number),chapter=chapters?.find(x=>x.number===surahId);q.lastSurah=surahId;q.progress={surahId,surahName:chapter?.englishName||'Surah '+surahId,ayah};save();context.toast('Reading position saved');}));
    document.querySelectorAll('[data-play-verse]').forEach(button=>button.addEventListener('click',()=>{const audio=document.querySelector('.quran-audio');if(!audio)return;if(activeAudio===audio&&!audio.paused){audio.pause();return;}activeAudio=audio;audio.src=button.dataset.playVerse;audio.play().catch(()=>context.toast('Audio could not be played. Check your connection.'));}));
    document.querySelector('[data-quran-bookmarks]')?.addEventListener('click',()=>{q.showBookmarks=!q.showBookmarks;context.render();});
    document.querySelectorAll('[data-open-bookmark]').forEach(button=>button.addEventListener('click',()=>{const [surahId,ayah]=button.dataset.openBookmark.split(':').map(Number);q.lastSurah=surahId;q.mode='verse';q.search='';q.showBookmarks=false;context.render();loadSurah(surahId,context.render).then(()=>setTimeout(()=>document.getElementById('ayah-'+surahId+'-'+ayah)?.scrollIntoView({behavior:'smooth',block:'center'}),120)).catch(()=>context.toast('Could not open this saved ayah.'));}));
    if(readObserver)readObserver.disconnect();
    if('IntersectionObserver' in window){readObserver=new IntersectionObserver(entries=>{const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];const key=visible?.target?.dataset.ayahKey;if(key&&key!==lastProgressKey){lastProgressKey=key;const [surahId,ayah]=key.split(':').map(Number),chapter=chapters.find(item=>item.number===surahId);q.lastSurah=surahId;q.progress={surahId,surahName:chapter?.englishName||'Surah '+surahId,ayah};save();}}, {threshold:[.45,.7]});document.querySelectorAll('[data-ayah-key]').forEach(verse=>readObserver.observe(verse));}
  }
  window.BarakahSpiritual={renderHome,renderQuran,renderDhikr,renderTasbeehHistory,addDhikrCounter,dailyNote,bindHome,bindDhikr,bindProfile,bindQuran};
})();
