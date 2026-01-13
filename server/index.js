// server/index.js
const express = require('express');
const app = express();
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const path = require('path');

// Import logic from gameLogic.js
const { createDeck, shuffleDeck, isValidMove } = require('./gameLogic');

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// --- STATE MANAGEMENT ---
const rooms = {};

// --- HELPER FUNCTIONS ---

// Score a Trick (Highest card of the lead suit wins)
function determineTrickWinner(board) {
    const leadSuit = board[0].card.suit;
    let highestValue = -1;
    let winnerIndex = -1;

    for (let i = 0; i < board.length; i++) {
        const { card, player } = board[i];
        if (card.suit === leadSuit) {
            if (card.value > highestValue) {
                highestValue = card.value;
                winnerIndex = i;
            }
        }
    }
    return board[winnerIndex].player; 
}

// Calculate Points in a pile
function calculatePoints(cards) {
    let points = 0;
    for (let card of cards) {
        if (card.suit === "H") points += 1;
        if (card.suit === "S" && card.value === 12) points += 13; // Queen of Spades
    }
    return points;
}

// Deal Cards
function dealCards(roomCode) {
    const room = rooms[roomCode];
    let deck = shuffleDeck(createDeck()); // Used imported helper
    
    // Clear hands
    room.players.forEach(p => p.hand = []);

    // Deal 13 cards to 4 players
    let playerIdx = 0;
    while (deck.length > 0) {
        room.players[playerIdx].hand.push(deck.pop());
        playerIdx = (playerIdx + 1) % 4;
    }

    // Sort hands
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
        p.roundPoints = 0; 
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
                gameActive: false,
                heartsBroken: false,
                trickCount: 0
            };
        }

        const currentRoom = rooms[room];
        
        if (currentRoom.players.length < 4) {
            const existing = currentRoom.players.find(p => p.name === username);
            if (!existing) {
                currentRoom.players.push({ 
                    id: socket.id, 
                    name: username, 
                    score: 0, 
                    roundPoints: 0, 
                    hand: [] 
                });
            } else {
                existing.id = socket.id; 
            }
        }

        io.to(room).emit("joined_successfully", { players: currentRoom.players });
    });

    // START GAME
    socket.on("start_game", (data) => {
        const { room } = data;
        if (rooms[room] && rooms[room].players.length === 4) {
            dealCards(room);
            rooms[room].gameActive = true;
            
            rooms[room].players.forEach((p) => {
                io.to(p.id).emit("game_started", {
                    hand: p.hand,
                    turnIndex: rooms[room].turnIndex,
                    scores: rooms[room].players.map(pl => ({name: pl.name, score: pl.score}))
                });
            });
            
            io.to(room).emit("state_update", { board: [], turnIndex: rooms[room].turnIndex });
        }
    });

    // PLAY CARD
    socket.on("play_card", (data) => {
        const { room, card, playerIndex } = data;
        const currentRoom = rooms[room];

        // 1. Validate Turn
        if (currentRoom.turnIndex !== playerIndex) return;

        const player = currentRoom.players[playerIndex];
        
        // --- RULE ENFORCEMENT ---

        // A. Is this the very first card of the round? (Must play 2 of Clubs)
        if (currentRoom.trickCount === 0 && currentRoom.board.length === 0) {
            if (card.suit !== 'C' || card.value !== 2) {
                // If they strictly have the 2C, they MUST play it.
                // (The deal logic ensures someone has it, and turnIndex starts at that person).
                socket.emit("error_message", "You must start with the 2 of Clubs!");
                return;
            }
        }

        // B. Determine Lead Suit
        const leadSuit = currentRoom.board.length > 0 ? currentRoom.board[0].card.suit : null;

        // C. Must Follow Suit
        if (!isValidMove(player.hand, card, leadSuit)) {
            socket.emit("error_message", "You must follow suit!");
            return;
        }

        // D. Breaking Hearts Logic (If leading)
        if (!leadSuit && card.suit === 'H' && !currentRoom.heartsBroken) {
            // Can only lead Hearts if broken OR if player has NO other suits
            const hasNonHearts = player.hand.some(c => c.suit !== 'H');
            if (hasNonHearts) {
                socket.emit("error_message", "Hearts are not broken yet!");
                return;
            }
        }

        // E. First Trick Point Dumping Rule (Bleeding)
        // You cannot play a point card (Heart or QS) on the first trick unless you have no choice
        if (currentRoom.trickCount === 0 && (card.suit === 'H' || (card.suit === 'S' && card.value === 12))) {
            // Check if player has safe cards matching the lead suit
            // If leadSuit exists, we already know they are following it or void.
            // If void in lead suit (or leading), do they have ANY non-point cards?
            const isPointCard = (c) => c.suit === 'H' || (c.suit === 'S' && c.value === 12);
            
            // If following suit, and we play a point card, is it because we ONLY have point cards in that suit?
            // (Actually standard rules say you can't dump points on trick 1 unless you have nothing else)
            const safeHand = player.hand.filter(c => !isPointCard(c));
            
            if (leadSuit) {
                const hasSafeLead = safeHand.some(c => c.suit === leadSuit);
                const hasLead = player.hand.some(c => c.suit === leadSuit);
                
                // If they have the lead suit, they must follow it (enforced by C). 
                // If they are following suit with a point card, that's fine (e.g. they only have heart if hearts led).
                // BUT if they are discarding (void in lead suit), they cannot discard points on trick 1 unless hand is all points.
                if (!hasLead && safeHand.length > 0) {
                     socket.emit("error_message", "Cannot play points on the first trick!");
                     return;
                }
            } 
        }

        // --- END RULES ---

        // Remove card from hand
        player.hand = player.hand.filter(c => !(c.suit === card.suit && c.value === card.value));
        
        // Add to center board
        currentRoom.board.push({ player: player.name, card });

        // Check if Hearts broke
        if (card.suit === "H") currentRoom.heartsBroken = true;

        // Move turn
        currentRoom.turnIndex = (currentRoom.turnIndex + 1) % 4;

        // Check if Trick is Complete
        if (currentRoom.board.length === 4) {
            
            const winnerName = determineTrickWinner(currentRoom.board);
            const winnerIndex = currentRoom.players.findIndex(p => p.name === winnerName);
            
            const pile = currentRoom.board.map(i => i.card);
            const points = calculatePoints(pile);
            currentRoom.players[winnerIndex].roundPoints += points;

            io.to(room).emit("state_update", {
                board: currentRoom.board,
                turnIndex: -1
            });

            setTimeout(() => {
                currentRoom.board = [];
                currentRoom.turnIndex = winnerIndex; 
                currentRoom.trickCount += 1;

                // CHECK: END OF ROUND
                if (currentRoom.trickCount === 13) {
                    
                    let moonShooter = null;
                    currentRoom.players.forEach(p => {
                        if (p.roundPoints === 26) moonShooter = p;
                    });

                    if (moonShooter) {
                        currentRoom.players.forEach(p => {
                            if (p !== moonShooter) p.score += 26;
                        });
                    } else {
                        currentRoom.players.forEach(p => {
                            p.score += p.roundPoints;
                        });
                    }

                    const loser = currentRoom.players.find(p => p.score >= 100);
                    
                    if (loser) {
                        io.to(room).emit("game_over", { 
                            scores: currentRoom.players.map(p => ({name: p.name, score: p.score})) 
                        });
                        rooms[room].gameActive = false;
                    } else {
                        dealCards(room);
                        currentRoom.players.forEach((p) => {
                            io.to(p.id).emit("game_started", {
                                hand: p.hand,
                                turnIndex: currentRoom.turnIndex,
                                scores: currentRoom.players.map(pl => ({name: pl.name, score: pl.score}))
                            });
                        });
                    }

                } else {
                    io.to(room).emit("trick_finished", {
                        scores: currentRoom.players.map(p => ({
                            name: p.name, 
                            score: p.score + p.roundPoints 
                        }))
                    });

                    io.to(room).emit("state_update", {
                        board: [],
                        turnIndex: currentRoom.turnIndex
                    });
                }
            }, 2000);

        } else {
            io.to(room).emit("state_update", {
                board: currentRoom.board,
                turnIndex: currentRoom.turnIndex
            });
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