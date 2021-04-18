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

	const artifactClient = artifact.create();
	await artifactClient.uploadArtifact(`coverage-${name}`, ["coverage.xml"], ".");
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
		["-reports:coverage/**/*.xml", "-targetdir:final-coverage/", "-reporttypes:HtmlInline;TextSummary"]
	);

	const globber = await glob.create("final-coverage/*");
	await artifactClient.uploadArtifact('final-coverage', await globber.glob(), '.');

	// TODO: fail the test at less than 100% coverage
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
