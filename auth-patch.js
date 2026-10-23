
(() => {
  const CFG_KEY = "fluency_cloud_config_v1";

  function getConfig(){
    try { return JSON.parse(localStorage.getItem(CFG_KEY) || "{}"); }
    catch { return {}; }
  }

  function getClient(){
    const cfg = getConfig();
    if(!cfg.url || !cfg.key) throw new Error("احفظ Supabase URL و Publishable Key الأول.");
    if(!window.supabase) throw new Error("Supabase library not loaded.");
    return window.supabase.createClient(cfg.url, cfg.key);
  }

  const btn = document.getElementById("loginBtn");
  const emailEl = document.getElementById("loginEmail");
  const passEl = document.getElementById("loginPassword");

  if(btn && emailEl && passEl){
    btn.onclick = async () => {
      const email = emailEl.value.trim();
      const password = passEl.value;
      if(!email || !password){
        alert("اكتب الإيميل وكلمة المرور.");
        return;
      }
      btn.disabled = true;
      btn.textContent = "جاري تسجيل الدخول...";
      try{
        const client = getClient();
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if(error) throw error;
        if(!data?.session) throw new Error("لم يتم إنشاء جلسة دخول.");
        alert("تم تسجيل الدخول بنجاح ✅");
        location.reload();
      }catch(e){
        alert(e.message || "تعذر تسجيل الدخول.");
      }finally{
        btn.disabled = false;
        btn.textContent = "تسجيل الدخول";
      }
    };
  }
})();
