(() => {
  const API = 'https://api.alquran.cloud/v1';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let chapters = null, chapterRequest = null, chapterFailed = false, readerData = {}, readerErrors = {}, prayerData = null, prayerKey = '';
  let callbacks = null, activeAudio = null, readObserver = null, lastProgressKey = '';
  const ensure = state => { state.quran ||= {bookmarks:[],mode:'verse',lastSurah:1,progress:null}; state.quran.bookmarks ||= []; return state.quran; };
  const save = () => window.BARAKAH_SAVE_STATE?.();
  const apiJson = async url => { const response = await fetch(url); if (!response.ok) throw new Error('Content service returned ' + response.status); const body = await response.json(); if (body.code !== 200 || !body.data) throw new Error(body.status || 'Content could not be loaded'); return body.data; };
  const loadChapters = async render => {
    if (chapters) return chapters;
    if (!chapterRequest) chapterRequest = apiJson(API + '/surah').then(data => chapters = data).finally(() => chapterRequest = null);
    try { await chapterRequest; if (render) render(); } catch { chapterFailed = true; if (render) render(); }
    return chapters;
  };
  const loadSurah = async (id, render) => {
    if (readerData[id]) return readerData[id];
    const [arabic,english,audio] = await Promise.all([
      apiJson(API + '/surah/' + id),
      apiJson(API + '/surah/' + id + '/en.sahih'),
      apiJson(API + '/surah/' + id + '/ar.alafasy')
    ]);
    if (!arabic.ayahs || !english.ayahs || !audio.ayahs) throw new Error('The Quran edition data is incomplete.');
    const verses = arabic.ayahs.map((ayah, i) => ({number:ayah.number, numberInSurah:ayah.numberInSurah, text:ayah.text, page:ayah.page, translation:english.ayahs[i]?.text || '', audio:audio?.ayahs[i]?.audio || '', key:id + ':' + ayah.numberInSurah}));
    readerData[id] = {arabic,english,verses};
    if (render) render();
    return readerData[id];
  };
  function renderHome(state) {
    const q = ensure(state), loc = state.profile?.location;
    if (loc?.city && loc?.country) requestPrayer(loc, () => { if (callbacks?.render && document.querySelector('[data-prayer-card]')) callbacks.render(); });
    const times = prayerData && prayerKey === prayerCacheKey(loc) ? prayerData : null;
    const last = q.progress;
    const names = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];
    const cards = times ? names.map(name => '<div class="prayer-time"><span>'+name+'</span><strong>'+esc(times[name])+'</strong></div>').join('') : '';
    return '<section class="section-heading"><div><h2>Prayer times</h2><p>'+(loc?.city ? esc(loc.city)+', '+esc(loc.country) : 'Set your location for today’s times')+'</p></div><button class="text-button" data-goto="profile">Settings ↗</button></section><section class="panel prayer-panel" data-prayer-card>'+(times ? '<div class="prayer-grid">'+cards+'</div><p class="source-note">Times from AlAdhan · '+esc(loc.methodName || 'Muslim World League')+' calculation</p>' : '<div class="prayer-empty"><span class="prayer-symbol">☾</span><div><strong>'+(loc?.city?'Loading today’s prayer times…':'Make prayer times personal')+'</strong><p>'+(loc?.city?'Prayer times are being fetched for your saved location.':'Choose your city and calculation method in Profile settings.')+'</p></div><button class="button secondary" data-goto="profile">'+(loc?.city?'Refresh settings':'Set location')+' ↗</button></div>')+'</section><section class="section-heading"><div><h2>Continue reading</h2><p>Your last saved Qur’an position</p></div></section><section class="panel continue-card"><div class="continue-mark">۞</div><div class="continue-copy"><strong>'+(last ? esc(last.surahName)+' · Ayah '+esc(last.ayah) : 'Begin with a moment of Qur’an')+'</strong><span>'+(last ? 'Your reading place is saved with your account.' : 'The reader opens with Al-Fātiḥah.')+'</span></div><button class="button primary" data-goto="quran">'+(last?'Resume':'Open reader')+' <span>↗</span></button></section><section class="section-heading"><div><h2>A verified hadith</h2><p>A gentle reminder for today</p></div></section><section class="panel hadith-card"><div class="hadith-mark">“</div><blockquote>Do good deeds properly, sincerely and moderately and know that your deeds will not make you enter Paradise, and that the most beloved deed to Allah is the most regular and constant even if it were little.</blockquote><div class="hadith-source">Narrated by ʿĀ’ishah · Sahih al-Bukhari 6464 · <a href="https://sunnah.com/bukhari:6464" target="_blank" rel="noopener noreferrer">Read the source ↗</a></div></section>';
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
  function renderQuran(state) {
    const q = ensure(state), id = Number(q.lastSurah || q.progress?.surahId || 1);
    if (!chapters) { if(!chapterFailed) loadChapters(() => callbacks?.render()); return '<div class="page"><div class="page-title"><div><span class="eyebrow">THE NOBLE QUR’AN</span><h1>A place to return<span style="color:#9eaa74">.</span></h1><p class="subheading">Verified text and recitation</p></div></div><section class="panel reader-loading">'+(chapterFailed?'The surah list could not be reached. Check your connection, then refresh.':'Connecting to the Arabic text, translation, and recitation source…')+'</section></div>'; }
    if (chapters && !readerData[id] && !readerErrors[id]) { loadSurah(id, () => callbacks?.render()).catch(() => {readerErrors[id]=true;callbacks?.render();}); }
    const chapter = chapters?.find(x => x.number === id), data = readerData[id];
    const selectedMode = q.mode || 'verse';
    const search = q.search || '';
    let verses = data?.verses || [];
    if (selectedMode === 'mushaf' && verses.length) {
      const pages = [...new Set(verses.map(v => v.page))], page = Math.max(0,pages.indexOf(Number(q.page || verses[0].page)));
      const pageNumber = pages[page]; verses = verses.filter(v => v.page === pageNumber);
    }
    if (search && selectedMode === 'verse') verses = verses.filter(v => (v.translation+' '+v.text).toLowerCase().includes(search.toLowerCase()));
    const bookmarks = q.bookmarks;
    const readerVerses = verses.map(v => verseHtml(v, bookmarks.includes(v.key), q.focus?.key === v.key ? q.focus.index : -1)).join('');
    const mushafPages = data ? [...new Set(data.verses.map(v => v.page))] : [];
    const selectedPage = selectedMode === 'mushaf' && mushafPages.length ? Math.max(0,mushafPages.indexOf(Number(q.page || mushafPages[0]))) : 0;
    const modeButton = mode => '<button class="reader-mode '+(selectedMode===mode?'selected':'')+'" data-reader-mode="'+mode+'">'+(mode==='mushaf'?'Mushaf pages':'Verse by verse')+'</button>';
    const loaded = !!data;
    return '<div class="page quran-page"><div class="quran-heading"><div><span class="eyebrow">READ, LISTEN, RETURN</span><h1>The Qur’an<span style="color:#9eaa74">.</span></h1><p class="subheading">A quiet space for your recitation and reflection.</p></div><button class="button secondary" data-quran-bookmarks>♡ Saved ayahs ('+bookmarks.length+')</button></div><section class="panel reader-toolbar"><label class="sr-only" for="surah-select">Choose surah</label><select id="surah-select" class="text-input">'+chapters.map(c=>'<option value="'+c.number+'" '+(c.number===id?'selected':'')+'>'+c.number+'. '+esc(c.englishName)+' · '+esc(c.name)+'</option>').join('')+'</select><div class="reader-modes">'+modeButton('mushaf')+modeButton('verse')+'</div><label class="reader-search"><span>⌕</span><input id="quran-search" type="search" value="'+esc(search)+'" placeholder="Find in this surah" aria-label="Search this surah"/></label></section>'+(chapter?'<section class="surah-title"><span class="surah-ornament">۞</span><div><span class="eyebrow">SURAH '+String(chapter.number).padStart(3,'0')+'</span><h2>'+esc(chapter.englishName)+'</h2><p>'+esc(chapter.englishNameTranslation)+' · '+chapter.numberOfAyahs+' ayahs · '+esc(chapter.revelationType)+'</p></div><div class="surah-arabic" lang="ar" dir="rtl">'+esc(chapter.name)+'</div></section>':'')+'<div class="reader-source-line">Arabic text and Saheeh International meaning · <a href="https://alquran.cloud/api" target="_blank" rel="noopener noreferrer">Al Quran Cloud source ↗</a></div>'+(q.showBookmarks?'<section class="bookmark-list" aria-label="Saved ayahs">'+(bookmarks.length?bookmarks.map(key=>'<button class="bookmark-link" data-open-bookmark="'+esc(key)+'">'+esc(key)+' ↗</button>').join(''):'<p>No ayahs saved yet.</p>')+'</section>':'')+(loaded ? '<audio class="quran-audio" controls preload="none" aria-label="Qur’an recitation playback"></audio><section class="quran-verses '+(selectedMode==='mushaf'?'mushaf-page':'')+'" dir="rtl" lang="ar">'+(readerVerses||'<div class="reader-empty" dir="ltr">No verses match your search in this surah.</div>')+'</section>'+(selectedMode==='mushaf'?'<div class="mushaf-pagination" dir="ltr"><button class="button secondary" data-page-step="-1" '+(selectedPage===0?'disabled':'')+'>← Previous page</button><span>Page '+esc(mushafPages[selectedPage]||'—')+' of '+(mushafPages.length||'—')+'</span><button class="button secondary" data-page-step="1" '+(selectedPage>=mushafPages.length-1?'disabled':'')+'>Next page →</button></div>':'')+'<p class="reader-credit">Translation: Saheeh International. Interpretive translations are meanings of the Qur’an, not the Arabic text.</p>' : '<section class="panel reader-loading">'+(readerErrors[id]?'<button class="button secondary" data-retry-surah>Retry loading this surah</button>':'Loading this surah…')+'</section>')+'</div>';
  }
  function verseHtml(v, bookmarked, focusIndex) {
    const words = v.text.split(/\s+/).map((word,i)=>'<button class="arabic-word '+(i===focusIndex?'word-focused':'')+'" data-word="'+i+'" data-verse="'+v.key+'" aria-label="Focus Arabic word '+(i+1)+' in ayah '+v.key+'">'+esc(word)+'</button>').join(' ');
    const audioButton = v.audio ? '<button class="verse-action" data-play-verse="'+esc(v.audio)+'" aria-label="Play ayah '+esc(v.key)+'">▶ Listen</button>' : '';
    return '<article class="quran-verse" id="ayah-'+esc(v.key.replace(':','-'))+'" data-ayah-key="'+esc(v.key)+'"><div class="ayah-actions" dir="ltr"><span class="ayah-number">'+esc(v.key)+'</span>'+audioButton+'<button class="verse-action '+(bookmarked?'saved':'')+'" data-bookmark="'+esc(v.key)+'" aria-label="'+(bookmarked?'Remove bookmark':'Bookmark')+' '+esc(v.key)+'">'+(bookmarked?'♥ Saved':'♡ Save')+'</button><button class="verse-action" data-read-position="'+esc(v.key)+'" aria-label="Save reading position at '+esc(v.key)+'">↗ Set last read</button></div><p class="arabic-verse" dir="rtl">'+words+' <span class="ayah-end">۞ '+esc(v.numberInSurah)+'</span></p><p class="verse-translation" dir="ltr">'+esc(v.translation.replace(/<[^>]*>/g,''))+'</p>'+(focusIndex>=0?'<div class="word-context" dir="ltr"><strong>Word '+(focusIndex+1)+' selected</strong><span>Arabic word focus · the translation below is for the complete ayah.</span></div>':'')+'</article>';
  }
  function bindHome(context) { callbacks=context; const loc=context.state.profile?.location; if (loc?.city && loc?.country) requestPrayer(loc,context.render); }
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
    callbacks=context; const q=ensure(context.state);
    const renderAtCurrentPosition=()=>{const top=window.scrollY;context.render();window.scrollTo(0,top);};
    document.getElementById('surah-select')?.addEventListener('change', event => {q.lastSurah=Number(event.target.value);q.page=null;q.search='';save();context.render();});
    document.querySelectorAll('[data-reader-mode]').forEach(button=>button.addEventListener('click',()=>{q.mode=button.dataset.readerMode;save();context.render();}));
    document.querySelector('[data-retry-surah]')?.addEventListener('click',()=>{readerErrors[q.lastSurah]=false;loadSurah(q.lastSurah,context.render).catch(()=>{readerErrors[q.lastSurah]=true;context.render();});context.render();});
    document.getElementById('quran-search')?.addEventListener('input',event=>{q.search=event.target.value;const pos=event.target.selectionStart;context.render();const input=document.getElementById('quran-search');input?.focus();input?.setSelectionRange(pos,pos);});
    document.querySelector('[data-page-step]')?.parentElement?.querySelectorAll('[data-page-step]').forEach(button=>button.addEventListener('click',()=>{const pages=[...new Set((readerData[q.lastSurah]?.verses||[]).map(v=>v.page))],index=pages.indexOf(Number(q.page||pages[0]));q.page=pages[index+Number(button.dataset.pageStep)];context.render();}));
    document.querySelectorAll('[data-word]').forEach(button=>button.addEventListener('click',()=>{q.focus={key:button.dataset.verse,index:Number(button.dataset.word)};renderAtCurrentPosition();}));
    document.querySelectorAll('[data-bookmark]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.bookmark;q.bookmarks=q.bookmarks.includes(key)?q.bookmarks.filter(x=>x!==key):[...q.bookmarks,key];save();renderAtCurrentPosition();context.toast(q.bookmarks.includes(key)?'Ayah saved':'Bookmark removed');}));
    document.querySelectorAll('[data-read-position]').forEach(button=>button.addEventListener('click',()=>{const [surahId,ayah]=button.dataset.readPosition.split(':').map(Number),chapter=chapters?.find(x=>x.number===surahId);q.lastSurah=surahId;q.progress={surahId,surahName:chapter?.englishName||'Surah '+surahId,ayah};save();context.toast('Reading position saved');}));
    document.querySelectorAll('[data-play-verse]').forEach(button=>button.addEventListener('click',()=>{const audio=document.querySelector('.quran-audio');if(!audio)return;if(activeAudio===audio&&!audio.paused){audio.pause();return;}activeAudio=audio;audio.src=button.dataset.playVerse;audio.play().catch(()=>context.toast('Audio could not be played. Check your connection.'));}));
    document.querySelector('[data-quran-bookmarks]')?.addEventListener('click',()=>{q.showBookmarks=!q.showBookmarks;context.render();});
    document.querySelectorAll('[data-open-bookmark]').forEach(button=>button.addEventListener('click',()=>{const [surahId,ayah]=button.dataset.openBookmark.split(':').map(Number);q.lastSurah=surahId;q.mode='verse';q.search='';q.showBookmarks=false;context.render();loadSurah(surahId,context.render).then(()=>setTimeout(()=>document.getElementById('ayah-'+surahId+'-'+ayah)?.scrollIntoView({behavior:'smooth',block:'center'}),120)).catch(()=>context.toast('Could not open this saved ayah.'));}));
    if(readObserver)readObserver.disconnect();
    if('IntersectionObserver' in window){readObserver=new IntersectionObserver(entries=>{const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];const key=visible?.target?.dataset.ayahKey;if(key&&key!==lastProgressKey){lastProgressKey=key;const [surahId,ayah]=key.split(':').map(Number),chapter=chapters.find(item=>item.number===surahId);q.lastSurah=surahId;q.progress={surahId,surahName:chapter?.englishName||'Surah '+surahId,ayah};save();}}, {threshold:[.45,.7]});document.querySelectorAll('[data-ayah-key]').forEach(verse=>readObserver.observe(verse));}
  }
  window.BarakahSpiritual={renderHome,renderQuran,bindHome,bindProfile,bindQuran};
})();
