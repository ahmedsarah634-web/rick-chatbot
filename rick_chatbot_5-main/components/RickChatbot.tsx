import React, { useState, useRef, useEffect } from 'react';
import { Send, Volume2, Trash2 } from 'lucide-react';
import Rick3DViewer from './Rick3DViewer';

const RickChatbot = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const audioRef = useRef(null);
  const recognitionRef = useRef(null);

  // ===============================
  // Speech Recognition Setup (Multilingual)
  // ===============================
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();

        // Multilingual speech recognition
        export default RickChatbot;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.continuous = false;

        recognitionRef.current.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          sendMessage(transcript);
        };

        recognitionRef.current.onerror = (event) => {
          console.error("Speech recognition error:", event.error);
        };
      }
    }
  }, []);

  const startListening = async () => {
    // Unlock audio for mobile browsers
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        audioRef.current.pause();
      } catch (e) {}
    }

    if (recognitionRef.current && !isPlayingAudio) {
      recognitionRef.current.start();
    }
  };

  // ===============================
  // Audio Playback
  // ===============================
  useEffect(() => {
    if (audioUrl && audioRef.current && pendingMessage) {
      setIsPlayingAudio(true);
      audioRef.current.src = audioUrl;
      audioRef.current.load();

      audioRef.current.play().catch(err => {
        console.error('Playback error', err);
        finishRickMessage();
      });
    }
  }, [audioUrl, pendingMessage]);

  const finishRickMessage = () => {
    if (pendingMessage) {
      setMessages(prev => [...prev, pendingMessage]);
      setPendingMessage(null);
    }

    setIsPlayingAudio(false);

    // Continuous conversation
    if (recognitionRef.current) {
      recognitionRef.current.start();
    }
  };

  // ===============================
  // Send Message
  // ===============================
  const sendMessage = async (voiceText = null) => {
    const messageToSend = voiceText || inputMessage;
    if (!messageToSend.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: messageToSend,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setIsThinking(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].slice(-10)
        }),
      });

      const data = await response.json();

      const rickMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: Date.now()
      };

      setIsThinking(false);

      if (data.audioUrl) {
        setPendingMessage(rickMessage);
        setAudioUrl(data.audioUrl);
      } else {
        setMessages(prev => [...prev, rickMessage]);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Aw jeez, something went wrong!',
          timestamp: Date.now()
        }
      ]);
      setIsThinking(false);
    } finally {
      setIsLoading(false);
    }
  };

  // ===============================
  // Controls
  // ===============================
  const clearChat = () => {
    setMessages([]);
    setAudioUrl(null);
    setPendingMessage(null);
    setIsPlayingAudio(false);
    setIsThinking(false);
  };

  const replayAudio = () => {
    if (audioRef.current && audioUrl) {
      setIsPlayingAudio(true);
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  // ===============================
  // UI
  // ===============================
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#ffffff] to-black">
      <div className="max-w-6xl mx-auto p-4 flex flex-col h-screen">

        {/* 3D Rick */}
        <div className="flex-1 bg-black bg-opacity-30 rounded-lg border border-[#ff5e00] shadow-2xl overflow-hidden mb-4">
          <Rick3DViewer 
            isPlayingAudio={isPlayingAudio}
            isThinking={isThinking}
            isLoading={isLoading}
            modelUrl="/models/rick.glb"
            backgroundImageUrl="https://res.cloudinary.com/dzq7c0mxt/image/upload/v1749164013/Rick_and_Morty_custom_portrait_background_green_portal_qpg1kq.jpg"
          />
        </div>

        {/* Input Area */}
        <div className="bg-black bg-opacity-30 rounded-lg border border-[#ff5e00] shadow-2xl p-4">
          <div className="flex space-x-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Talk to Rick..."
              className="flex-1 p-4 bg-black bg-opacity-50 border border-[#ff5e00] rounded-lg text-white"
              disabled={isLoading || isPlayingAudio || isThinking}
            />

            <button
              onClick={startListening}
              className="px-4 py-4 bg-black border border-[#ff5e00] text-white rounded-lg"
            >
              🎤
            </button>

            <button
              onClick={() => sendMessage()}
              disabled={isLoading || isPlayingAudio || isThinking || !inputMessage.trim()}
              className="px-6 py-4 bg-[#ff5e00] text-white rounded-lg"
            >
              <Send size={24} />
            </button>
          </div>

          <div className="text-center text-[#ff5e00] mt-2">
            {isThinking && <p>Rick is thinking...</p>}
            {isPlayingAudio && <p>Rick is talking...</p>}
          </div>

          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={clearChat}
              className="flex items-center space-x-2 px-4 py-2 bg-black text-white rounded-lg border border-[#ff5e00]"
            >
              <Trash2 size={16} />
              <span>Clear Chat</span>
            </button>

            {audioUrl && (
              <button
                onClick={replayAudio}
                className="flex items-center space-x-2 px-4 py-2 bg-[#ff5e00] text-white rounded-lg"
              >
                <Volume2 size={16} />
                <span>Replay Audio</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        className="hidden"
        preload="auto"
        onEnded={finishRickMessage}
      />
    </div>
  );
};

export default RickChatbot; 
  
