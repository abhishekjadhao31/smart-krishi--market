import { useState } from 'react';
import { sendMessage } from '../api/messages.js';

export default function SendMessageModal({ recipientId, recipientName, cropId, cropName, onClose, onSuccess }) {
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState(cropName ? `Inquiry about ${cropName}` : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await sendMessage({
        toUserId: recipientId,
        cropId: cropId || null,
        subject: subject || null,
        body: body.trim(),
      });
      setBody('');
      setSubject('');
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-krishi-800">Message {recipientName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {cropName && (
          <p className="mt-2 text-sm text-gray-600">Re: {cropName}</p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="label">Subject (optional)</label>
            <input
              className="input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={255}
            />
          </div>

          <div>
            <label className="label">Message *</label>
            <textarea
              className="input min-h-32 resize-none"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              maxLength={5000}
              required
            />
            <p className="text-xs text-gray-500">{body.length}/5000</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1" disabled={loading || !body.trim()}>
              {loading ? 'Sending...' : 'Send'}
            </button>
            <button type="button" onClick={onClose} className="btn-outline flex-1">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
