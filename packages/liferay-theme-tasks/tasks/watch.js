/**
 * © 2017 Liferay, Inc. <https://liferay.com>
 *
 * SPDX-License-Identifier: MIT
 */

'use strict';

const chalk = require('chalk');
const del = require('del');
const fs = require('fs');
const http = require('http');
const httpProxy = require('http-proxy');
const opn = require('opn');
const path = require('path');
const themeUtil = require('../lib/util');
const tinylr = require('tiny-lr');
const portfinder = require('portfinder');
const url = require('url');

const DEPLOYMENT_STRATEGIES = themeUtil.DEPLOYMENT_STRATEGIES;
const EXPLODED_BUILD_DIR_NAME = '.web_bundle_build';
const MIME_TYPES = {
	'.css': 'text/css',
	'.js': 'text/javacript',
};

/**
 * Splits a path into an array of path components.
 */
function getPathComponents(pathString) {
	return pathString.split(path.sep);
}

/**
 * Give a path to a resource such as "src/css/partials/_header.scss",
 * returns the the name of the child directory under "src/" containing
 * the resource (eg. "css").
 */
function getResourceDir(pathString, pathSrc) {
	const relativePath = path.relative(pathSrc, pathString);
	return getPathComponents(relativePath)[0];
}

module.exports = function(options) {
	// Get things from options
	const {argv, distName, gulp, pathBuild, pathSrc, resourcePrefix} = options;

	// Initialize global things
	const {storage} = gulp;
	const fullDeploy = argv.full || argv.f;
	const runSequence = require('run-sequence').use(gulp);

	// Get config from liferay-theme.json
	const proxyUrl = argv.url || storage.get('url');
	const deploymentStrategy = storage.get('deploymentStrategy');
	const dockerContainerName = storage.get('dockerContainerName');
	const pluginName = storage.get('pluginName') || '';

	// Calculate some values
	const explodedBuildDir = path.join(process.cwd(), EXPLODED_BUILD_DIR_NAME);
	const dockerThemePath = path.posix.join('/tmp', pluginName);
	const dockerBundleDirPath = path.posix.join(
		dockerThemePath,
		EXPLODED_BUILD_DIR_NAME
	);

	/**
	 * Start watching project folder
	 */
	gulp.task('watch', function() {
		options.watching = true;

		storage.set('appServerPathPlugin', explodedBuildDir);

		// Get tasks array
		const taskArray = getCleanTaskArray(deploymentStrategy);

		// Push final task that deploys the theme and starts live reloads
		taskArray.push(err => {
			if (err) {
				throw err;
			}

			Promise.all([
				portfinder.getPortPromise({port: 9080}),
				portfinder.getPortPromise({port: 35729}),
			]).then(([httpPort, tinylrPort]) => {
				storage.set('webBundleDir', 'watching');
				startWatch(httpPort, tinylrPort, proxyUrl);
			});
		});

		// Run tasks in sequence
		runSequence.apply(this, taskArray);
	});

	/**
	 * Clean the exploded build dir
	 */
	gulp.task('watch:clean', function(cb) {
		del([explodedBuildDir]).then(() => cb());
	});

	/**
	 * Clean the remote exploded build dir in docker
	 */
	gulp.task('watch:docker:clean', function(cb) {
		themeUtil.dockerExec(
			dockerContainerName,
			'rm -rf ' + dockerBundleDirPath
		);

		cb();
	});

	/**
	 * Copy the exploded build dir to docker
	 */
	gulp.task('watch:docker:copy', function(cb) {
		themeUtil.dockerExec(
			dockerContainerName,
			'mkdir -p ' + dockerBundleDirPath
		);

		themeUtil.dockerCopy(
			dockerContainerName,
			explodedBuildDir,
			dockerBundleDirPath,
			cb
		);
	});

	/**
	 * Copy output files to exploded build dir
	 */
	gulp.task('watch:setup', function() {
		return gulp
			.src(path.join(pathBuild, '**/*'))
			.pipe(gulp.dest(explodedBuildDir));
	});

	/**
	 * Cleanup watch machinery
	 */
	gulp.task('watch:teardown', function(cb) {
		storage.set('webBundleDir');

		const taskArray = getTeardownTaskArray();

		taskArray.push(cb);

		runSequence.apply(this, taskArray);
	});

	let livereload;

	gulp.task('watch:reload', function(cb) {
		const changedFile = storage.get('changedFile');
		const srcPath = path.relative(process.cwd(), changedFile.path);
		const dstPath = srcPath.replace(/^src\//, '');
		const urlPath = `${resourcePrefix}/${distName}/${dstPath}`;

		livereload.changed({
			body: {
				files: [urlPath],
			},
		});
		cb();
	});

	/**
	 * Start live reload server and watch for changes in project files.
	 * @param {int} httpPort   The port for the http server
	 * @param {int} tinylrPort The port for the livereload server
	 * @param {string} proxyUrl     The proxy target URL
	 */
	function startWatch(httpPort, tinylrPort, proxyUrl) {
		clearChangedFile();

		const themePattern = new RegExp(
			`(?!.*.(ftl|tpl|vm))(${resourcePrefix}/${distName}/)(.*)`
		);

		livereload = tinylr();
		livereload.server.on('error', err => {
			// eslint-disable-next-line
			console.error(err);
		});
		livereload.listen(tinylrPort);

		const proxy = httpProxy.createServer();

		http.createServer((req, res) => {
			if (
				req.headers.accept &&
				req.headers.accept.includes('text/html')
			) {
				res.write(
					`<script src="http://localhost:${tinylrPort}/livereload.js"></script>`
				);
			}

			const requestUrl = url.parse(req.url);

			const match = themePattern.exec(requestUrl.pathname);
			if (match) {
				const filepath = path.resolve('build', match[3]);
				const ext = path.extname(filepath);

				if (MIME_TYPES[ext]) {
					res.setHeader('Content-Type', MIME_TYPES[ext]);
				}

				fs.createReadStream(filepath)
					.on('error', err => {
						// eslint-disable-next-line
						console.error(err);
					})
					.pipe(res);
			} else {
				proxy.web(req, res, {
					target: proxyUrl,
				});
			}
		}).listen(httpPort, function() {
			const url = `http://localhost:${httpPort}/`;
			const messages = [
				`Watch mode is now active at: ${url}`,
				`Proxying: ${proxyUrl}`,
			];
			const width = messages.reduce((max, line) => {
				return Math.max(line.length, max);
			}, 0);
			const ruler = '-'.repeat(width);

			// eslint-disable-next-line no-console
			console.log(
				'\n' + chalk.yellow([ruler, ...messages, ruler].join('\n'))
			);

			opn(url);
		});

		gulp.watch(path.join(pathSrc, '**/*'), function(vinyl) {
			storage.set('changedFile', vinyl);

			const resourceDir = getResourceDir(vinyl.path, pathSrc);

			let taskArray = ['deploy:file'];

			if (!fullDeploy && storage.get('deployed')) {
				taskArray = getBuildTaskArray(resourceDir, []);
			}

			taskArray.push(clearChangedFile);

			runSequence.apply(this, taskArray);
		});
	}

	function clearChangedFile() {
		storage.set('changedFile');
	}

	function getTeardownTaskArray() {
		const taskArray = ['watch:clean'];

		if (deploymentStrategy === DEPLOYMENT_STRATEGIES.DOCKER_CONTAINER) {
			taskArray.push('watch:docker:clean');
		}

		return taskArray;
	}

	function getBuildTaskArray(resourceDir, defaultTaskArray) {
		let taskArray = defaultTaskArray || [];

		if (resourceDir === 'WEB-INF') {
			taskArray = [
				'build:clean',
				'build:src',
				'build:web-inf',
				'deploy:folder',
				'watch:reload',
			];
		} else if (resourceDir === 'templates') {
			taskArray = [
				'build:src',
				'build:themelet-src',
				'build:themelet-js-inject',
				'deploy:folder',
				'watch:reload',
			];
		} else if (resourceDir === 'css') {
			taskArray = [
				'build:clean',
				'build:base',
				'build:src',
				'build:themelet-src',
				'build:themelet-css-inject',
				'build:rename-css-dir',
				'build:compile-css',
				'build:move-compiled-css',
				'build:remove-old-css-dir',
				'watch:reload',
				'deploy:css-files',
			];
		} else if (resourceDir === 'js') {
			taskArray = ['build:src', 'watch:reload'];
		} else {
			taskArray = ['deploy:file'];
		}

		return taskArray;
	}

	function getCleanTaskArray(deploymentStrategy) {
		switch (deploymentStrategy) {
			case DEPLOYMENT_STRATEGIES.LOCAL_APP_SERVER:
				return ['build', 'watch:clean', 'watch:setup'];

			case DEPLOYMENT_STRATEGIES.DOCKER_CONTAINER:
				return [
					'build',
					'watch:clean',
					'watch:docker:clean',
					'watch:setup',
					'watch:docker:copy',
				];

			default:
				return [];
		}
	}
};