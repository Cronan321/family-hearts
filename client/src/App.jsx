// client/src/App.jsx
import { useState, useEffect } from "react";
import io from "socket.io-client";
import Game from "./Game";
import "./App.css";

// IMPORT THE BACKGROUND IMAGE
import lobbyBg from "./assets/lobbyBg.png";

// Connect to the live server
const socket = io();

function App() {
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");
  const [showGame, setShowGame] = useState(false);
  const [players, setPlayers] = useState([]);

  // Join Room Function
  const joinRoom = () => {
    if (username !== "" && room !== "") {
      socket.emit("join_room", { room, username });
    }
  };

  useEffect(() => {
    socket.on("joined_successfully", (data) => {
      setPlayers(data.players);
      setShowGame(true);
    });

    socket.on("connect_error", (err) => {
      console.log(`Connection failed: ${err.message}`);
    });
  }, []);

  return (
    <div className="App">
      {!showGame ? (
        // --- MOBILE-OPTIMIZED LOGIN SCREEN ---
        <div style={{
            height: '100vh',
            width: '100vw',
            backgroundImage: `url(${lobbyBg})`, 
            backgroundSize: 'center',
            backgroundPosition: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position : 'absolute',
            top: 0,
            left: 0
        }}>
            
            {/* The "Glass" Box */}
            <div style={{
                background: 'rgb(6, 6, 6)', // Slightly darker for better readability
                backdropFilter: 'blur(8px)',
                padding: '30px 20px', // Top/Bottom padding, Left/Right padding
                borderRadius: '25px',
                textAlign: 'center',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'white',
                
                // MOBILE SIZING RULES:
                width: '85%', // Takes up most of the phone width
                maxWidth: '400px', // But stops getting huge on tablets
                display: 'flex',
                flexDirection: 'column',
                gap: '15px'
            }}>
                <h1 style={{ 
                    fontSize: 'clamp(2.0em, 5vw, 2.5rem)', // Responsive font size
                    margin: '0 0 5px 0',
                    fontWeight: '800',
                    letterSpacing: '0.5px',
                    color: '#710616',
                    border: '3px solid #fefeff',
                    borderRadius: '12px',
                    padding: '10px',
                    background: 'rgba(255, 255, 255, 0.7)',
                    boxShadow: '#710616'
                }}>
                    ♥  Family Hearts ♥ 
                </h1>
                
                <p style={{ 
                    fontSize: 'clamp(0.85rem, 3vw, 1.1rem)', // Responsive font size
                    margin: '0 0 20px 0', 
                    opacity: 0.8,
                    color: '#fefeff'
                }}>
                   Enter your name & room code below to join or create a table!
                </p>
                
                <input
                    type="text"
                    placeholder="Player Name"
                    onChange={(event) => setUsername(event.target.value)}
                    style={{
                        padding: '16px', // Big touch target
                        fontSize: '16px', // PREVENTS IPHONE ZOOMING
                        borderRadius: '8px',
                        border: '2px solid rgba(241, 239, 239, 0.1)',
                        background: 'rgba(255,255,255,0.9)',
                        outline: 'none',
                        textAlign: 'center',
                        fontWeight: '800'
                    }}
                />
                
                <input
                    type="text"
                    placeholder="Enter 4-digit Room Code"
                    maxLength={4}
                    onChange={(event) => setRoom(event.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && joinRoom()} // Hit Enter to join
                    style={{
                        padding: '16px',
                        fontSize: '16px', 
                        borderRadius: '8px',
                        border: '2px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.9)',
                        outline: 'none',
                        textAlign: 'center',
                        fontWeight: '700',
                        textTransform: 'uppercase' // Forces Room code to look uniform
                    }}
                />
                
                <button 
                    onClick={joinRoom}
                    style={{
                        padding: 'clamp(12px, 3vw, 18px)', // Touch-friendly, responsive
                        fontSize: 'clamp(14px, 3vw, 18px)',
                        fontWeight: 'bold',
                        background: 'linear-gradient(135deg, #710606 0%, #3a3c3a 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        marginTop: '10px',
                        boxShadow: '0 4px 15px rgb(255, 255, 255)',
                        letterSpacing: '1px',
                        minHeight: '44px', // Apple's recommended touch target size
                        transition: 'transform 0.1s, box-shadow 0.1s'
                    }}
                    onTouchStart={(e) => e.target.style.transform = 'scale(0.98)'}
                    onTouchEnd={(e) => e.target.style.transform = 'scale(1)'}
                >
                    START PLAYING
                </button>
                <p><footer> Copyright 2025-2026 All Rights Reserved.<br/>
                Software Engineer Brianna Cronan <br/>
                Cronan Technology® </footer></p>
            </div>
        </div>
        
      ) : (
        <Game socket={socket} username={username} room={room} players={players} />
      )}
    </div>
  );
}

export default App;