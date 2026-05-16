import LiveMandiPrice from './LiveMandiPrice.jsx';

export default function LivePotatoPrice({ variant = 'card' }) {
  return <LiveMandiPrice commodity="Potato" district="Mumbai" variant={variant} />;
}
