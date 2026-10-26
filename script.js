/* NOX interactions. Local-only personal data; no real authentication or shared reviews. */
(() => {
  "use strict";
  const titles = Array.isArray(window.NOX_TITLES) ? window.NOX_TITLES : [];
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const safeParse = (key, fallback) => { try { const v=JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast("Could not save in this browser."); } };
  const state = {
    type:"All", genre:"All", country:"All", query:"",
    watchlist:safeParse("nox_watchlist",[]), watched:safeParse("nox_watched",[]),
    reviews:safeParse("nox_reviews",[]), collections:safeParse("nox_collections",[]),
    profile:safeParse("nox_profile",null), activeLibrary:"watchlist", detailId:null, rating:0
  };
  const escapeHTML = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const getTitle = id => titles.find(t=>t.id===id);
  let soundEnabled=localStorage.getItem("nox_sound")!=="off";
  function playSound(kind="soft"){
    if(!soundEnabled)return;
    try{const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;const ctx=new Ctx();const now=ctx.currentTime;
      const notes=kind==="success"?[523.25,659.25,783.99]:kind==="save"?[659.25,880]:[440,554.37];
      notes.forEach((freq,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type="sine";osc.frequency.value=freq;gain.gain.setValueAtTime(.0001,now+i*.075);gain.gain.exponentialRampToValueAtTime(.055,now+i*.075+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+i*.075+.16);osc.connect(gain);gain.connect(ctx.destination);osc.start(now+i*.075);osc.stop(now+i*.075+.18);});setTimeout(()=>ctx.close(),600);
    }catch(_){/* Sound is a progressive enhancement; never block an action. */}
  }
  function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");if(/saved|created|added|marked|account|review/i.test(message))playSound(/account|created/i.test(message)?"success":"save");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2300);}
  function posterMarkup(t){
    const alt=escapeHTML(t.title);
    return `<div class="poster-image-wrap"><img class="poster-image" src="${escapeHTML(t.poster||"")}" alt="${alt} poster" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden')"><div class="poster-fallback ${t.poster?'hidden':''}"><small>NOX / ${escapeHTML(t.type.toUpperCase())}</small>${alt}</div><div class="poster-overlay"><div class="poster-actions"><button data-action="watchlist" data-id="${t.id}" aria-label="Add ${alt} to watchlist" title="Add to watchlist">＋</button><button data-action="watched" data-id="${t.id}" aria-label="Mark ${alt} as watched" title="Mark watched">✓</button></div><span class="poster-rating">★ ${Number(t.rating||0).toFixed(1)}</span></div></div>`;
  }
  function cardMarkup(t){return `<article class="poster-card" tabindex="0" role="button" data-open-title="${t.id}" aria-label="View ${escapeHTML(t.title)}"><div>${posterMarkup(t)}</div><div class="poster-info"><h3 class="poster-title">${escapeHTML(t.title)}</h3><div class="poster-meta"><span>${t.year} · ${escapeHTML(t.type)}</span><span class="poster-rating">★ ${Number(t.rating||0).toFixed(1)}</span></div></div></article>`;}
  function matches(t){return (state.type==="All"||t.type===state.type)&&(state.genre==="All"||(t.genres||[]).includes(state.genre))&&(state.country==="All"||t.country===state.country)&&(!state.query||`${t.title} ${t.country} ${t.language} ${(t.genres||[]).join(" ")}`.toLowerCase().includes(state.query.toLowerCase()));}
  function renderGrid(id, items){const el=$("#"+id);if(el)el.innerHTML=items.map(cardMarkup).join("");}
  function renderCatalogue(){
    const filtered=titles.filter(matches);
    renderGrid("popularGrid",filtered);
    $("#emptyState").classList.toggle("hidden",filtered.length>0);
    const movies=titles.filter(t=>t.type==="Movie").slice(0,10);
    const series=titles.filter(t=>t.type==="Series").slice(0,10);
    renderGrid("moviesGrid",movies);renderGrid("seriesGrid",series);
    renderCounts();
  }
  function setupFilters(){
    const genres=[...new Set(titles.flatMap(t=>t.genres||[]))].sort();
    const countries=[...new Set(titles.map(t=>t.country).filter(Boolean))].sort();
    $("#genreFilter").innerHTML='<option value="All">All genres</option>'+genres.map(g=>`<option>${escapeHTML(g)}</option>`).join("");
    $("#countryFilter").innerHTML='<option value="All">All cinema</option>'+countries.map(c=>`<option>${escapeHTML(c)}</option>`).join("");
  }
  function renderCounts(){
    $("#watchlistCount").textContent=`${state.watchlist.length} titles`;
    $("#watchedCount").textContent=`${state.watched.length} titles`;
    $("#reviewsCount").textContent=`${state.reviews.length} reviews`;
    $("#collectionsCount").textContent=`${state.collections.length} collections`;
  }
  function setOverlay(id,open){const el=$("#"+id);el.classList.toggle("open",open);document.body.classList.toggle("modal-open",$$(".overlay.open").length>0);if(open){const inp=$("input",el);if(inp)setTimeout(()=>inp.focus(),60);}}
  function toggleId(listKey,id){
    const list=state[listKey];const idx=list.indexOf(id);
    if(idx>=0){list.splice(idx,1);toast("Removed from your "+(listKey==="watchlist"?"watchlist":"watched list")+".");}
    else{list.push(id);toast(listKey==="watchlist"?"Added to your watchlist.":"Marked as watched.");}
    save("nox_"+listKey,list);renderCounts();
    if(state.detailId)renderDetail(state.detailId);
  }
  function renderDetail(id){
    const t=getTitle(id);if(!t)return;state.detailId=id;
    const inWatch=state.watchlist.includes(id),inWatched=state.watched.includes(id);
    const myReview=state.reviews.find(r=>r.id===id);
    $("#titleDetail").innerHTML=`<div class="title-detail-layout"><div><img class="detail-poster" src="${escapeHTML(t.poster||"")}" alt="${escapeHTML(t.title)} poster" onerror="this.style.display='none'"><div class="poster-fallback hidden">${escapeHTML(t.title)}</div></div><div class="detail-copy"><p class="eyebrow">${escapeHTML(t.type)} · NOX DISCOVERY</p><h2>${escapeHTML(t.title)}</h2><div class="detail-meta">${t.year} · ${escapeHTML(t.country||"Country unknown")} · ${escapeHTML(t.language||"Language unknown")} · ★ ${Number(t.rating||0).toFixed(1)} <span style="color:var(--muted)">· catalogue rating</span></div><div class="detail-tags">${(t.genres||[]).map(g=>`<span>${escapeHTML(g)}</span>`).join("")}</div><p>${escapeHTML(t.synopsis||"A story waiting to be discovered.")}</p><p class="detail-meta">${t.runtime?escapeHTML(t.runtime):t.seasons?`${t.seasons} season(s)`: "Additional runtime details unavailable"} · Metadata may be incomplete.</p><div class="detail-actions"><button class="primary" data-action="watchlist" data-id="${t.id}">${inWatch?"✓ In Watchlist":"＋ Add to Watchlist"}</button><button data-action="watched" data-id="${t.id}">${inWatched?"✓ Watched":"Mark as Watched"}</button></div><div class="review-form"><p class="eyebrow">YOUR TAKE</p><label for="reviewRating">Your rating</label><div class="rating-control" id="reviewRating">${[1,2,3,4,5].map(n=>`<button type="button" data-rate="${n}" class="${(myReview?.rating||state.rating)>=n?"selected":""}" aria-label="${n} stars">★</button>`).join("")}</div><textarea id="reviewText" placeholder="What did this story make you think or feel?">${escapeHTML(myReview?.text||"")}</textarea><button class="account-button" id="saveReview" data-id="${t.id}">Save my review</button><p class="poster-meta">Your review is stored locally in this browser, not shared online.</p></div></div></div>`;
    setOverlay("titleOverlay",true);
  }
  function renderSearchResults(query){
    const list=titles.filter(t=>`${t.title} ${t.country} ${t.language} ${(t.genres||[]).join(" ")}`.toLowerCase().includes(query.toLowerCase())).slice(0,8);
    $("#searchResults").innerHTML=list.length?list.map(t=>`<button class="search-result" data-open-title="${t.id}"><img src="${escapeHTML(t.poster||"")}" alt="" onerror="this.style.visibility='hidden'"><span><strong>${escapeHTML(t.title)}</strong><small>${t.year} · ${escapeHTML(t.type)} · ${escapeHTML(t.country)}</small></span></button>`).join(""):`<p class="poster-meta">No matches yet. Try another title or genre.</p>`;
  }
  function openSearch(query=""){setOverlay("searchOverlay",true);$("#modalSearchInput").value=query;renderSearchResults(query);}
  function renderLibrary(){
    const key=state.activeLibrary;
    let items=[];
    if(key==="watchlist")items=state.watchlist.map(getTitle).filter(Boolean);
    if(key==="watched")items=state.watched.map(getTitle).filter(Boolean);
    if(key==="reviews")items=state.reviews.map(r=>({...getTitle(r.id),review:r})).filter(t=>t.id);
    if(key==="collections")items=state.collections;
    if(key==="discover"){
      const favGenres=state.reviews.flatMap(r=>getTitle(r.id)?.genres||[]);
      const favCountry=state.reviews.map(r=>getTitle(r.id)?.country).filter(Boolean);
      items=[...titles].filter(t=>!state.watched.includes(t.id)).sort((a,b)=>{
        const score=t=>((t.genres||[]).filter(g=>favGenres.includes(g)).length*2)+(favCountry.includes(t.country)?1:0)+Number(t.rating||0)/10;
        return score(b)-score(a);
      }).slice(0,8);
    }
    const labels={watchlist:"My Watchlist",watched:"Watched List",reviews:"My Ratings & Reviews",collections:"Custom Collections",discover:"Discover For Me"};
    let content=`<div class="account-session"><span>Signed in as <strong>${escapeHTML(state.profile?.name||"NOX Viewer")}</strong><small>Local browser profile</small></span><button type="button" data-logout>Log out</button></div><div class="account-tabs">${Object.entries(labels).map(([k,v])=>`<button data-library="${k}" class="${key===k?"active":""}">${v}</button>`).join("")}</div>`;
    if(key==="discover"){
      content+=`<p class="poster-meta">Picks are based on your local ratings when available, then catalogue ratings. Save or mark a title to build your cinema profile.</p><div class="library-list">${items.map(t=>`<div class="library-item"><span><strong>${escapeHTML(t.title)}</strong><br><small class="poster-meta">${t.year} · ${escapeHTML(t.country)} · ★ ${Number(t.rating||0).toFixed(1)}</small></span><button data-open-title="${t.id}">Explore</button><button data-action="watchlist" data-id="${t.id}">＋</button></div>`).join("")}</div>`;
    } else if(key==="collections"){
      content+=`<form id="collectionForm"><input id="collectionName" maxlength="60" placeholder="Collection name (e.g. Mind-bending nights)" required><button class="account-button" type="submit">Create collection</button></form>`;
      content+=items.length?`<div class="library-list">${items.map(c=>`<div class="library-item"><span><strong>${escapeHTML(c.name)}</strong><br><small class="poster-meta">${c.ids.length} saved titles</small></span><button data-delete-collection="${c.id}">Delete</button></div>`).join("")}</div>`:`<p class="poster-meta">Your custom collections will appear here.</p>`;
    } else if(key==="reviews"){
      content+=items.length?`<div class="library-list">${items.map(t=>`<div class="library-item"><span><strong>${escapeHTML(t.title)}</strong><br><small>★ ${t.review.rating||0}/5 · ${escapeHTML(t.review.text||"No written note")}</small></span><button data-open-title="${t.id}">Edit</button></div>`).join("")}</div>`:`<p class="poster-meta">Open a title and save your first rating or review.</p>`;
    } else {
      content+=items.length?`<div class="library-list">${items.map(t=>`<div class="library-item"><span><strong>${escapeHTML(t.title)}</strong><br><small class="poster-meta">${t.year} · ${escapeHTML(t.type)}</small></span><button data-open-title="${t.id}">Details</button><button data-remove="${key}" data-id="${t.id}">Remove</button></div>`).join("")}</div>`:`<p class="poster-meta">Nothing here yet. Explore titles and add a few to get started.</p>`;
    }
    $("#accountContent").innerHTML=content;
  }
  function openAccount(tab="watchlist"){
    state.activeLibrary=tab;
    if(!state.profile){
      state.authMode="signup";
      renderAuth();
      setOverlay("accountOverlay",true);
      return;
    }
    setOverlay("accountOverlay",true);
    if(tab==="profile"){
      $("#accountContent").innerHTML=`<div class="profile-summary"><strong>${escapeHTML(state.profile.name||"NOX Viewer")}</strong><p>${escapeHTML(state.profile.email||"")} · Saved in this browser only.</p></div><button class="account-button" data-logout>Log out</button><p class="poster-meta">This is a local demo account, not a secure online account. Data stays in this browser and does not sync across devices.</p>`;
    } else renderLibrary();
  }
  function renderAuth(){
    const mode=state.authMode||"signup";
    $("#accountContent").innerHTML=`<div class="auth-intro"><span class="auth-mark">N<span>O</span>X</span><p>${mode==="signup"?"Create your personal cinema journal.":"Welcome back to your cinema journal."}</p></div><div class="account-tabs auth-tabs"><button type="button" data-auth-mode="signup" class="${mode==="signup"?"active":""}">Create account</button><button type="button" data-auth-mode="login" class="${mode==="login"?"active":""}">Log in</button></div><form id="accountAuthForm" data-mode="${mode}" class="auth-form">${mode==="signup"?'<label>Display name<input id="authName" maxlength="40" placeholder="What should NOX call you?" required></label>':''}<label>Email<input id="authEmail" type="email" autocomplete="email" placeholder="you@example.com" required></label><label>Password<input id="authPassword" type="password" minlength="4" autocomplete="${mode==="signup"?"new-password":"current-password"}" placeholder="At least 4 characters" required></label><button class="account-button" type="submit">${mode==="signup"?"Create my account ↗":"Log in ↗"}</button><p class="poster-meta">Demo mode: account data is stored only in this browser. It is not secure authentication and will not sync across devices. Use no real or reused password.</p></form>`;
  }
  async function passwordDigest(value){
    if(window.crypto?.subtle){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");}
    let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return "local-"+(h>>>0).toString(16);
  }
  function showLibrary(tab){state.activeLibrary=tab;setOverlay("accountOverlay",true);renderLibrary();}
  document.addEventListener("click",e=>{
    const close=e.target.closest("[data-close]");if(close){setOverlay(close.dataset.close,false);return;}
    const authMode=e.target.closest("[data-auth-mode]");if(authMode){state.authMode=authMode.dataset.authMode;renderAuth();return;}
    const logout=e.target.closest("[data-logout]");if(logout){state.profile=null;save("nox_profile",null);openAccount("watchlist");toast("Logged out of this browser.");return;}
    const open=e.target.closest("[data-open-title]");if(open){renderDetail(open.dataset.openTitle);setOverlay("searchOverlay",false);setOverlay("accountOverlay",false);return;}
    const action=e.target.closest("[data-action]");if(action){e.stopPropagation();toggleId(action.dataset.action,action.dataset.id);return;}
    const rate=e.target.closest("[data-rate]");if(rate){state.rating=Number(rate.dataset.rate);$$("[data-rate]").forEach(b=>b.classList.toggle("selected",Number(b.dataset.rate)<=state.rating));return;}
    const lib=e.target.closest("[data-library]");if(lib){showLibrary(lib.dataset.library);return;}
    const mood=e.target.closest("[data-mood]");if(mood){state.query="";state.type="All";state.genre="All";state.country="All";$("#genreFilter").value="All";$("#countryFilter").value="All";$$("[data-type]").forEach(b=>b.classList.toggle("active",b.dataset.type==="All"));const moodTitles=titles.filter(t=>(t.mood||[]).includes(mood.dataset.mood));renderGrid("popularGrid",moodTitles);$("#emptyState").classList.toggle("hidden",moodTitles.length>0);$("#trending").scrollIntoView({behavior:"smooth"});return;}
    const country=e.target.closest("[data-country]");if(country){state.country=country.dataset.country;$("#countryFilter").value=state.country;renderCatalogue();$("#trending").scrollIntoView({behavior:"smooth"});return;}
    const typeJump=e.target.closest("[data-type-jump]");if(typeJump){state.type=typeJump.dataset.typeJump;$$("[data-type]").forEach(b=>b.classList.toggle("active",b.dataset.type===state.type));renderCatalogue();$("#trending").scrollIntoView({behavior:"smooth"});return;}
    const showAll=e.target.closest("[data-show-all]");if(showAll){state.type="All";state.genre="All";state.country="All";state.query="";$("#genreFilter").value="All";$("#countryFilter").value="All";$("#heroSearchInput").value="";$$("[data-type]").forEach(b=>b.classList.toggle("active",b.dataset.type==="All"));renderCatalogue();$("#trending").scrollIntoView({behavior:"smooth"});return;}
    const remove=e.target.closest("[data-remove]");if(remove){state[remove.dataset.remove]=state[remove.dataset.remove].filter(id=>id!==remove.dataset.id);save("nox_"+remove.dataset.remove,state[remove.dataset.remove]);renderCounts();renderLibrary();toast("Removed.");return;}
    const del=e.target.closest("[data-delete-collection]");if(del){state.collections=state.collections.filter(c=>c.id!==del.dataset.deleteCollection);save("nox_collections",state.collections);renderCounts();renderLibrary();return;}
    const openLibrary=e.target.closest(".personal-card");if(openLibrary){openAccount(openLibrary.dataset.library);return;}
  });
  document.addEventListener("keydown",e=>{if(e.key==="Escape")$$(".overlay.open").forEach(o=>setOverlay(o.id,false));if((e.key==="Enter"||e.key===" ")&&e.target.matches(".poster-card")){e.preventDefault();renderDetail(e.target.dataset.openTitle);}});
  $("#heroSearchForm").addEventListener("submit",e=>{e.preventDefault();state.query=$("#heroSearchInput").value.trim();state.type="All";state.genre="All";state.country="All";$("#genreFilter").value="All";$("#countryFilter").value="All";$$("[data-type]").forEach(b=>b.classList.toggle("active",b.dataset.type==="All"));renderCatalogue();$("#trending").scrollIntoView({behavior:"smooth"});});
  $("#openSearch").addEventListener("click",()=>openSearch());
  $("#soundToggle").addEventListener("click",()=>{soundEnabled=!soundEnabled;localStorage.setItem("nox_sound",soundEnabled?"on":"off");$("#soundToggle").textContent=soundEnabled?"♪":"♪̸";$("#soundToggle").classList.toggle("sound-off",!soundEnabled);if(soundEnabled)playSound("success");toast(soundEnabled?"Sound effects enabled.":"Sound effects muted.");});
  $("#modalSearchInput").addEventListener("input",e=>renderSearchResults(e.target.value.trim()));
  $("#accountButton").addEventListener("click",()=>openAccount("watchlist"));
  $("#genreFilter").addEventListener("change",e=>{state.genre=e.target.value;renderCatalogue();});
  $("#countryFilter").addEventListener("change",e=>{state.country=e.target.value;renderCatalogue();});
  $("#typeFilters").addEventListener("click",e=>{const b=e.target.closest("[data-type]");if(!b)return;state.type=b.dataset.type;$$("[data-type]").forEach(x=>x.classList.toggle("active",x===b));renderCatalogue();});
  $("#clearFilters").addEventListener("click",()=>{state.type="All";state.genre="All";state.country="All";state.query="";$("#genreFilter").value="All";$("#countryFilter").value="All";$("#heroSearchInput").value="";$$("[data-type]").forEach(b=>b.classList.toggle("active",b.dataset.type==="All"));renderCatalogue();});
  $("#menuToggle").addEventListener("click",()=>$("#mainNav").classList.toggle("open"));
  $$("#mainNav a").forEach(a=>a.addEventListener("click",()=>$("#mainNav").classList.remove("open")));
  $("#titleDetail").addEventListener("click",e=>{if(e.target.id==="saveReview"){const id=e.target.dataset.id;const text=$("#reviewText").value.trim();const rating=state.rating||Number(state.reviews.find(r=>r.id===id)?.rating)||0;const idx=state.reviews.findIndex(r=>r.id===id);const entry={id,rating,text,updatedAt:new Date().toISOString()};if(idx>=0)state.reviews[idx]=entry;else state.reviews.push(entry);save("nox_reviews",state.reviews);state.rating=0;renderCounts();renderDetail(id);toast("Your review was saved in this browser.");}});
  $("#accountContent").addEventListener("submit",async e=>{e.preventDefault();if(e.target.id==="accountAuthForm"){
      const mode=e.target.dataset.mode,email=$("#authEmail").value.trim().toLowerCase(),password=$("#authPassword").value;
      const accounts=safeParse("nox_local_accounts",{});const digest=await passwordDigest(password);
      if(mode==="signup"){
        const name=$("#authName").value.trim();if(!name){toast("Add a display name first.");return;}if(accounts[email]){toast("An account with this email exists. Log in instead.");state.authMode="login";renderAuth();return;}
        accounts[email]={name,passHash:digest};save("nox_local_accounts",accounts);state.profile={name,email};save("nox_profile",state.profile);state.activeLibrary="watchlist";openAccount("watchlist");toast("Account created. Welcome to NOX!");playSound("success");return;
      } else {
        if(!accounts[email]||accounts[email].passHash!==digest){toast("Email or password doesn't match this browser.");return;}
        state.profile={name:accounts[email].name,email};save("nox_profile",state.profile);openAccount("watchlist");toast("Welcome back to NOX!");playSound("success");return;
      }
    }
    if(e.target.id==="profileForm"){const name=$("#profileName").value.trim();state.profile=name?{...state.profile,name}:null;save("nox_profile",state.profile);openAccount(state.activeLibrary);toast("Local profile saved.");}
    if(e.target.id==="collectionForm"){const name=$("#collectionName").value.trim();if(!name)return;state.collections.push({id:"c"+Date.now(),name,ids:[]});save("nox_collections",state.collections);renderCounts();renderLibrary();toast("Collection created.");}
  });
  $("#year").textContent=new Date().getFullYear();
  setupFilters();renderCatalogue();
  window.setTimeout(()=>$("#introScreen").classList.add("done"),1250);
})();
