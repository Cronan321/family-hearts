const express = require('express');
const app = express();
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const path = require('path');

app.use(cors());

// Serve the React App from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Handle "Catch-All" to serve React for any URL
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow connections from anywhere
        methods: ["GET", "POST"]
    }
});

// --- GAME CONSTANTS ---
const SUITS = ["H", "D", "C", "S"];
const VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 11=J, 12=Q, 13=K, 14=A

// --- STATE MANAGEMENT ---
// rooms[roomCode] = { players: [], deck: [], board: [], turnIndex: 0, heartsBroken: false, roundNumber: 1, trickCount: 0 }
const rooms = {};

// --- HELPER FUNCTIONS ---

// 1. Create a full deck
function createDeck() {
    let deck = [];
    for (let suit of SUITS) {
        for (let value of VALUES) {
            deck.push({ suit, value });
        }
    }
    return deck;
}

// 2. Shuffle Deck
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// 3. Score a Trick (Highest card of the lead suit wins)
function determineTrickWinner(board) {
    const leadSuit = board[0].card.suit;
    let highestValue = -1;
    let winnerIndex = -1;

    // Find cards that match lead suit
    for (let i = 0; i < board.length; i++) {
        const { card, player } = board[i];
        if (card.suit === leadSuit) {
            if (card.value > highestValue) {
                highestValue = card.value;
                winnerIndex = i;
            }
        }
    }
    return board[winnerIndex].player; // Return name of winner
}

// 4. Calculate Points in a pile of cards
function calculatePoints(cards) {
    let points = 0;
    let hasMoonShot = false; // logic for tracking distinct point cards could go here
    for (let card of cards) {
        if (card.suit === "H") points += 1;
        if (card.suit === "S" && card.value === 12) points += 13; // Queen of Spades
    }
    return points;
}

// 5. Deal Cards
function dealCards(roomCode) {
    const room = rooms[roomCode];
    let deck = shuffleDeck(createDeck());
    
    // Clear hands
    room.players.forEach(p => p.hand = []);

    // Deal 13 cards to each of the 4 players
    let playerIdx = 0;
    while (deck.length > 0) {
        room.players[playerIdx].hand.push(deck.pop());
        playerIdx = (playerIdx + 1) % 4;
    }

    // Sort hands for neatness
    room.players.forEach(p => {
        p.hand.sort((a, b) => {
            if (a.suit === b.suit) return a.value - b.value;
            return a.suit.localeCompare(b.suit);
        });
    });

    // Reset Round State
    room.board = [];
    room.heartsBroken = false;
    room.trickCount = 0;
    
    // Find who has the 2 of Clubs to start
    let starterIndex = 0;
    room.players.forEach((p, index) => {
        p.roundPoints = 0; // Reset points for this specific round
        const has2C = p.hand.find(c => c.suit === "C" && c.value === 2);
        if (has2C) starterIndex = index;
    });
    room.turnIndex = starterIndex;

    return room;
}

// --- SOCKET CONNECTION ---
io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // JOIN ROOM
    socket.on("join_room", (data) => {
        const { room, username } = data;
        socket.join(room);

        if (!rooms[room]) {
            rooms[room] = { 
                players: [], 
                board: [], 
                turnIndex: 0, 
                gameActive: false 
            };
        }

        const currentRoom = rooms[room];
        
        // Add player if not full
        if (currentRoom.players.length < 4) {
            // Check if reconnecting
            const existing = currentRoom.players.find(p => p.name === username);
            if (!existing) {
                currentRoom.players.push({ 
                    id: socket.id, 
                    name: username, 
                    score: 0, // Total Game Score
                    roundPoints: 0, // Points in current hand
                    hand: [] 
                });
            } else {
                existing.id = socket.id; // Update ID on reconnect
            }
        }

        // Notify everyone in room
        io.to(room).emit("joined_successfully", { 
            players: currentRoom.players 
        });
    });

    // START GAME / NEW ROUND
    socket.on("start_game", (data) => {
        const { room } = data;
        if (rooms[room] && rooms[room].players.length === 4) {
            dealCards(room);
            rooms[room].gameActive = true;
            
            // Send each player their specific hand
            rooms[room].players.forEach((p, index) => {
                io.to(p.id).emit("game_started", {
                    hand: p.hand,
                    turnIndex: rooms[room].turnIndex,
                    scores: rooms[room].players.map(pl => ({name: pl.name, score: pl.score}))
                });
            });
            
            // Broadcast generic update for spectators/state
            io.to(room).emit("state_update", {
                board: [],
                turnIndex: rooms[room].turnIndex
            });
        }
    });

    // PLAY CARD
    socket.on("play_card", (data) => {
        const { room, card, playerIndex } = data;
        const currentRoom = rooms[room];

        // Validate Turn
        if (currentRoom.turnIndex !== playerIndex) return;

        // Add to board
        const player = currentRoom.players[playerIndex];
        
        // Remove card from hand
        player.hand = player.hand.filter(c => !(c.suit === card.suit && c.value === card.value));
        
        // Add to center board
        currentRoom.board.push({ player: player.name, card });

        // Logic: Breaking Hearts?
        if (card.suit === "H") currentRoom.heartsBroken = true;

        // Move turn
        currentRoom.turnIndex = (currentRoom.turnIndex + 1) % 4;

        // Check if Trick is Complete (4 cards)
        if (currentRoom.board.length === 4) {
            
            // 1. Determine Winner
            const winnerName = determineTrickWinner(currentRoom.board);
            const winnerIndex = currentRoom.players.findIndex(p => p.name === winnerName);
            
            // 2. Calculate Points for this trick
            const pile = currentRoom.board.map(i => i.card);
            const points = calculatePoints(pile);
            currentRoom.players[winnerIndex].roundPoints += points;

            // 3. Emit update so users see the last card played
            io.to(room).emit("state_update", {
                board: currentRoom.board,
                turnIndex: -1 // Pause turns for a moment
            });

            // 4. Wait 2 seconds, then clear board
            setTimeout(() => {
                currentRoom.board = [];
                currentRoom.turnIndex = winnerIndex; // Winner leads next
                currentRoom.trickCount += 1;

                // CHECK: END OF ROUND (13 Tricks)
                if (currentRoom.trickCount === 13) {
                    
                    // --- SCORING LOGIC ---
                    let moonShooter = null;
                    currentRoom.players.forEach(p => {
                        if (p.roundPoints === 26) moonShooter = p;
                    });

                    if (moonShooter) {
                        // Shoot the Moon! (Opponents +26, Shooter +0)
                        currentRoom.players.forEach(p => {
                            if (p !== moonShooter) p.score += 26;
                        });
                    } else {
                        // Normal Scoring
                        currentRoom.players.forEach(p => {
                            p.score += p.roundPoints;
                        });
                    }

                    // --- CHECK FOR GAME OVER (100 Points) ---
                    const loser = currentRoom.players.find(p => p.score >= 100);
                    
                    if (loser) {
                        // GAME OVER
                        io.to(room).emit("game_over", { 
                            scores: currentRoom.players.map(p => ({name: p.name, score: p.score})) 
                        });
                        rooms[room].gameActive = false;
                    } else {
                        // START NEXT ROUND
                        dealCards(room);
                        
                        // Send new hands
                        currentRoom.players.forEach((p) => {
                            io.to(p.id).emit("game_started", {
                                hand: p.hand,
                                turnIndex: currentRoom.turnIndex,
                                scores: currentRoom.players.map(pl => ({name: pl.name, score: pl.score}))
                            });
                        });
                    }

                } else {
                    // Just a normal trick end
                    io.to(room).emit("trick_finished", {
                        scores: currentRoom.players.map(p => ({
                            name: p.name, 
                            // Show Total + Current Round points so players know where they stand
                            score: p.score + p.roundPoints 
                        }))
                    });

                    io.to(room).emit("state_update", {
                        board: [],
                        turnIndex: currentRoom.turnIndex
                    });
                }
            }, 2000); // 2 second pause to see the trick

        } else {
            // Trick not done, just update state
            io.to(room).emit("state_update", {
                board: currentRoom.board,
                turnIndex: currentRoom.turnIndex
            });
            
            // Also send hand update to the specific player who played
            io.to(rooms[room].players[playerIndex].id).emit("hand_update", player.hand);
        }
    });

    // CHAT
    socket.on("send_message", (data) => {
        socket.to(data.room).emit("receive_message", data);
    });

    socket.on("disconnect", () => {
        console.log("User Disconnected", socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});