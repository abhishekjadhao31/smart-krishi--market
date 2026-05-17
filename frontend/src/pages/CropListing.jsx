import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Loader from '../components/Loader.jsx';
import { getCrop, predictForCrop } from '../api/crops.js';
import { createConversation } from '../api/conversations.js';

export default function CropListing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [crop, setCrop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [contacting, setContacting] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const { data } = await getCrop(id);
        if (!mounted) return;
        setCrop(data);
      } catch (err) {
        setError(err?.response?.data || { message: err.message });
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  const handlePredict = async () => {
    if (!crop) return;
    try {
      setPredicting(true);
      const { data } = await predictForCrop({ cropId: crop.id });
      setPrediction(data);
    } catch (err) {
      setError(err?.response?.data || { message: err.message });
    } finally {
      setPredicting(false);
    }
  };

  const handleContactFarmer = async () => {
    if (!crop) return;
    try {
      setContacting(true);
      const { data } = await createConversation({
        farmerId: crop.farmer_id,
        listingId: crop.id,
      });
      navigate(`/messages?conversationId=${data.data.id}`);
    } catch (err) {
      setError(err?.response?.data || { message: err.message || 'Could not start conversation' });
    } finally {
      setContacting(false);
    }
  };

  if (loading) return <Loader label="Loading crop..." />;
  if (error) return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="card text-red-600">Error loading crop: {error.message || 'Unknown'}</div>
      <Link to="/buyer" className="btn-outline mt-4">Back to search</Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="card">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="w-full lg:w-1/3">
            {crop.image_url ? (
              <img src={crop.image_url} alt={crop.crop_name} className="w-full h-48 object-cover rounded-md" />
            ) : (
              <div className="h-48 w-full bg-krishi-100 flex items-center justify-center rounded-md">No image</div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-krishi-800">{crop.crop_name}</h1>
            <p className="text-sm text-gray-600">Listed by <strong>{crop.farmer_name || 'Farmer'}</strong> • {crop.district}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div><strong>Quantity:</strong> {crop.quantity_kg} kg</div>
              <div><strong>Price:</strong> {crop.price_per_kg ? `₹${crop.price_per_kg}/kg` : '—'}</div>
              <div><strong>Harvest:</strong> {crop.harvest_date || '—'}</div>
              <div><strong>Storage:</strong> {crop.storage_available ? 'Yes' : 'No'}</div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="btn-primary" onClick={handleContactFarmer} disabled={contacting}>
                {contacting ? 'Opening...' : 'Contact Farmer'}
              </button>
              <Link to={`/logistics?cropId=${crop.id}`} className="btn-outline">🚚 Plan transport</Link>
              <button className="btn-outline" onClick={handlePredict} disabled={predicting}>{predicting ? 'Predicting…' : 'Run prediction'}</button>
            </div>

            {prediction && (
              <div className="mt-4 bg-white border rounded-md p-3">
                <h3 className="font-semibold">Prediction</h3>
                <p className="text-sm text-gray-700">Estimated modal price next 7 days: <strong>₹{prediction.estimate}</strong></p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
