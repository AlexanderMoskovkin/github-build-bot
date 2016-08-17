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

gulp.task('build', ['clean', 'lint'], function () {
    return gulp
        .src('src/**/*.js')
        .pipe(babel())
        .pipe(gulp.dest('./lib'));
});

gulp.task('test', ['build'], function () {

});