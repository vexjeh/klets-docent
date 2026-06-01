import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { analyzeTranscript } from '../services/api';
import './AnalysisChat.css';

export default function AnalysisChat({ transcript }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-run general analysis on first load
  useEffect(() => {
    if (transcript && messages.length === 0) {
      runAnalysis('');
    }
  }, [transcript]);

  const runAnalysis = async (question) => {
    setLoading(true);
    setError('');

    const userQuestion = question.trim() || 'Algemene analyse';
    setMessages((prev) => [...prev, { role: 'user', content: userQuestion }]);

    try {
      const result = await analyzeTranscript(transcript, question.trim() || undefined);
      setMessages((prev) => [...prev, { role: 'assistant', content: result.analysis }]);
    } catch (err) {
      setError(err.message);
      // Remove the user message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    runAnalysis(question);
  };

  const handleSuggestion = (suggestion) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  const suggestions = [
    'Welke grammaticale fouten maakt de cursist?',
    'Wat is het geschatte CEFR-niveau?',
    'Analyseer de woordvolgorde',
    'Welke werkwoordsfouten zie je?',
    'Beoordeel de uitspraak op basis van de transcriptie',
    'Wat zijn de sterke punten en werkpunten?',
  ];

  return (
    <div className="analysis-chat">
      <div className="chat-header">
        <Sparkles size={18} strokeWidth={1.5} />
        <h3>Analyse</h3>
      </div>

      <div className="messages-area">
        {messages.length === 0 && !loading && (
          <div className="empty-chat">
            <MessageSquare size={32} strokeWidth={1} />
            <p>Stel een vraag over de transcriptie voor een gerichte analyse.</p>
            <div className="suggestions">
              {suggestions.map((s, i) => (
                <button key={i} className="suggestion-chip" onClick={() => handleSuggestion(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            <div className="msg-label">
              {msg.role === 'user' ? 'Jij' : 'Analyse'}
            </div>
            <div className="msg-content">
              {msg.role === 'assistant' ? (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-message assistant loading-msg">
            <div className="msg-label">Analyse</div>
            <div className="msg-content">
              <Loader2 size={18} className="inline-spinner" />
              <span>Bezig met analyseren...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="chat-error">
            <p>{error}</p>
            <button onClick={() => { setError(''); runAnalysis(inputRef.current?.value || ''); }}>
              Opnieuw
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Stel een vraag over de transcriptie..."
          disabled={loading}
        />
        <button type="submit" disabled={!input.trim() || loading} title="Versturen">
          <Send size={18} strokeWidth={1.5} />
        </button>
      </form>
    </div>
  );
}
