import { Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import { FileProvider } from '@/contexts/FileContext';
import HomePage from '@/pages/HomePage';
import ResultsPage from '@/pages/ResultsPage';
import ManifestPage from '@/pages/ManifestPage';
import NotFoundPage from '@/pages/NotFoundPage';

export default function App() {
  return (
    <FileProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/manifest/:id" element={<ManifestPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </FileProvider>
  );
}
