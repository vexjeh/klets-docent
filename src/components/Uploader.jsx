import { useState, useRef, useCallback } from 'react';
import { Upload, FileAudio, Trash2, Loader2, Video } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { transcribeAudio, analyzeTranscript } from '../services/api';
import TranscriptView from './TranscriptView';
import AnalysisChat from './AnalysisChat';
import './Uploader.css';

const STATES = {
  UPLOAD: 'upload',
  EXTRACTING: 'extracting',
  TRANSCRIBING: 'transcribing',
  READY: 'ready',
  ERROR: 'error',
};

// ffmpeg.wasm core files — loaded from CDN (gecached door browser na 1e keer)
const FFMPEG_CORE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';

// Singleton FFmpeg instantie (lazy loading, eenmalig)
let ffmpegInstance = null;
let ffmpegLoading = null;

async function getFFmpeg() {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (ffmpegLoading) return ffmpegLoading;

  ffmpegInstance = new FFmpeg();
  ffmpegInstance.on('log', ({ message }) => {
    console.log('[ffmpeg.wasm]', message);
  });

  ffmpegLoading = (async () => {
    const coreURL = await toBlobURL(`${FFMPEG_CORE_URL}/ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await toBlobURL(`${FFMPEG_CORE_URL}/ffmpeg-core.wasm`, 'application/wasm');
    await ffmpegInstance.load({ coreURL, wasmURL });
    return ffmpegInstance;
  })();

  return ffmpegLoading;
}

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
const AUDIO_ONLY_EXTENSIONS = ['webm', 'mp3', 'wav', 'm4a', 'ogg', 'opus', 'flac', 'aac'];

function isVideoFile(file) {
  if (file.type.startsWith('video/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext) && !AUDIO_ONLY_EXTENSIONS.includes(ext);
}

/**
 * Extract audio from a video file using ffmpeg.wasm.
 * Verwerkt in seconden i.p.v. real-time — ongeacht de videolengte.
 * Gebruikt AAC 16kHz mono voor kleine bestandsgrootte + OpenAI-compatibiliteit.
 */
async function extractAudioFromVideo(videoFile) {
  const ffmpeg = await getFFmpeg();

  const inputExt = videoFile.name.split('.').pop()?.toLowerCase() || 'mp4';
  const inputName = `input-${Date.now()}.${inputExt}`;
  const outputName = `output-${Date.now()}.m4a`;

  try {
    // Schrijf video naar ffmpeg's virtuele filesystem
    ffmpeg.writeFile(inputName, await fetchFile(videoFile));

    // Extraheer audio: geen video, AAC 16kHz mono, 64kbps
    await ffmpeg.exec([
      '-i', inputName,
      '-vn',                    // geen video track
      '-c:a', 'aac',            // AAC codec
      '-ac', '1',               // mono
      '-ar', '16000',           // 16kHz sample rate
      '-b:a', '64k',            // 64kbps (ruim voldoende voor spraak)
      '-y',                     // overschrijf output
      outputName,
    ]);

    // Lees het resultaat uit
    const data = await ffmpeg.readFile(outputName);
    const audioBlob = new Blob([data], { type: 'audio/mp4' });

    // Opruimen virtueel filesystem
    try { ffmpeg.deleteFile(inputName); } catch {}
    try { ffmpeg.deleteFile(outputName); } catch {}

    if (audioBlob.size === 0) {
      throw new Error('Geen audio gevonden in deze video.');
    }

    return audioBlob;
  } catch (err) {
    // Opruimen bij fout
    try { ffmpeg.deleteFile(inputName); } catch {}
    try { ffmpeg.deleteFile(outputName); } catch {}
    throw err;
  }
}

export default function Uploader({ onTranscriptReady }) {
  const [state, setState] = useState(STATES.UPLOAD);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const processFile = useCallback(async (file) => {
    if (!file) return;

    const validTypes = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/mp4', 'audio/ogg', 'audio/opus', 'video/mp4'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!validTypes.includes(file.type) && !file.name.match(/\.(webm|mp3|wav|m4a|mp4|ogg|opus|flac|aac|mov|mkv|avi)$/i)) {
      setError('Ongeldig bestand. Gebruik MP3, WAV, M4A, MP4, WebM, OGG of Opus.');
      return;
    }

    setFileName(file.name);
    setError('');
    setState(STATES.TRANSCRIBING);

    try {
      let audioFile = file;
      let audioFormat = file.type || 'audio/webm';

      // Extraheer audio uit video via ffmpeg.wasm (véél sneller dan real-time)
      if (isVideoFile(file)) {
        setState(STATES.EXTRACTING);

        const audioBlob = await extractAudioFromVideo(file);

        audioFile = new File([audioBlob], file.name.replace(/\.[^.]+$/, '.m4a'), { type: 'audio/mp4' });
        audioFormat = 'audio/mp4';
      }

      setState(STATES.TRANSCRIBING);

      // Lees bestand als base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(audioFile);
      });

      const result = await transcribeAudio(base64, audioFormat);
      setState(STATES.READY);
      onTranscriptReady(result.text, file.name);
    } catch (err) {
      setError(err.message);
      setState(STATES.ERROR);
    }
  }, [onTranscriptReady]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files[0];
    processFile(file);
  }, [processFile]);

  const handleReset = useCallback(() => {
    setState(STATES.UPLOAD);
    setFileName('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return (
    <div className="uploader">
      {(state === STATES.EXTRACTING) && (
        <div className="uploader-card transcribing">
          <Video size={48} className="spinner" strokeWidth={1} />
          <h2>Audio wordt uitgelezen uit video...</h2>
          <p className="file-name">{fileName}</p>
          <p className="hint">Videotrack wordt genegeerd, enkel audio wordt verwerkt</p>
          <p className="hint" style={{ fontSize: '0.8em', opacity: 0.7 }}>
            (ffmpeg.wasm — seconden i.p.v. minuten)
          </p>
        </div>
      )}

      {state === STATES.TRANSCRIBING && (
        <div className="uploader-card transcribing">
          <Loader2 size={48} className="spinner" strokeWidth={1} />
          <h2>Bezig met transcriberen...</h2>
          <p className="file-name">{fileName}</p>
          <p className="hint">Dit kan enkele seconden duren</p>
        </div>
      )}

      {(state === STATES.UPLOAD || state === STATES.ERROR) && (
        <div
          className={`uploader-card dropzone ${dragging ? 'dragging' : ''} ${state === STATES.ERROR ? 'has-error' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="drop-icon">
            {dragging ? <FileAudio size={64} strokeWidth={1} /> : <Upload size={48} strokeWidth={1.5} />}
          </div>

          {state === STATES.UPLOAD ? (
            <>
              <h2>Audiofragment uploaden</h2>
              <p className="drop-hint">Sleep een audio- of videobestand hierheen of klik om te kiezen</p>
              <p className="formats">MP3, WAV, M4A, MP4, WebM, OGG, Opus, FLAC</p>
              <p className="video-note">📹 MP4 video: audio wordt razendsnel uitgelezen via ffmpeg.wasm, video genegeerd</p>
            </>
          ) : (
            <>
              <h2 className="error-title">Er is iets misgegaan</h2>
              <p className="error-msg">{error}</p>
              <button className="retry-btn" onClick={(e) => { e.stopPropagation(); handleReset(); }}>
                Opnieuw proberen
              </button>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/mp4"
            onChange={handleFileSelect}
            hidden
          />
        </div>
      )}

      {state === STATES.READY && (
        <div className="uploader-card done-card">
          <div className="done-header">
            <FileAudio size={20} strokeWidth={1.5} />
            <span className="done-name">{fileName}</span>
            <button className="reset-btn" onClick={handleReset} title="Nieuw bestand">
              <Trash2 size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
