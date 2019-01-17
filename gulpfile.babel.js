import fs from 'fs';
import path from 'path';

import gulp from 'gulp';

// Load all gulp plugins automatically
// and attach them to the `plugins` object
import plugins from 'gulp-load-plugins';

import archiver from 'archiver';
import glob from 'glob';
import rimraf from 'rimraf';
import ssri from 'ssri';
import modernizr from 'modernizr';

import pkg from './package.json';
import modernizrConfig from './modernizr-config.json';


const dirs = pkg['h5bp-configs'].directories;

// ---------------------------------------------------------------------
// | Helper tasks                                                      |
// ---------------------------------------------------------------------


const archiveMakeDir = (done) => {
  fs.mkdir(path.resolve(dirs.archive), '0755', done);
};

const archiveZip = (done) => {
  const archiveName = path.resolve(dirs.archive, `${pkg.name}_v${pkg.version}.zip`);
  const zip = archiver('zip');
  const files = glob.sync('**/*.*', {
    'cwd': dirs.dist,
    'dot': true // include hidden files
  });
  const output = fs.createWriteStream(archiveName);

  zip.on('error', (error) => {
    done();
    throw error;
  });

  output.on('close', done);

  files.forEach((file) => {

    const filePath = path.resolve(dirs.dist, file);

    // `zip.bulk` does not maintain the file
    // permissions, so we need to add files individually
    zip.append(fs.createReadStream(filePath), {
      'name': file,
      'mode': fs.statSync(filePath).mode
    });

  });

  zip.pipe(output);
  zip.finalize();
};

const clean = gulp.parallel(
  (done) => { rimraf(dirs.archive, done); },
  (done) => { rimraf(dirs.dist, done); }
);

const copyHtAccess = () =>
  gulp.src('node_modules/apache-server-configs/dist/.htaccess')
    .pipe(plugins().replace(/# ErrorDocument/g, 'ErrorDocument'))
    .pipe(gulp.dest(dirs.dist));

const copyIndex = () => {
  const hash = ssri.fromData(
    fs.readFileSync('node_modules/jquery/dist/jquery.min.js'),
    {algorithms: ['sha256']}
  );
  let version = pkg.devDependencies.jquery;
  let modernizrVersion = pkg.devDependencies.modernizr;

  return gulp.src(`${dirs.src}/index.html`)
    .pipe(plugins().replace(/{{JQUERY_VERSION}}/g, version))
    .pipe(plugins().replace(/{{MODERNIZR_VERSION}}/g, modernizrVersion))
    .pipe(plugins().replace(/{{JQUERY_SRI_HASH}}/g, hash.toString()))
    .pipe(gulp.dest(dirs.dist));
};

const copyJQuery = () =>
  gulp.src('node_modules/jquery/dist/jquery.min.js')
    .pipe(plugins().rename( `jquery-${pkg.devDependencies.jquery}.min.js`))
    .pipe(gulp.dest( `${dirs.dist}/js/vendor`));

const copyLicense = () =>
  gulp.src('LICENSE.txt')
    .pipe(gulp.dest( dirs.dist));

const banner = `/*! HTML5 Boilerplate v${pkg.version} | ${pkg.license} License | ${pkg.homepage} */\n\n`;
const copyMainCss = () =>
  gulp.src(`node_modules/main.css/dist/main.css`)
    .pipe(plugins().header(banner))
    .pipe(plugins().autoprefixer({
      browsers: ['last 2 versions', 'ie >= 9', '> 1%'],
      cascade: false
    }))
    .pipe(gulp.dest(`${dirs.dist}/css`));

const copyMisc = () =>
  gulp.src([

    // Copy all files
    `${dirs.src}/**/*`,

    // Exclude the following files
    // (other tasks will handle the copying of these files)
    `!${dirs.src}/css/main.css`,
    `!${dirs.src}/index.html`

  ], {

    // Include hidden files by default
    dot: true

  }).pipe(gulp.dest(dirs.dist));

const copyNormalize = () =>
  gulp.src('node_modules/normalize.css/normalize.css')
    .pipe(gulp.dest(`${dirs.dist}/css`));

const copy = gulp.parallel(
  copyHtAccess,
  copyIndex,
  copyJQuery,
  copyLicense,
  copyMainCss,
  copyMisc,
  copyNormalize
);

const buildModernizr = (done) => {
  modernizr.build(modernizrConfig, (code) => {
    fs.writeFile(`${dirs.dist}/js/vendor/modernizr-${pkg.devDependencies.modernizr}.min.js`, code, done);
  });
};

const lintJs = () =>
  gulp.src([
    'gulpfile.js',
    `${dirs.src}/js/*.js`,
    `${dirs.test}/*.js`
  ]).pipe(plugins().jscs())
    .pipe(plugins().eslint())
    .pipe(plugins().eslint.failOnError());


// ---------------------------------------------------------------------
// | Main tasks                                                        |
// ---------------------------------------------------------------------

gulp.task('archive', (done) => {
  runSequence(
    'build',
    'archive:create_archive_dir',
    'archive:zip',
    done);
});

gulp.task('build', (done) => {
  runSequence(
    ['clean', 'lint:js'],
    'copy', 'modernizr',
    done);
});

gulp.task('default', ['build']);
