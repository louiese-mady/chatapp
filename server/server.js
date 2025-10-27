const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Store connected clients with their user data
const clients = new Map();

// Store rooms
const rooms = new Map();

// Send to specific user
function sendToUser(username, message) {
  clients.forEach((clientData, ws) => {
    if (clientData.username === username && ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  });
}

// Send to all users in a room
function sendToRoom(roomId, message, excludeClient = null) {
  clients.forEach((clientData, ws) => {
    if (ws !== excludeClient && ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  });
}

// Broadcast to all connected clients
function broadcast(message, excludeClient = null) {
  clients.forEach((clientData, ws) => {
    if (ws !== excludeClient && ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  });
}

// Get list of online users with their display info
function getOnlineUsers() {
  return Array.from(clients.values()).map(client => ({
    username: client.username,
    displayName: client.displayName,
    avatar: client.avatar
  }));
}

// Get list of all rooms
function getRoomsList() {
  return Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    creator: room.creator
  }));
}

// Broadcast user list to all clients
function broadcastUserList() {
  const onlineUsers = getOnlineUsers();
  broadcast({
    type: 'users',
    users: onlineUsers
  });
}

// Broadcast room list to all clients
function broadcastRoomList() {
  const roomList = getRoomsList();
  broadcast({
    type: 'rooms',
    rooms: roomList
  });
}

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'join':
          // Register the user
          clients.set(ws, {
            username: message.username,
            displayName: message.displayName || message.username,
            avatar: message.avatar || message.username.charAt(0).toUpperCase()
          });
          
          console.log(`${message.username} joined the chat`);
          
          // Send current user list and rooms to the new user
          broadcastUserList();
          broadcastRoomList();
          
          break;
          
        case 'message':
          const senderData = clients.get(ws);
          
          if (!senderData) {
            ws.send(JSON.stringify({
              type: 'error',
              text: 'You are not registered. Please join first.'
            }));
            return;
          }
          
          if (message.roomId) {
            // Room message
            console.log(`Message from ${message.sender} to room ${message.roomId}: ${message.text}`);
            
            // Send to all users in the room (everyone)
            sendToRoom(message.roomId, {
              type: 'message',
              sender: message.sender,
              displayName: message.displayName,
              avatar: message.avatar,
              text: message.text,
              timestamp: message.timestamp || new Date().toISOString(),
              roomId: message.roomId,
              isOwn: false
            }, ws);
            
            // Send confirmation to sender
            ws.send(JSON.stringify({
              type: 'message',
              sender: message.sender,
              displayName: message.displayName,
              avatar: message.avatar,
              text: message.text,
              timestamp: message.timestamp || new Date().toISOString(),
              roomId: message.roomId,
              isOwn: true
            }));
          } else {
            // Direct message
            console.log(`Message from ${message.sender} to ${message.recipient}: ${message.text}`);
            
            // Send message to the recipient
            sendToUser(message.recipient, {
              type: 'message',
              sender: message.sender,
              displayName: message.displayName,
              avatar: message.avatar,
              recipient: message.recipient,
              text: message.text,
              timestamp: message.timestamp || new Date().toISOString(),
              isOwn: false
            });
            
            // Send confirmation to sender
            ws.send(JSON.stringify({
              type: 'message',
              sender: message.sender,
              displayName: message.displayName,
              avatar: message.avatar,
              recipient: message.recipient,
              text: message.text,
              timestamp: message.timestamp || new Date().toISOString(),
              isOwn: true
            }));
          }
          
          break;
          
        case 'create_room':
          const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const newRoom = {
            id: roomId,
            name: message.roomName,
            creator: message.creator,
            createdAt: new Date().toISOString()
          };
          
          rooms.set(roomId, newRoom);
          
          console.log(`Room created: ${message.roomName} by ${message.creator}`);
          
          // Broadcast updated room list to all users
          broadcastRoomList();
          
          break;
          
        case 'update_profile':
          const clientData = clients.get(ws);
          
          if (clientData) {
            clientData.displayName = message.displayName;
            clientData.avatar = message.avatar;
            
            console.log(`Profile updated for ${message.username}`);
            
            // Notify the user
            ws.send(JSON.stringify({
              type: 'profile_updated',
              username: message.username,
              displayName: message.displayName,
              avatar: message.avatar
            }));
            
            // Broadcast updated user list
            broadcastUserList();
          }
          
          break;
          
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        text: 'Failed to process message'
      }));
    }
  });

  ws.on('close', () => {
    const clientData = clients.get(ws);
    
    if (clientData) {
      console.log(`${clientData.username} disconnected`);
      
      // Remove client from the map
      clients.delete(ws);
      
      // Send updated user list to remaining clients
      broadcastUserList();
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connections: clients.size,
    users: getOnlineUsers(),
    rooms: getRoomsList()
  });
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`WebSocket server is running on port ${PORT}`);
  console.log(`Connect using: ws://localhost:${PORT}`);
});