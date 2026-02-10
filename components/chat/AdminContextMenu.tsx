// components/chat/AdminContextMenu.tsx - Update to pass spaceId and channelId

const handleBanUser = async () => {
  if (!confirm(`Ban ${message.sender.name}? They will be banned from Towns Protocol.`)) return;

  setIsProcessing(true);
  try {
    const response = await fetch('/api/admin/chat/ban-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminAddress: activeAccount?.address,
        userAddress: message.sender.id,
        ban: true,
        spaceId: spaceId, // ✅ Pass from props
      }),
    });

    const data = await response.json();

    if (data.success) {
      toast.success(`${message.sender.name} has been banned from Towns Protocol`);
      onClose();
    } else {
      toast.error(data.error || 'Failed to ban user');
    }
  } catch (error: any) {
    toast.error(error.message || 'Failed to ban user');
  } finally {
    setIsProcessing(false);
  }
};

const handleDeleteMessage = async () => {
  if (!confirm('Delete this message from Towns Protocol?')) return;

  setIsProcessing(true);
  try {
    const response = await fetch('/api/admin/chat/delete-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminAddress: activeAccount?.address,
        messageId: message.id,
        channelId: channelId, // ✅ Pass from props
      }),
    });

    const data = await response.json();

    if (data.success) {
      toast.success('Message deleted from Towns Protocol');
      onClose();
      // Message will disappear from UI automatically via Towns sync
    } else {
      toast.error(data.error || 'Failed to delete message');
    }
  } catch (error: any) {
    toast.error(error.message || 'Failed to delete message');
  } finally {
    setIsProcessing(false);
  }
};
