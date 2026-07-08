'use client';

import { useState } from 'react';
import { Send, Bot, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Message = {
  id: number;
  sender: 'ai' | 'user';
  text: string;
};

export default function AuditRoomPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, sender: 'ai', text: "Welcome to the Audit Room. I noticed that for the 'TechNova Acquisition' matter, the exact deal value wasn't mentioned. Could you provide the approximate value?" }
  ]);
  const [input, setInput] = useState('');
  const [completeness, setCompleteness] = useState(65);
  const [questionsLeft, setQuestionsLeft] = useState(41);
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    const newMsg: Message = { id: Date.now(), sender: 'user', text: input };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate AI processing and responding
    setTimeout(() => {
      setCompleteness(prev => Math.min(prev + 5, 100));
      setQuestionsLeft(prev => Math.max(prev - 1, 0));
      
      const aiResponse: Message = { 
        id: Date.now() + 1, 
        sender: 'ai', 
        text: "Got it, I've updated the deal value to your response. Next, for the 'HealthStart Series B', who was the lead partner from your firm?" 
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleFinish = () => {
    router.push('/reports');
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 120px)' }}>
      
      {/* Left Panel: Context & Progress */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '400px' }}>
        
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={20} color="#2563eb" /> Audit Progress
          </h2>
          
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Completeness Score</span>
              <span style={{ fontSize: '0.9rem', color: '#2563eb', fontWeight: 700 }}>{completeness}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ width: `${completeness}%`, height: '100%', background: '#2563eb', transition: 'width 0.3s ease-out' }}></div>
            </div>
          </div>

          <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>
            <strong>{questionsLeft}</strong> key data points remaining to reach Band 5 standard.
          </p>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: '1rem' }}>Current Submission Context</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Target</div>
              <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 500 }}>Band 5 · Banking & Finance</div>
            </div>
            
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Strengths Detected</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#475569' }}>
                <li>Strong cross-border M&A presence</li>
                <li>High volume of Series B+ funding rounds</li>
              </ul>
            </div>
          </div>
        </div>

      </div>

      {/* Right Panel: The Chat / Interrogator */}
      <div style={{ flex: '2', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        
        {/* Chat Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>RankPilot Co-pilot</h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Strategic Interrogator</p>
            </div>
          </div>
          {completeness >= 80 && (
            <button onClick={handleFinish} style={{ background: '#16a34a', color: '#fff', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', animation: 'pulse 2s infinite' }}>
              <CheckCircle2 size={16} /> Compile Final Report
            </button>
          )}
        </div>

        {/* Chat Messages */}
        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#ffffff' }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{ display: 'flex', gap: '1rem', flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: msg.sender === 'user' ? '#e2e8f0' : '#eff6ff', color: msg.sender === 'user' ? '#475569' : '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {msg.sender === 'user' ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div style={{ 
                background: msg.sender === 'user' ? '#0f172a' : '#f8fafc',
                color: msg.sender === 'user' ? '#ffffff' : '#334155',
                padding: '1rem 1.25rem',
                borderRadius: '12px',
                border: msg.sender === 'user' ? 'none' : '1px solid #e2e8f0',
                maxWidth: '80%',
                fontSize: '0.95rem',
                lineHeight: 1.5,
                borderTopRightRadius: msg.sender === 'user' ? 0 : '12px',
                borderTopLeftRadius: msg.sender === 'ai' ? 0 : '12px',
              }}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={18} />
              </div>
              <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', borderTopLeftRadius: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span className="dot" style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }}></span>
                <span className="dot" style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.2s' }}></span>
                <span className="dot" style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.4s' }}></span>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div style={{ padding: '1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '1rem' }}>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer here..." 
              style={{ flex: 1, padding: '1rem 1.5rem', borderRadius: '9999px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem' }}
            />
            <button 
              type="submit"
              disabled={!input.trim() || isTyping}
              style={{ 
                width: '52px', height: '52px', borderRadius: '50%', background: input.trim() && !isTyping ? '#2563eb' : '#94a3b8',
                color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s'
              }}
            >
              <Send size={20} style={{ marginLeft: '4px' }} />
            </button>
          </form>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(22, 163, 74, 0); }
          100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
        }
      `}} />
    </div>
  );
}
