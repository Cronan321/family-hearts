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
    // Listen for successful join
    socket.on("joined_successfully", (data) => {
      setPlayers(data.players);
      setShowGame(true);
    });

    // Listen for connection errors (optional safety)
    socket.on("connect_error", (err) => {
      console.log(`Connection failed: ${err.message}`);
    });
  }, []);

  return (
    <div className="App">
      {!showGame ? (
        // --- LOGIN SCREEN WITH BACKGROUND ---
        <div style={{
            height: '100vh',
            width: '100vw',
            backgroundImage: `url(${lobbyBg})`, // Use the imported image
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            
            {/* Dark Overlay Box for readability */}
            <div style={{
                background: 'rgba(0, 0, 0, 0.6)', // 60% dark tint
                backdropFilter: 'blur(5px)', // Blurs the image behind the box
                padding: '40px',
                borderRadius: '20px',
                textAlign: 'center',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                color: 'white',
                maxWidth: '90%' // Prevents it from being too wide on phones
            }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>♥ Family Hearts</h1>
                <p style={{ marginBottom: '30px', opacity: 0.8 }}>Enter a name and room to start</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input
                        type="text"
                        placeholder="Your Name..."
                        onChange={(event) => setUsername(event.target.value)}
                        style={{
                            padding: '15px',
                            fontSize: '16px',
                            borderRadius: '8px',
                            border: 'none',
                            outline: 'none'
                        }}
                    />
                    <input
                        type="text"
                        placeholder="Room Code (e.g. FAMILY)"
                        onChange={(event) => setRoom(event.target.value)}
                        style={{
                            padding: '15px',
                            fontSize: '16px',
                            borderRadius: '8px',
                            border: 'none',
                            outline: 'none'
                        }}
                    />
                    <button 
                        onClick={joinRoom}
                        style={{
                            padding: '15px',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            background: '#4caf50', // Green button
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            marginTop: '10px',
                            transition: 'background 0.2s'
                        }}
                    >
                        JOIN ROOM
                    </button>
                </div>
            </div>
        </div>
      ) : (
        // --- THE GAME SCREEN ---
        <Game socket={socket} username={username} room={room} players={players} />
      )}
    </div>
  );
}

export default App;