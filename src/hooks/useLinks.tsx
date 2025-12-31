import type { ReactElement } from 'react';
import { Link, useLocation, type LinkProps } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import pages from '../data/pages.json';

export type MenuLinks = Array<ReactElement<LinkProps> | null>;

export type LinkType = 'header' | 'footer' | 'side';

export const useLinks = (type: LinkType): MenuLinks => {
	const { pathname } = useLocation();

	const list =
		useQuery({
			queryKey: ['pages'],
			queryFn: async () => {
				const all = pages;
				return all.filter((p) => p.url !== 'home');
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
			<Link key={prev.url} to={'/' + prev.url}>
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
			<Link key={next.url} to={'/' + next.url}>
				Next: {next.title}
			</Link>
		) : null,
	);

	return links;
};
