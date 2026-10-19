import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Topbar from './components/Topbar';
import Overview from './pages/Overview';
import Layers from './pages/Layers';
import Styles from './pages/Styles';
import Workspaces from './pages/Workspaces';
import Stores from './pages/Stores';
import LayerGroups from './pages/LayerGroups';
import Clone from './pages/Clone';
import LoginScreen from './components/LoginScreen';
import { Loader } from './components/ui';
import { useAuth } from './store/authStore';

export default function App() {
  const auth = useAuth();

  useEffect(() => {
    auth.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (auth.loading) {
    return (
      <div className="grid h-full place-items-center">
        <Loader size={28} />
      </div>
    );
  }

  if (!auth.user) {
    return <LoginScreen />;
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar />
      <div className="min-h-0 flex-1">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/workspaces" element={<Workspaces />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/layergroups" element={<LayerGroups />} />
          <Route path="/layers" element={<Layers />} />
          <Route path="/styles" element={<Styles />} />
          <Route path="/clone" element={<Clone />} />
        </Routes>
      </div>
    </div>
  );
}
