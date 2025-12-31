import { Content } from './Content';
import { Layout } from './Layout';
import { Menu } from './Menu';

import { useLinks } from '../hooks/useLinks';

export const Homepage = () => {
	const links = useLinks('header');

	return (
		<Layout>
			<div id="home">
				<div id="intro">
					<Content />
				</div>
				<Menu type="side" links={links} />
			</div>
		</Layout>
	);
};
