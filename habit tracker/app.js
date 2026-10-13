(() => {
  const KEY = 'barakah-habit-tracker-v1';
  const iconSet = ['☾','◉','✦','♡','⌁','☼','✧','❋','⌂','◌','❀','◈'];
  const seed = [
    {id:'fajr',name:'Fajr prayer',category:'Prayer',goal:'On time',icon:'☾'},
    {id:'quran',name:'Read Qur’an',category:'Qur’an',goal:'10 minutes',icon:'◉'},
    {id:'dhikr',name:'Morning adhkar',category:'Dhikr',goal:'After Fajr',icon:'✦'},
    {id:'kindness',name:'An act of kindness',category:'Character',goal:'Big or small',icon:'♡'},
    {id:'learn',name:'Learn something beneficial',category:'Learning',goal:'A few minutes',icon:'⌁'}
  ];
  const today = new Date();
  let state = load();
  let selectedDate = dayKey(today);
  let activeView = 'today';
  let editingId = null;
  let selectedIcon = iconSet[0];
  let toastTimer;
  const $ = (s,root=document) => root.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function dayKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function load(){if(window.BARAKAH_INITIAL_STATE)return JSON.parse(JSON.stringify(window.BARAKAH_INITIAL_STATE));try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&Array.isArray(v.habits)&&v.logs)return v}catch{}return {habits:seed,logs:{}}}
  function save(){if(!window.BARAKAH_USER)localStorage.setItem(KEY,JSON.stringify(state));if(window.BARAKAH_PERSIST)window.BARAKAH_PERSIST(state).then(({error})=>{if(error)toast('Cloud sync failed. Your latest changes may not be saved.')}).catch(()=>toast('Cloud sync failed. Your latest changes may not be saved.'))}
  function fmtDate(d,opt={weekday:'long',month:'long',day:'numeric'}){return d.toLocaleDateString(undefined,opt)}
  function selected(){const [y,m,d]=selectedDate.split('-').map(Number);return new Date(y,m-1,d)}
  function getStatus(date,id){return state.logs[date]?.[id]||''}
  function setStatus(date,id,status){state.logs[date] ||= {}; if(status)state.logs[date][id]=status;else delete state.logs[date][id];save()}
  function completedCount(date){return state.habits.filter(h=>getStatus(date,h.id)==='done').length}
  function streak(id){let d=new Date();let n=0;for(let i=0;i<366;i++){const k=dayKey(d);if(getStatus(k,id)!=='done')break;n++;d.setDate(d.getDate()-1)}return n}
  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2300)}
  function render(){
    $('#top-date').textContent=fmtDate(today,{month:'short',day:'numeric',year:'numeric'});
    const titles={today:'MY DAY',insights:'INSIGHTS',habits:'MY HABITS',rewards:'REWARDS'};$('#section-title').textContent=titles[activeView];
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===activeView));
    const user=window.BARAKAH_USER;if(user){const name=user.user_metadata?.full_name||'My journey';$('.profile .avatar').textContent=(name.trim()[0]||'M').toUpperCase();$('.profile strong').textContent=name;$('.profile span').textContent=user.email||'Signed in';$('.profile').title='Click to sign out'}
    const container=$('#view-container');
    if(activeView==='today')container.innerHTML=renderToday();
    if(activeView==='insights')container.innerHTML=renderInsights();
    if(activeView==='habits')container.innerHTML=renderHabits();
    if(activeView==='rewards')container.innerHTML=window.BarakahRewards.render(state,window.BARAKAH_USER);
    bindView();
    if(activeView==='rewards')window.BarakahRewards.bind({state,render,toast});
    if(activeView==='insights')drawChart();
  }
  function renderToday(){
    const date=selected(), key=selectedDate, done=completedCount(key), total=state.habits.length, pct=total?Math.round(done/total*100):0;
    const isToday=key===dayKey(today);
    const habitHtml=state.habits.map((h,i)=>{const status=getStatus(key,h.id);return `<article class="habit-card stagger"><div class="habit-symbol">${esc(h.icon)}</div><div class="habit-info"><strong>${esc(h.name)}</strong><span>${esc(h.goal||h.category)}</span></div><div class="habit-meta"><span class="habit-streak">${streak(h.id)?`<b>✦ ${streak(h.id)}</b> day streak`:''}</span><button class="check-button ${status}" data-check="${esc(h.id)}" aria-label="${status==='done'?'Mark incomplete':'Mark complete'}: ${esc(h.name)}" title="Click to mark complete">${status==='done'?'✓':status==='partial'?'•':''}</button></div></article>`}).join('');
    return `<div class="page"><div class="greeting-row"><div><span class="eyebrow">A MOMENT FOR WHAT MATTERS</span><h1>${isToday?greeting():fmtDate(date,{weekday:'long'})}<span>.</span></h1><p class="subheading">Show up with intention. Every small step counts.</p></div><div class="day-controls"><button class="day-nav" data-day="-1" aria-label="Previous day">‹</button><span class="day-label">${isToday?'Today':fmtDate(date,{month:'short',day:'numeric'})}</span><button class="day-nav" data-day="1" aria-label="Next day" ${isToday?'disabled':''}>›</button></div></div>
      <section class="streak-banner"><div class="streak-icon">✦</div><div class="streak-copy"><strong>${done===total&&total?'A beautiful day of showing up.':'Your journey, one intention at a time.'}</strong><p>${done===total&&total?'Alhamdulillah — you honored every intention today.':'There is no perfect day. Just the next good choice.'}</p></div><div class="streak-count"><strong>${longestCurrentStreak()}</strong><span>DAY STREAK</span></div></section>
      <div class="section-heading"><div><h2>Your intentions</h2><p>${isToday?'A gentle check-in for today':`A look back at ${fmtDate(date,{month:'long',day:'numeric'})}`}</p></div><button class="text-button" data-goto="habits">Manage habits ↗</button></div>
      <div class="habit-list">${habitHtml||`<div class="empty-state"><div class="empty-icon">✧</div><h3>Begin with an intention</h3><p>Add a spiritual practice that feels meaningful to you. You can adjust it whenever your journey changes.</p><button class="button primary" data-action="add">Add your first habit <span>↗</span></button></div>`}</div>
      ${total?`<section class="progress-strip"><div><div class="progress-copy"><span>Today’s progress</span><strong>${done} of ${total} intentions</strong></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div><div class="progress-ring" style="--progress:${pct*3.6}deg"><span>${pct}%</span></div></section>`:''}
      <div class="section-heading"><div><h2>A note for today</h2><p>Gentle reminders for the journey</p></div></div><div class="panel" style="padding:15px 17px"><div class="insight-note" style="margin:0"><span>☼</span><p><strong>Progress over perfection.</strong> Your spiritual journey is personal. A missed day is simply an invitation to begin again, with mercy and intention.</p></div></div>
    </div>`;
  }
  function greeting(){const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening'}
  function longestCurrentStreak(){return window.BarakahRewards.currentStreak(state)}
  function getLast7(){return Array.from({length:7},(_,i)=>{let d=new Date();d.setDate(d.getDate()-(6-i));return {date:d,key:dayKey(d),label:d.toLocaleDateString(undefined,{weekday:'short'})}})}
  function renderInsights(){
    const days=getLast7(), totalPossible=state.habits.length*7, done=days.reduce((n,d)=>n+completedCount(d.key),0), rate=totalPossible?Math.round(done/totalPossible*100):0;
    const previous=days.slice(0,6).reduce((n,d)=>n+completedCount(d.key),0), best=Math.max(0,...days.map(d=>completedCount(d.key)));
    const cats=[...new Set(state.habits.map(h=>h.category))].slice(0,5).map(cat=>{const items=state.habits.filter(h=>h.category===cat);const c=days.reduce((n,d)=>n+items.filter(h=>getStatus(d.key,h.id)==='done').length,0);return {cat,pct:items.length?Math.round(c/(items.length*7)*100):0}});
    const hist=state.habits.slice(0,6).map(h=>`<div class="history-row"><span>${esc(h.name)}</span>${days.map(d=>{const s=getStatus(d.key,h.id);return `<span class="history-dot ${s==='done'?'high':s==='partial'?'mid':''}" title="${esc(d.label)} · ${s||'not logged'}"></span>`}).join('')}</div>`).join('');
    return `<div class="page"><div class="page-title"><div><span class="eyebrow">YOUR JOURNEY, IN PERSPECTIVE</span><h1>Small steps, <span style="color:#9eaa74">steady growth.</span></h1><p class="subheading">A kind look at your practice over the last seven days.</p></div></div>
    <div class="stats-grid"><div class="stat-card"><span class="stat-label">Intentions kept</span><strong>${rate}%</strong><small>of your weekly check-ins</small></div><div class="stat-card"><span class="stat-label">Practices today</span><strong>${completedCount(dayKey(today))}<span style="color:#a0a99b;font-size:13px"> / ${state.habits.length}</span></strong><small>small steps add up</small></div><div class="stat-card"><span class="stat-label">Best day this week</span><strong>${best}</strong><small>intentions completed</small></div><div class="stat-card"><span class="stat-label">Active intentions</span><strong>${state.habits.length}</strong><small>your personal practice</small></div></div>
    <div class="analytics-grid"><section class="panel"><div class="panel-head"><div><h3>Your consistency</h3><p>Daily practices completed</p></div><select class="range-select" aria-label="Chart range"><option>Last 7 days</option></select></div><div class="chart-wrap"><canvas id="trend-chart" aria-label="Habit completion trend for the last seven days"></canvas></div></section><section class="panel"><div class="panel-head"><div><h3>By intention</h3><p>Weekly completion by category</p></div></div><div class="category-bars">${cats.length?cats.map(c=>`<div class="category-row"><span>${esc(c.cat)}</span><div class="category-track"><div class="category-fill" style="width:${c.pct}%"></div></div><b>${c.pct}%</b></div>`).join(''):`<p class="subheading">Add habits to see your category trends.</p>`}</div><div class="insight-note"><span>✦</span><p><strong>${rate>=70?'Consistency is taking root.':rate>0?'Every check-in is a beginning.':'Start where you are.'}</strong> ${rate>=70?'Your regular effort is a beautiful thing to notice.':rate>0?'Notice what feels supportive and keep returning to it.':'Choose one small practice for today.'}</p></div></section></div>
    <section class="panel history-panel"><div class="panel-head"><div><h3>Practice rhythm</h3><p>Each square is one day of your journey</p></div></div><div class="history-row history-header"><span>Habit</span>${days.map(d=>`<span style="text-align:center">${d.label.slice(0,1)}</span>`).join('')}</div>${hist||'<p class="subheading">Create a habit to begin your history.</p>'}</section>
    </div>`;
  }
  function renderHabits(){return `<div class="page"><div class="page-title"><div><span class="eyebrow">SHAPE A PRACTICE THAT FITS YOU</span><h1>Your intentions<span style="color:#9eaa74">.</span></h1><p class="subheading">Add, edit, or let go of habits as your journey evolves.</p></div><button class="button primary" data-action="add">＋ Add habit</button></div><div class="section-heading" style="margin-top:0"><div><h2>${state.habits.length} ${state.habits.length===1?'intention':'intentions'}</h2><p>Your practices are personal and can change over time.</p></div></div><div class="habits-manage">${state.habits.map(h=>`<article class="manage-card"><div class="habit-symbol">${esc(h.icon)}</div><div class="habit-info"><strong>${esc(h.name)}</strong><span>${esc(h.category)}${h.goal?' · '+esc(h.goal):''}</span></div><div class="manage-actions"><button class="small-action" data-edit="${esc(h.id)}" aria-label="Edit ${esc(h.name)}" title="Edit">✎</button><button class="small-action delete" data-delete="${esc(h.id)}" aria-label="Delete ${esc(h.name)}" title="Delete">×</button></div></article>`).join('')||`<div class="empty-state"><div class="empty-icon">✧</div><h3>Your journey starts here</h3><p>Add a meaningful practice to begin building your personal tracker.</p><button class="button primary" data-action="add">Add your first habit <span>↗</span></button></div>`}</div><div class="panel" style="margin-top:18px"><div class="insight-note" style="margin:0"><span>♡</span><p><strong>Make room for what matters.</strong> A good habit is one that brings meaning to your own life. Keep it small enough to return to.</p></div></div></div>`}
  function bindView(){
    document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{activeView=b.dataset.view;render()});
    document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>{activeView=b.dataset.goto;render()});
    document.querySelectorAll('[data-action="add"]').forEach(b=>b.onclick=()=>openDialog());
    document.querySelectorAll('[data-check]').forEach(b=>b.onclick=()=>{const id=b.dataset.check;setStatus(selectedDate,id,getStatus(selectedDate,id)==='done'?'':'done');render()});
    document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{const d=selected();d.setDate(d.getDate()+Number(b.dataset.day));if(dayKey(d)<=dayKey(today)){selectedDate=dayKey(d);render()}});
    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openDialog(b.dataset.edit));
    document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteHabit(b.dataset.delete));
    const profile=$('.profile');if(profile&&window.BARAKAH_SIGNOUT)profile.onclick=async()=>{if(!confirm('Sign out of your Barakah account?'))return;try{await window.BARAKAH_SIGNOUT()}catch{toast('Could not sign out. Please try again.')}};
  }
  function openDialog(id=null){editingId=id;const h=id?state.habits.find(x=>x.id===id):null;$('#dialog-title').textContent=h?'Edit habit':'Create a habit';$('#habit-name').value=h?.name||'';$('#habit-category').value=h?.category||'Prayer';$('#habit-goal').value=h?.goal||'';selectedIcon=h?.icon||iconSet[0];$('#save-habit').innerHTML=h?'Save changes <span>↗</span>':'Save habit <span>↗</span>';$('#icon-choices').innerHTML=iconSet.map(icon=>`<button type="button" class="icon-choice ${icon===selectedIcon?'selected':''}" data-icon="${icon}" aria-label="Choose ${icon}">${icon}</button>`).join('');document.querySelectorAll('[data-icon]').forEach(b=>b.onclick=()=>{selectedIcon=b.dataset.icon;document.querySelectorAll('[data-icon]').forEach(x=>x.classList.toggle('selected',x===b))});$('#habit-dialog').showModal();setTimeout(()=>$('#habit-name').focus(),60)}
  function deleteHabit(id){const h=state.habits.find(x=>x.id===id);if(!h)return;if(!confirm(`Remove “${h.name}” and its check-in history?`))return;state.habits=state.habits.filter(x=>x.id!==id);Object.values(state.logs).forEach(log=>delete log[id]);save();render();toast('Habit removed')}
  function drawChart(){const canvas=$('#trend-chart');if(!canvas)return;const box=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;canvas.width=box.width*dpr;canvas.height=box.height*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const w=box.width,h=box.height,days=getLast7(),max=Math.max(3,state.habits.length),left=26,right=12,top=12,bottom=27,cw=w-left-right,ch=h-top-bottom;ctx.font='9px DM Sans';ctx.textBaseline='middle';for(let i=0;i<=3;i++){const y=top+ch-(ch*i/3);ctx.strokeStyle='#edf0e9';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();ctx.fillStyle='#a0a69b';ctx.textAlign='right';ctx.fillText(Math.round(max*i/3),left-8,y)}const points=days.map((d,i)=>({x:left+(days.length===1?0:cw*i/(days.length-1)),y:top+ch-(completedCount(d.key)/max)*ch,label:d.label}));ctx.strokeStyle='#83946d';ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();points.forEach(p=>{ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#83946d';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#929b90';ctx.textAlign='center';ctx.fillText(p.label,p.x,h-10)})}
  $('#habit-form').addEventListener('submit',e=>{e.preventDefault();const name=$('#habit-name').value.trim();if(!name)return;const payload={name,category:$('#habit-category').value,goal:$('#habit-goal').value.trim(),icon:selectedIcon};if(editingId){Object.assign(state.habits.find(h=>h.id===editingId),payload);toast('Habit updated')}else{state.habits.push({id:crypto.randomUUID?.()||String(Date.now()),...payload});toast('A new intention begins')}save();$('#habit-dialog').close();render()});
  $('#close-dialog').onclick=()=>$('#habit-dialog').close();$('#cancel-dialog').onclick=()=>$('#habit-dialog').close();
  $('#today-button').onclick=()=>{selectedDate=dayKey(today);activeView='today';render()};
  window.addEventListener('resize',()=>{if(activeView==='insights')drawChart()});
  render();
})();
