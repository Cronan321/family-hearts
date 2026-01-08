// client/src/AudioChat.jsx
import React, { useEffect, useState, useRef } from 'react';
import Peer from 'peerjs';

function AudioChat({ socket, room, username }) {
  const [myPeerId, setMyPeerId] = useState('');
  const [isTalking, setIsTalking] = useState(false);
  const [error, setError] = useState('');
  
  const myStreamRef = useRef(null); // My microphone stream
  const peerInstance = useRef(null); // My Peer connection
  const peersRef = useRef({}); // List of active calls

  useEffect(() => {
    // 1. Initialize PeerJS (Connect to the public cloud server)
    const peer = new Peer();
    peerInstance.current = peer;

    peer.on('open', (id) => {
        setMyPeerId(id);
        // Tell the game server "I am ready for audio"
        socket.emit('register_peer', { room, peerId: id });
    });

    // 2. Get Microphone Access
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        myStreamRef.current = stream;
        
        // MUTE BY DEFAULT (Push to Talk logic)
        stream.getAudioTracks()[0].enabled = false;

        // 3. Answer Incoming Calls
        peer.on('call', (call) => {
            // Answer the call and send them my (muted) stream
            call.answer(stream);
            
            // Listen to their stream
            call.on('stream', (userAudioStream) => {
                addAudioStream(userAudioStream);
            });
        });

        // 4. Call others when they join
        socket.on('user_joined_audio', (data) => {
            const call = peer.call(data.peerId, stream);
            call.on('stream', (userAudioStream) => {
                addAudioStream(userAudioStream);
            });
        });
      })
      .catch(err => {
          console.error("Audio Error:", err);
          setError("Mic Access Denied");
      });

    return () => {
        // Cleanup
        socket.off('user_joined_audio');
        if(peerInstance.current) peerInstance.current.destroy();
    };
  }, [room, socket]);

  // Helper: Create an invisible <audio> element for each person
  const addAudioStream = (stream) => {
    const audio = document.createElement('audio');
    audio.srcObject = stream;
    audio.addEventListener('loadedmetadata', () => {
        audio.play();
    });
    // Add to DOM invisibly
    document.body.append(audio);
  };

  // --- PUSH TO TALK LOGIC ---
  const startTalking = () => {
    if (myStreamRef.current) {
        myStreamRef.current.getAudioTracks()[0].enabled = true;
        setIsTalking(true);
    }
  };

  const stopTalking = () => {
    if (myStreamRef.current) {
        myStreamRef.current.getAudioTracks()[0].enabled = false;
        setIsTalking(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', textAlign: 'center' }}>
      {error && <p style={{color: 'red', fontSize: '10px'}}>{error}</p>}
      
      <button
        onMouseDown={startTalking}
        onMouseUp={stopTalking}
        onMouseLeave={stopTalking} // Stop if they drag mouse off button
        onTouchStart={startTalking} // Mobile support
        onTouchEnd={stopTalking}
        style={{
            width: '100%',
            padding: '15px',
            borderRadius: '50px',
            border: 'none',
            background: isTalking ? '#4caf50' : '#d32f2f', // Green when talking, Red when muted
            color: 'white',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: isTalking ? '0 0 15px #4caf50' : 'none',
            userSelect: 'none' // Prevent text highlighting
        }}
      >
        {isTalking ? "🎙️ BROADCASTING..." : "HOLD TO TALK"}
      </button>
    </div>
  );
}

export default AudioChat;