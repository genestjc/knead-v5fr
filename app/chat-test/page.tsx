// app/chat-test/page.tsx

import React from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useMembership } from 'your-membership-provider'; // Replace with actual membership provider import

const ChatPage = () => {
  const { account } = useActiveAccount();
  const { isMember } = useMembership();

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1 style={{ fontFamily: 'Adonis' }}>Knead</h1>
        <button className="hamburger-menu">☰</button>
      </header>
      <aside className="chat-sidebar">
        <ul>
          <li>Main</li>
          <li>Tech</li>
          <li>Food</li>
          <li>Music</li>
          <li>Art</li>
          <li>Fashion</li>
          <li>Pitch Deck</li>
          <li>Live Interviews</li>
        </ul>
      </aside>
      <main className="chat-main" style={{ fontFamily: 'Georgia Pro' }}>
        {/* Chat messages will be rendered here */}
      </main>
      <footer className="chat-footer">
        <input type="text" placeholder="Type your message..." />
        <button type="submit">Send</button>
      </footer>
      {!account && <div>Please connect your wallet.</div>}
      {account && !isMember && <div>You need to be a member to participate.</div>}
    </div>
  );
};

export default ChatPage;