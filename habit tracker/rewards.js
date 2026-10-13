(() => {
  const milestones = [
    { days: 3, title: 'First Steps', tier: 'Seedling', color: '#82966b' },
    { days: 7, title: 'A Steady Week', tier: 'Bronze', color: '#ae7952' },
    { days: 14, title: 'Two Weeks of Intention', tier: 'Silver', color: '#738b92' },
    { days: 30, title: 'A Month of Showing Up', tier: 'Gold', color: '#b9954a' },
    { days: 60, title: 'Growing Roots', tier: 'Emerald', color: '#3f765c' },
    { days: 100, title: 'One Hundred Days', tier: 'Legacy', color: '#856c9a' }
  ];
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const keyFor = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const ordinal = key => { const [y, m, d] = key.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };
  const hasPractice = (state, key) => Object.values(state.logs?.[key] || {}).some(status => status === 'done');

  function bestStreak(state) {
    const days = Object.keys(state.logs || {}).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key) && hasPractice(state, key)).sort();
    let best = 0, run = 0, previous = null;
    for (const key of days) {
      const day = ordinal(key);
      run = previous !== null && day === previous + 1 ? run + 1 : 1;
      best = Math.max(best, run);
      previous = day;
    }
    return best;
  }

  function currentStreak(state) {
    const start = new Date();
    let key = keyFor(start);
    if (!hasPractice(state, key)) {
      start.setDate(start.getDate() - 1);
      key = keyFor(start);
      if (!hasPractice(state, key)) return 0;
    }
    let count = 0;
    while (count < 3660 && hasPractice(state, key)) {
      count++;
      start.setDate(start.getDate() - 1);
      key = keyFor(start);
    }
    return count;
  }

  function rewardSnapshot(state) {
    const best = bestStreak(state);
    return { best, current: currentStreak(state), earned: milestones.filter(item => best >= item.days) };
  }

  function render(state, user) {
    const snapshot = rewardSnapshot(state);
    const next = milestones.find(item => item.days > snapshot.best);
    const progress = next ? Math.min(100, Math.round(snapshot.best / next.days * 100)) : 100;
    const name = user?.user_metadata?.full_name || '';
    const cards = milestones.map(item => {
      const unlocked = snapshot.best >= item.days;
      return `<article class="reward-card ${unlocked ? 'unlocked' : 'locked'}" style="--reward-color:${item.color}">
        <div class="reward-medal" aria-hidden="true"><span>${unlocked ? '✦' : '·'}</span></div>
        <div class="reward-card-copy"><span class="reward-tier">${esc(item.tier)} ${unlocked ? '· EARNED' : '· MILESTONE'}</span><h3>${esc(item.title)}</h3><p>${item.days} consecutive days</p></div>
        ${unlocked ? `<button class="button secondary reward-share" type="button" data-share-badge="${item.days}">Share poster ↗</button>` : `<span class="reward-lock">${item.days} days</span>`}
      </article>`;
    }).join('');
    return `<div class="page rewards-page">
      <div class="page-title"><div><span class="eyebrow">CELEBRATE THE SMALL STEPS</span><h1>Your rewards<span style="color:#9eaa74">.</span></h1><p class="subheading">Gentle milestones for showing up, one day at a time.</p></div></div>
      <section class="reward-hero"><div class="reward-hero-copy"><span class="reward-tier">YOUR PRACTICE STREAK</span><strong>${snapshot.current}<small> days</small></strong><p>${snapshot.current ? 'You are building a steady rhythm. Keep returning with intention.' : 'Complete one intention today to begin your streak.'}</p></div><div class="reward-hero-mark" aria-hidden="true">✳</div></section>
      <section class="panel reward-progress"><div class="reward-progress-top"><div><span class="eyebrow">NEXT MILESTONE</span><h2>${next ? `${next.days} days · ${esc(next.title)}` : 'Every day is a milestone'}</h2></div><strong>${snapshot.best}${next ? ` / ${next.days}` : ' days'}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><p class="reward-rule">A day counts when you complete at least one intention. Rewards are based on your longest daily practice streak.</p></section>
      <div class="section-heading"><div><h2>Milestone collection</h2><p>${snapshot.earned.length} of ${milestones.length} badges earned · Best streak ${snapshot.best} days</p></div></div>
      <div class="reward-grid">${cards}</div>
      ${snapshot.earned.length ? `<section class="panel reward-share-panel"><label class="reward-name-toggle"><input type="checkbox" id="reward-show-name" /> Add my name to shared posters</label><p>Posters include the Barakah name and your milestone. Your name is left off unless you choose to add it.</p></section>` : `<section class="panel reward-share-panel"><div class="insight-note" style="margin:0"><span>♡</span><p><strong>Your first badge is three days away.</strong> Complete one intention each day to earn your first shareable milestone.</p></div></section>`}
    </div>`;
  }

  function drawStar(ctx, cx, cy, radius, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 8;
      const r = i % 2 ? radius * 0.34 : radius;
      const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function posterBlob(item, name) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1350;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Could not create poster image.'));
      const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
      bg.addColorStop(0, '#f7f7f0');
      bg.addColorStop(1, '#e9efe5');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1080, 1350);
      ctx.strokeStyle = '#dce5d7';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 40, 1000, 1270);
      ctx.strokeRect(58, 58, 964, 1234);
      drawStar(ctx, 540, 202, 42, '#274a3b');
      ctx.fillStyle = '#274a3b';
      ctx.textAlign = 'center';
      ctx.font = '700 31px Arial, sans-serif';
      ctx.fillText('barakah.', 540, 286);
      ctx.fillStyle = '#8a9585';
      ctx.font = '600 18px Arial, sans-serif';
      ctx.letterSpacing = '4px';
      ctx.fillText('A SPIRITUAL JOURNEY', 540, 382);
      ctx.letterSpacing = '0px';
      ctx.fillStyle = '#304b3b';
      ctx.font = '500 46px Georgia, serif';
      ctx.fillText(name ? `${name} reached a milestone` : 'A quiet milestone', 540, 486, 900);
      const medalY = 730;
      ctx.beginPath(); ctx.arc(540, medalY, 175, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(540, medalY, 151, 0, Math.PI * 2); ctx.fillStyle = item.color; ctx.fill();
      ctx.beginPath(); ctx.arc(540, medalY, 128, 0, Math.PI * 2); ctx.fillStyle = '#f5f3df'; ctx.fill();
      drawStar(ctx, 540, medalY - 22, 54, item.color);
      ctx.fillStyle = '#274a3b';
      ctx.font = '700 31px Arial, sans-serif';
      ctx.fillText(`${item.days} DAYS`, 540, medalY + 69);
      ctx.fillStyle = '#304b3b';
      ctx.font = '600 37px Georgia, serif';
      ctx.fillText(item.title, 540, 1008, 900);
      ctx.fillStyle = '#778276';
      ctx.font = '400 23px Arial, sans-serif';
      ctx.fillText('Small steps, with intention.', 540, 1060);
      ctx.fillStyle = '#9aa496';
      ctx.font = '400 16px Arial, sans-serif';
      ctx.fillText('A personal reminder to keep returning with care.', 540, 1180);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare the poster.')), 'image/png');
    });
  }

  async function share(item, user, toast) {
    const checkbox = document.querySelector('#reward-show-name');
    const displayName = checkbox?.checked ? (user?.user_metadata?.full_name || '').trim() : '';
    try {
      const blob = await posterBlob(item, displayName);
      const fileName = `barakah-${item.days}-day-badge.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      if (window.barakahAndroid?.postMessage) {
        const imageData = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.readAsDataURL(blob);
        });
        window.barakahAndroid.postMessage(JSON.stringify({ type: 'sharePoster', title: `Barakah · ${item.days}-day milestone`, fileName, imageData }));
        return;
      }
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `Barakah · ${item.days}-day milestone`, text: 'Small steps, with intention.', files: [file] });
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast('Poster downloaded. You can share it from your photos.');
    } catch (error) {
      if (error.name !== 'AbortError') toast(error.message || 'Could not create the poster.');
    }
  }

  function bind({ state, render, toast }) {
    document.querySelectorAll('[data-share-badge]').forEach(button => button.addEventListener('click', async () => {
      const item = milestones.find(value => value.days === Number(button.dataset.shareBadge));
      if (!item || bestStreak(state) < item.days) return;
      button.disabled = true;
      await share(item, window.BARAKAH_USER, toast);
      button.disabled = false;
    }));
  }

  window.BarakahRewards = { render, bind, currentStreak, bestStreak };
})();
