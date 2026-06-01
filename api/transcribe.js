const MISTRAL_BASE = 'https://api.mistral.ai/v1';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'MISTRAL_API_KEY niet ingesteld' });
  }

  const { audioBase64, audioFormat } = req.body || {};

  if (!audioBase64) {
    return res.status(400).json({ error: 'Geen audio data (audioBase64)' });
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // Step 1: Upload file to Mistral
    const uploadForm = new FormData();
    const blob = new Blob([audioBuffer], { type: audioFormat || 'audio/webm' });
    uploadForm.append('file', blob, 'audio.webm');
    uploadForm.append('purpose', 'audio');

    const uploadRes = await fetch(`${MISTRAL_BASE}/files`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: uploadForm,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return res.status(uploadRes.status).json({
        error: `Upload mislukt: ${uploadRes.status}`,
        detail: err,
      });
    }

    const { id: fileId } = await uploadRes.json();

    // Step 2: Transcribe
    const transcribeForm = new FormData();
    transcribeForm.append('model', 'voxtral-mini-2602');
    transcribeForm.append('language', 'nl');
    transcribeForm.append('file_id', fileId);

    const transcribeRes = await fetch(`${MISTRAL_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: transcribeForm,
    });

    if (!transcribeRes.ok) {
      const err = await transcribeRes.text();
      return res.status(transcribeRes.status).json({
        error: `Transcriptie mislukt: ${transcribeRes.status}`,
        detail: err,
      });
    }

    const data = await transcribeRes.json();

    return res.status(200).json({
      text: data.text,
      language: data.language || 'nl',
      model: 'voxtral-mini-2602',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
