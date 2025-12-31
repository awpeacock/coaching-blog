import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Menu } from './Menu';

import { useLinks } from '../hooks/useLinks';

interface LayoutProps {
	children: ReactNode;
}

export const Layout = (props: LayoutProps) => {
	const { children } = props;

	const { t, i18n } = useTranslation();
	const links = useLinks('footer');

	useEffect(() => {
		document.title = t('title');
	}, [t, i18n.language]);

	return (
		<>
			<div id="frame" />
			<div id="main">
				<h1>{t('title')}</h1>
				{children}
			</div>
			<Menu type="footer" links={links} />
		</>
	);
};
