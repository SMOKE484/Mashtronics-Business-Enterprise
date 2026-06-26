import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './ChatBot.css';
import profileImg from '../../assets/profile.png';

const WELCOME = "Hi! I'm the Mashtronics assistant. Ask me about our security and IT services, pricing, or anything else I can help with.";

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('mashtronics_chat');
      return saved ? JSON.parse(saved) : [{ role: 'assistant', content: WELCOME }];
    } catch {
      return [{ role: 'assistant', content: WELCOME }];
    }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const chatWindowRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('mashtronics_chat', JSON.stringify(messages.slice(-50)));
    } catch {}
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);


  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];

    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: updated[updated.length - 1].content + delta,
                };
                return updated;
              });
            }
          } catch {
            // partial JSON chunk — safe to skip
          }
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: "Sorry, I'm having trouble connecting right now. Please call us on 011 765 4148 or WhatsApp 060 428 4818.",
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="chatbot">
      <button
        className="chatbot__fab"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close chat assistant' : 'Open chat assistant'}
        aria-expanded={open}
      >
        <i className={`fas ${open ? 'fa-times' : 'fa-comment-dots'}`} />
      </button>

      {open && (
        <div className="chatbot__window" ref={chatWindowRef} data-lenis-prevent role="dialog" aria-label="Mashtronics chat assistant">
          <header className="chatbot__header">
            <div className="chatbot__header-info">
              <div className="chatbot__avatar" aria-hidden="true">
                <img src={profileImg} alt="" className="chatbot__avatar-img" />
              </div>
              <div className="chatbot__header-text">
                <strong>Mashtronics Assistant</strong>
                <span className="chatbot__status">● Online</span>
              </div>
            </div>
            <button
              className="chatbot__close"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              <i className="fas fa-times" />
            </button>
          </header>

          <div className="chatbot__messages" ref={messagesContainerRef} role="log" aria-live="polite" aria-relevant="additions">
            {messages.map((msg, i) => (
              <div key={i} className={`chatbot__message chatbot__message--${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="chatbot__bot-avatar" aria-hidden="true">
                    <img src={profileImg} alt="" className="chatbot__avatar-img" />
                  </div>
                )}
                <div className="chatbot__bubble">
                  {msg.role === 'assistant'
                    ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                    : msg.content}
                </div>
              </div>
            ))}

            {loading && messages[messages.length - 1]?.content === '' && (
              <div className="chatbot__message chatbot__message--assistant">
                <div className="chatbot__bot-avatar" aria-hidden="true">
                  <img src={profileImg} alt="" className="chatbot__avatar-img" />
                </div>
                <div className="chatbot__bubble chatbot__bubble--typing" aria-label="Typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot__input-area">
            <textarea
              ref={inputRef}
              className="chatbot__input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about our services..."
              rows={1}
              disabled={loading}
              aria-label="Chat message input"
            />
            <button
              className="chatbot__send"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              <i className="fas fa-paper-plane" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
