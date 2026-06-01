import { useState, useRef, useCallback } from 'react';
import { Upload, FileAudio, Trash2, Loader2 } from 'lucide-react';
import { transcribeAudio, analyzeTranscript } from '../services/api';
import TranscriptView from './TranscriptView';
import AnalysisChat from './AnalysisChat';
import './Uploader.css';

const STATES = {
  UPLOAD: 'upload',
  TRANSCRIBING: 'transcribing',
  READY: 'ready',
  ERROR: 'error',
};

export default function Uploader({ onTranscriptReady }) {
  const [state, setState] = useState(STATES.UPLOAD);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const processFile = useCallback(async (file) => {
    if (!file) return;

    const validTypes = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/mp4', 'audio/ogg', 'audio/opus'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(webm|mp3|wav|m4a|mp4|ogg|opus|flac|aac)$/i)) {
      setError('Ongeldig audioformaat. Gebruik MP3, WAV, M4A, WebM, OGG of Opus.');
      return;
    }

    setFileName(file.name);
    setError('');
    setState(STATES.TRANSCRIBING);

    try {
      // Read file as base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await transcribeAudio(base64, file.type || 'audio/webm');
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
              <p className="drop-hint">Sleep een audiobestand hierheen of klik om te kiezen</p>
              <p className="formats">MP3, WAV, M4A, WebM, OGG, Opus, FLAC</p>
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
            accept="audio/*"
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
