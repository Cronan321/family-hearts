// client/src/App.jsx
import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import Game from "./Game";
import "./App.css";

// IMPORT THE BACKGROUND IMAGE
import lobbyBg from "./assets/lobbybg.png"; 

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
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'fixed', // Locks it in place so it doesn't scroll
            top: 0,
            left: 0
        }}>
            
            {/* The "Glass" Box */}
            <div style={{
                background: 'rgba(0, 0, 0, 0.75)', // Slightly darker for better readability
                backdropFilter: 'blur(8px)',
                padding: '30px 20px', // Top/Bottom padding, Left/Right padding
                borderRadius: '25px',
                textAlign: 'center',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
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
                    fontSize: '2rem', // Big readable title
                    margin: '0 0 5px 0',
                    fontWeight: '800',
                    letterSpacing: '1px'
                }}>
                    ♥ Family Hearts
                </h1>
                
                <p style={{ 
                    fontSize: '1rem', 
                    margin: '0 0 20px 0', 
                    opacity: 0.8,
                    color: '#ddd'
                }}>
                    Mobile Edition
                </p>
                
                <input
                    type="text"
                    placeholder="Your Name"
                    onChange={(event) => setUsername(event.target.value)}
                    style={{
                        padding: '16px', // Big touch target
                        fontSize: '16px', // PREVENTS IPHONE ZOOMING
                        borderRadius: '12px',
                        border: '2px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.9)',
                        outline: 'none',
                        textAlign: 'center',
                        fontWeight: '500'
                    }}
                />
                
                <input
                    type="text"
                    placeholder="Room Code (e.g. FAM)"
                    onChange={(event) => setRoom(event.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && joinRoom()} // Hit Enter to join
                    style={{
                        padding: '16px',
                        fontSize: '16px', 
                        borderRadius: '12px',
                        border: '2px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.9)',
                        outline: 'none',
                        textAlign: 'center',
                        fontWeight: '500',
                        textTransform: 'uppercase' // Forces Room code to look uniform
                    }}
                />
                
                <button 
                    onClick={joinRoom}
                    style={{
                        padding: '18px', // Very easy to tap
                        fontSize: '18px',
                        fontWeight: 'bold',
                        background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)', // Nice gradient
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        marginTop: '10px',
                        boxShadow: '0 4px 15px rgba(76, 175, 80, 0.4)',
                        letterSpacing: '1px'
                    }}
                >
                    ENTER LOBBY
                </button>
            </div>
        </div>
      ) : (
        <Game socket={socket} username={username} room={room} players={players} />
      )}
    </div>
  );
}

export default App;