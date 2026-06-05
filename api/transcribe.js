import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Supported by gpt-4o-transcribe: mp3, mp4, mpeg, mpga, m4a, wav, webm
const SUPPORTED_BY_GPT4O = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'];

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

function isSupported(ext, audioFormat) {
  const fmt = (audioFormat || '').toLowerCase();
  // Force conversion for video files (mp4 container, video/* MIME) — strip video track, send only audio
  if (ext === 'mp4' || fmt.includes('video/')) return false;
  if (SUPPORTED_BY_GPT4O.includes(ext)) return true;
  if (fmt.includes('mp3') || fmt.includes('mpeg')) return true;
  if (fmt.includes('m4a') || fmt.includes('wav') || fmt.includes('webm')) return true;
  return false;
}

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const FFMPEG_PATH = require('@ffmpeg-installer/ffmpeg').path;

function convertToMp3(inputPath, outputPath) {
  execFileSync(FFMPEG_PATH, [
    '-y',                   // overwrite output
    '-i', inputPath,        // input file
    '-acodec', 'libmp3lame', // mp3 codec
    '-ac', '1',             // mono (all we need for speech)
    '-ar', '16000',         // 16kHz (Whisper standard sample rate)
    '-ab', '64k',           // 64kbps is fine for speech
    outputPath,
  ], { timeout: 30000 });
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
  let convertedPath = null;
  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const ext = detectExt(audioFormat);
    const needsConversion = !isSupported(ext, audioFormat);

    const model = 'gpt-4o-transcribe';
    const fileExt = needsConversion ? 'mp3' : ext;

    tmpPath = path.join(os.tmpdir(), `klets-audio-${Date.now()}.${ext}`);
    fs.writeFileSync(tmpPath, audioBuffer);

    if (needsConversion) {
      convertedPath = path.join(os.tmpdir(), `klets-audio-${Date.now()}.mp3`);
      convertToMp3(tmpPath, convertedPath);
    }

    const filePath = convertedPath || tmpPath;

    const transcription = await openai.audio.transcriptions.create({
      model,
      file: fs.createReadStream(filePath),
      prompt: 'Spreektaal transcriptie. Spontaan gesproken Nederlands heeft korte zinnen, informele vormen en aarzelingen — schrijf het precies zoals het klinkt. Geen correcties.',
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
    [tmpPath, convertedPath].forEach(p => {
      if (p) try { fs.unlinkSync(p); } catch {}
    });
  }
};
