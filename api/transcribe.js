const OPENAI_BASE = 'https://api.openai.com/v1';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY niet ingesteld' });
  }

  const { audioBase64, audioFormat } = req.body || {};

  if (!audioBase64) {
    return res.status(400).json({ error: 'Geen audio data (audioBase64)' });
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // Build multipart form for transcription
    const form = new FormData();
    const ext = (audioFormat || 'audio/webm').includes('mp3') ? 'mp3' :
                (audioFormat || '').includes('m4a') ? 'm4a' :
                (audioFormat || '').includes('wav') ? 'wav' : 'webm';
    const mime = audioFormat || 'audio/webm';
    const blob = new Blob([audioBuffer], { type: mime });
    form.append('file', blob, `audio.${ext}`);
    form.append('model', 'gpt-4o-mini-transcribe');
    form.append('response_format', 'json');

    const response = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI transcription error:', response.status, err);
      return res.status(response.status).json({
        error: `Transcriptie mislukt: ${response.status}`,
        detail: err,
      });
    }

    const data = await response.json();

    return res.status(200).json({
      text: data.text,
      language: data.language || 'nl',
      model: 'gpt-4o-mini-transcribe',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
