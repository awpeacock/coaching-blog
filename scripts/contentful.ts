import contentful from 'contentful-management';
import type {
	ClientAPI,
	Space,
	ContentType,
	Environment,
} from 'contentful-management';
import dotenv from 'dotenv';
import * as fs from 'node:fs';
import path from 'node:path';

dotenv.config();

const heading = (msg: string) => {
	console.log('\x1b[1m' + msg + '\x1b[0m');
};
const info = (msg: string) => {
	console.log('\x1b[1m\x1b[34m\u2139\x1b[0m ' + msg);
};
const log = (msg: string) => {
	console.log(msg);
};
const success = (msg: string) => {
	console.log('\x1b[1m\x1b[32m\u2713\x1b[0m ' + msg);
};
const warn = (msg: string) => {
	console.error('\x1b[33m' + msg + '\x1b[0m');
};
const fail = (msg: string, err?: Error) => {
	if (err) {
		console.error(
			'\x1b[1m\x1b[31m\u2718\x1b[0m ' + msg + ' - ' + err.message,
		);
	} else {
		console.error('\x1b[1m\x1b[31m\u2718\x1b[0m ' + msg);
	}
	process.exit(1);
};

const resolveSpace = async (client: ClientAPI): Promise<Space> => {
	const id = process.env.VITE_CONTENTFUL_SPACE_ID;

	if (id) {
		info(`Existing Space ID: ${id}`);
		return client.getSpace(id);
	}

	// If we don't have a Space ID, then we need to try to create a Space.
	// Ignoring the error below as the code expects an organisation ID but it is NOT
	// mandatory and isn't even included in Contentful's own examples.
	// @ts-expect-error ts-2554
	const space: Space = await client.createSpace({
		name: process.env.CONTENTFUL_SPACE_NAME,
	});

	if (!space.sys.id) {
		fail('Space creation failed');
	}

	const key = space.sys.id;
	success(`Space successfully created with ID: ${space.sys.id}`);

	const file = path.resolve('.env');
	if (fs.existsSync(file)) {
		fs.appendFileSync(file, `\nVITE_CONTENTFUL_SPACE_ID=${key}\n`);
		log('Space ID added to .env');
	} else {
		warn('Unable to add Space ID to .env file - it does not exist');
	}

	return space;
};

const resolveContentType = async (space: Space): Promise<ContentType> => {
	const name = process.env.VITE_CONTENTFUL_CONTENT_TYPE ?? 'Blog Post';

	const environment: Environment = await space.getEnvironment('master');
	if (!environment) {
		fail('Unable to retrieve Environment');
	}

	let type: ContentType | null = null;
	try {
		const existing = await environment.getContentType('blog-post');
		if (existing) {
			info(`Content Type "${existing.name}" exists`);
			if (existing.sys.publishedVersion) {
				return existing;
			}
			type = existing;
		}
	} catch (e) {
		const err = e as Error;
		if (err.name !== 'NotFound') {
			fail('Error trying to retrieve Content Type', e as Error);
		}
	}

	if (!type) {
		type = await environment.createContentTypeWithId('blog-post', {
			name: name,
			description: 'Simple blog post structure',
			fields: [
				{
					id: 'title',
					name: 'Title',
					type: 'Symbol',
					required: true,
					localized: false,
				},
				{
					id: 'url',
					name: 'URL/Path',
					type: 'Symbol',
					required: true,
					localized: false,
					validations: [
						{
							unique: true,
						},
					],
				},
				{
					id: 'content',
					name: 'Content',
					type: 'RichText',
					required: true,
					localized: false,
				},
			],
			displayField: 'title',
		});
		if (!type) {
			fail('Unable to create Content Type');
		}
		success(`Content Type successfully created with name "${name}"`);
	}

	const published = await type.publish();
	if (!published) {
		fail('Unable to publish Content Type');
	}
	success('Content Type successfully published');

	return published;
};

heading('Setting up Contentful Space and Content Model');

// Validate all necessary environment variables are present
if (!process.env.CONTENTFUL_MANAGEMENT_TOKEN) {
	fail('No CMA token provided');
}
if (
	!process.env.VITE_CONTENTFUL_SPACE_ID &&
	!process.env.CONTENTFUL_SPACE_NAME
) {
	fail('No Space ID provided and no name provided to create a new one');
}

const client = contentful.createClient({
	accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN!,
});

const space = await resolveSpace(client);
await resolveContentType(space);
