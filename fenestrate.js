/** fenestrate npm package utility for windows compat
  *  (c) 2014 James Zetlen, every single right reserved
  *
  *  This program is free software: you can redistribute it and/or modify
  *  it under the terms of the GNU General Public License as published by
  *  the Free Software Foundation, either version 3 of the License, or
  *  (at your option) any later version.
  *
  *  This program is distributed in the hope that it will be useful,
  *  but WITHOUT ANY WARRANTY; without even the implied warranty of
  *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  *  GNU General Public License for more details.
  *
  *  You should have received a copy of the GNU General Public License
  *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
  *
  */

var fs = require('fs'),
    path = require('path'),
    rimraf = require('rimraf'),
    childProcess = require("child_process"),
    cmdArgs = process.argv.slice(2),
    cmd = cmdArgs.shift(),
    modulePath = cmdArgs.shift(),
    helpText = fs.readFileSync(path.resolve(__dirname, './README.md'), 'utf-8').split('<!-- cut here -->').shift(),
    dependencyTypes = ["dependencies","devDependencies"];

if (cmd === "help" || cmd === "-h" || !cmd) {
  console.log(helpText);
  process.exit(0);
}

if (!modulePath) {
  console.error("\n  You must provide a path!\n\n");
  console.log(helpText);
  process.exit(1);
}

if (cmdArgs > 1) {
  die("\n  Multiple non-flag arguments detected. You must provide only one path.");
}

modulePath = path.resolve(modulePath);

var rootPkg = require(path.resolve(modulePath, './package.json'));

if (!fs.existsSync(modulePath)) {
  die('Path "' + modulePath + '" does not exist.');
}

if (!fs.existsSync(path.resolve(modulePath, './node_modules')) && cmd === "make") {
  die('The node_modules directory is not present in "' + modulePath + '". Cannot run `fenestrate make` until the package has been installed.');
}


function flattener(conf, dep, declared, depType) {
  if (conf && !conf.missing && conf.from) {
    var sv = conf.from.split('@').pop();
    if (!declared.hasOwnProperty(dep)) {
      console.log('Adding dependency "' + dep + '" at semver "' + sv + '" to ' + depType);
      declared[dep] = sv;
    } else {
      console.log('Skipping dependency "' + dep + '" at semver "' + sv + '" because it already exists at "' + declared[dep] + '" in ' + depType);
    }
    if (conf.dependencies) flattenDependencies(declared, conf.dependencies, depType);
  }
}

function flattenDependencies(declared, resolved, depType) {
  for (var d in resolved) {
    if (resolved.hasOwnProperty(d)) {
      flattener(resolved[d], d, declared, depType);
    }
  }
  return declared;
}

function reinstallNodeModules(p, prod, cb) {
  rimraf(path.resolve(p, "./node_modules"), function(err) {
    if (err) {
      cb(err);
    } else {
      childProcess.spawn('npm', prod ? ['install','--production'] : ['install'], { cwd: p, stdio: 'inherit' }).on('close', function(code) {
        cb(null, code);
      }); 
    }
  });
}

function die(why) {
  console.error(why);
  process.exit(1);
}

function clone(obj) {
  if (!obj) return obj;
  return JSON.parse(JSON.stringify(obj));
}

var commands = {
  make: function(modPath, dry, cb) {
    var pkg = require(path.resolve(modPath, './package.json'));
    var f = pkg.__fenestrate;
    if (!f) { 
      f = pkg.__fenestrate = {
        comment: "This package.json file was modified by the `fenestrate` utility for Windows compatibility. The flattened dependency graph was flattened to accommodate the 260-character limit on Windows file paths. If there is a `previous` dependency graph, this package has already been transformed."
      }; 
    }
    if (f.previous) {
      die('This package is already in a transformed state. Run `fenestrate restore` before running `fenestrate make` again.')
    }

    console.log('Reading installed dependencies for ' + modPath);
    childProcess.exec("npm ls --json", { cwd: modPath }, function(err, res) {
      if (err && !res) {
        console.error("Failed to do initial listing of dependencies.");
        die(err.message);
      }
      console.log('Successfully read dependencies.');
      f.flattened = {};
      res = JSON.parse(res);
      dependencyTypes.forEach(function(type) {
        if (pkg[type]) {
          f.flattened[type] = flattenDependencies(clone(pkg[type]), res.dependencies, type);
        }
      });
      var pkgString = JSON.stringify(pkg, null, 2);
      if (dry) {
        console.log(pkgString);
        console.log('\n\nDry run only, making no changes.');
      } else {
        fs.writeFileSync(path.resolve(modPath, './package.json'), pkgString);
        console.log('Updated package.json. This package can now be rewritten using `fenestrate rewrite`.');
      }
      if (cb) {
        cb();
      } else {
        process.exit(0);
      }
    });
  },
  rewrite: function(modPath, restore, prod) {
    var pkg = require(path.resolve(modPath, './package.json'));
    var f = pkg.__fenestrate,
    rewriteFrom = restore ? "previous" : "flattened",
    saveTo = restore ? "flattened" : "previous";

    if (prod) dependencyTypes.pop();

    if (f && !restore && f.previous) {
      console.log('This package is already in a transformed state. Run `fenestrate restore` before running `fenestrate rewrite` again.')
      process.exit(0);
    }
    if (f && restore && !f.previous) {
      die('This package is not in a transformed state and cannot be restored.')
    }
    if (!f || !f[rewriteFrom]) { 
      console.log('A ' + rewriteFrom + ' configuration was never added to this package.');
      process.exit(0);
    }
    f[saveTo] = {};
    dependencyTypes.forEach(function(type) {
      if (pkg[type] && !f[rewriteFrom][type]) {
        die('The package.json file has a "' + type + '" configuration, but there is no "' + type + '" present in the fenestrate config. Run `fenestrate make` again.');
      }
      f[saveTo][type] = clone(pkg[type]);
      pkg[type] = clone(f[rewriteFrom][type]);
    });
    delete f[rewriteFrom];
    console.log("Writing " + rewriteFrom + " package.json...");
    fs.writeFileSync(path.resolve(modPath, './package.json'), JSON.stringify(pkg, null, 2));
    console.log("Successfully saved " + rewriteFrom + " package.json. Rewriting node_modules directory...")
    reinstallNodeModules(modPath, prod, function(err, code) {
      if (code !== 0) {
        die("Error building " + rewriteFrom + " node_modules directory. Could not continue.");
      }
      if (restore) {
        console.log('Done restoring original node_modules directory structure. Defenestration complete.')
        process.exit(0);
      }
      console.log("Installed node_modules directory. Recursing into it; hold tight.");
      (function rewriteDeep(mPath, levels, outerCb) {
        var mNMPath = path.resolve(mPath, './node_modules'),
            levelsUp = 0;
        fs.readdirSync(mNMPath).reverse().reduceRight(function(cb, subModule) {
          return function() {
            var subModulePath = path.resolve(mNMPath, subModule);
            if (
                fs.statSync(subModulePath).isDirectory() &&
                fs.existsSync(path.resolve(subModulePath, './node_modules')) &&
                fs.existsSync(path.resolve(subModulePath, './package.json'))
              ) {
                // it's a real module
                if (dependencyTypes.some(function(type){
                  return pkg[type] && pkg[type].hasOwnProperty(subModule)
                }) && levels > 2) {
                  // it's already present in the root package. we don't need semver
                  // to know that npm left it because it's an incompatible version
                  // 
                  // (and this won't ever work at the first layer of packages, so we count up)
                  console.log('Detected that "' + subModule + '" has mutually incompatible versions in the tree, resulting in excess depth. Checking if we can make it shallower...');
                  var ancestorToMoveTo = mNMPath;
                  function logLookin() {
                    console.log('Trying to find ' + subModule + ' above ' + ancestorToMoveTo);
                    return true;
                  }
                  while (!(logLookin() && fs.existsSync(path.resolve(ancestorToMoveTo, '../../', subModule)))) { // go up until it's there
                    ancestorToMoveTo = path.resolve(ancestorToMoveTo, '../../');
                    if (++levelsUp > levels) {
                      console.log("Didn't find the conflicting dependency higher up and we're at " + ancestorToMoveTo + ". Something's weird about " + subModule);
                      return cb();
                    }
                  }
                  console.log('Found the shallowest available directory for moving ' + subModule + ', at ' + ancestorToMoveTo);
                  var newSubModulePath = path.resolve(ancestorToMoveTo, subModule);
                  fs.renameSync(subModulePath, newSubModulePath)
                  console.log("Successfully moved " + subModulePath + " to " + newSubModulePath);
                  subModulePath = newSubModulePath;
                }
                rewriteDeep(subModulePath, ((levels - levelsUp) + 1), cb);
              } else {
                cb();
              }
          };
        }, outerCb)();
      })(modPath, 1, function() {
        console.log("Done walking the tree for deep duplicates. Fenestration complete.")
        process.exit(0);
      });
    });
  },
  'rewrite-prod': function(modPath) {
    commands.rewrite(modPath, false, true);
  },
  restore: function(modPath) {
    commands.rewrite(modPath, true);
  },
  remove: function(modPath) {
    var pkg = require(path.resolve(modPath, './package.json'));
    if (!pkg.__fenestrate) {
      die("Cannot remove fenestrate config because there isn't one present in package.json.")
    }
    if (pkg.__fenestrate.previous) {
      die("Cannot remove fenestrate config because this package is in a transformed state. Run `fenestrate restore` before `fenestrate remove`.");
    }
    console.log("Removing fenestrate config from package.json...");
    delete pkg.__fenestrate;
    fs.writeFileSync(path.resolve(modPath, './package.json'), JSON.stringify(pkg, null, 2));
    console.log("Saved package.json.");
    process.exit(0);
  },
  "dry-run": function(modPath) {
    commands.make(modPath, true);
  }
};

if (!commands[cmd]) {
  console.error("Unrecognized command " + cmd).
  console.log(helpText);
  process.exit(1);
}

commands[cmd](modulePath);
