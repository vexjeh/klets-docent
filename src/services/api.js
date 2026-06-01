const API_BASE = '/api';

export async function transcribeAudio(audioBase64, audioFormat) {
  const res = await fetch(`${API_BASE}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, audioFormat }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Transcriptie mislukt (${res.status})`);
  }

  const data = await res.json();
  if (!data.text) throw new Error('Geen transcriptie ontvangen');
  return data;
}

export async function analyzeTranscript(transcript, question) {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, question }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Analyse mislukt (${res.status})`);
  }

  const data = await res.json();
  if (!data.analysis) throw new Error('Geen analyse ontvangen');
  return data;
}
