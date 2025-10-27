import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Settings, Moon, Sun, Search, Plus, Users, Hash, X, Smile, Upload, User, Check } from 'lucide-react';

const EMOJI_LIST = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😡', '👍', '👎', '❤️', '🔥', '✨', '🎉', '💯', '🙏', '👏', '💪', '🎯', '⚡'];

export default function ChatApp() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [conversations, setConversations] = useState({});
  const [inputMessage, setInputMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [connectionError, setConnectionError] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [tempDisplayName, setTempDisplayName] = useState('');
  const [tempAvatar, setTempAvatar] = useState('');
  
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversations, selectedChat]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectToChat = () => {
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }

    setConnectionError('');
    setDisplayName(username);
    setAvatar(username.charAt(0).toUpperCase());

    const ws = new WebSocket('ws://localhost:8080');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to WebSocket server');
      setIsConnected(true);
      
      ws.send(JSON.stringify({
        type: 'join',
        username: username,
        displayName: username,
        avatar: username.charAt(0).toUpperCase()
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        console.log('Received:', data);
        
        switch (data.type) {
          case 'message':
            const chatId = data.roomId || (data.isOwn ? data.recipient : data.sender);
            setConversations(prev => ({
              ...prev,
              [chatId]: [
                ...(prev[chatId] || []),
                {
                  sender: data.sender,
                  displayName: data.displayName,
                  avatar: data.avatar,
                  text: data.text,
                  timestamp: new Date(data.timestamp),
                  isOwn: data.isOwn
                }
              ]
            }));
            break;
            
          case 'users':
            setOnlineUsers(data.users.filter(u => u.username !== username));
            break;
            
          case 'rooms':
            setRooms(data.rooms);
            break;
            
          case 'profile_updated':
            if (data.username === username) {
              setDisplayName(data.displayName);
              setAvatar(data.avatar);
            }
            break;
            
          case 'error':
            alert(data.text);
            break;
            
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionError('Connection error. Make sure the server is running on ws://localhost:8080');
    };
  };

  const sendMessage = () => {
    if (!inputMessage.trim() || !isConnected || !selectedChat) return;

    const msgData = {
      type: 'message',
      sender: username,
      displayName: displayName,
      avatar: avatar,
      text: inputMessage,
      timestamp: new Date().toISOString()
    };

    if (selectedChat.type === 'room') {
      msgData.roomId = selectedChat.id;
    } else {
      msgData.recipient = selectedChat.id;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msgData));
      setInputMessage('');
      setShowEmojiPicker(false);
    } else {
      alert('Connection lost. Please reconnect.');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const selectChat = (id, type, name) => {
    setSelectedChat({ id, type, name });
    setShowEmojiPicker(false);
  };

  const createRoom = () => {
    if (!newRoomName.trim()) {
      alert('Please enter a room name');
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'create_room',
        roomName: newRoomName,
        creator: username
      }));
      setNewRoomName('');
      setShowCreateRoom(false);
    }
  };

  const updateProfile = () => {
    if (!tempDisplayName.trim()) {
      alert('Display name cannot be empty');
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'update_profile',
        username: username,
        displayName: tempDisplayName,
        avatar: tempAvatar || tempDisplayName.charAt(0).toUpperCase()
      }));
      setShowSettings(false);
    }
  };

  const handleEmojiClick = (emoji) => {
    setInputMessage(prev => prev + emoji);
  };

  const getLastMessage = (chatId) => {
    const conv = conversations[chatId];
    if (!conv || conv.length === 0) return 'No messages yet';
    return conv[conv.length - 1].text;
  };

  const getFilteredUsers = () => {
    return onlineUsers.filter(user => 
      user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getFilteredRooms = () => {
    return rooms.filter(room => 
      room.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  if (!isConnected) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} flex items-center justify-center p-4 transition-colors`}>
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-8 w-full max-w-md transition-colors`}>
          <div className="text-center mb-8">
            <MessageCircle className={`w-16 h-16 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'} mx-auto mb-4`} />
            <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-2`}>Chat App</h1>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Connect and start chatting</p>
          </div>

          {connectionError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{connectionError}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Your Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className={`w-full px-4 py-3 border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition`}
                onKeyPress={(e) => e.key === 'Enter' && connectToChat()}
              />
            </div>

            <button
              onClick={connectToChat}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 transform hover:scale-105"
            >
              Connect to Chat
            </button>
          </div>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`mt-6 w-full ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} py-2 px-4 rounded-lg transition flex items-center justify-center gap-2`}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className={darkMode ? 'text-white' : 'text-gray-800'}>
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </span>
          </button>
        </div>
      </div>
    );
  }

  const currentMessages = selectedChat ? (conversations[selectedChat.id] || []) : [];

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} flex items-center justify-center p-4 transition-colors`}>
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl w-full max-w-6xl h-[700px] flex overflow-hidden`}>
        {/* Sidebar */}
        <div className={`w-80 ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'} border-r flex flex-col`}>
          <div className="p-4 bg-indigo-600 text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold">
                  {avatar}
                </div>
                <div>
                  <h2 className="font-bold">{displayName}</h2>
                  <p className="text-xs text-indigo-100">@{username}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDarkMode(!darkMode)} className="p-2 hover:bg-indigo-700 rounded-lg transition">
                  {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button onClick={() => {
                  setTempDisplayName(displayName);
                  setTempAvatar(avatar);
                  setShowSettings(true);
                }} className="p-2 hover:bg-indigo-700 rounded-lg transition">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-indigo-300" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users or rooms..."
                className="w-full pl-10 pr-4 py-2 bg-indigo-700 text-white placeholder-indigo-300 rounded-lg outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Rooms Section */}
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'} uppercase`}>Rooms</h3>
                <button
                  onClick={() => setShowCreateRoom(true)}
                  className="p-1 hover:bg-indigo-100 dark:hover:bg-gray-700 rounded transition"
                >
                  <Plus className="w-4 h-4 text-indigo-600" />
                </button>
              </div>
              <div className="space-y-1">
                {getFilteredRooms().map((room, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectChat(room.id, 'room', room.name)}
                    className={`w-full p-3 text-left rounded-lg transition ${
                      selectedChat?.id === room.id
                        ? 'bg-indigo-100 dark:bg-indigo-900'
                        : darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Hash className="w-5 h-5 text-indigo-600" />
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-800'} truncate`}>{room.name}</h3>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} truncate`}>
                          {getLastMessage(room.id)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Messages Section */}
            <div className="p-3">
              <h3 className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'} uppercase mb-2`}>
                Direct Messages ({onlineUsers.length})
              </h3>
              <div className="space-y-1">
                {getFilteredUsers().map((user, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectChat(user.username, 'dm', user.displayName)}
                    className={`w-full p-3 text-left rounded-lg transition ${
                      selectedChat?.id === user.username
                        ? 'bg-indigo-100 dark:bg-indigo-900'
                        : darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {user.avatar}
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-800'} truncate`}>{user.displayName}</h3>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} truncate`}>
                          {getLastMessage(user.username)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {!selectedChat ? (
            <div className={`flex-1 flex items-center justify-center ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <div className={`text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a chat to start messaging</p>
                <p className="text-sm mt-2">Choose from users or rooms on the left</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="bg-indigo-600 text-white px-6 py-4 flex items-center gap-3">
                {selectedChat.type === 'room' ? (
                  <>
                    <Hash className="w-8 h-8" />
                    <div>
                      <h2 className="text-xl font-semibold">{selectedChat.name}</h2>
                      <p className="text-sm text-indigo-100">Group chat</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <div className="w-10 h-10 bg-white text-indigo-600 rounded-full flex items-center justify-center font-semibold">
                        {onlineUsers.find(u => u.username === selectedChat.id)?.avatar || selectedChat.name.charAt(0)}
                      </div>
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-indigo-600"></div>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">{selectedChat.name}</h2>
                      <p className="text-sm text-indigo-100">🟢 Online</p>
                    </div>
                  </>
                )}
              </div>

              {/* Messages */}
              <div className={`flex-1 overflow-y-auto p-6 space-y-4 ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                {currentMessages.length === 0 && (
                  <div className={`text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-8`}>
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                )}
                
                {currentMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md flex gap-2 ${msg.isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!msg.isOwn && (
                        <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                          {msg.avatar}
                        </div>
                      )}
                      <div>
                        <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-1 px-1 ${msg.isOwn ? 'text-right' : 'text-left'}`}>
                          {msg.isOwn ? 'You' : msg.displayName}
                        </div>
                        <div
                          className={`px-4 py-3 rounded-2xl break-words ${
                            msg.isOwn
                              ? 'bg-indigo-600 text-white rounded-br-none'
                              : darkMode
                              ? 'bg-gray-700 text-white rounded-bl-none'
                              : 'bg-white text-gray-800 rounded-bl-none shadow'
                          }`}
                        >
                          {msg.text}
                        </div>
                        <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'} mt-1 px-1 ${msg.isOwn ? 'text-right' : 'text-left'}`}>
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className={`border-t ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'} p-4`}>
                {showEmojiPicker && (
                  <div className={`mb-3 p-3 ${darkMode ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg`}>
                    <div className="flex flex-wrap gap-2">
                      {EMOJI_LIST.map((emoji, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleEmojiClick(emoji)}
                          className={`text-2xl p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`p-3 ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} rounded-lg transition`}
                  >
                    <Smile className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                  </button>
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    className={`flex-1 px-4 py-3 border ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none`}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputMessage.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-3 rounded-lg transition duration-200 transform hover:scale-105 disabled:transform-none"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 w-full max-w-md`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Profile Settings</h2>
              <button onClick={() => setShowSettings(false)} className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg`}>
                <X className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                  Display Name
                </label>
                <input
                  type="text"
                  value={tempDisplayName}
                  onChange={(e) => setTempDisplayName(e.target.value)}
                  className={`w-full px-4 py-3 border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'} rounded-lg outline-none focus:ring-2 focus:ring-indigo-500`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                  Avatar (single character or emoji)
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={tempAvatar}
                  onChange={(e) => setTempAvatar(e.target.value)}
                  placeholder="e.g., A or 😀"
                  className={`w-full px-4 py-3 border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'} rounded-lg outline-none focus:ring-2 focus:ring-indigo-500`}
                />
              </div>
              <button
                onClick={updateProfile}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 w-full max-w-md`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Create Room</h2>
              <button onClick={() => setShowCreateRoom(false)} className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg`}>
                <X className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                  Room Name
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g., General, Random, Team Chat"
                  className={`w-full px-4 py-3 border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'} rounded-lg outline-none focus:ring-2 focus:ring-indigo-500`}
                  onKeyPress={(e) => e.key === 'Enter' && createRoom()}
                />
              </div>
              <button
                onClick={createRoom}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition"
              >
                Create Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}