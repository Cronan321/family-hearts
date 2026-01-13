// server/gameLogic.js

const SUITS = ['H', 'D', 'C', 'S']; 
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

// 2. Shuffle (Fisher-Yates Algorithm)
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]]; 
    }
    return deck;
}

/**
 * Validates a move based on the player's hand and the current trick state.
 * @param {Array} hand - The player's current hand of cards.
 * @param {Object} card - The card the player is trying to play.
 * @param {String|null} leadSuit - The suit of the first card played in this trick (or null if leading).
 * @returns {Boolean} - True if the move is valid, false otherwise.
 */
function isValidMove(hand, card, leadSuit) {
    // If no lead suit (this player is starting the trick), they can theoretically play anything
    // (Note: Specific "Hearts" or "2 of Clubs" rules are usually handled at the game state level, 
    // but basic suit following is handled here).
    if (!leadSuit) return true;

    // If player follows suit, it's always valid
    if (card.suit === leadSuit) return true;

    // If player DOES NOT follow suit, check if they *could* have
    const hasLeadSuit = hand.some(c => c.suit === leadSuit);
    
    // If they have the suit but didn't play it -> ILLEGAL (Reneging)
    if (hasLeadSuit) return false;

    // Otherwise (they are void in that suit) -> VALID
    return true;
}

module.exports = { createDeck, shuffleDeck, isValidMove };