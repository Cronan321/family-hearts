// server/gameLogic.js

const SUITS = ['H', 'D', 'C', 'S']; // Hearts, Diamonds, Clubs, Spades
const VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 11=J, 12=Q, 13=K, 14=A

// 1. Create a fresh sorted deck
function createDeck() {
    let deck = [];
    for (let suit of SUITS) {
        for (let value of VALUES) {
            deck.push({ suit, value });
        }
    }
    return deck;
}

// 2. Shuffle (Fisher-Yates Algorithm) - The industry standard for randomness
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]]; // Swap
    }
    return deck;
}

// 3. Deal 13 cards to 4 players
function dealCards(deck, players) {
    // We assume players array has 4 people
    // Player 0 gets index 0, 4, 8...
    // Player 1 gets index 1, 5, 9...
    
    players.forEach(p => p.hand = []); // Clear old hands
    
    let playerIndex = 0;
    for(let card of deck) {
        players[playerIndex].hand.push(card);
        playerIndex = (playerIndex + 1) % 4; // Rotates 0, 1, 2, 3, 0...
    }

    // Sort hands so players can read them easily (By Suit, then Value)
    players.forEach(p => {
        p.hand.sort((a, b) => {
            if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
            return a.value - b.value;
        });
    });
    
    return players;
}

// 4. Validate Move (Must follow suit!)
function isValidMove(hand, card, leadSuit) {
    // If no lead suit (first card of trick), any card is valid
    if (!leadSuit) return true;

    // If player follows suit, it's valid
    if (card.suit === leadSuit) return true;

    // If player DOES NOT follow suit, check if they *could* have
    const hasLeadSuit = hand.some(c => c.suit === leadSuit);
    
    // If they have the suit but didn't play it -> ILLEGAL
    if (hasLeadSuit) return false;

    // Otherwise (they are void in that suit) -> VALID
    return true;
}

// 5. Evaluate Trick (Who won? How many points?)
function evaluateTrick(board) {
    // board = [{ card: {suit, value}, player: "Name" }, ...]
    
    const leadSuit = board[0].card.suit;
    let winner = board[0];
    let points = 0;

    board.forEach(play => {
        const { card } = play;
        
        // 1. Check for Winner (Must match lead suit & be higher value)
        if (card.suit === leadSuit && card.value > winner.card.value) {
            winner = play;
        }

        // 2. Calculate Points
        if (card.suit === 'H') points += 1; // Heart = 1 pt
        if (card.suit === 'S' && card.value === 12) points += 13; // Queen of Spades = 13 pts
        if (card.suit === 'D' && card.value === 11) points -= 10; // Jack of Diamonds = -10 pts
    });

    return { 
        winnerName: winner.player, 
        points: points 
    };
}

module.exports = { createDeck, shuffleDeck, dealCards, isValidMove, evaluateTrick };