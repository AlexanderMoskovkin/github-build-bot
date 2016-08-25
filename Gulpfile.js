var babel  = require('gulp-babel');
var del    = require('del');
var eslint = require('gulp-eslint');
var gulp   = require('gulp');

gulp.task('lint', function () {
    return gulp
        .src(['src/**/*.js', 'test/**/*.js'])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.task('clean', function () {
    return del('lib');
});

gulp.task('fast-build', ['clean'], function () {
    return gulp
        .src('src/**/*.js')
        .pipe(babel())
        .pipe(gulp.dest('./lib'));
});

gulp.task('build', ['fast-build', 'lint']);

gulp.task('test', ['build'], function () {
    /* eslint-disable */
    return require('./test/index.js')('test/fixtures/pull-request/index-test.js')
        .then(function () {
            process.exit(0);
        })
        .catch(function () {
            process.exit(1);
        });
    /* eslint-enable */
});