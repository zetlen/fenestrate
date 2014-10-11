var fs = require('fs'),
    _ = require('underscore'),
    path = require('path'),
    rimraf = require('rimraf'),
    childProcess = require("child_process"),
    minimist = require('minimist'),
    cmdArgs = process.argv.slice(2),
    args = minimist(cmdArgs, {
      boolean: ['u','U','d','h']
    }),
    helpText = fs.readFileSync('./help.txt', 'utf-8'),
    dependencyTypes = ["dependencies","devDependencies"],
    modulePath;


if (args.h) {
  console.log(helpText);
  process.exit(0);
}

if (cmdArgs.length === 0 || args._.length === 0) {
  console.error("\n  You must provide a path!\n\n");
  console.log(helpText);
  process.exit(1);
}

if (args._.length > 1) {
  console.error("\n  Multiple non-flag arguments detected. You must provide only one path.");
  process.exit(1);
}

modulePath = args._.pop();

var pkgPath = path.resolve(modulePath, './package.json'),
    pkg = require(pkgPath),
    declaredDeps = {};
    dependencyTypes.forEach(function(type) {
      declaredDeps[type] = _.clone(pkg[type]);
    });

if (args.u || args.U) {
  console.log("Defenestrating package.json");
  var fenestrateNode = pkg.__fenestrate;
  if (!fenestrateNode) {
    console.error("Could not find the __fenestrate property in your package.json, so could not defenestrate.\nHas this module ever been fenestrated?");
    process.exit(1);
  }
  if (!fenestrateNode.previous) {
    console.error("Could not find the previous collection of dependency tyes, so could not defenestrate.");
    process.exit(1);
  }
  dependencyTypes.forEach(function(type) {
    if (pkg[type] && !fenestrateNode.previous[type]) {
      console.error("Could not find the previous collection of " + type + ", so could not defenestrate.")
      process.exit(1);
    }
  });
  dependencyTypes.forEach(function(type) {
    console.log("Defenestrating " + type);
    pkg[type] = fenestrateNode.previous[type];
  });
  delete pkg.__fenestrate;
  console.log("Completed defenestration of package.json. Writing file...")
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  if (args.U) {
    console.log("Rewriting node_modules directory...")
    removeNodeModulesDir(function() {
      console.log("Removed existing node_modules directory. Making new one...")
      npmInstall(function(code) {
        if (code !== 0) {
          console.error("Error building old node_modules directory. Could not continue.");
          process.exit(1);
        }
        console.log("Installed old node_modules directory, pre-fenestration.")
        process.exit(0);
      });
    });
  } else {
    process.exit(0);
  }
}

function removeNodeModulesDir(cb) {
  rimraf(path.resolve(modulePath, "./node_modules"), cb);
}

function npmInstall(cb) {
  childProcess.spawn('npm', ['install','-v'], { stdio: 'inherit' }).on('close', cb);
}

function flattenDependencies(declared, resolved) {
  _.each(resolved, function(conf, dep) {
    var sv = conf.from.split('@').pop();
    if (!_.has(declared, dep)) {
      console.log('Adding dependency "' + dep + '" at semver ' + sv);
      declared[dep] = sv;
    } else {
      console.log('Skipping dependency "' + dep + '" at semver' + sv + ' because it already exists at ' + declared[dep]);
    }
    if (conf.dependencies) flattenDependencies(declared, conf.dependencies);
  });
  return declared;
}

childProcess.exec("npm ls --json", function(err, res) { 
  console.log(flattenDependencies(pkg.dependencies, JSON.parse(res).dependencies));

  if (!args.d) {
    pkg.__fenestrate = {
      comment: "This package.json file was modified by the `fenestrate` utility for Windows compatibility. The dependency graph was flattened to accommodate the 260-character limit on Windows file paths. The prior version of the `dependencies` is below.",
      previous: {
        dependencies: declaredDeps
      }
    }
    fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
    console.log('Updated package.json. Reinstalling node_modules...');
    removeNodeModulesDir(function() {
      npmInstall(function(code) {
        if (code !== 0) {
          console.error("Error building new node_modules directory. Could not continue. Run `fenestrate -U` to get back to where you were.");
          process.exit(1);
        }
        console.log("Installed newly fenestrated node_modules directory.")
        process.exit(0);
      });
    });
  } else {
    console.log('Dry run only, making no changes.');
    process.exit(0);
  }
});