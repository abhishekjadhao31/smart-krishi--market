import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Loader from '../components/Loader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getConversationMessages,
  getMyConversations,
  sendConversationMessage,
} from '../api/conversations.js';

function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function Messages() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(searchParams.get('conversationId') || '');
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [draft, setDraft] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  const activeConversation = useMemo(
    () => conversations.find((item) => String(item.id) === String(activeId)) || conversation,
    [activeId, conversation, conversations]
  );

  const loadConversations = async ({ quiet = false } = {}) => {
    if (!quiet) setLoadingList(true);
    try {
      const { data } = await getMyConversations();
      const items = data.data || [];
      setConversations(items);
      setError('');

      if (!activeId && items.length > 0) {
        setActiveId(String(items[0].id));
        setSearchParams({ conversationId: String(items[0].id) });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load conversations.');
    } finally {
      if (!quiet) setLoadingList(false);
    }
  };

  const loadMessages = async (conversationId, { quiet = false } = {}) => {
    if (!conversationId) return;
    if (!quiet) setLoadingMessages(true);
    try {
      const { data } = await getConversationMessages(conversationId);
      setMessages(data.data || []);
      setConversation(data.conversation || null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load messages.');
    } finally {
      if (!quiet) setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    const paramId = searchParams.get('conversationId') || '';
    if (paramId && paramId !== activeId) setActiveId(paramId);
  }, [searchParams]);

  useEffect(() => {
    if (!activeId) return;
    setSearchParams({ conversationId: String(activeId) });
    loadMessages(activeId);
  }, [activeId]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadConversations({ quiet: true });
      if (activeId) loadMessages(activeId, { quiet: true });
    }, 4000);

    return () => clearInterval(timer);
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeId]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !activeId) return;

    setSending(true);
    try {
      const { data } = await sendConversationMessage(activeId, text);
      setMessages((items) => [
        ...items,
        {
          ...data.data,
          sender_name: user?.name || 'You',
        },
      ]);
      setDraft('');
      loadConversations({ quiet: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const selectConversation = (id) => {
    setActiveId(String(id));
    setSearchParams({ conversationId: String(id) });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-krishi-900">Messages</h1>
        <p className="text-sm text-gray-600">Simple buyer and farmer conversations.</p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 grid min-h-[620px] overflow-hidden rounded-lg border border-krishi-100 bg-white shadow-sm lg:grid-cols-[340px_1fr]">
        <aside className="border-b border-krishi-100 lg:border-b-0 lg:border-r">
          <div className="border-b border-krishi-100 px-4 py-3">
            <h2 className="font-semibold text-krishi-900">Inbox</h2>
          </div>

          {loadingList ? (
            <Loader label="Loading conversations..." />
          ) : conversations.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">
              No conversations yet. Buyers can start one from a crop listing.
            </div>
          ) : (
            <div className="max-h-[560px] overflow-y-auto">
              {conversations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectConversation(item.id)}
                  className={`block w-full border-b border-gray-100 px-4 py-3 text-left transition ${
                    String(activeId) === String(item.id)
                      ? 'bg-krishi-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-krishi-900">
                        {item.other_user_name || 'Conversation'}
                      </p>
                      {item.crop_name && (
                        <p className="truncate text-xs text-krishi-700">
                          {item.crop_name}
                        </p>
                      )}
                    </div>
                    {item.unread_count > 0 && (
                      <span className="badge bg-amber-100 text-amber-800">
                        {item.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                    {item.last_message || 'No messages yet'}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {formatTime(item.last_message_at || item.updated_at)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="flex min-h-[620px] flex-col">
          {activeConversation ? (
            <>
              <div className="border-b border-krishi-100 px-4 py-3">
                <h2 className="font-semibold text-krishi-900">
                  {activeConversation.other_user_name ||
                    (user?.role === 'buyer'
                      ? activeConversation.farmer_name
                      : activeConversation.buyer_name) ||
                    'Chat'}
                </h2>
                {activeConversation.crop_name && (
                  <p className="text-sm text-gray-600">
                    Listing: {activeConversation.crop_name}
                  </p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-5">
                {loadingMessages ? (
                  <Loader label="Loading chat..." />
                ) : messages.length === 0 ? (
                  <div className="mt-16 text-center text-sm text-gray-600">
                    No messages yet. Start the conversation below.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => {
                      const isBuyerMessage =
                        Number(message.sender_id) === Number(activeConversation.buyer_id);
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isBuyerMessage ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[78%] rounded-lg px-4 py-3 shadow-sm ${
                              isBuyerMessage
                                ? 'bg-krishi-600 text-white'
                                : 'bg-white text-gray-800'
                            }`}
                          >
                            <p
                              className={`text-xs font-semibold ${
                                isBuyerMessage ? 'text-krishi-50' : 'text-krishi-700'
                              }`}
                            >
                              {message.sender_name || (isBuyerMessage ? 'Buyer' : 'Farmer')}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                              {message.text}
                            </p>
                            <p
                              className={`mt-2 text-right text-[11px] ${
                                isBuyerMessage ? 'text-krishi-50/80' : 'text-gray-400'
                              }`}
                            >
                              {formatTime(message.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              <form onSubmit={handleSend} className="border-t border-krishi-100 p-4">
                <div className="flex gap-3">
                  <input
                    className="input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a message"
                    maxLength={5000}
                  />
                  <button
                    type="submit"
                    className="btn-primary shrink-0"
                    disabled={sending || !draft.trim()}
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-gray-600">
              Select a conversation to open chat.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
