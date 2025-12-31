import { useLocation } from 'react-router';

import { useContent } from '../hooks/useContent';

export const Content = () => {
	const { pathname } = useLocation();
	const post = useContent();

	if (post) {
		const { title, content, date } = post;

		return (
			<>
				{pathname !== '/' && (
					<>
						<h2>{title}</h2>
						<small>{date}</small>
					</>
				)}
				<p>
					<strong>{content[0]}</strong>
				</p>
				{content.slice(1).map((para, p) => (
					<p key={p + para.slice(0, 5)}>{para}</p>
				))}
			</>
		);
	}
};
