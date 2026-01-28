import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ArticlePage from './pages/ArticlePage';
import StarredPage from './pages/StarredPage';

function App() {
  const [useAiSummaries, setUseAiSummaries] = useState(() => {
    const stored = localStorage.getItem('useAiSummaries');
    return stored ? JSON.parse(stored) : true;
  });

  return (
    <Authenticator.Provider>
      <BrowserRouter>
        <Layout useAiSummaries={useAiSummaries} setUseAiSummaries={setUseAiSummaries}>
          <Routes>
            <Route path="/" element={<HomePage useAiSummaries={useAiSummaries} />} />
            <Route path="/article/:articleId" element={<ArticlePage />} />
            <Route path="/starred" element={<StarredPage useAiSummaries={useAiSummaries} />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </Authenticator.Provider>
  );
}

export default App;
