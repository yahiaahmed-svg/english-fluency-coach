
window.Cloud = (() => {
  let client = null;
  const CFG_KEY = "fluency_cloud_config_v1";
  const loadConfig = () => {
    try { return JSON.parse(localStorage.getItem(CFG_KEY) || "{}"); } catch { return {}; }
  };
  const saveConfig = (url,key) => {
    const cfg = { url:(url||"").trim(), key:(key||"").trim() };
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    return cfg;
  };
  async function init(){
    const cfg = loadConfig();
    if(!cfg.url || !cfg.key || !window.supabase) { client=null; return false; }
    try {
      client = window.supabase.createClient(cfg.url, cfg.key);
      const { data } = await client.auth.getSession();
      return !!client;
    } catch(e){ console.warn(e); client=null; return false; }
  }
  function isReady(){ return !!client; }
  async function getSession(){
    if(!client) return null;
    const { data } = await client.auth.getSession();
    return data.session || null;
  }
  async function getUser(){
    if(!client) return null;
    const { data } = await client.auth.getUser();
    return data.user || null;
  }
  async function signInWithOtp(email){
    if(!client) throw new Error("Cloud is not configured");
    return client.auth.signInWithOtp({ email, options:{ emailRedirectTo: window.location.href }});
  }
  async function signOut(){ if(client) await client.auth.signOut(); }
  async function upsertProgress(rec){
    const u = await getUser(); if(!u) return;
    return client.from("sentence_progress").upsert({
      user_id:u.id, sentence_id:rec.sentence_id, status:rec.status, ease:rec.ease,
      interval_days:rec.interval_days, repetitions:rec.repetitions,
      due_at:new Date(rec.due_at).toISOString(), last_result:rec.last_result,
      updated_at:new Date().toISOString()
    });
  }
  async function fetchProgress(){
    const u=await getUser(); if(!u) return [];
    const {data,error}=await client.from("sentence_progress").select("*");
    if(error) throw error; return data||[];
  }
  async function saveDaily(stats){
    const u=await getUser(); if(!u) return;
    const date=new Date().toISOString().slice(0,10);
    return client.from("daily_stats").upsert({user_id:u.id,date,...stats},{onConflict:"user_id,date"});
  }
  async function saveFavorite(sentenceId,on){
    const u=await getUser(); if(!u) return;
    if(on) return client.from("favorites").upsert({user_id:u.id,sentence_id:sentenceId});
    return client.from("favorites").delete().eq("user_id",u.id).eq("sentence_id",sentenceId);
  }
  async function invokeAI(payload){
    if(!client) throw new Error("Cloud is not configured");
    const {data,error}=await client.functions.invoke("ai-coach",{body:payload});
    if(error) throw error; return data;
  }
  async function scoreSpeech(blob,targetText){
    if(!client) throw new Error("Cloud is not configured");
    const cfg=loadConfig(), session=await getSession();
    if(!session) throw new Error("Please sign in first");
    const res=await fetch(`${cfg.url}/functions/v1/speech-score`,{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${session.access_token}`,
        "apikey":cfg.key,
        "content-type":blob.type||"audio/webm",
        "x-target-text":encodeURIComponent(targetText)
      },
      body:blob
    });
    const data=await res.json();
    if(!res.ok) throw new Error(data.error||"Speech scoring failed");
    return data;
  }
  return {loadConfig,saveConfig,init,isReady,getSession,getUser,signInWithOtp,signOut,upsertProgress,fetchProgress,saveDaily,saveFavorite,invokeAI,scoreSpeech};
})();
