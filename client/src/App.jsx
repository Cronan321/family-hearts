// client/src/App.jsx
import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import Lobby from './Lobby';
import Game from './Game';

// Connect to the backend
const socket = io.connect("http://localhost:3001");

function App() {
  const [isInGame, setInGame] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    // Listener: When the server says we joined successfully
    socket.on("joined_successfully", (data) => {
        setInGame(true);
        setRoomCode(data.room);
        setPlayers(data.players);
    });

    // Listener: When a new player joins the room
    socket.on("player_update", (updatedPlayers) => {
        setPlayers(updatedPlayers);
    });

    // Listener: If there is an error (like room full)
    socket.on("error_message", (msg) => {
        alert(msg);
    });

    // Cleanup listener to prevent memory leaks
    return () => {
        socket.off("joined_successfully");
        socket.off("player_update");
        socket.off("error_message");
    };
  }, []); // The empty [] means this runs once when the app starts

  return (
    <div className="App">
      {!isInGame ? (
        // Show the Lobby if they haven't joined yet
        <Lobby socket={socket} setInGame={setInGame} setRoomData={setRoomCode} />
      ) : (
        // Show the Waiting Room / Game Board if they have joined
        <Game
          socket={socket}
          username={players.find(p => p.id === socket.id)?.name || "Player"}
          room={roomCode}
          players={players}
        />
      )}
    </div>
  );
}

export default App;