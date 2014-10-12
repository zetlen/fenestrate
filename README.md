
fenestrate
==========

Flatten the dependency graph for your NPM package so that it's less likely
to bump up against the 260-char path limit on Windows. Does not assign blame
or bloviate about whose responsibility this whole mess is.

**The package needs to be fully installed before fenestrate configuration 
creation will work. Run `npm install` before `fenestrate` if you haven't
already installed the module in place. `fenestrate rewrite` on the other hand
does not require installation first.**

Installation:

    npm install -g fenestrate

Usage:

    C:/some/long/path/> fenestrate make ./module


Commands:


`make`    updates the package.json file in the current directory to contain a
          __fenestrate configuration that can be used to rewrite the
          node_modules directory later, using `fenestrate rewrite`.

`rewrite` rewrites package.json and the node_modules directory to use the
          flatter dependency graph present in the __fenestrate configuration.

`restore` defenestrates! It undoes the changes written to your node_modules by
          `fenestrate rewrite`.

`remove`  removes the __fenestrate configuration from package.json.

`dry-run` describes the changes that would be made to package.json, but won't
          make them.

`help`    prints this help text.

You must always give fenestrate a path. It can be an absolute or relative
path, but it will never assume you should use the working directory, since
its operations can be (reversibly) destructive.

Licensed GPLv3.
