
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

    C:\some\long\path> fenestrate make .\module

(Of course it works on *nix systems as well.)

Common Commands:


`make`    updates the package.json file in the current directory to contain a
          __fenestrate configuration that can be used to rewrite the
          node_modules directory later, using `fenestrate rewrite-full`.

`rewrite` rewrites the node_modules directory to use the flattest possible
          dependency graph for the dependencies. requires `make` first.

`rewrite-prod` does what `rewrite` does, but skips `devDependencies`.

`rewrite-full` swaps out the fenestrated package.json before performing a
          `rewrite`, resulting in the flattest possible dependency graph.
          it may lead to instability if your dependencies are doing anything
          strange, but it is the most aggressive algorithm.

`rewrite-prod-full` does what `rewrite-full` does, but skips
          `devDependencies`.

`restore` defenestrates! It undoes the changes written to your node_modules by
          `fenestrate rewrite`.

`remove`  removes the __fenestrate configuration from package.json.

`dry-run` describes the changes that would be made to package.json, but won't
          make them.

`help`    prints this help text.

<!-- cut here -->

packaging
---------

If you're making an npm package and you know the graph is dangerously deep for windows (i'm looking at you, [bower](http://bower.io)) you should run `fenestrate make` on your package and commit the change.

The `fenestrate make` command creates a flatter dependency graph and saves it in a special `__fenestrate` attribute in your `package.json` file. By itself, it doesn't flatten the dep graph, but *indicates to the Windows consumer that the package can be safely flattened with `fenestrate rewrite`, and describes the flatter dependencies.* The idea is for Windows servers to add a post-install hook script to the `node_modules` folder in their installation root (and this setup is covered in the next section).

So by successfully running `fenestrate make` on your package before you publish it, you're letting Windows consumers know that your package is optimized for Windows, even if you can't test on Windows yourself.

windows server setup
--------------------

You can configure a Windows server to run `fenestrate rewrite` on every npm package that installs inside a certain directory tree. (Note that `fenestrate rewrite` will silently fail with a successful exit code if it doesn't find a `__fenestrate` configuration, so it can be safely run on non-fenestrated packages as well.)

Let's say that all of your npm packages on a given server will be descendents of the `D:\web\` folder. Add the following file, creating directories if they don't already exist:

    D:\web\node_modules\.hooks\install.cmd

And put in that file:

    fenestrate rewrite .

Add another, blank file, with the same name without the three-letter extension. (This is a Node quirk on Windows, to force it to acknowledge an install hook script.)

    D:\web\node_modules\.hooks\install

Finally, install fenestrate globally:

    npm install -g fenestrate

And now, all packages will be fenestrate rewritten as they come in. You're welcome.

Licensed GPLv3.
