import {
	CloudFrontClient,
	CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront';
import {
	S3Client,
	PutObjectCommand,
	ListObjectsV2Command,
	DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import dotenv from 'dotenv';
import { lookup } from 'mime-types';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

import { heading, info, log, success, fail } from './funcs';

dotenv.config();

const getAccountId = async (sts: STSClient) => {
	const identity = await sts.send(new GetCallerIdentityCommand({}));
	return identity.Account;
};

const traverse = (dir: string): Array<string> => {
	return readdirSync(dir).flatMap((file) => {
		const path = join(dir, file);
		return statSync(path).isDirectory() ? traverse(path) : [path];
	});
};

const empty = async (s3: S3Client, bucket: string) => {
	const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));

	if (!listed.Contents?.length) return;

	await s3.send(
		new DeleteObjectsCommand({
			Bucket: bucket,
			Delete: {
				Objects: listed.Contents.map((obj) => ({ Key: obj.Key! })),
			},
		}),
	);
};

const upload = async (s3: S3Client, bucket: string, directory: string) => {
	const files = traverse(directory);

	for (const file of files) {
		const key = file.replace(`${directory}${sep}`, '').split(sep).join('/');
		const body = readFileSync(file);
		const contentType = lookup(file) || 'application/octet-stream';

		await s3.send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				Body: body,
				ContentType: contentType,
			}),
		);
	}
};

const clearCache = async (cf: CloudFrontClient, id: string) => {
	await cf.send(
		new CreateInvalidationCommand({
			DistributionId: id,
			InvalidationBatch: {
				CallerReference: `${Date.now()}`,
				Paths: { Quantity: 1, Items: ['/*'] },
			},
		}),
	);
};

heading('Uploading React site to S3');

const config = {
	region: process.env.AWS_REGION,
	project: process.env.AWS_PROJECT_NAME ?? 'BLOG',
	cloudfront: process.env.CLOUDFRONT_DISTRIBUTION_ID,
};

if (!config.region || !config.project || !config.cloudfront) {
	fail('Missing environment variables. Check .env or GitHub secrets.');
}

const sts = new STSClient({ region: config.region });

const accountId = await getAccountId(sts);

const bucket = `${config.project.toLowerCase()}-site-${accountId}`;
info(`S3 Bucket Name: ${bucket}`);

const s3 = new S3Client({ region: config.region });

log('Emptying bucket...');
await empty(s3, bucket);

log('Uploading new build...');
await upload(s3, bucket, 'dist');

success('S3 bucket successfully updated');

const cf = new CloudFrontClient({ region: config.region });
info(`CloudFront Distribution ID: ${config.cloudfront}`);

await clearCache(cf, config.cloudfront!);

success('CloudFront Cache cleared');
