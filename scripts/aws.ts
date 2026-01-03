import {
	CloudFormationClient,
	CreateStackCommand,
	UpdateStackCommand,
} from '@aws-sdk/client-cloudformation';
import type {
	CreateStackCommandInput,
	Parameter,
} from '@aws-sdk/client-cloudformation';
import dotenv from 'dotenv';
import fs from 'node:fs';

import { heading, info, log, success, fail } from './funcs';

dotenv.config();

const deploy = async (
	client: CloudFormationClient,
	input: CreateStackCommandInput,
) => {
	try {
		log('Deploying stack...');
		await client.send(new CreateStackCommand(input)).catch(async (e) => {
			if (e.name === 'AlreadyExistsException') {
				info('Stack exists, updating...');
				await client.send(new UpdateStackCommand(input));
			} else {
				throw e;
			}
		});
		success('Deployment initiated!');
	} catch (e) {
		const err = e as Error;
		if (err.message.includes('No updates are to be performed')) {
			info('No updates were required');
		} else {
			fail('Deployment failed', e as Error);
		}
	}
};

heading('Setting up AWS S3');

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

deploy(client, input);
