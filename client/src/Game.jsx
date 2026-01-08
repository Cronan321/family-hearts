// client/src/Game.jsx
import React, { useState, useEffect } from 'react';
import Chat from './Chat';
import AudioChat from './AudioChat';
import './Game.css'; 

const getCardImage = (suit, value) => {
    let v = value;
    if (value === 11) v = "J";
    if (value === 12) v = "Q";
    if (value === 13) v = "K";
    if (value === 14) v = "A";
    if (value === 10) v = "0"; 
    return `https://deckofcardsapi.com/static/img/${v}${suit}.png`;
};

function Game({ socket, username, room, players }) {
  const [gameStatus, setGameStatus] = useState("WAITING");
  const [myHand, setMyHand] = useState([]);
  const [board, setBoard] = useState([]); 
  const [turnIndex, setTurnIndex] = useState(0); 
  const [scores, setScores] = useState([]); 

  const myIndex = players.findIndex(p => p.id === socket.id);

  const getRelativePlayer = (offset) => {
      if (myIndex === -1) return players[offset]; 
      const actualIndex = (myIndex + offset) % 4;
      return players[actualIndex];
  };

  useEffect(() => {
    socket.on('game_started', (data) => {
        setGameStatus("PLAYING");
        setMyHand(data.hand);
        setTurnIndex(data.turnIndex);
        setBoard([]);
    });
    socket.on('hand_update', (newHand) => setMyHand(newHand));
    socket.on('state_update', (data) => {
        setBoard(data.board);
        setTurnIndex(data.turnIndex);
    });
    socket.on('trick_finished', (data) => setScores(data.scores));
    
    return () => {
        socket.off('game_started');
        socket.off('hand_update');
        socket.off('state_update');
        socket.off('trick_finished');
    };
  }, [socket]);

  const startGame = () => socket.emit('start_game', { room });

  const playCard = (card) => {
    if (turnIndex !== myIndex) return;
    socket.emit('play_card', { room, card, playerIndex: myIndex });
  };

  const renderSeat = (positionName, offset) => {
      const player = getRelativePlayer(offset);
      if (!player) return null;

      const isMyTurn = players.indexOf(player) === turnIndex;
      const playerScore = scores.find(s => s.name === player.name)?.score || 0;
      const isMe = offset === 0;

      return (
          <div className={`player-seat seat-${positionName}`}>
              {/* THE HAND */}
              {isMe ? (
                  <div className="my-hand">
                      {myHand.map((c, i) => (
                          <img 
                            key={i} 
                            src={getCardImage(c.suit, c.value)} 
                            className="my-card" // Uses new CSS class
                            onClick={() => playCard(c)}
                            alt="card"
                          />
                      ))}
                  </div>
              ) : (
                  <div className="opponent-hand">
                      {[1,2,3].map(i => <div key={i} className="card-back"></div>)}
                  </div>
              )}

              {/* INFO */}
              <div className={`player-info ${isMyTurn ? 'turn-active' : ''}`}>
                  <div>{player.name}</div>
                  <div style={{fontSize: '0.8em', color: '#ccc'}}>Score: {playerScore}</div>
              </div>
          </div>
      );
  };

  return (
    <div className="game-container">
      
      {/* TOP BAR */}
      <div className="top-bar">
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <h2>♥ Family Hearts</h2>
            <div style={{ opacity: 0.7 }}>Room: {room}</div>
            <AudioChat socket={socket} room={room} username={username} />
          </div>
      </div>

      <div style={{ position: 'absolute', top: '70px', right: '20px', zIndex: 50 }}>
        <Chat socket={socket} username={username} room={room} />
      </div>

      {/* THE TABLE */}
      <div className="table-area">
        
        {gameStatus === "WAITING" && (
            <div style={{ textAlign: 'center', marginTop: '150px', color: 'white' }}>
                <h1>Waiting for Family...</h1>
                <p>{players.length}/4 Players Ready</p>
                {players.length === 4 && <button onClick={startGame} style={{padding: '20px', fontSize: '20px'}}>DEAL CARDS</button>}
            </div>
        )}

        {gameStatus === "PLAYING" && (
            <>
                {renderSeat("bottom", 0)}
                {renderSeat("left", 1)}
                {renderSeat("top", 2)}
                {renderSeat("right", 3)}

                {/* CENTER POT */}
                <div className="center-pot">
                    {board.map((item, i) => {
                        const ownerIndex = players.findIndex(p => p.name === item.player);
                        const relativePos = (ownerIndex - myIndex + 4) % 4;
                        
                        let rotation = 0;
                        let translate = "0px, 0px";
                        
                        // Tight cluster values (20px offset)
                        if (relativePos === 0) { rotation = 0; translate = "0px, 20px"; }    
                        if (relativePos === 1) { rotation = 90; translate = "-20px, 0px"; }  
                        if (relativePos === 2) { rotation = 180; translate = "0px, -20px"; } 
                        if (relativePos === 3) { rotation = -90; translate = "20px, 0px"; } 

                        return (
                             <img 
                                key={i}
                                src={getCardImage(item.card.suit, item.card.value)}
                                className="played-card" // Uses new CSS class
                                style={{
                                    transform: `translate(${translate}) rotate(${rotation}deg)`,
                                    zIndex: i
                                }}
                             />
                        );
                    })}
                </div>
            </>
        )}
      </div>
    </div>
  );
}

export default Game;