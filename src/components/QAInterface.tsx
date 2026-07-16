'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

interface QAInterfaceProps {
  documentText: string;
}

export default function QAInterface({ documentText }: QAInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: "I've processed this document. You can ask me any question about its content, numbers, or conclusions, and I'll extract the answers for you!"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat history
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userQuestion = input.trim();
    setInput('');
    setMessages(prev => [...prev, { sender: 'user', text: userQuestion }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: documentText,
          question: userQuestion
        })
      });

      if (!res.ok) {
        throw new Error('Failed to query the document');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader available');

      // Add a placeholder message for the AI's response
      setMessages(prev => [...prev, { sender: 'ai', text: '' }]);

      let accumulatedText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { sender: 'ai', text: accumulatedText };
          return updated;
        });
      }
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [
        ...prev, 
        { sender: 'ai', text: `⚠️ Error: ${err.message || 'Unable to connect to the analysis engine. Please try again.'}` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Basic formatter for lists and bold styling in Chat bubbles
  const renderFormattedMessage = (text: string) => {
    return text.split('\n').map((line, idx) => {
      // Bold text formatting
      let formattedLine = line;
      const boldRegex = /\*\*(.*?)\*\*/g;
      
      // Handle list items
      if (line.startsWith('* ') || line.startsWith('- ')) {
        const content = line.substring(2);
        return (
          <li key={idx} style={{ marginLeft: '1rem', listStyleType: 'disc', marginBottom: '0.25rem' }}>
            <span dangerouslySetInnerHTML={{ __html: content.replace(boldRegex, '<strong>$1</strong>') }} />
          </li>
        );
      }
      
      if (line.trim() === '') {
        return <div key={idx} style={{ height: '0.5rem' }} />;
      }

      return (
        <p key={idx} style={{ marginBottom: '0.4rem' }} dangerouslySetInnerHTML={{ 
          __html: formattedLine.replace(boldRegex, '<strong>$1</strong>') 
        }} />
      );
    });
  };

  return (
    <div className="qa-container">
      <div className="chat-history">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`chat-bubble ${msg.sender === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}
          >
            {renderFormattedMessage(msg.text)}
          </div>
        ))}
        {loading && (
          <div className="chat-bubble chat-bubble-ai" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="badge-dot" style={{ backgroundColor: 'var(--accent-cyan)' }} />
            <span className="badge-dot" style={{ backgroundColor: 'var(--accent-cyan)', animationDelay: '0.3s' }} />
            <span className="badge-dot" style={{ backgroundColor: 'var(--accent-cyan)', animationDelay: '0.6s' }} />
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSend}>
        <input
          type="text"
          className="chat-input"
          placeholder="Ask a question about the document..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading || !documentText}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={loading || !input.trim() || !documentText}
        >
          ➔
        </button>
      </form>
    </div>
  );
}
