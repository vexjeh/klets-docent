# Klets Docent

NT2 audio-analyse tool voor docenten. Upload geluidsfragmenten van cursisten, krijg een transcriptie, en stel analysevragen.

## Tech

- **Frontend**: React + Vite
- **Backend**: Vercel serverless functions
- **STT**: Mistral (voxtral-mini-2602)
- **LLM**: Mistral Large

## Deploy naar Vercel

1. Fork/clone deze repo
2. Link met Vercel
3. Zet env var `MISTRAL_API_KEY` in Vercel dashboard
4. Deploy!

## Lokaal ontwikkelen

```bash
npm install
npm run dev
```

Zorg dat je een `.env.local` hebt met `VITE_MISTRAL_API_KEY=...` (gebruikt door de API endpoints).
