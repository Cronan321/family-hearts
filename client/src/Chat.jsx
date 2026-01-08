// client/src/Chat.jsx
import React, { useState, useEffect, useRef } from 'react';

function Chat({ socket, username, room }) {
  const [currentMessage, setCurrentMessage] = useState("");
  const [messageList, setMessageList] = useState([]);
  
  // Auto-scroll to bottom when new message arrives
  const messagesEndRef = useRef(null);

  const sendMessage = async () => {
    if (currentMessage !== "") {
      const messageData = {
        room: room,
        author: username,
        message: currentMessage,
        time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
      };

      await socket.emit("send_message", messageData);
      setCurrentMessage("");
    }
  };

  useEffect(() => {
    const handler = (data) => {
      setMessageList((list) => [...list, data]);
    };
    
    socket.on("receive_message", handler);
    
    // Cleanup to prevent double messages
    return () => socket.off("receive_message", handler);
  }, [socket]);

  // Scroll effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageList]);

  return (
    <div style={{ 
    border: '1px solid #444', 
    width: '200px', 
    height: '150px', // Shorter
    display: 'flex', 
    flexDirection: 'across', 
    background: 'rgba(243, 239, 239, 0)', // Semi-transparent
    color: 'white',
    borderRadius: '10px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
}}>
      
      {/* Header */}
      <div style={{ background: '#333', color: 'white', padding: '10px' }}>
        <p style={{ margin: 0 }}>Live Chat</p>
      </div>

      {/* Message Body */}
      <div style={{ flex: 1, overflowY: 'scroll', padding: '10px', background: '#f9f9f9' }}>
        {messageList.map((msg, index) => {
           const isMe = msg.author === username;
           return (
             <div key={index} style={{ 
                display: 'flex', 
                justifyContent: isMe ? 'flex-end' : 'flex-start',
                marginBottom: '5px' 
             }}>
                <div style={{
                    background: isMe ? '#74f078ff' : '#7e67f0fe',
                    color: isMe ? 'white' : 'black',
                    padding: '5px 10px',
                    borderRadius: '10px',
                    maxWidth: '80%'
                }}>
                    <p style={{ margin: 0, fontWeight: 'bold', fontSize: '10px' }}>{msg.author}</p>
                    <p style={{ margin: 0 }}>{msg.message}</p>
                </div>
             </div>
           );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ display: 'flex', borderTop: '1px solid #080808' }}>
        <input
          type="text"
          value={currentMessage}
          placeholder="Say something..."
          onChange={(event) => setCurrentMessage(event.target.value)}
          onKeyPress={(event) => { event.key === "Enter" && sendMessage(); }}
          style={{ flex: 1, padding: '10px', border: 'none', outline: 'none' }}
        />
        <button onClick={sendMessage} style={{ border: 'none', background: '#333', color: 'white', padding: '0 15px', cursor: 'pointer' }}>
            &#9658;
        </button>
      </div>
    </div>
  );
}

export default Chat;