import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ArticlePage from './pages/ArticlePage';
import StarredPage from './pages/StarredPage';

function App() {
  return (
    <Authenticator.Provider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/article/:articleId" element={<ArticlePage />} />
            <Route path="/starred" element={<StarredPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </Authenticator.Provider>
  );
}

export default App;
