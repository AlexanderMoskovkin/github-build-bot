var babel  = require('gulp-babel');
var del    = require('del');
var eslint = require('gulp-eslint');
var gulp   = require('gulp');
var mocha  = require('gulp-mocha');

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

gulp.task('build', ['clean', 'lint'], function () {
    return gulp
        .src('src/**/*.js')
        .pipe(babel())
        .pipe(gulp.dest('./lib'));
});

gulp.task('test', ['build'], function () {
    return gulp
        .src('test/*-test.js')
        .pipe(mocha({
            ui:       'bdd',
            reporter: 'spec',
            timeout:  typeof v8debug === 'undefined' ? 2000 : Infinity // NOTE: disable timeouts in debug
        }));
});