import { useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import pages from '../data/pages.json';

export interface Content {
	url: string;
	date: string;
	title: string;
	content: Array<string>;
}

export const useContent = (): Content | null => {
	const { pathname } = useLocation();
	const key = pathname === '/' ? 'home' : pathname.substring(1);

	const { data, isSuccess } = useQuery({
		queryKey: ['page', key],
		queryFn: async () => {
			for (let page of pages) {
				if (page.url === key) {
					return page;
				}
			}
			return null;
		},
	});

	if (isSuccess) {
		return data;
	}
	return null;
};
