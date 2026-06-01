# Klets Docent

NT2 audio-analyse tool voor docenten. Upload geluidsfragmenten van cursisten, krijg een transcriptie, en stel analysevragen.

## Tech

- **Frontend**: React + Vite
- **Backend**: Vercel serverless functions
- **STT**: OpenAI Whisper (whisper-1)
- **LLM**: Mistral Large

## Deploy naar Vercel

1. Fork/clone deze repo
2. Link met Vercel
3. Zet deze env vars in Vercel dashboard:
   - `OPENAI_API_KEY` — voor transcriptie (Whisper)
   - `MISTRAL_API_KEY` — voor analyse (Mistral Large)
4. Deploy!

## Lokaal ontwikkelen

```bash
npm install
npm run dev
```

Zorg dat je een `.env.local` hebt met de API keys.
