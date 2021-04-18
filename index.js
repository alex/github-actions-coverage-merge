const fs = require('fs');
const artifact = require('@actions/artifact');
const core = require('@actions/core');
const exec = require('@actions/exec');
const glob = require('@actions/glob');

async function uploadCoverage() {
	const name = core.getInput('name');
	if (name === '') {
		core.setFailed("Name not provided");
		return;
	}

	await exec.exec('coverage xml');

	const globber = await glob.create('*.lcov');
	const artifactClient = artifact.create();
	await artifactClient.uploadArtifact(`coverage-${name}`, ["coverage.xml"].concat(await globber.glob()), ".");
}

function parseJSONWithBOM(data) {
	data = data.toString();
	// Remove UTF-16 BOMs before passing to JSON.
	if (data.charCodeAt(0) == 0xFEFF) {
		data = data.slice(1);
	}
	return JSON.parse(data);
}

async function mergeCoverage() {
	const artifactClient = artifact.create();
	await artifactClient.downloadAllArtifacts("coverage/");

	await exec.exec(
		'dotnet',
		['tool', 'install', 'dotnet-reportgenerator-globaltool', '--tool-path', 'reportgeneratortool', '--ignore-failed-sources']
	);
	await exec.exec(
		'reportgeneratortool/reportgenerator',
		["-reports:coverage/**/*.xml", "-targetdir:final-coverage/", "-reporttypes:HtmlInline;JsonSummary"]
	);

	const globber = await glob.create("final-coverage/*");
	await artifactClient.uploadArtifact('final-coverage', await globber.glob(), '.');

	let data = parseJSONWithBOM(fs.readFileSync('final-coverage/Summary.json'))["summary"];
	if (data["linecoverage"] < 100 || data["branchcoverage"] < 100) {
		core.setFailed(`Project had less than 100% coverage, only had: ${data["linecoverage"]}% line coverage and ${data["branchcoverage"]}% branch coverage.`);
	}
}

async function main() {
	const mode = core.getInput('mode');
	try {
		if (mode === 'upload') {
			await uploadCoverage();
		} else if (mode === 'merge') {
			await mergeCoverage();
		} else {
			core.setFailed(`Unexpected mode: ${mode}`);
		}
	} catch (error) {
		core.setFailed(error.message);
	}
}

main();
