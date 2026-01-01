import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import './index.css';
import 'react-loading-skeleton/dist/skeleton.css';

import './i18n/config';

import { Homepage } from './components/Homepage.tsx';
import { Post } from './components/Post.tsx';

const client = new QueryClient();

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<QueryClientProvider client={client}>
			<BrowserRouter>
				<Routes>
					<Route index element={<Homepage />} />
					<Route path=":post" element={<Post />} />
				</Routes>
			</BrowserRouter>
		</QueryClientProvider>
	</StrictMode>,
);
