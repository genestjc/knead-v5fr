import React from 'react';
import ProgressiveLoader from '../components/chat/ProgressiveLoader';

const ChatClient = () => {
  const [isNewUser, setIsNewUser] = React.useState(false);
  const [loadingMessage, setLoadingMessage] = React.useState('');

  React.useEffect(() => {
    // Detect if user is a member and update state accordingly
    // Placeholder for actual detection logic
    const userIsMember = false; // Assume we get this from IndexedDB or blockchain
    setIsNewUser(!userIsMember);
  }, []);

  const loadingMessagesNewUser = [
    'Minting chat membership',
    'Connecting to network',
    'Reaching the nodes',
    'Connected to nodes',
    'Kneading the dough',
  ];

  const loadingMessagesReturningUser = [
    'Reconnecting to chat...',
    'Loading your messages...',
    'Almost there...',
  ];

  return (
    <div className="chat-client">
      {isNewUser ? (
        <div>
          <h1>Welcome to our chat</h1>
          <h2 style={{ fontStyle: 'italic' }}>
            Our home for community, conversation, and creativity.
          </h2>
          <p>If this is your first time joining, click the button below to sign-up:</p>
          <ProgressiveLoader messages={loadingMessagesNewUser} />
        </div>
      ) : (
        <ProgressiveLoader messages={loadingMessagesReturningUser} />
      )}
    </div>
  );
};

export default ChatClient;