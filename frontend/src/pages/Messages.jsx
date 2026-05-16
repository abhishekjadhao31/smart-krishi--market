import { useEffect, useState } from 'react';
import { getInbox, getSent, markAsRead } from '../api/messages.js';
import Loader from '../components/Loader.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Messages() {
  const { user } = useAuth();
  const [tab, setTab] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const fetch = tab === 'inbox' ? getInbox : getSent;
    fetch()
      .then(({ data }) => setMessages(data.data || []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [tab]);

  const handleMarkRead = async (messageId) => {
    try {
      await markAsRead(messageId);
      setMessages((msgs) =>
        msgs.map((m) => (m.id === messageId ? { ...m, is_read: true } : m))
      );
    } catch (err) {
      console.error('Failed to mark message as read:', err);
    }
  };

  const unreadCount = messages.filter((m) => !m.is_read).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-krishi-900">Messages</h1>

      <div className="mt-6 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab('inbox')}
          className={`px-4 py-2 font-semibold ${
            tab === 'inbox'
              ? 'border-b-2 border-krishi-600 text-krishi-600'
              : 'text-gray-600 hover:text-krishi-600'
          }`}
        >
          Inbox {tab === 'inbox' && unreadCount > 0 && `(${unreadCount})`}
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`px-4 py-2 font-semibold ${
            tab === 'sent'
              ? 'border-b-2 border-krishi-600 text-krishi-600'
              : 'text-gray-600 hover:text-krishi-600'
          }`}
        >
          Sent
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <Loader label="Loading messages..." />
        ) : messages.length === 0 ? (
          <div className="card text-center text-gray-600">
            <p>No messages yet.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`card cursor-pointer border-l-4 transition ${
                msg.is_read ? 'border-l-transparent bg-white' : 'border-l-krishi-600 bg-krishi-50'
              }`}
              onClick={() => tab === 'inbox' && !msg.is_read && handleMarkRead(msg.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-krishi-800">
                    {tab === 'inbox' ? msg.from_name : msg.to_name}
                  </p>
                  {msg.subject && <p className="text-sm text-gray-600">{msg.subject}</p>}
                  {msg.crop_name && <p className="text-xs text-gray-500">Re: {msg.crop_name}</p>}
                  <p className="mt-2 line-clamp-2 text-sm text-gray-700">{msg.body}</p>
                </div>
                <span className="whitespace-nowrap text-xs text-gray-500">
                  {new Date(msg.created_at).toLocaleDateString()}
                </span>
              </div>
              {!msg.is_read && <div className="mt-2 h-1 w-4 bg-krishi-600"></div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
