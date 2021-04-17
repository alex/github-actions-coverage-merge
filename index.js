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
	const globber = glob.create(["coverage/**/*.xml"])

	await exec.exec("sudo apt install cobertura");
	await exec.exec('cobertura-merge', ['--datafile', 'final-coverage.xml'].concat(globber.glob()));
	await exec.exec('cobertura-report --datafile final-coverage.xml --destination html-coverage/');
	await artifactClient.uploadArtifact('final-coverage', ['html-coverage/'], '.');

	await exec.exec('cobertura-check -datafile final-coverage.xml --line=100 --branch=100');
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
