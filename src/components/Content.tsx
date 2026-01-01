import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';

import { useContent } from '../hooks/useContent';

export const Content = () => {
	const { pathname } = useLocation();
	const { t } = useTranslation();
	const { post, loading, error } = useContent();

	if (loading) {
		return (
			<SkeletonTheme baseColor="#8e6da5ff" highlightColor="#e695de">
				<p>
					<Skeleton width="75%" height="1.25rem" />
				</p>
				<p>
					<Skeleton count={10.5} />
				</p>
			</SkeletonTheme>
		);
	}

	if (error) {
		if (error === 404) {
			return <p className="error">{t('404')}</p>;
		} else {
			return <p className="error">{t('error')}</p>;
		}
	}

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
