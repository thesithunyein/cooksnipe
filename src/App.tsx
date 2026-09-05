import { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { CinematicText } from './components/CinematicText';
import { Metrics } from './components/Metrics';
import { Technology } from './components/Technology';
import { Architecture } from './components/Architecture';
import { Footer } from './components/Footer';
import { AppView } from './app/AppView';

type Route = 'landing' | 'app';

function getRoute(): Route {
  return window.location.hash.startsWith('#/app') ? 'app' : 'landing';
}

export default function App() {
  const [route, setRoute] = useState<Route>(getRoute);
  const [entranceComplete, setEntranceComplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setEntranceComplete(true), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onHash = () => {
      setRoute(getRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (route === 'app') {
    return <AppView />;
  }

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
