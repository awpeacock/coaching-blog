import { createClient } from 'contentful';
import type { ReactElement } from 'react';
import { Link, useLocation, type LinkProps } from 'react-router';
import { useQuery } from '@tanstack/react-query';

export type MenuLinks = Array<ReactElement<LinkProps> | null>;

export type LinkType = 'header' | 'footer' | 'side';

const client = createClient({
	space: import.meta.env.VITE_CONTENTFUL_SPACE_ID,
	accessToken: import.meta.env.VITE_CONTENTFUL_DELIVERY_TOKEN,
});

export const useLinks = (type: LinkType): MenuLinks => {
	const { pathname } = useLocation();

	const list =
		useQuery({
			queryKey: ['pages'],
			queryFn: async () => {
				const response = await client.getEntries({
					content_type: 'blog-post',
					select: ['sys.id', 'fields.title', 'fields.url'],
					order: ['-sys.createdAt'],
				});

				return response.items
					.map((entry) => ({
						id: entry.sys.id,
						title: entry.fields.title as string,
						url: entry.fields.url as string,
					}))
					.filter((p) => p.url !== 'home');
			},
		}).data ?? [];

	if (pathname === '/') {
		return list.map((p) => (
			<Link key={p.url} to={'/' + p.url}>
				{p.title}
			</Link>
		));
	}

	const page = pathname.substring(1);
	const keys = list.map((p) => p.url);
	const index = keys.indexOf(page);

	const links: MenuLinks = [];
	const prev = index > 0 ? list[index - 1] : null;
	const next = index < keys.length - 1 ? list[index + 1] : null;
	links.push(
		prev ? (
			<Link key={'prev'} to={'/' + prev.url}>
				Previous: {prev.title}
			</Link>
		) : null,
	);
	if (type === 'header') {
		links.push(
			<Link key={'home'} to="/">
				Home
			</Link>,
		);
	}
	links.push(
		next ? (
			<Link key={'next'} to={'/' + next.url}>
				Next: {next.title}
			</Link>
		) : null,
	);

	return links;
};
