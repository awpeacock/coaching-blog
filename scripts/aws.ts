import {
	CloudFormationClient,
	CreateStackCommand,
	UpdateStackCommand,
	DescribeStacksCommand,
	waitUntilStackCreateComplete,
	waitUntilStackUpdateComplete,
} from '@aws-sdk/client-cloudformation';
import type {
	CreateStackCommandInput,
	Parameter,
} from '@aws-sdk/client-cloudformation';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

import { heading, info, log, success, fail } from './funcs';

interface DistributionDetails {
	id: string;
	domain: string;
}

dotenv.config();

const deploy = async (
	client: CloudFormationClient,
	input: CreateStackCommandInput,
) => {
	try {
		log('Deploying stack...');
		let create = true;
		await client.send(new CreateStackCommand(input)).catch(async (e) => {
			if (e.name === 'AlreadyExistsException') {
				info('Stack exists, updating...');
				create = false;
				await client.send(new UpdateStackCommand(input));
			} else {
				throw e;
			}
		});
		success('Deployment initiated');
		if (create) {
			await waitUntilStackCreateComplete(
				{ client: client, maxWaitTime: 600 },
				{ StackName: config.stack! },
			);
		} else {
			await waitUntilStackUpdateComplete(
				{ client: client, maxWaitTime: 600 },
				{ StackName: config.stack! },
			);
		}
		success('Deployment completed');
	} catch (e) {
		const err = e as Error;
		if (err.message.includes('No updates are to be performed')) {
			info('No updates were required');
		} else {
			fail('Deployment failed', e as Error);
		}
	}
};

const getDetails = async (
	client: CloudFormationClient,
	stack: string,
): Promise<DistributionDetails> => {
	const { Stacks } = await client.send(
		new DescribeStacksCommand({
			StackName: stack,
		}),
	);

	const outputs = Stacks?.[0]?.Outputs;
	const id = outputs?.find(
		(o) => o.OutputKey === 'CloudFrontDistributionId',
	)?.OutputValue;
	const domain = outputs?.find(
		(o) => o.OutputKey === 'CloudFrontDomainName',
	)?.OutputValue;

	if (!id) {
		throw new Error('Unable to retrieve Distribution ID');
	}
	if (!domain) {
		throw new Error('Unable to retrieve Distribution Domain');
	}

	const details: DistributionDetails = {
		id,
		domain,
	};

	info(`Distribution ID: ${details.id}`);
	info(`Domain: ${details.domain}`);
	return details;
};

const writeDetails = (details: DistributionDetails) => {
	const isCI = !!process.env.GITHUB_ACTIONS;

	if (isCI) {
		fs.appendFileSync(
			process.env.GITHUB_ENV!,
			`CLOUDFRONT_DISTRIBUTION_ID=${details.id}\n`,
		);
		fs.appendFileSync(
			process.env.GITHUB_ENV!,
			`CLOUDFRONT_DOMAIN=${details.domain}\n`,
		);
	} else {
		const file = path.resolve('.env');
		if (!fs.existsSync(file)) {
			fail('.env file not found');
		}

		const resolve = (
			lines: Array<string>,
			key: string,
			value: string,
		): Array<string> => {
			const index = lines.findIndex((line) => line.startsWith(`${key}=`));
			if (index === -1) {
				lines.push(`${key}=${value}`);
			} else {
				lines[index] = `${key}=${value}`;
			}
			return lines;
		};

		let vars = fs.readFileSync(file, 'utf8').split('\n');
		vars = resolve(vars, 'CLOUDFRONT_DISTRIBUTION_ID', details.id);
		vars = resolve(vars, 'CLOUDFRONT_DOMAIN', details.domain);
		fs.writeFileSync(file, vars.join('\n').trim() + '\n');
	}
	success(
		'Environment variables successfully updated with CloudFront details',
	);
};

heading('Setting up AWS S3 and CloudFront');

const template = fs.readFileSync('./cloudformation/template.yaml', 'utf8');

const config = {
	region: process.env.AWS_REGION,
	stack: process.env.AWS_STACK,
	project: process.env.AWS_PROJECT_NAME,
};

if (!config.region || !config.stack) {
	fail('Missing environment variables. Check .env or GitHub secrets.');
}

const client = new CloudFormationClient({
	region: config.region,
});

let params: Array<Parameter> = [];
if (config.project) {
	params = [
		{
			ParameterKey: 'ProjectName',
			ParameterValue: config.project,
		},
		{
			ParameterKey: 'BucketName',
			ParameterValue: config.project.toLowerCase(),
		},
	];
}

const input: CreateStackCommandInput = {
	StackName: config.stack,
	TemplateBody: template,
	Capabilities: ['CAPABILITY_NAMED_IAM'],
	Parameters: params,
};

info(`AWS Region: ${config.region}`);
info(`AWS Stack Name: ${config.stack}`);
if (config.project) {
	info(`AWS Project Name: ${config.project}`);
}

await deploy(client, input);
try {
	const details = await getDetails(client, config.stack!);
	writeDetails(details);
} catch (e) {
	fail('Failed to retrieve details', e as Error);
}
