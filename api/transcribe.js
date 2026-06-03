import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Supported by gpt-4o-mini-transcribe: mp3, mp4, mpeg, mpga, m4a, wav, webm
const GPT4O_SUPPORTED = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'];

function pickModel(audioFormat, ext) {
  // Check if format is supported by gpt-4o-mini-transcribe
  const normalized = (audioFormat || '').toLowerCase();
  if (GPT4O_SUPPORTED.includes(ext)) return 'gpt-4o-mini-transcribe';
  if (normalized.includes('mp3') || normalized.includes('mpeg')) return 'gpt-4o-mini-transcribe';
  if (normalized.includes('m4a') || normalized.includes('mp4')) return 'gpt-4o-mini-transcribe';
  if (normalized.includes('wav')) return 'gpt-4o-mini-transcribe';
  if (normalized.includes('webm')) return 'gpt-4o-mini-transcribe';
  return 'whisper-1';
}

function detectExt(audioFormat) {
  const fmt = (audioFormat || '').toLowerCase();
  if (fmt.includes('mp3') || fmt.includes('mpeg')) return 'mp3';
  if (fmt.includes('m4a') || fmt.includes('mp4')) return 'm4a';
  if (fmt.includes('wav')) return 'wav';
  if (fmt.includes('ogg') || fmt.includes('opus')) return 'ogg';
  if (fmt.includes('webm')) return 'webm';
  if (fmt.includes('flac')) return 'flac';
  if (fmt.includes('aac')) return 'aac';
  return 'webm';
}

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
    const ext = detectExt(audioFormat);
    const model = pickModel(audioFormat, ext);

    tmpPath = path.join(os.tmpdir(), `klets-audio-${Date.now()}.${ext}`);
    fs.writeFileSync(tmpPath, audioBuffer);

    const transcription = await openai.audio.transcriptions.create({
      model,
      file: fs.createReadStream(tmpPath),
      ...(model === 'whisper-1' ? { language: 'nl', temperature: 0 } : {}),
      response_format: 'json',
    });

    return res.status(200).json({
      text: transcription.text,
      language: 'nl',
      model,
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
