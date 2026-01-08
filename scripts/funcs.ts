export const title = (msg: string) => {
	console.log('\x1b[1m\x1b[34m' + msg + '\x1b[0m\n');
};
export const heading = (msg: string) => {
	console.log('\n\x1b[1m' + msg + '\x1b[0m');
};
export const info = (msg: string) => {
	console.log('\x1b[1m\x1b[34m\u2139\x1b[0m  ' + msg);
};
export const log = (msg: string) => {
	console.log('\x1b[1m\x1b[34m\u00BB\x1b[0m  ' + msg);
};
export const success = (msg: string) => {
	console.log('\x1b[1m\x1b[32m\u2713\x1b[0m  ' + msg);
};
export const warn = (msg: string) => {
	console.error('\x1b[33m' + msg + '\x1b[0m');
};
export const fail = (msg: string, err?: Error) => {
	if (err) {
		console.error(
			'\x1b[1m\x1b[31m\u2718\x1b[0m  ' + msg + ' - ' + err.message,
		);
	} else {
		console.error('\x1b[1m\x1b[31m\u2718\x1b[0m  ' + msg);
	}
	process.exit(1);
};
export const dump = (details: Map<string, string>) => {
	const line = (msg: string) => {
		console.log('| ' + msg + ' '.repeat(105 - msg.length) + '|');
	};

	console.log('\n' + '-'.repeat(100));
	for (const key of details.keys()) {
		line(key + ': \x1b[1m' + details.get(key) + '\x1b[0m');
	}
	console.log('-'.repeat(100));
};
