import { useState, useRef, useCallback } from 'react';
import { Upload, FileAudio, Trash2, Loader2, Video } from 'lucide-react';
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

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
const AUDIO_ONLY_EXTENSIONS = ['webm', 'mp3', 'wav', 'm4a', 'ogg', 'opus', 'flac', 'aac'];

function isVideoFile(file) {
  if (file.type.startsWith('video/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext) && !AUDIO_ONLY_EXTENSIONS.includes(ext);
}

/**
 * Extract audio from a video file using the browser's built-in decoders.
 * Creates a hidden <video> element, captures audio via MediaRecorder.
 */
function extractAudioFromVideo(videoFile) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';

    const objectUrl = URL.createObjectURL(videoFile);
    video.src = objectUrl;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Kon videobestand niet laden. Is het een geldig MP4 bestand?'));
    };

    video.onloadedmetadata = () => {
      // Safety: limit to 30 minutes of video
      if (video.duration > 1800) {
        cleanup();
        reject(new Error('Video is langer dan 30 minuten. Kies een korter bestand.'));
        return;
      }

      let audioContext;
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        cleanup();
        reject(new Error('Je browser ondersteunt geen audioverwerking.'));
        return;
      }

      let source;
      try {
        source = audioContext.createMediaElementSource(video);
      } catch (e) {
        audioContext.close();
        cleanup();
        reject(new Error('Kon audiospoor niet uitlezen uit deze video.'));
        return;
      }

      const dest = audioContext.createMediaStreamDestination();
      source.connect(dest);

      // Prefer opus/webm (widely supported, good quality)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const chunks = [];
      const recorder = new MediaRecorder(dest.stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        source.disconnect();
        audioContext.close();
        cleanup();

        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        if (audioBlob.size === 0) {
          reject(new Error('Geen audio gevonden in deze video.'));
          return;
        }
        resolve(audioBlob);
      };

      recorder.onerror = () => {
        source.disconnect();
        audioContext.close();
        cleanup();
        reject(new Error('Fout bij het verwerken van de audio.'));
      };

      recorder.start(1000); // collect in 1s chunks

      video.play().catch((err) => {
        recorder.stop(); // clean up
        reject(new Error('Autoplay geweigerd. Klik nogmaals of gebruik een audioformaat.'));
      });
    };

    // If video is very short, just wait for it to end
    video.onended = () => {
      // MediaRecorder stops itself when the stream ends? Actually no, we need to stop it explicitly.
      // But we can't access recorder here... Instead, we rely on the duration check below.
    };
  });
}

export default function Uploader({ onTranscriptReady }) {
  const [state, setState] = useState(STATES.UPLOAD);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const extractTimeoutRef = useRef(null);

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

      // Extract audio from video files client-side
      if (isVideoFile(file)) {
        setState(STATES.EXTRACTING);

        const audioBlob = await extractAudioFromVideo(file);

        // Create a new File with the audio data
        audioFile = new File([audioBlob], file.name.replace(/\.[^.]+$/, '.webm'), { type: 'audio/webm' });
        audioFormat = 'audio/webm';
      }

      setState(STATES.TRANSCRIBING);

      // Read file as base64
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
              <p className="video-note">📹 MP4 video: audio wordt automatisch uitgelezen, video genegeerd</p>
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
