// client/src/Game.jsx
import React, { useState, useEffect, useRef } from 'react';
import AudioChat from './AudioChat';
import './Game.css'; 

// --- SOUND IMPORTS ---
import cardSoundFile from './assets/card.wav';      
import shuffleSoundFile from './assets/shuffle.mp3'; 
import collectSoundFile from './assets/collect.ogg'; 

// --- CARD IMAGES ---
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
  
  // --- NEW: GAME OVER STATE ---
  const [gameOverData, setGameOverData] = useState(null);

  // --- CHAT STATES ---
  const [chatInput, setChatInput] = useState("");
  const [bubbles, setBubbles] = useState({}); 

  // --- AUDIO REFS ---
  const cardAudio = useRef(new Audio(cardSoundFile));
  const shuffleAudio = useRef(new Audio(shuffleSoundFile));
  const collectAudio = useRef(new Audio(collectSoundFile));

  const myIndex = players.findIndex(p => p.id === socket.id);

  const getRelativePlayer = (offset) => {
      if (myIndex === -1) return players[offset]; 
      const actualIndex = (myIndex + offset) % 4;
      return players[actualIndex];
  };

  const playSound = (audioRef) => {
      try {
          audioRef.current.currentTime = 0; 
          audioRef.current.play();
      } catch (e) {
          console.error("Audio play failed", e);
      }
  };

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    socket.on('game_started', (data) => {
        setGameStatus("PLAYING");
        setGameOverData(null); // Reset game over if we restart
        setMyHand(data.hand);
        setTurnIndex(data.turnIndex);
        setBoard([]);
        playSound(shuffleAudio);
    });

    socket.on('hand_update', (newHand) => setMyHand(newHand));

    socket.on('state_update', (data) => {
        setBoard(data.board);
        setTurnIndex(data.turnIndex);
        if (data.board.length > 0) playSound(cardAudio);
    });

    socket.on('trick_finished', (data) => {
        setScores(data.scores);
        playSound(collectAudio);
    });
    
    // --- NEW: LISTEN FOR GAME OVER ---
    socket.on('game_over', (data) => {
        setGameOverData(data); // Save the final scores
        setGameStatus("FINISHED");
    });

    socket.on('receive_message', (data) => {
        const { author, message } = data;
        setBubbles(prev => ({ ...prev, [author]: message }));
        setTimeout(() => {
            setBubbles(prev => {
                const newState = { ...prev };
                if (newState[author] === message) delete newState[author];
                return newState;
            });
        }, 4000);
    });
    
    return () => {
        socket.off('game_started');
        socket.off('hand_update');
        socket.off('state_update');
        socket.off('trick_finished');
        socket.off('receive_message');
        socket.off('game_over');
    };
  }, [socket]);

  const startGame = () => socket.emit('start_game', { room });

  const playCard = (card) => {
    if (turnIndex !== myIndex) return;
    socket.emit('play_card', { room, card, playerIndex: myIndex });
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (chatInput.trim() !== "") {
        const messageData = { room, author: username, message: chatInput };
        socket.emit("send_message", messageData);
        setChatInput(""); 
        setBubbles(prev => ({ ...prev, [username]: chatInput }));
        setTimeout(() => {
             setBubbles(prev => {
                const newState = { ...prev };
                if (newState[username] === chatInput) delete newState[username];
                return newState;
            });
        }, 4000);
    }
  };

  const renderSeat = (positionName, offset) => {
      const player = getRelativePlayer(offset);
      if (!player) return null;
      const isMyTurn = players.indexOf(player) === turnIndex;
      const playerScore = scores.find(s => s.name === player.name)?.score || 0;
      const isMe = offset === 0;
      const activeMessage = bubbles[player.name];

      return (
          <div className={`player-seat seat-${positionName}`}>
              {activeMessage && (
                  <div style={{
                      position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)',
                      background: 'white', color: 'black', padding: '10px 15px', borderRadius: '15px',
                      fontSize: '14px', fontWeight: 'bold', boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                      zIndex: 200, whiteSpace: 'nowrap', pointerEvents: 'none'
                  }}>
                      {activeMessage}
                      <div style={{
                          position: 'absolute', bottom: '-8px', left: '50%', marginLeft: '-8px',
                          borderWidth: '8px 8px 0', borderStyle: 'solid', borderColor: 'white transparent transparent'
                      }}></div>
                  </div>
              )}

              {isMe ? (
                  <div className="my-hand">
                      {myHand.map((c, i) => (
                          <img key={i} src={getCardImage(c.suit, c.value)} className="my-card"
                            onClick={() => playCard(c)} alt="card"
                          />
                      ))}
                  </div>
              ) : (
                  <div className="opponent-hand">
                      {[1,2,3].map(i => <div key={i} className="card-back"></div>)}
                  </div>
              )}

              <div className={`player-info ${isMyTurn ? 'turn-active' : ''}`}>
                  <div>{player.name}</div>
                  <div style={{fontSize: '0.8em', color: '#ccc'}}>Score: {playerScore}</div>
              </div>
          </div>
      );
  };

  return (
    <div className="game-container">
      <div className="top-bar">
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <h2>♥ Family Hearts</h2>
            <div style={{ opacity: 0.7 }}>Room: {room}</div>
            <AudioChat socket={socket} room={room} username={username} />
          </div>
      </div>

      <div className="table-area">
        
        {/* --- WAITING SCREEN --- */}
        {gameStatus === "WAITING" && (
            <div style={{ textAlign: 'center', marginTop: '150px', color: 'white' }}>
                <h1>Waiting for Family...</h1>
                <p>{players.length}/4 Players Ready</p>
                {players.length === 4 && <button onClick={startGame} style={{padding: '20px', fontSize: '20px'}}>DEAL CARDS</button>}
            </div>
        )}

        {/* --- GAME OVER SCREEN --- */}
        {gameStatus === "FINISHED" && gameOverData && (
             <div style={{
                 position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                 background: 'rgba(0,0,0,0.85)', zIndex: 999,
                 display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
             }}>
                 <h1 style={{ fontSize: '3rem', color: '#ffd700', marginBottom: '20px' }}>GAME OVER</h1>
                 <div style={{ background: 'white', padding: '20px', borderRadius: '15px', minWidth: '300px' }}>
                     {gameOverData.scores
                        .sort((a,b) => a.score - b.score) // Sort lowest score (winner) first
                        .map((p, i) => (
                         <div key={i} style={{ 
                             display: 'flex', justifyContent: 'space-between', 
                             padding: '10px', borderBottom: '1px solid #ccc',
                             color: 'black', fontSize: '1.2rem', fontWeight: i===0 ? 'bold' : 'normal'
                         }}>
                             <span>{i===0 ? '👑 ' : ''}{p.name}</span>
                             <span>{p.score} pts</span>
                         </div>
                     ))}
                 </div>
                 <button onClick={() => window.location.reload()} style={{
                     marginTop: '30px', padding: '15px 30px', fontSize: '18px',
                     background: '#4caf50', color: 'white', border: 'none', borderRadius: '30px', cursor: 'pointer'
                 }}>
                     PLAY AGAIN
                 </button>
             </div>
        )}

        {/* --- PLAYING TABLE --- */}
        {(gameStatus === "PLAYING" || gameStatus === "FINISHED") && (
            <>
                {renderSeat("bottom", 0)}
                {renderSeat("left", 1)}
                {renderSeat("top", 2)}
                {renderSeat("right", 3)}

                <div className="center-pot">
                    {board.map((item, i) => {
                        const ownerIndex = players.findIndex(p => p.name === item.player);
                        const relativePos = (ownerIndex - myIndex + 4) % 4;
                        let rotation = 0;
                        let translate = "0px, 0px";
                        
                        if (relativePos === 0) { rotation = 0; translate = "0px, 20px"; }    
                        if (relativePos === 1) { rotation = 90; translate = "-20px, 0px"; }  
                        if (relativePos === 2) { rotation = 180; translate = "0px, -20px"; } 
                        if (relativePos === 3) { rotation = -90; translate = "20px, 0px"; } 

                        return (
                             <img key={i} src={getCardImage(item.card.suit, item.card.value)}
                                className="played-card"
                                style={{ transform: `translate(${translate}) rotate(${rotation}deg)`, zIndex: i }}
                             />
                        );
                    })}
                </div>
            </>
        )}

        <div style={{
            position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
            width: 'min(300px, 80%)', zIndex: 100
        }}>
            <form onSubmit={sendMessage}>
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type to chat..."
                    style={{
                        width: '100%', padding: '10px 20px', borderRadius: '25px', border: 'none',
                        background: 'rgba(0,0,0,0.5)', color: 'white', textAlign: 'center', outline: 'none',
                        backdropFilter: 'blur(5px)', boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                    }}
                />
            </form>
        </div>

      </div>
    </div>
  );
}

export default Game;