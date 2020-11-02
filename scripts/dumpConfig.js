// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

const path = require('path');
const cwd = process.cwd();

try {
  const hdwalletNodeModulePath = path.join(cwd, 'node_modules', 'truffle-hdwallet-provider');
  require(hdwalletNodeModulePath);
  require.cache[require.resolve(hdwalletNodeModulePath)].exports = function HDWallet(...args) {
    this.mnemonic = args[0];
    this.url = args[1];
  };
} catch (err) {
  // ignore
}

const truffleConfig = require(path.join(cwd, 'truffle-config.js'));

const getCircularReplacer = () => {
	const seen = new WeakSet();
	return (_key, value) => {
		if (typeof value === "object" && value !== null) {
			if (seen.has(value)) {
				return;
			}
			seen.add(value);
		}
		return value;
	};
};

let msg = JSON.stringify(truffleConfig, getCircularReplacer());
process.send({ command: 'truffleConfig', message: msg }, () => process.exit());