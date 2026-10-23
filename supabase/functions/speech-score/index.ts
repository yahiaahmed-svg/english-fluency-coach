import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function norm(s:string){return s.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu," ").replace(/\s+/g," ").trim()}
function levenshtein(a:string[],b:string[]){
  const dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++)dp[i][0]=i;for(let j=0;j<=b.length;j++)dp[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return dp[a.length][b.length];
}
function matchScore(target:string,said:string){
  const a=norm(target).split(" ").filter(Boolean),b=norm(said).split(" ").filter(Boolean);
  if(!a.length)return 0;const d=levenshtein(a,b);return Math.max(0,Math.min(100,Math.round(100*(1-d/Math.max(a.length,b.length,1)))));
}
function extractText(r:any){if(typeof r?.output_text==="string")return r.output_text;for(const item of r?.output||[])for(const c of item?.content||[])if(c?.type==="output_text"&&c?.text)return c.text;return ""}

Deno.serve(async(req)=>{
  try{
    if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
    const auth=req.headers.get("Authorization")||"";
    const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
    const {data:{user},error:uerr}=await supabase.auth.getUser();
    if(uerr||!user) return json({error:"Unauthorized"},401);
    const target=decodeURIComponent(req.headers.get("x-target-text")||"");
    if(!target)return json({error:"Missing target text"},400);
    const bytes=await req.arrayBuffer(),type=req.headers.get("content-type")||"audio/webm";
    const file=new File([bytes],"speech.webm",{type});
    const form=new FormData();form.append("file",file);form.append("model",Deno.env.get("OPENAI_TRANSCRIBE_MODEL")||"gpt-4o-mini-transcribe");form.append("language","en");
    const tr=await fetch("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{"Authorization":`Bearer ${Deno.env.get("OPENAI_API_KEY")}`},body:form});
    const tj=await tr.json();if(!tr.ok)return json({error:tj?.error?.message||"Transcription failed"},500);
    const transcript=String(tj.text||""),score=matchScore(target,transcript);
    let feedback_ar=score>=90?"ممتاز. الكلام المتعرّف عليه قريب جدًا من الجملة.":score>=75?"كويس جدًا. اسمع الجملة مرة كمان وركز على الكلمات اللي اتغيرت.":score>=55?"محاولة كويسة، لكن في كلمات اتسمعت بشكل مختلف. اعمل Shadowing أبطأ.":"ابدأ بسرعة 0.75x وكرر الجملة جزء جزء.";
    const model=Deno.env.get("OPENAI_TEXT_MODEL")||"gpt-6-luna";
    try{
      const prompt=`Target English: ${target}\nTranscript heard: ${transcript}\nMatch score: ${score}%\nGive one short practical pronunciation/speaking tip in Arabic. Do not claim phonetic certainty because you only have a transcript.`;
      const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${Deno.env.get("OPENAI_API_KEY")}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:prompt,max_output_tokens:120})});
      if(r.ok){const j=await r.json();const t=extractText(j).trim();if(t)feedback_ar=t}
    }catch{}
    await supabase.from("pronunciation_attempts").insert({user_id:user.id,target_text:target,transcript,match_score:score,feedback_json:{feedback_ar}});
    return json({transcript,match_score:score,feedback_ar},200);
  }catch(e){return json({error:String(e?.message||e)},500)}
});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-target-text"};
function json(v:any,status=200){return new Response(JSON.stringify(v),{status,headers:{...cors,"Content-Type":"application/json"}})}
