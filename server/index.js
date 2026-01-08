// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createDeck, shuffleDeck, dealCards, isValidMove, evaluateTrick } = require('./gameLogic'); // Import game logic

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// --- GLOBAL GAME STATE ---
const rooms = {}; 

io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // 1. JOIN ROOM
  socket.on('join_room', ({ room, name }) => {
    const roomCode = room.trim().toUpperCase();
    const playerName = name.trim();

    // 6. AUDIO HANDSHAKE
  // When a user activates audio, they tell the server their "Peer ID"
  socket.on('register_peer', ({ room, peerId }) => {
    // Broadcast this ID to everyone else in the room so they can call me
    socket.to(room).emit('user_joined_audio', { 
        peerId: peerId, 
        socketId: socket.id 
    });
  });

    // Create room if it doesn't exist
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        players: [],
        status: "WAITING",
        board: [],
        turnIndex: 0
      };
    }

    const currentRoom = rooms[roomCode];

    // Constraints
    if (currentRoom.players.length >= 4) {
      socket.emit('error_message', "Room is full!");
      return;
    }
    const nameExists = currentRoom.players.some(p => p.name === playerName);
    if(nameExists) {
        socket.emit('error_message', "Name already taken!");
        return;
    }

    // Add Player
    const newPlayer = { id: socket.id, name: playerName, score: 0, hand: [] };
    currentRoom.players.push(newPlayer);
    socket.join(roomCode);

    // Notify Success
    socket.emit('joined_successfully', { 
        room: roomCode, 
        players: currentRoom.players 
    });

    // Notify Others
    socket.to(roomCode).emit('player_update', currentRoom.players);
    console.log(`${playerName} joined ${roomCode}`);
  });

  // 2. CHAT LOGIC
  socket.on('send_message', (data) => {
    io.to(data.room).emit('receive_message', data);
  });

  // 3. START GAME LOGIC
  socket.on('start_game', ({ room }) => {
    const currentRoom = rooms[room];
    if (!currentRoom || currentRoom.players.length !== 4) return;

    // Setup Game
    currentRoom.status = "PLAYING";
    currentRoom.board = []; 
    
    // Deal Cards
    let deck = createDeck();
    deck = shuffleDeck(deck);
    dealCards(deck, currentRoom.players);

    // Find who has 2 of Clubs
    let starterIndex = 0;
    currentRoom.players.forEach((p, index) => {
        if (p.hand.find(c => c.suit === 'C' && c.value === 2)) {
            starterIndex = index;
        }
    });
    currentRoom.turnIndex = starterIndex;

    // Send Hands Privately
    currentRoom.players.forEach((player) => {
        io.to(player.id).emit('game_started', { 
            hand: player.hand,
            turnIndex: starterIndex,
            players: currentRoom.players
        });
    });
    
    // Notify Room
    io.to(room).emit('update_game_status', { 
        status: "PLAYING", 
        turnIndex: starterIndex,
        board: [] 
    });
  });

  // 5. PLAY CARD LOGIC (UPDATED WITH RULES)
  socket.on('play_card', ({ room, card, playerIndex }) => {
    const currentRoom = rooms[room];
    if (!currentRoom) return;
    
    // 1. Validate Turn
    if (currentRoom.turnIndex !== playerIndex) {
        socket.emit('error_message', "It is not your turn!");
        return;
    }

    // 2. Validate Card Ownership
    const player = currentRoom.players[playerIndex];
    const cardIndex = player.hand.findIndex(c => c.suit === card.suit && c.value === card.value);
    if (cardIndex === -1) return; 

    // 3. VALIDATE RULES (Must Follow Suit)
    // The "lead suit" is the suit of the first card on the board (if any)
    const leadSuit = currentRoom.board.length > 0 ? currentRoom.board[0].card.suit : null;
    
    if (!isValidMove(player.hand, card, leadSuit)) {
        socket.emit('error_message', `You must follow suit (${leadSuit})!`);
        return;
    }

    // --- EXECUTE MOVE ---
    player.hand.splice(cardIndex, 1);
    currentRoom.board.push({ card: card, player: player.name });
    
    // Advance turn (temporarily, until trick end)
    currentRoom.turnIndex = (currentRoom.turnIndex + 1) % 4;

    io.to(room).emit('state_update', {
        board: currentRoom.board,
        turnIndex: currentRoom.turnIndex
    });
    io.to(player.id).emit('hand_update', player.hand);

    // --- CHECK FOR TRICK END ---
    if (currentRoom.board.length === 4) {
        // 1. Calculate Result
        const result = evaluateTrick(currentRoom.board);
        
        // 2. Find who won to give them the lead
        const winnerIndex = currentRoom.players.findIndex(p => p.name === result.winnerName);
        currentRoom.players[winnerIndex].score += result.points;
        
        // 3. Pause for 2 seconds so players can see the cards, then clear
        setTimeout(() => {
            currentRoom.board = [];
            currentRoom.turnIndex = winnerIndex; // Winner leads next

            io.to(room).emit('trick_finished', {
                winner: result.winnerName,
                pointsTaken: result.points,
                scores: currentRoom.players.map(p => ({ name: p.name, score: p.score })),
                nextTurn: winnerIndex
            });
            
            // Sync state again to clear board
            io.to(room).emit('state_update', {
                board: [],
                turnIndex: winnerIndex
            });

        }, 3000); // 3 second delay
    }
  });

  // 5. DISCONNECT LOGIC
  socket.on('disconnect', () => {
    console.log("User Disconnected", socket.id);
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        io.to(roomCode).emit('player_update', room.players);
        if (room.players.length === 0) delete rooms[roomCode];
        break;
      }
    }
  });

}); // ... (All your socket code stays the same) ...

// --- SERVE STATIC REACT FILES ---
const path = require('path'); // Ensure this is imported at top, or add here

// 1. Tell Node where the built React files are
// We will name the folder 'public' in the next step
app.use(express.static(path.join(__dirname, 'public')));

// 2. If a user asks for any page, send them the React App
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 3. LISTEN ON THE CORRECT PORT
// Render gives us a specific PORT. If we are local, we use 3001.
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`SERVER RUNNING ON PORT ${PORT}`);
});