import { createClient } from "@supabase/supabase-js";
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
const ip="203.0.113." + Math.floor(Math.random()*200+10);
// 3 bad logins from one IP
for(let i=0;i<3;i++){await fetch("https://app.getpatchup.co.uk/api/auth/login",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded","x-forwarded-for":ip},body:new URLSearchParams({email:"nobody@example.invalid",password:"x"})});}
// did the new code write a row for that IP?
const {data}=await db.from("login_attempts").select("ip,attempts").eq("ip",ip).maybeSingle();
console.log(`row for injected IP ${ip}:`, data ? `attempts=${data.attempts}` : "NONE");
// also: is ANY row being written (maybe under the real Vercel edge IP)?
const {data:all}=await db.from("login_attempts").select("ip,attempts,window_started_at").order("window_started_at",{ascending:false}).limit(5);
console.log("recent login_attempts rows:");
for(const r of all||[]) console.log(`  ${r.ip}  attempts=${r.attempts}  ${r.window_started_at?.slice(11,19)}`);
if(data) await db.from("login_attempts").delete().eq("ip",ip);
