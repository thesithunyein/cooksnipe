import { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { CinematicText } from './components/CinematicText';
import { Metrics } from './components/Metrics';
import { Technology } from './components/Technology';
import { Architecture } from './components/Architecture';
import { Footer } from './components/Footer';

export default function App() {
  const [entranceComplete, setEntranceComplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setEntranceComplete(true), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ fontFamily: '"Space Mono", monospace' }} className="bg-black text-white">
      <Navbar entranceComplete={entranceComplete} />
      <Hero entranceComplete={entranceComplete} />
      <CinematicText />
      <Metrics />
      <Technology />
      <Architecture />
      <Footer />
    </div>
  );
}