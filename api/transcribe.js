import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY niet ingesteld' });
  }

  const { audioBase64, audioFormat } = req.body || {};

  if (!audioBase64) {
    return res.status(400).json({ error: 'Geen audio data (audioBase64)' });
  }

  let tmpPath = null;
  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const ext = (audioFormat || 'audio/webm').includes('mp3') ? 'mp3' :
                (audioFormat || '').includes('m4a') ? 'm4a' :
                (audioFormat || '').includes('wav') ? 'wav' : 'webm';

    // Write to temp file for reliable streaming
    tmpPath = path.join(os.tmpdir(), `klets-audio-${Date.now()}.${ext}`);
    fs.writeFileSync(tmpPath, audioBuffer);

    const transcription = await openai.audio.transcriptions.create({
      model: 'gpt-4o-mini-transcribe',
      file: fs.createReadStream(tmpPath),
      response_format: 'json',
    });

    return res.status(200).json({
      text: transcription.text,
      language: 'nl',
      model: 'gpt-4o-mini-transcribe',
    });
  } catch (err) {
    console.error('Transcriptie error:', err.status, err.message, err);
    return res.status(err.status || 500).json({
      error: `Transcriptie mislukt: ${err.status || 500}`,
      detail: err.message,
    });
  } finally {
    if (tmpPath) {
      try { fs.unlinkSync(tmpPath); } catch {}
    }
  }
};
