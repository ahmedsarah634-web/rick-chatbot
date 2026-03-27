import React, { useState, useRef, useEffect } from 'react';
import { Send, Volume2, Trash2, MessageSquare, X } from 'lucide-react';
import Rick3DViewer from './Rick3DViewer';

const RickChatbot = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const audioRef = useRef(null);
  const chatHistoryRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom whenever messages change or chat history is shown
  useEffect(() => {
    if (messagesEndRef.current && showChatHistory) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, pendingMessage, showChatHistory]);

  // Handle audio playback when audioUrl updates
  useEffect(() => {
    if (audioUrl && audioRef.current && pendingMessage) {
      console.log('Starting audio playback');
      setIsPlayingAudio(true);
      audioRef.current.src = audioUrl;
      audioRef.current.load();
      audioRef.current.play().catch(err => {
        console.error('Playback error', err);
        // Add pending message to chat history on error
        setMessages(prev => [...prev, pendingMessage]);
        setPendingMessage(null);
        setIsPlayingAudio(false);
      });
    }
  }, [audioUrl, pendingMessage]);

  // Handle audio end
  const handleAudioEnd = () => {
    console.log('Audio ended, adding message to chat history');
    if (pendingMessage) {
      // Add the pending message to the chat history
      setMessages(prev => [...prev, pendingMessage]);
      setPendingMessage(null);
    }
    setIsPlayingAudio(false);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // Create and add user message
    const userMessage = { role: 'user', content: inputMessage, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setIsThinking(true);

    try {
      // Send request to API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].slice(-10)
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Create Rick's response message
      const rickMessage = { 
        role: 'assistant', 
        content: data.message, 
        timestamp: Date.now() 
      };

      setIsThinking(false);

      if (data.audioUrl) {
        // Store as pending message until audio finishes
        console.log('Received audio, setting as pending message');
        setPendingMessage(rickMessage);
        setAudioUrl(data.audioUrl);
      } else {
        // No audio, add directly to chat history
        console.log('No audio, adding message directly to chat');
        setMessages(prev => [...prev, rickMessage]);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = { 
        role: 'assistant', 
        content: 'Aw jeez, something went wrong with the interdimensional communication! Try again, *burp*', 
        timestamp: Date.now() 
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsThinking(false);
    } finally {
      setIsLoading(false);
    }
  };

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
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  const toggleChatHistory = () => {
    setShowChatHistory(prev => !prev);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Log message state for debugging
  useEffect(() => {
    console.log('Messages array:', messages);
    console.log('Pending message:', pendingMessage);
  }, [messages, pendingMessage]);

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#ffffff] to-black">
      <div className="max-w-6xl mx-auto p-4 flex flex-col h-screen">
        {/* 3D Model Container */}
        <div className="flex-1 bg-black bg-opacity-30 backdrop-blur-sm rounded-lg border border-[#ff5e00] shadow-2xl overflow-hidden mb-4">
          <Rick3DViewer 
            isPlayingAudio={isPlayingAudio}
            isThinking={isThinking}
            isLoading={isLoading}
            modelUrl="/models/rick.glb"
            backgroundImageUrl= "https://res.cloudinary.com/dzq7c0mxt/image/upload/v1749164013/Rick_and_Morty_custom_portrait_background_green_portal_qpg1kq.jpg"
          />
        </div>

        {/* Input Area */}
        <div className="bg-black bg-opacity-30 backdrop-blur-sm rounded-lg border border-[#ff5e00] shadow-2xl p-4">
          {/* Message input */}
          <div className="flex space-x-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Rick something..."
              className="flex-1 p-4 bg-black bg-opacity-50 border border-[#ff5e00] rounded-lg text-white placeholder-[#ffffff] focus:outline-none focus:border-[#ff5e00] focus:ring-1 focus:ring-[#ff5e00] text-lg"
              disabled={isLoading || isPlayingAudio || isThinking}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || isPlayingAudio || isThinking || !inputMessage.trim()}
              className="px-6 py-4 bg-[#ff5e00] hover:bg-[#ff7e30] disabled:bg-black disabled:opacity-50 text-white rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              <Send size={24} />
            </button>
          </div>

          {/* Status indicator */}
          <div className="text-center text-[#ff5e00] mt-2">
            {isThinking && <p>Rick is thinking...</p>}
            {isPlayingAudio && <p>Rick is talking...</p>}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-3 justify-center mt-4">
            <button
              onClick={clearChat}
              className="flex items-center space-x-2 px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-lg transition-colors duration-200 border border-[#ff5e00]"
            >
              <Trash2 size={16} />
              <span>Clear Chat</span>
            </button>
            
            {audioUrl && (
              <button
                onClick={replayAudio}
                disabled={isThinking}
                className="flex items-center space-x-2 px-4 py-2 bg-[#ff5e00] hover:bg-[#ff7e30] disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors duration-200"
              >
                <Volume2 size={16} />
                <span>Replay Audio</span>
              </button>
            )}
            
           
          </div>
          
          {/* Chat History - Simplified Implementation */}
          {showChatHistory && (
            <div 
              className="mt-4 p-3 bg-black bg-opacity-70 rounded-lg border border-[#ff5e00] text-white max-h-60 overflow-y-auto"
            >
              {messages.length === 0 && !pendingMessage ? (
                <p className="text-center text-gray-400 italic">No messages yet. Start the conversation!</p>
              ) : (
                <div className="space-y-4">
                  {/* Display all messages in chat history */}
                  {messages.map((msg, index) => (
                    <div 
                      key={`msg-${index}-${msg.timestamp}`} 
                      className={`p-2 rounded-lg ${
                        msg.role === 'user' 
                          ? 'bg-black text-white border border-white' 
                          : 'bg-black text-[#ff5e00] border border-[#ff5e00]'
                      }`}
                    >
                      <div className="font-bold mb-1">
                        {msg.role === 'user' ? 'You' : 'Rick'}
                      </div>
                      <div>{msg.content}</div>
                      <div className="text-xs opacity-50 text-right mt-1">
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  ))}
                  
                  {/* Display pending message if available */}
                  {pendingMessage && (
                    <div 
                      className="p-2 rounded-lg bg-black text-[#ff5e00] border border-[#ff5e00] animate-pulse"
                    >
                      <div className="font-bold mb-1">
                        Rick <span className="text-sm">(Speaking...)</span>
                      </div>
                      <div>{pendingMessage.content}</div>
                      <div className="text-xs opacity-50 text-right mt-1">
                        {formatTime(pendingMessage.timestamp)}
                      </div>
                    </div>
                  )}
                  
                  {/* Invisible element to scroll to */}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Audio element */}
      <audio
        ref={audioRef}
        className="hidden"
        preload="auto"
        onEnded={handleAudioEnd}
      />
    </div>
  );
};

export default RickChatbot;
