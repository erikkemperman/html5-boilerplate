import fs from 'fs';
import path from 'path';

import gulp from 'gulp';

// Load all gulp plugins automatically
// and attach them to the `plugins` object
import loadPlugins from 'gulp-load-plugins';

import archiver from 'archiver';
import glob from 'glob';
import del from 'del';
import ssri from 'ssri';
import modernizr from 'modernizr';

import pkg from './package.json';
import modernizrConfig from './modernizr-config.json';


const dirs = pkg['h5bp-configs'].directories;
const plugins = loadPlugins();


// Wrapper because we prefer colons over camels in task names
const task = (name, fun) => {
  fun.displayName = name;
  return fun;
};


// ---------------------------------------------------------------------
// | Helper tasks                                                      |
// ---------------------------------------------------------------------


const archiveCreateDir = task('archive:create_archive_dir', (done) => {
  fs.mkdir(path.resolve(dirs.archive), '0755', done);
});

const archiveZip = task('archive:zip', (done) => {
  const archiveName = path.resolve(dirs.archive, `${pkg.name}_v${pkg.version}.zip`);
  const zip = archiver('zip');
  const files = glob.sync('**/*.*', {
    'cwd': dirs.dist,
    'dot': true // include hidden files
  });
  const output = fs.createWriteStream(archiveName);

  zip.on('error', done);
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
});

const clean = task('clean', () =>
  del([
    dirs.archive,
    dirs.dist
  ])
);

const copyHtAccess = task('copy:.htaccess', () =>
  gulp.src('node_modules/apache-server-configs/dist/.htaccess')
    .pipe(plugins.replace(/# ErrorDocument/g, 'ErrorDocument'))
    .pipe(gulp.dest(dirs.dist))
);

const copyIndexHtml = task('copy:index.html', () => {
  const hash = ssri.fromData(
    fs.readFileSync('node_modules/jquery/dist/jquery.min.js'),
    {algorithms: ['sha256']}
  );
  let version = pkg.devDependencies.jquery;
  let modernizrVersion = pkg.devDependencies.modernizr;

  return gulp.src(`${dirs.src}/index.html`)
    .pipe(plugins.replace(/{{JQUERY_VERSION}}/g, version))
    .pipe(plugins.replace(/{{MODERNIZR_VERSION}}/g, modernizrVersion))
    .pipe(plugins.replace(/{{JQUERY_SRI_HASH}}/g, hash.toString()))
    .pipe(gulp.dest(dirs.dist));
});

const copyJQuery = task('copy:jquery', () =>
  gulp.src('node_modules/jquery/dist/jquery.min.js')
    .pipe(plugins.rename( `jquery-${pkg.devDependencies.jquery}.min.js`))
    .pipe(gulp.dest( `${dirs.dist}/js/vendor`))
);

const copyLicense = task('copy:license', () =>
  gulp.src('LICENSE.txt')
    .pipe(gulp.dest( dirs.dist))
);

const banner = `/*! HTML5 Boilerplate v${pkg.version} | ${pkg.license} License | ${pkg.homepage} */\n\n`;
const copyMainCss = task('copy:main.css', () =>
  gulp.src('node_modules/main.css/dist/main.css')
    .pipe(plugins.header(banner))
    .pipe(plugins.autoprefixer({
      browsers: ['last 2 versions', 'ie >= 9', '> 1%'],
      cascade: false
    }))
    .pipe(gulp.dest(`${dirs.dist}/css`))
);

const copyMisc = task('copy:misc', () =>
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

  }).pipe(gulp.dest(dirs.dist))
);

const copyNormalize = task('copy:normalize', () =>
  gulp.src('node_modules/normalize.css/normalize.css')
    .pipe(gulp.dest(`${dirs.dist}/css`))
);

const copy = task('copy',
  gulp.parallel(
    copyHtAccess,
    copyIndexHtml,
    copyJQuery,
    copyLicense,
    copyMainCss,
    copyMisc,
    copyNormalize
  )
);

const buildModernizr = task('modernizr', (done) => {
  modernizr.build(modernizrConfig, (code) => {
    fs.writeFile(`${dirs.dist}/js/vendor/modernizr-${pkg.devDependencies.modernizr}.min.js`, code, done);
  });
});

const lintJs = task('lint:js', () =>
  gulp.src([
    'gulpfile.babel.js',
    `${dirs.src}/js/*.js`,
    `${dirs.test}/*.js`
  ]).pipe(plugins.jscs())
    .pipe(plugins.eslint())
    .pipe(plugins.eslint.failOnError())
);


// ---------------------------------------------------------------------
// | Main tasks                                                        |
// ---------------------------------------------------------------------

const build = task('build',
  gulp.series(
    clean,
    lintJs,
    copy,
    buildModernizr
  )
);

const archive = task('archive',
  gulp.series(
    build,
    archiveCreateDir,
    archiveZip
  )
);

export { archive, build, clean };
export default build;
