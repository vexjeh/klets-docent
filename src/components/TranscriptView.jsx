import { useRef, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import './TranscriptView.css';

export default function TranscriptView({ transcript, fileName }) {
  const [copied, setCopied] = useState(false);
  const textRef = useRef(null);

  useEffect(() => {
    if (textRef.current) {
      textRef.current.scrollTop = 0;
    }
  }, [transcript]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = transcript?.trim().split(/\s+/).length || 0;

  return (
    <div className="transcript-view">
      <div className="transcript-header">
        <div className="transcript-info">
          <h3>Transcriptie</h3>
          {fileName && <span className="source-name">{fileName}</span>}
        </div>
        <div className="transcript-meta">
          <span className="word-count">{wordCount} woorden</span>
          <button className="copy-btn" onClick={handleCopy} title="Kopiëren">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Gekopieerd' : 'Kopiëren'}
          </button>
        </div>
      </div>
      <div className="transcript-text" ref={textRef}>
        {transcript}
      </div>
    </div>
  );
}
