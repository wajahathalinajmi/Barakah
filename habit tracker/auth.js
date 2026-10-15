(() => {
  const root = document.getElementById('auth-root');
  const appShell = document.getElementById('app-shell');
  const config = window.BARAKAH_SUPABASE_CONFIG || {};
  const configured = Boolean(config.url && config.publishableKey);
  let client = null;
  let busy = false;
  let recoveryMode = false;

  const escapeHTML = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const brand = '<div class="auth-brand"><span class="brand-mark">✳</span><span>barakah<span class="brand-period">.</span></span></div>';
  function showMessage(text, error=false) {
    const box = root.querySelector('.auth-message');
    if (!box) return;
    box.textContent = text;
    box.classList.toggle('error', error);
    box.classList.add('visible');
  }
  function paintSetup(message='') {
    appShell.hidden = true;
    root.hidden = false;
    root.innerHTML = `<section class="auth-card">${brand}<span class="eyebrow">YOUR PRIVATE SPACE</span><h1>Connect your account.</h1><p class="auth-intro">Set up Supabase to create a secure account and sync your spiritual journey across devices.</p><div class="auth-setup">Add your Supabase project URL and publishable key to <code>supabase-config.js</code>, then run <code>supabase-schema.sql</code> in your project's SQL Editor. See <code>SUPABASE_SETUP.md</code> for the steps.</div>${message?`<p class="auth-message visible error" style="margin-top:14px">${escapeHTML(message)}</p>`:''}<div class="auth-divider"></div><p class="auth-note">Your publishable key is intended for browser apps. Never put a service role key in the client.</p></section>`;
  }
  function paintForm(mode='signin') {
    appShell.hidden = true;
    root.hidden = false;
    const signup = mode === 'signup';
    const reset = mode === 'reset';
    const recovery = mode === 'recovery';
    const title = signup ? 'Create your account.' : reset ? 'Reset your password.' : recovery ? 'Choose a new password.' : 'Welcome back.';
    const intro = signup ? 'A name for your space, then you can begin your journey.' : reset ? 'We’ll send a secure password reset link to your email.' : recovery ? 'Choose a new password for your Barakah account.' : 'Sign in to continue your spiritual journey.';
    root.innerHTML = `<section class="auth-card">${brand}<span class="eyebrow">YOUR PRIVATE SPACE</span><h1>${title}</h1><p class="auth-intro">${intro}</p><form class="auth-form" data-auth-mode="${mode}">${signup?'<div class="auth-field"><label for="auth-name">Your name</label><input id="auth-name" name="name" autocomplete="name" maxlength="60" required placeholder="How should we greet you?" /></div>':''}<div class="auth-field"><label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com" ${recovery?'disabled':''} /></div>${!reset?`<div class="auth-field"><label for="auth-password">${recovery?'New password':'Password'}</label><input id="auth-password" name="password" type="password" autocomplete="${signup||recovery?'new-password':'current-password'}" minlength="8" required placeholder="At least 8 characters" /></div>`:''}<p class="auth-message" aria-live="polite"></p><button class="button primary auth-submit" type="submit">${signup?'Create account':reset?'Send reset link':recovery?'Update password':'Sign in'} <span>↗</span></button></form>${!signup&&!reset&&!recovery?'<p class="auth-footer"><button class="auth-link" data-auth-action="reset">Forgot password?</button></p>':''}<div class="auth-divider"></div><p class="auth-footer">${signup?'Already have an account?':recovery?'':'New to Barakah?'} <button class="auth-link" data-auth-action="${signup?'signin':'signup'}">${signup?'Sign in':recovery?'Back to sign in':'Create an account'}</button></p><p class="auth-note" style="margin-top:14px">Your reflections and habit history are private to your account.</p></section>`;
    root.querySelector('[data-auth-mode]').addEventListener('submit', submitAuth);
    root.querySelectorAll('[data-auth-action]').forEach(button => button.addEventListener('click', () => paintForm(button.dataset.authAction)));
  }
  function setBusy(form, value) {
    busy = value;
    const button = form.querySelector('button[type="submit"]');
    if (button) { button.disabled = value; button.style.opacity = value ? '.65' : ''; }
  }
  async function submitAuth(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const mode = form.dataset.authMode;
    const values = new FormData(form);
    const email = String(values.get('email') || '').trim();
    const password = String(values.get('password') || '');
    setBusy(form, true);
    try {
      if (mode === 'signup') {
        const {data,error} = await client.auth.signUp({email,password,options:{data:{full_name:String(values.get('name')||'').trim()},emailRedirectTo:location.href.split('#')[0]}});
        if (error) throw error;
        if (data.session) await openTracker(data.user);
        else showMessage('Account created. Check your inbox for a confirmation link, then come back here to sign in.');
      } else if (mode === 'signin') {
        const {data,error} = await client.auth.signInWithPassword({email,password});
        if (error) throw error;
        await openTracker(data.user);
      } else if (mode === 'reset') {
        const {error} = await client.auth.resetPasswordForEmail(email,{redirectTo:location.href.split('#')[0]});
        if (error) throw error;
        showMessage('If an account uses that address, a password reset link is on its way.');
      } else if (mode === 'recovery') {
        const {error} = await client.auth.updateUser({password});
        if (error) throw error;
        const {data} = await client.auth.getUser();
        await openTracker(data.user);
      }
    } catch (error) {
      showMessage(error.message || 'We could not complete that request. Please try again.', true);
    } finally {
      if (form.isConnected) setBusy(form, false);
    }
  }
  async function openTracker(user) {
    const {data,error} = await client.from('user_tracker_data').select('data').eq('user_id',user.id).maybeSingle();
    if (error) {
      paintForm('signin');
      showMessage(`Could not load your private tracker data: ${error.message}. Check the Supabase SQL setup.`,true);
      return;
    }
    window.BARAKAH_INITIAL_STATE = data?.data && Array.isArray(data.data.habits) && data.data.logs ? data.data : {habits:[],logs:{}};
    window.BARAKAH_USER = user;
    window.BARAKAH_UPDATE_PROFILE = async fullName => {
      const {data,error} = await client.auth.updateUser({data:{full_name:fullName}});
      if (error) throw error;
      window.BARAKAH_USER = data.user;
      return data.user;
    };
    let persistQueue = Promise.resolve();
    window.BARAKAH_PERSIST = state => {
      const snapshot = JSON.parse(JSON.stringify(state));
      persistQueue = persistQueue.catch(() => {}).then(() => client.from('user_tracker_data').upsert({user_id:user.id,data:snapshot,updated_at:new Date().toISOString()},{onConflict:'user_id'}));
      return persistQueue;
    };
    window.BARAKAH_SIGNOUT = async () => {
      const {error:signOutError} = await client.auth.signOut();
      if (signOutError) throw signOutError;
      window.location.reload();
    };
    root.hidden = true;
    appShell.hidden = false;
    const script = document.createElement('script');
    script.src = 'app.js';
    script.onerror = () => paintSetup('Could not load the tracker interface. Refresh the page and try again.');
    document.body.appendChild(script);
  }
  async function start() {
    if (!configured) { paintSetup(); return; }
    if (!window.supabase?.createClient) { paintSetup('Supabase could not load. Check your internet connection and refresh.'); return; }
    try { client = window.supabase.createClient(config.url,config.publishableKey); }
    catch { paintSetup('The Supabase URL or publishable key is not valid. Check supabase-config.js.'); return; }
    client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') { recoveryMode = true; paintForm('recovery'); }
    });
    const {data,error} = await client.auth.getSession();
    if (error) { paintForm(); showMessage(error.message,true); return; }
    if (recoveryMode) return;
    if (data.session?.user) await openTracker(data.session.user);
    else paintForm();
  }
  start();
})();
