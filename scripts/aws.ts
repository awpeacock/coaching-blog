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

interface Details {
	cloudfront: {
		id: string;
		domain: string;
	};
	route53: {
		zone?: string;
	};
}

dotenv.config();

const deploy = async (
	client: CloudFormationClient,
	stack: string,
	input: CreateStackCommandInput,
): Promise<void> => {
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
				{ client: client, maxWaitTime: 1800 },
				{ StackName: stack },
			);
		} else {
			await waitUntilStackUpdateComplete(
				{ client: client, maxWaitTime: 1800 },
				{ StackName: stack },
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
): Promise<Details> => {
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
	const ns = outputs?.find(
		(o) => o.OutputKey === 'Route53NSRecords',
	)?.OutputValue;
	const zone = outputs?.find(
		(o) => o.OutputKey === 'Route53HostedZoneID',
	)?.OutputValue;

	if (!id) {
		throw new Error('Unable to retrieve Distribution ID');
	}
	if (!domain) {
		throw new Error('Unable to retrieve Distribution Domain');
	}

	const details: Details = {
		cloudfront: {
			id,
			domain,
		},
		route53: {
			zone,
		},
	};

	info(`CloudFront Distribution ID: ${details.cloudfront.id}`);
	info(`CloudFront Domain: ${details.cloudfront.domain}`);
	if (ns) {
		info(`Route 53 NS Records: ${ns}`);
	}
	if (zone) {
		info(`Route 53 Hosted Zone ID: ${zone}`);
	}
	return details;
};

const writeDetails = (details: Details): void => {
	const isCI = !!process.env.GITHUB_ACTIONS;

	if (isCI) {
		fs.appendFileSync(
			process.env.GITHUB_ENV!,
			`CLOUDFRONT_DISTRIBUTION_ID=${details.cloudfront.id}\n`,
		);
		fs.appendFileSync(
			process.env.GITHUB_ENV!,
			`CLOUDFRONT_DOMAIN=${details.cloudfront.domain}\n`,
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
		vars = resolve(
			vars,
			'CLOUDFRONT_DISTRIBUTION_ID',
			details.cloudfront.id,
		);
		vars = resolve(vars, 'CLOUDFRONT_DOMAIN', details.cloudfront.domain);
		fs.writeFileSync(file, vars.join('\n').trim() + '\n');
	}
	success(
		'Environment variables successfully updated with CloudFront details',
	);
};

const createACM = async (
	stack: string,
	route53: boolean,
	zone?: string,
): Promise<string> => {
	const template = fs.readFileSync('./cloudformation/acm-cert.yaml', 'utf8');
	const client = new CloudFormationClient({
		region: 'us-east-1',
	});
	let params = [
		{
			ParameterKey: 'Domain',
			ParameterValue: config.domain,
		},
	];
	if (route53) {
		params = params.concat([
			{
				ParameterKey: 'EnableRoute53',
				ParameterValue: 'true',
			},
			{
				ParameterKey: 'HostedZoneId',
				ParameterValue: zone,
			},
		]);
	}

	const input: CreateStackCommandInput = {
		StackName: stack,
		TemplateBody: template,
		Capabilities: ['CAPABILITY_NAMED_IAM'],
		Parameters: params,
	};
	await deploy(client, stack, input);

	const { Stacks } = await client.send(
		new DescribeStacksCommand({ StackName: stack }),
	);
	const arn = Stacks?.[0]?.Outputs?.find(
		(o) => o.OutputKey === 'CertificateArn',
	)?.OutputValue;
	if (!arn) {
		throw new Error('Unable to retrieve ACM Certificate ARN');
	}
	info(`ACM Certificate ARN: ${arn}`);

	return arn;
};

heading('Setting up AWS S3, CloudFront and (optionally) Route 53');

const template = fs.readFileSync('./cloudformation/template.yaml', 'utf8');

const config = {
	region: process.env.AWS_REGION,
	stack: process.env.AWS_STACK,
	project: process.env.AWS_PROJECT_NAME,
	route53: process.env.AWS_ENABLE_ROUTE53,
	domain: process.env.DOMAIN,
};

if (!config.region || !config.stack || !config.domain) {
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
if (config.route53 !== undefined) {
	params.push({
		ParameterKey: 'EnableRoute53',
		ParameterValue: config.route53,
	});
	if (config.route53 === 'true') {
		params.push({
			ParameterKey: 'Domain',
			ParameterValue: config.domain,
		});
	}
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
info(`Is Route 53 enabled? ${config.route53 === 'true'}`);
if (config.domain) {
	info(`Public Domain: ${config.domain}`);
}

try {
	heading('Initial deployment of main stack');
	await deploy(client, config.stack!, input);

	const details = await getDetails(client, config.stack!);
	writeDetails(details);

	heading('Deployment of ACM certificate');
	const cert = await createACM(
		config.stack! + '-ACM-Cert',
		config.route53 === 'true',
		details.route53.zone,
	);

	heading('Redeploying main stack and injecting certificate into CloudFront');
	const revised = [
		...params,
		{ ParameterKey: 'AcmCertificateArn', ParameterValue: cert },
	];

	await deploy(client, config.stack!, {
		...input,
		Parameters: revised,
	});
} catch (e) {
	fail('Failed to deploy', e as Error);
}
