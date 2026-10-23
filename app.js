
const D=window.APP_DATA,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const screens=["home","learn","review","ai","speaking","dashboard","account"];
const LS={
  get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},
  set(k,v){localStorage.setItem(k,JSON.stringify(v))}
};
const state={
  learned:new Set(LS.get("pro_learned",[])),
  favs:new Set(LS.get("pro_favs",[])),
  reviews:LS.get("pro_reviews",{}),
  xp:LS.get("pro_xp",0),
  streak:LS.get("pro_streak",{last:"",count:0}),
  daily:LS.get("pro_daily",{date:"",learned:0,reviewed:0,speaking_attempts:0,xp:0}),
  showPhonetic:LS.get("pro_phonetic",true),
  voiceLocale:LS.get("pro_voice","en-US"),
  voiceRate:LS.get("pro_rate",1),
  lesson:[], idx:0, reviewQueue:[], reviewIdx:0,
  aiMode:"conversation", mediaRecorder:null, chunks:[], recordStarted:0
};
function today(){return new Date().toISOString().slice(0,10)}
if(state.daily.date!==today())state.daily={date:today(),learned:0,reviewed:0,speaking_attempts:0,xp:0};
function persist(){
  LS.set("pro_learned",[...state.learned]);LS.set("pro_favs",[...state.favs]);LS.set("pro_reviews",state.reviews);
  LS.set("pro_xp",state.xp);LS.set("pro_streak",state.streak);LS.set("pro_daily",state.daily);
  LS.set("pro_phonetic",state.showPhonetic);LS.set("pro_voice",state.voiceLocale);LS.set("pro_rate",state.voiceRate);
  renderStats(); Cloud.saveDaily({learned:state.daily.learned,reviewed:state.daily.reviewed,speaking_attempts:state.daily.speaking_attempts,xp:state.daily.xp}).catch(()=>{});
}
function touchStreak(){
  const d=today(); if(state.streak.last===d)return;
  const y=new Date();y.setDate(y.getDate()-1);const ys=y.toISOString().slice(0,10);
  state.streak.count=state.streak.last===ys?state.streak.count+1:1;state.streak.last=d;
}
const titles={home:"الرئيسية",learn:"درس اليوم",review:"Smart Review",ai:"AI Coach",speaking:"Speaking Practice",dashboard:"تقدمك",account:"الحساب والسحابة"};
function go(s){
  screens.forEach(x=>$("#"+x+"Screen").classList.toggle("active",x===s));
  $$(".navItem").forEach(b=>b.classList.toggle("active",b.dataset.screen===s));
  $("#screenTitle").textContent=titles[s]||s;
  if(s==="learn"&&!state.lesson.length)startLesson();
  if(s==="review")prepareReview();
  if(s==="speaking")renderSpeaking();
  if(s==="account")renderAccount();
  if(s==="dashboard")renderStats();
  window.scrollTo({top:0,behavior:"smooth"});
}
$$(".navItem").forEach(b=>b.onclick=()=>go(b.dataset.screen));
$$("[data-go]").forEach(b=>b.onclick=()=>{$("#settingsModal").hidden=true;go(b.dataset.go)});
function catName(id){return D.categories?.find(x=>x.id===id)?.name||id}
function speak(t,n=1){
  if(!("speechSynthesis" in window))return alert("الصوت غير مدعوم هنا.");
  speechSynthesis.cancel();let i=0,voices=speechSynthesis.getVoices(),voice=voices.find(v=>v.lang===state.voiceLocale)||voices.find(v=>v.lang.startsWith("en"));
  function run(){const u=new SpeechSynthesisUtterance(t);u.lang=state.voiceLocale;u.rate=state.voiceRate;if(voice)u.voice=voice;u.onend=()=>{i++;if(i<n)setTimeout(run,250)};speechSynthesis.speak(u)}run();
}
function randomSentence(){return D.seed[Math.floor(Math.random()*D.seed.length)]}
function startLesson(){
  touchStreak();
  state.lesson=[...D.seed].sort(()=>Math.random()-.5).slice(0,20);state.idx=0;renderLesson();persist();
}
function sentenceHTML(s){
  return `<div class="sentenceBox">
    <div class="sentenceMeta"><span class="badge level">${s.level}</span><span class="badge">${catName(s.cat)}</span></div>
    <div class="english">${s.en}</div>
    ${state.showPhonetic?`<div class="phonetic">(${s.ph})</div>`:""}
    <div class="arabic">${s.ar}</div>
    <div class="divider"></div><div class="label">إمتى تستخدمها؟</div><div class="explain">${s.when||"في الموقف المناسب للسياق."}</div>
    <div class="divider"></div><div class="label">Natural Reply — رد طبيعي</div>
    <div class="reply"><div class="en">${s.reply_en||""}</div>${state.showPhonetic?`<div class="ph">(${s.reply_ph||""})</div>`:""}<div>${s.reply_ar||""}</div></div>
    <div class="sentenceActions"><button class="listen" data-listen>🔊 اسمع</button><button class="listen" data-listen3>↻ 3 مرات</button><button class="fav" data-fav>${state.favs.has(s.id)?"★ محفوظة":"☆ مفضلة"}</button><button class="fav" data-hideph>${state.showPhonetic?"إخفاء النطق":"إظهار النطق"}</button></div>
  </div>`;
}
function bindSentence(el,s){
  el.querySelector("[data-listen]").onclick=()=>speak(s.en,1);
  el.querySelector("[data-listen3]").onclick=()=>speak(s.en,3);
  el.querySelector("[data-fav]").onclick=()=>{state.favs.has(s.id)?state.favs.delete(s.id):state.favs.add(s.id);Cloud.saveFavorite(s.id,state.favs.has(s.id)).catch(()=>{});persist();renderLesson()};
  el.querySelector("[data-hideph]").onclick=()=>{state.showPhonetic=!state.showPhonetic;persist();renderLesson()};
}
function renderLesson(){
  const s=state.lesson[state.idx]||randomSentence(),el=$("#lessonCard");el.innerHTML=sentenceHTML(s);bindSentence(el,s);
  $("#lessonCount").textContent=`${state.idx+1} / ${state.lesson.length||20}`;$("#lessonBar").style.width=`${((state.idx+1)/(state.lesson.length||20))*100}%`;
}
function scheduleReview(id,rating){
  const now=Date.now(),old=state.reviews[id]||{ease:2.5,interval_days:0,repetitions:0,due_at:now,status:"learning"};
  let days=0,ease=old.ease,reps=old.repetitions;
  if(rating==="again"){days=0.0007;reps=0;ease=Math.max(1.3,ease-.2)}
  if(rating==="hard"){days=Math.max(1,Math.round(old.interval_days*1.2)||1);reps+=1;ease=Math.max(1.3,ease-.15)}
  if(rating==="good"){days=reps===0?3:Math.max(3,Math.round(old.interval_days*ease)||3);reps+=1}
  if(rating==="easy"){days=reps===0?7:Math.max(7,Math.round(old.interval_days*ease*1.3)||7);reps+=1;ease+=.1}
  const rec={sentence_id:id,status:rating==="again"?"learning":(days>=14?"mastered":"reviewing"),ease,interval_days:days,repetitions:reps,due_at:now+days*86400000,last_result:rating};
  state.reviews[id]=rec;Cloud.upsertProgress(rec).catch(()=>{});return rec;
}
$$("[data-rating]").forEach(b=>b.onclick=()=>{
  const s=state.lesson[state.idx];if(!s)return;
  scheduleReview(s.id,b.dataset.rating);state.learned.add(s.id);state.xp+=10;state.daily.learned++;state.daily.xp+=10;persist();
  if(state.idx<state.lesson.length-1){state.idx++;renderLesson()}else{alert("أحسنت! خلصت درس اليوم 🎉");state.lesson=[];go("home")}
});
function dueSentences(){
  const now=Date.now();return D.seed.filter(s=>state.reviews[s.id]&&state.reviews[s.id].due_at<=now);
}
function prepareReview(){
  state.reviewQueue=dueSentences();state.reviewIdx=0;
  const el=$("#reviewCard");
  if(!state.reviewQueue.length)el.innerHTML=`<div class="card empty">مفيش جمل مستحقة للمراجعة دلوقتي. ممتاز 👌</div>`;
  else el.innerHTML=`<div class="card"><b>${state.reviewQueue.length}</b> جملة مستحقة للمراجعة.</div>`;
}
$("#startReviewBtn").onclick=()=>{
  if(!state.reviewQueue.length)return alert("مفيش مراجعات مستحقة دلوقتي.");
  renderReviewOne();
};
function renderReviewOne(){
  const s=state.reviewQueue[state.reviewIdx],el=$("#reviewCard");if(!s)return prepareReview();
  el.innerHTML=sentenceHTML(s)+`<div class="ratingPanel">${["again","hard","good","easy"].map(x=>`<button class="rate ${x}" data-r="${x}">${x}</button>`).join("")}</div>`;
  bindSentence(el,s);el.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{scheduleReview(s.id,b.dataset.r);state.daily.reviewed++;state.xp+=5;state.daily.xp+=5;persist();state.reviewIdx++;renderReviewOne()});
}
$$(".mode").forEach(b=>b.onclick=()=>{$$(".mode").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.aiMode=b.dataset.mode});
$("#aiExample").onclick=()=>{const ex={conversation:"Let's practice a sales conversation about price objections.",correct:"I am work in sales and I talk with client yesterday.",upgrade:"I don't agree with this price.",generate:"اعمل لي درس B2 عن التفاوض على السعر"};$("#aiInput").value=ex[state.aiMode]};
function addBubble(kind,html){const d=document.createElement("div");d.className=`bubble ${kind}`;d.innerHTML=html;$("#chatLog").appendChild(d);d.scrollIntoView({behavior:"smooth",block:"end"})}
function renderAIResult(data){
  if(data?.english){
    addBubble("ai",`<div class="upgrade">${data.english}</div>${data.pronunciation_ar?`<div class="pron">(${data.pronunciation_ar})</div>`:""}${data.arabic?`<div class="tr">${data.arabic}</div>`:""}${data.explanation_ar?`<div class="tr"><b>ليه؟</b> ${data.explanation_ar}</div>`:""}${data.reply_english?`<hr><div class="upgrade">${data.reply_english}</div><div class="pron">(${data.reply_pronunciation_ar||""})</div><div class="tr">${data.reply_arabic||""}</div>`:""}`);
  } else addBubble("ai",`<div>${data?.message||data?.text||JSON.stringify(data)}</div>`);
}
$("#aiSend").onclick=async()=>{
  const text=$("#aiInput").value.trim();if(!text)return;
  addBubble("user",text);$("#aiInput").value="";$("#aiSend").disabled=true;$("#aiSend").textContent="جاري...";
  try{
    if(!Cloud.isReady())throw new Error("فعّل Cloud من الحساب الأول.");
    const data=await Cloud.invokeAI({mode:state.aiMode,level:$("#aiLevel").value,scenario:$("#aiScenario").value,text});
    renderAIResult(data);
  }catch(e){addBubble("ai",`⚠️ ${e.message}<br><small>التطبيق شغال Local، لكن ميزات AI محتاجة إعداد Supabase + OpenAI مرة واحدة.</small>`)}
  $("#aiSend").disabled=false;$("#aiSend").textContent="إرسال للمدرب";
};
function renderSpeaking(){
  const s=randomSentence(),el=$("#speakingCard");el.dataset.id=s.id;el.dataset.text=s.en;el.innerHTML=sentenceHTML(s);bindSentence(el,s);$("#speechResult").hidden=true;
}
let timerInt=null;
$("#recordBtn").onclick=async()=>{
  if(state.mediaRecorder&&state.mediaRecorder.state==="recording"){state.mediaRecorder.stop();return}
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const mr=new MediaRecorder(stream);state.mediaRecorder=mr;state.chunks=[];state.recordStarted=Date.now();
    mr.ondataavailable=e=>{if(e.data.size)state.chunks.push(e.data)};
    mr.onstop=async()=>{
      clearInterval(timerInt);$("#recordBtn").classList.remove("recording");$("#recordBtn").textContent="🎙️ ابدأ التسجيل";stream.getTracks().forEach(t=>t.stop());
      const blob=new Blob(state.chunks,{type:mr.mimeType||"audio/webm"}),target=$("#speakingCard").dataset.text;
      $("#speechResult").hidden=false;$("#speechResult").innerHTML="جاري تحليل المحاولة...";
      try{
        if(!Cloud.isReady())throw new Error("فعّل Cloud وسجّل دخولك الأول.");
        const r=await Cloud.scoreSpeech(blob,target);state.daily.speaking_attempts++;state.xp+=10;state.daily.xp+=10;persist();
        $("#speechResult").innerHTML=`<div class="score">${r.match_score}%</div><b>اللي اتسمع:</b><div dir="ltr">${r.transcript}</div><p>${r.feedback_ar||""}</p>`;
      }catch(e){$("#speechResult").innerHTML=`⚠️ ${e.message}<br><small>تقدر لسه تستخدم زر اسمع وتعمل Shadowing بدون Cloud.</small>`}
    };
    mr.start();$("#recordBtn").classList.add("recording");$("#recordBtn").textContent="⏹️ إيقاف";
    timerInt=setInterval(()=>{const s=Math.floor((Date.now()-state.recordStarted)/1000);$("#recordTimer").textContent=`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`},500);
  }catch(e){alert("تعذر تشغيل الميكروفون: "+e.message)}
};
function renderStats(){
  const due=dueSentences().length;$("#streakVal").textContent=state.streak.count;$("#homeLearned").textContent=state.learned.size;$("#homeDue").textContent=due;$("#homeXp").textContent=state.xp;
  $("#dashLearned").textContent=state.learned.size;$("#dashReviewed").textContent=state.daily.reviewed;$("#dashSpeaking").textContent=state.daily.speaking_attempts;$("#dashXp").textContent=state.xp;
}
async function renderAccount(){
  const cfg=Cloud.loadConfig();$("#supabaseUrl").value=cfg.url||"";$("#supabaseKey").value=cfg.key||"";
  const user=await Cloud.getUser().catch(()=>null);
  if(user){$("#accountState").innerHTML=`<div class="mutedBox">✅ مسجل دخول: <b>${user.email}</b></div>`;$("#loginBtn").hidden=true;$("#logoutBtn").hidden=false}
  else{$("#accountState").innerHTML=`<div class="mutedBox">سجّل بالبريد عبر Magic Link.</div>`;$("#loginBtn").hidden=false;$("#logoutBtn").hidden=true}
}
$("#saveCloudConfig").onclick=async()=>{
  Cloud.saveConfig($("#supabaseUrl").value,$("#supabaseKey").value);const ok=await Cloud.init();
  $("#cloudTest").textContent=ok?"✅ الاتصال بالسحابة جاهز":"❌ تأكد من URL وPublishable Key";updateCloudBadge();renderAccount();
};
$("#loginBtn").onclick=async()=>{
  const email=$("#loginEmail").value.trim();if(!email)return alert("اكتب البريد الإلكتروني.");
  try{const {error}=await Cloud.signInWithOtp(email);if(error)throw error;alert("تم إرسال رابط تسجيل الدخول إلى بريدك.")}catch(e){alert(e.message)}
};
$("#logoutBtn").onclick=async()=>{await Cloud.signOut();renderAccount();updateCloudBadge()};
async function updateCloudBadge(){
  const ok=Cloud.isReady(),u=ok?await Cloud.getUser().catch(()=>null):null;
  $("#cloudBadge").textContent=u?"Cloud ✓":(ok?"Cloud":"Local");$("#cloudBadge").className=`statusBadge ${ok?"online":"offline"}`;
}
$("#settingsBtn").onclick=()=>$("#settingsModal").hidden=false;$("#closeSettings").onclick=()=>$("#settingsModal").hidden=true;
$("#settingsModal").onclick=e=>{if(e.target===$("#settingsModal"))$("#settingsModal").hidden=true};
$("#voiceLocale").value=state.voiceLocale;$("#voiceRate").value=state.voiceRate;$("#showPhonetic").checked=state.showPhonetic;
$("#voiceLocale").onchange=e=>{state.voiceLocale=e.target.value;persist()};$("#voiceRate").onchange=e=>{state.voiceRate=Number(e.target.value);persist()};
$("#showPhonetic").onchange=e=>{state.showPhonetic=e.target.checked;persist();if($("#learnScreen").classList.contains("active"))renderLesson()};
async function hydrateCloud(){
  const ok=await Cloud.init();if(ok){
    try{const rows=await Cloud.fetchProgress();for(const r of rows)state.reviews[r.sentence_id]={...r,due_at:new Date(r.due_at).getTime()}}catch(e){console.warn(e)}
  }updateCloudBadge();renderStats();
}
touchStreak();persist();hydrateCloud();renderSpeaking();
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("service-worker.js").catch(()=>{});
