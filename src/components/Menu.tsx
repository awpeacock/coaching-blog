import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { MenuLinks } from '../hooks/useLinks';

interface MenuProps {
	type: 'header' | 'footer' | 'side';
	links: MenuLinks;
}

export const Menu = (props: MenuProps) => {
	const { type, links } = props;
	const { t } = useTranslation();

	const [visible, setVisible] = useState<boolean>(false);

	const list = (
		<ul>
			{links
				.filter((link) => link !== null)
				.filter((link) => link || type !== 'footer')
				.map((link) => (
					<li key={link.key}>{link}</li>
				))}
		</ul>
	);

	switch (type) {
		case 'header': {
			return <header>{list}</header>;
		}
		case 'footer': {
			return (
				<footer>
					{visible && list}
					<div>
						<button
							className="hamburger"
							onClick={() => setVisible(!visible)}
						>
							<div className="burger" />
							<div className="burger" />
							<div className="burger" />
						</button>
						<Link to="/">
							<img
								src="home.svg"
								alt={t('home')}
								className="home"
							/>
						</Link>
					</div>
				</footer>
			);
		}
		case 'side': {
			return list;
		}
	}
};
