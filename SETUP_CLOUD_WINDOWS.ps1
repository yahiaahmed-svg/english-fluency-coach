$ErrorActionPreference = "Stop"
Write-Host "English Fluency Coach Pro - Cloud Setup" -ForegroundColor Cyan
Write-Host "You need a Supabase project and an OpenAI API key." -ForegroundColor Yellow

$projectRef = Read-Host "Supabase Project Ref (the short id in your project URL)"
$openaiKey = Read-Host "OpenAI API Key"
$textModel = Read-Host "Text model [gpt-6-luna]"
if ([string]::IsNullOrWhiteSpace($textModel)) { $textModel = "gpt-6-luna" }
$transcribeModel = Read-Host "Transcription model [gpt-4o-mini-transcribe]"
if ([string]::IsNullOrWhiteSpace($transcribeModel)) { $transcribeModel = "gpt-4o-mini-transcribe" }

Write-Host "Logging into Supabase..." -ForegroundColor Cyan
npx supabase login

Write-Host "Linking project..." -ForegroundColor Cyan
npx supabase link --project-ref $projectRef

Write-Host "Applying database migration..." -ForegroundColor Cyan
npx supabase db push

Write-Host "Deploying AI functions..." -ForegroundColor Cyan
npx supabase functions deploy ai-coach
npx supabase functions deploy speech-score

Write-Host "Saving server-side secrets..." -ForegroundColor Cyan
npx supabase secrets set "OPENAI_API_KEY=$openaiKey" "OPENAI_TEXT_MODEL=$textModel" "OPENAI_TRANSCRIBE_MODEL=$transcribeModel"

Write-Host ""
Write-Host "DONE. Now open Supabase Dashboard > Project Settings > API and copy:" -ForegroundColor Green
Write-Host "1) Project URL"
Write-Host "2) Publishable/anon key"
Write-Host "Then paste both inside the app: Settings > الحساب والسحابة."
