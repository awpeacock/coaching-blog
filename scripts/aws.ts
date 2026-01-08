import {
	ACMClient,
	DescribeCertificateCommand,
	ListCertificatesCommand,
} from '@aws-sdk/client-acm';
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

import { title, heading, info, log, success, fail, dump } from './funcs';

interface Details {
	cloudfront: {
		id: string;
		domain: string;
	};
	route53: {
		ns?: string;
		zone?: string;
	};
}

dotenv.config();

// Store the details to output to the user for configuring their hosting provider's DNS records
const output = new Map<string, string>();

const deploy = async (
	client: CloudFormationClient,
	stack: string,
	input: CreateStackCommandInput,
	wait?: boolean,
): Promise<void> => {
	try {
		log('Deploying stack...');
		let create = true;
		await client.send(new CreateStackCommand(input)).catch(async (e) => {
			if (e.name === 'AlreadyExistsException') {
				if (phase === 'init') {
					log(
						'Stack exists, skipping (recreating the stack in init phase can break the site...',
					);
					return;
				}
				if (phase === 'finalise') {
					log('Stack exists, updating...');
					create = false;
					await client.send(new UpdateStackCommand(input));
				}
			} else {
				throw e;
			}
		});
		success('Deployment initiated');
		if (wait === undefined || wait === true) {
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
		}
	} catch (e) {
		const err = e as Error;
		if (err.message.includes('No updates are to be performed')) {
			log('No updates were required');
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
			ns,
			zone,
		},
	};

	return details;
};

const writeDetails = (details: Details, domain: string): void => {
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

	info(`CloudFront Distribution ID: ${details.cloudfront.id}`);
	info(`CloudFront Domain: ${details.cloudfront.domain}`);
	if (details.route53?.ns) {
		const ns = details.route53.ns
			.split(',')
			.map((r) => r.trim())
			.filter(Boolean);
		for (let n = 0; n < ns.length; n++) {
			output.set('DNS Record Type (' + (n + 1) + ')', 'NS');
			output.set(
				'DNS Record Name (' + (n + 1) + ')',
				domain.substring(0, domain.indexOf('.')),
			);
			output.set('DNS Record Value (' + (n + 1) + ')', ns[n]);
		}
	}
	if (details.route53?.zone) {
		info(`Route 53 Hosted Zone ID: ${details.route53.zone}`);
	}
};

const createACM = async (
	stack: string,
	route53: boolean,
	zone?: string,
): Promise<void> => {
	if (route53 && !zone) {
		throw new Error('Route53 enabled but Hosted Zone ID is missing');
	}
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
	await deploy(client, stack, input, false);
};

const getCertificateArnByStack = async (stack: string): Promise<string> => {
	const client = new CloudFormationClient({
		region: 'us-east-1',
	});

	// Keep trying every minute for half an hour (if it hasn't been generated in that time, we likely have a problem)
	for (let retry = 0; retry < 30; retry++) {
		const { Stacks } = await client.send(
			new DescribeStacksCommand({ StackName: stack }),
		);

		const arn = Stacks?.[0]?.Outputs?.find(
			(o) => o.OutputKey === 'CertificateArn',
		)?.OutputValue;
		if (arn) {
			return arn;
		}

		log(
			`Trying to retrieve ACM Certificate ARN by Stack... (Attempt ${retry + 1})`,
		);
		await new Promise((t) => setTimeout(t, 60000));
	}
	throw new Error('Unable to retrieve ACM Certificate ARN');
};

const getCertificateArnByDomain = async (domain: string): Promise<string> => {
	const client = new ACMClient({ region: 'us-east-1' });

	// Keep trying every minute for half an hour (if it hasn't been generated in that time, we likely have a problem)
	for (let retry = 0; retry < 30; retry++) {
		const list = await client.send(
			new ListCertificatesCommand({
				CertificateStatuses: ['PENDING_VALIDATION', 'ISSUED'],
			}),
		);

		const cert = list.CertificateSummaryList?.find(
			(c) => c.DomainName === domain,
		);

		if (cert?.CertificateArn) {
			return cert.CertificateArn;
		}

		log(
			`Trying to retrieve ACM Certificate ARN by Domain... (Attempt ${retry + 1})`,
		);
		await new Promise((t) => setTimeout(t, 60000));
	}
	throw new Error('Unable to retrieve ACM Certificate ARN');
};

const getValidationRecords = async (
	arn: string,
	details: Details,
): Promise<void> => {
	const client = new ACMClient({ region: 'us-east-1' });

	const { Certificate } = await client.send(
		new DescribeCertificateCommand({ CertificateArn: arn }),
	);

	if (!Certificate?.DomainValidationOptions) {
		throw new Error('No validation options found for certificate');
	}

	Certificate.DomainValidationOptions.forEach((opt) => {
		if (opt.DomainName && opt.ResourceRecord) {
			output.set('DNS Record Type (1)', opt.ResourceRecord.Type!);
			output.set(
				'DNS Record Name (1)',
				opt.DomainName.substring(0, opt.DomainName.indexOf('.')),
			);
			output.set('DNS Record Value (1)', details.cloudfront.domain);
			output.set('DNS Record Type (2)', opt.ResourceRecord.Type!);
			output.set('DNS Record Name (2)', opt.ResourceRecord.Name!);
			output.set('DNS Record Value (2)', opt.ResourceRecord.Value!);
		}
	});
};

const getCertificate = async (arn: string): Promise<void> => {
	const client = new ACMClient({ region: 'us-east-1' });

	// Again, keep trying every minute for half an hour
	for (let retry = 0; retry < 30; retry++) {
		const { Certificate } = await client.send(
			new DescribeCertificateCommand({ CertificateArn: arn }),
		);

		if (Certificate?.Status === 'ISSUED') {
			success('Certificate issued');
			return;
		}

		if (Certificate?.Status !== 'PENDING_VALIDATION') {
			throw new Error(
				`Certificate failed with status ${Certificate?.Status}`,
			);
		}

		log(`Waiting for certificate validation... (Retry ${retry})`);
		await new Promise((t) => setTimeout(t, 60000));
	}
	throw new Error('Certificate still pending validation');
};

title('Setting up AWS S3, CloudFront and (optionally) Route 53');

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

const arg = process.argv.find((a) => a.startsWith('-phase'));
const phase = arg?.split('=')[1];

if (phase !== 'init' && phase !== 'finalise') {
	fail(
		'You must select which phase of the hosting setup you are running. ' +
			'Run with -phase=init, configure DNS on your hosting provider, then rerun with -phase=finalise.',
	);
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
params.push({
	ParameterKey: 'Domain',
	ParameterValue: config.domain,
});
if (config.route53 !== undefined) {
	params.push({
		ParameterKey: 'EnableRoute53',
		ParameterValue: config.route53,
	});
}

const input: CreateStackCommandInput = {
	StackName: config.stack,
	TemplateBody: template,
	Capabilities: ['CAPABILITY_NAMED_IAM'],
	Parameters: params,
};

info(`Public Domain: ${config.domain}`);
info(`AWS Region: ${config.region}`);
info(`AWS Stack Name: ${config.stack}`);
if (config.project) {
	info(`AWS Project Name: ${config.project}`);
}
info(`Is Route 53 enabled? ${config.route53 === 'true'}`);

try {
	if (phase === 'init') {
		heading('Initial deployment of main stack');
		await deploy(client, config.stack!, input);

		const details = await getDetails(client, config.stack!);
		writeDetails(details, config.domain!);

		heading('Deployment of ACM certificate');
		await createACM(
			config.stack! + '-ACM-Cert',
			config.route53 === 'true',
			details.route53.zone,
		);

		if (config.route53 !== 'true') {
			const cert = await getCertificateArnByDomain(config.domain!);
			await getValidationRecords(cert, details);
		}

		dump(output);
	}

	if (phase === 'finalise') {
		heading('Verification of ACM certificate');
		const cert = await getCertificateArnByStack(
			config.stack! + '-ACM-Cert',
		);
		await getCertificate(cert);

		heading(
			'Redeploying main stack and injecting certificate into CloudFront',
		);
		const revised = [
			...params,
			{ ParameterKey: 'AcmCertificateArn', ParameterValue: cert },
		];
		await deploy(client, config.stack!, {
			...input,
			Parameters: revised,
		});
	}
} catch (e) {
	fail('Failed to deploy', e as Error);
}
