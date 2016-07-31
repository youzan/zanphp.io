import fs from 'fs';
import path from 'path';

import gulp from 'gulp';

// Load all gulp plugins automatically
// and attach them to the `plugins` object
import plugins from 'gulp-load-plugins';

// Temporary solution until gulp 4
// https://github.com/gulpjs/gulp/issues/355
import runSequence from 'run-sequence';

import archiver from 'archiver';
import glob from 'glob';
import del from 'del';

import pkg from './package.json';

const dirs = pkg['h5bp-configs'].directories;
const sass = require('gulp-sass');
const livereload = require('gulp-livereload');

// ---------------------------------------------------------------------
// | Helper tasks                                                      |
// ---------------------------------------------------------------------

gulp.task('archive:create_archive_dir', () => {
    fs.mkdirSync(path.resolve(dirs.archive), '0755');
});

gulp.task('archive:zip', (done) => {

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

    files.forEach( (file) => {

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

gulp.task('clean', (done) => {
    del([
        dirs.archive,
        dirs.dist
    ]).then( () => {
        done();
    });
});

gulp.task('copy', [
    'copy:.htaccess',
    'copy:index.html',
    'copy:license',
    'copy:main.css',
    'copy:misc'
]);

gulp.task('copy:.htaccess', () =>
    gulp.src('node_modules/apache-server-configs/dist/.htaccess')
        .pipe(plugins().replace(/# ErrorDocument/g, 'ErrorDocument'))
        .pipe(gulp.dest(dirs.dist))
);

gulp.task('copy:index.html', () =>
    gulp.src(`${dirs.src}/index.html`)
        .pipe(gulp.dest(dirs.dist))
);

gulp.task('copy:license', () =>
    gulp.src('LICENSE.txt')
        .pipe(gulp.dest(dirs.dist))
);

gulp.task('sass', function () {
    return gulp.src(`${dirs.src}/scss/**/*.scss`)
        .pipe(sass().on('error', sass.logError))
        .pipe(gulp.dest(`${dirs.src}/css`))
        .pipe(livereload());
});

gulp.task('html', function () {
    return gulp.src(`${dirs.src}/*.html`)
        .pipe(livereload());
});
 
gulp.task('watch', function () {
    livereload.listen();
    gulp.watch(`${dirs.src}/*.html`, ['html']);
    gulp.watch(`${dirs.src}/scss/**/*.scss`, ['sass']);
});

gulp.task('copy:main.css', () => {

    const banner = `/*! Zanphp.io v${pkg.version} | ${pkg.license.type} License | ${pkg.homepage} */\n\n`;

    gulp.src(`${dirs.src}/css/main.css`)
        .pipe(plugins().header(banner))
        .pipe(plugins().autoprefixer({
            browsers: ['last 2 versions', 'ie >= 8', '> 1%'],
            cascade: false
        }))
        .pipe(gulp.dest(`${dirs.dist}/css`));
});

gulp.task('copy:misc', () =>
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

gulp.task('lint:js', () =>
    gulp.src([
        'gulpfile.js',
        `${dirs.src}/js/*.js`,
        `${dirs.test}/*.js`
    ]).pipe(plugins().jscs())
      .pipe(plugins().jshint())
      .pipe(plugins().jshint.reporter('jshint-stylish'))
      .pipe(plugins().jshint.reporter('fail'))
);


// ---------------------------------------------------------------------
// | Main tasks                                                        |
// ---------------------------------------------------------------------

gulp.task('archive', (done) => {
    runSequence(
        'build',
        'archive:create_archive_dir',
        'archive:zip',
    done)
});

gulp.task('build', (done) => {
    runSequence(
        ['clean', 'lint:js', 'sass'],
        'copy',
    done)
});

gulp.task('default', ['build']);
