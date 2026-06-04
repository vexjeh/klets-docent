import { useState, useCallback } from 'react';
import Uploader from './components/Uploader';
import TranscriptView from './components/TranscriptView';
import AnalysisChat from './components/AnalysisChat';
import './App.css';

function App() {
  const [transcript, setTranscript] = useState('');
  const [fileName, setFileName] = useState('');

  const handleTranscriptReady = useCallback((text, name) => {
    setTranscript(text);
    setFileName(name);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <span className="brand-icon">&#9670;</span>
          Klets Docent
        </h1>
        <p className="subtitle">NT2 audio-analyse voor docenten</p>
      </header>

      <main className="app-main">
        {!transcript ? (
          <section className="upload-section">
            <Uploader onTranscriptReady={handleTranscriptReady} />
          </section>
        ) : (
          <div className="results-layout">
            <section className="transcript-section">
              <Uploader onTranscriptReady={handleTranscriptReady} />
              <TranscriptView transcript={transcript} fileName={fileName} />
            </section>
            {/*
            <section className="analysis-section">
              <AnalysisChat transcript={transcript} />
            </section>
            */}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Klets Docent · Powered by Mistral AI</p>
      </footer>
    </div>
  );
}

export default App;
