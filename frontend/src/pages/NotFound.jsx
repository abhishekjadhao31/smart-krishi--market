import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <span className="text-5xl">🌾</span>
      <h1 className="mt-4 text-3xl font-bold text-krishi-800">Page not found</h1>
      <p className="mt-2 text-gray-600">The page you're looking for has wandered off the farm.</p>
      <Link to="/" className="btn-primary mt-6">Back to home</Link>
    </div>
  );
}
