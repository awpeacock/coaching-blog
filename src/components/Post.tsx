import { Content } from './Content';
import { Layout } from './Layout';
import { Menu } from './Menu';

import { useContent } from '../hooks/useContent';
import { useLinks } from '../hooks/useLinks';

export const Post = () => {
	const post = useContent();
	const links = useLinks('header');

	if (post) {
		return (
			<Layout>
				<Menu type="header" links={links} />
				<div id="content">
					<Content />
				</div>
			</Layout>
		);
	}
};
