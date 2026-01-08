// client/src/Lobby.jsx
import React, { useState } from 'react';

function Lobby({ socket, setInGame, setRoomData }) {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [error, setError] = useState("");

  const joinRoom = () => {
    if (name === "" || room === "") {
        setError("Please enter both a Name and Room Code.");
        return;
    }
    
    // Send request to server
    socket.emit("join_room", { room, name });
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>♥ Family Hearts ♠</h1>
      
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '300px', margin: '0 auto', gap: '10px' }}>
        <input 
            placeholder="Your Nickname..." 
            onChange={(event) => setName(event.target.value)}
            style={{ padding: '10px', fontSize: '16px' }}
        />
        <input 
            placeholder="Room Code (e.g. FAM1)" 
            onChange={(event) => setRoom(event.target.value)}
            style={{ padding: '10px', fontSize: '16px' }}
        />
        
        <button 
            onClick={joinRoom}
            style={{ padding: '10px', fontSize: '16px', background: '#d32f2f', color: 'white', border: 'none', cursor: 'pointer' }}
        >
            JOIN ROOM
        </button>
        
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    </div>
  );
}

export default Lobby;