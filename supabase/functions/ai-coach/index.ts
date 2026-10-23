import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function extractText(r:any){
  if(typeof r?.output_text==="string") return r.output_text;
  for(const item of r?.output||[]) for(const c of item?.content||[]) if(c?.type==="output_text"&&c?.text) return c.text;
  return "";
}
function jsonFromText(t:string){
  const clean=t.trim().replace(/^```json\s*/i,"").replace(/```$/,"").trim();
  try{return JSON.parse(clean)}catch{
    const a=clean.indexOf("{"),b=clean.lastIndexOf("}");
    if(a>=0&&b>a) return JSON.parse(clean.slice(a,b+1));
    return {message:clean};
  }
}
Deno.serve(async(req)=>{
  try{
    if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
    const auth=req.headers.get("Authorization")||"";
    const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
    const {data:{user},error:uerr}=await supabase.auth.getUser();
    if(uerr||!user) return json({error:"Unauthorized"},401);
    const body=await req.json(), mode=String(body.mode||"conversation"), level=String(body.level||"B1"), scenario=String(body.scenario||"daily"), text=String(body.text||"").trim();
    if(!text) return json({error:"Missing text"},400);

    const system=`You are an English fluency coach for an Arabic-speaking learner.
Goal: natural English, not unnecessarily complicated English. C1/C2 means precision, nuance and register control, not idiom overload.
Always return ONLY valid JSON with these keys:
english, pronunciation_ar, arabic, explanation_ar, reply_english, reply_pronunciation_ar, reply_arabic.
pronunciation_ar must be an Egyptian-Arabic-friendly approximation in Arabic letters, inside the value without parentheses.
For mode=correct: correct the learner's English and explain the key error briefly in Arabic.
For mode=upgrade: rewrite the same meaning naturally at requested CEFR level, avoiding pompous language.
For mode=conversation: respond naturally in the selected scenario and provide an easy next reply for the learner.
For mode=generate: produce one useful sentence/example lesson fitting the requested level and scenario.
Keep explanations concise and practical.`;
    const userPrompt=`Mode: ${mode}\nTarget level: ${level}\nScenario: ${scenario}\nLearner input: ${text}`;
    const model=Deno.env.get("OPENAI_TEXT_MODEL")||"gpt-6-luna";
    const ores=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",headers:{"Authorization":`Bearer ${Deno.env.get("OPENAI_API_KEY")}`,"Content-Type":"application/json"},
      body:JSON.stringify({model,input:[{role:"system",content:system},{role:"user",content:userPrompt}],max_output_tokens:800})
    });
    const raw=await ores.json();
    if(!ores.ok) return json({error:raw?.error?.message||"OpenAI request failed"},500);
    const result=jsonFromText(extractText(raw));
    await supabase.from("ai_history").insert({user_id:user.id,mode,scenario,user_text:text,assistant_json:result});
    return json(result,200);
  }catch(e){return json({error:String(e?.message||e)},500)}
});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
function json(v:any,status=200){return new Response(JSON.stringify(v),{status,headers:{...cors,"Content-Type":"application/json"}})}
