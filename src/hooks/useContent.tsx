import { createClient } from 'contentful';
import type {
	Document,
	Text,
	TopLevelBlock,
} from '@contentful/rich-text-types';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import pages from '../data/pages.json';

export interface Content {
	url: string;
	date: string;
	title: string;
	content: Array<string>;
}

const client = createClient({
	space: import.meta.env.VITE_CONTENTFUL_SPACE_ID,
	accessToken: import.meta.env.VITE_CONTENTFUL_DELIVERY_TOKEN,
});

const parse = (doc: Document): Array<string> =>
	doc.content
		.filter((node): node is TopLevelBlock => node.nodeType === 'paragraph')
		.flatMap((paragraph) =>
			paragraph.content
				.filter((c): c is Text => c.nodeType === 'text')
				.map((t) => t.value)
				.join(''),
		);

export const useContent = () => {
	const { pathname } = useLocation();
	const { t } = useTranslation();
	const key = pathname === '/' ? 'home' : pathname.substring(1);

	const remote = useQuery({
		queryKey: ['contentful', key],
		queryFn: async () => {
			const response = await client.getEntries({
				content_type: 'blog-post',
				'fields.url': key,
				limit: 1,
			});

			const entry = response.items[0];
			if (!entry) throw new Error('Page not found');

			const date = new Date(entry.sys.createdAt);
			const months = [
				'january',
				'february',
				'march',
				'april',
				'may',
				'june',
				'july',
				'august',
				'september',
				'october',
				'november',
				'december',
			];

			return {
				url: entry.fields.url as string,
				title: entry.fields.title as string,
				date:
					date.getDate() +
					' ' +
					t(months[date.getMonth()]) +
					' ' +
					date.getFullYear(),
				content: parse(entry.fields.content as Document),
			};
		},
	});

	const local = useQuery({
		queryKey: ['local', key],
		enabled: remote.isError,
		queryFn: async () => {
			for (let page of pages) {
				if (page.url === key) {
					return page;
				}
			}
			return null;
		},
	});

	let error = null;
	if (remote.isError) {
		if (local.data === null) {
			error = remote.error.message === 'Page not found' ? 404 : 500;
		}
	}

	return {
		post: remote.data ?? (remote.isError ? (local.data ?? null) : null),
		loading: remote.isLoading,
		error: error,
	};
};
