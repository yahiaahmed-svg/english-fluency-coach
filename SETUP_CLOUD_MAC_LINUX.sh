#!/usr/bin/env bash
set -e
echo "English Fluency Coach Pro - Cloud Setup"
read -p "Supabase Project Ref: " PROJECT_REF
read -s -p "OpenAI API Key: " OPENAI_KEY
echo
read -p "Text model [gpt-6-luna]: " TEXT_MODEL
TEXT_MODEL=${TEXT_MODEL:-gpt-6-luna}
read -p "Transcription model [gpt-4o-mini-transcribe]: " TRANSCRIBE_MODEL
TRANSCRIBE_MODEL=${TRANSCRIBE_MODEL:-gpt-4o-mini-transcribe}

npx supabase login
npx supabase link --project-ref "$PROJECT_REF"
npx supabase db push
npx supabase functions deploy ai-coach
npx supabase functions deploy speech-score
npx supabase secrets set OPENAI_API_KEY="$OPENAI_KEY" OPENAI_TEXT_MODEL="$TEXT_MODEL" OPENAI_TRANSCRIBE_MODEL="$TRANSCRIBE_MODEL"

echo "DONE. Copy Project URL + Publishable Key from Supabase Dashboard into the app's Cloud Account screen."
