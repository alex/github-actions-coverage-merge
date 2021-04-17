const artifact = require('@actions/artifact');
const core = require('@actions/core');
const exec = require('@actions/exec');

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

	await exec.exec("sudo apt install cobertura");
	await exec.exec('cobertura-merge --datafile final-coverage.xml $(for p in $(find coverage/ -iname "*.xml"); do printf "%s " "$p"; done)');
	await exec.exec('cobertura-report --datafile final-coverage.xml --destination html-coverage/');
	await artifactClient.uploadArtifact('final-coverage', ['html-coverage/'], '.');

	await exec.exec('cobertura-check -datafile final-coverage.xml --line=100 --branch=100');
}

async function main() {
	const mode = core.getInput('mode');
	if (mode === 'upload') {
		await uploadCoverage();
	} else if (mode === 'merge') {
		await mergeCoverage();
	} else {
		core.setFailed(`Unexpected mode: ${mode}`);
	}
}

main()