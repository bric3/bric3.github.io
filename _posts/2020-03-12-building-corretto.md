---
layout: post
title: Building Java
date: 2020-03-12
published: false
tags:
- Java
- Corretto
- OpenJDK
author: Brice Dutheil
---

## How to build your corretto JDK


Let's git clone the `master` branch, otherwise the default is `develop`

```bash
❯ git clone git@github.com:corretto/corretto-11.git --master
```

Giving a quick look at what the repo is made off we see 

```bash
corretto-11❯ tree -L 2
..
├── ADDITIONAL_LICENSE_INFO
├── ASSEMBLY_EXCEPTION
├── CHANGELOG.md
├── CODE_OF_CONDUCT.md
├── LICENSE
├── README.md
├── TRADEMARKS.md
├── amazon-cacerts
├── build.gradle
├── gradle
│   └── wrapper
├── gradle.properties
├── gradlew
├── gradlew.bat
├── installers
│   ├── linux
│   ├── mac
│   └── windows
├── settings.gradle
├── src
│   ├── ADDITIONAL_LICENSE_INFO
│   ├── ASSEMBLY_EXCEPTION
│   ├── LICENSE
│   ├── Makefile
│   ├── README
│   ├── bin
│   ├── build
│   ├── configure
│   ├── doc
│   ├── make
│   ├── src
│   └── test
└── version.txt
```

So interestingly, corretto _installers_ appears to be built with gradle, let's
skip that part for now and directly try to build the OpenJDK sources.

For that let's go in the `src/` folder, open the building documentation,
available either as markdown (`doc/building.md`) or as an html `doc/building.html` file.

_The impatient should really read the TLDR of this documentation._

The first step would be to configure the build. I already have the bare minimum 
requirement : `make`, `autoconf`, `bash` and XCode.

However I encoutered this error

```bash
corretto-11/src❯ bash configure

...
configure: error: No xcodebuild tool and no system framework headers found, use --with-sysroot or --with-sdk-name to provide a path to a valid SDK
...
```

All I had to do was to select the current XCode tooling, this command 
wasn't properly documented in the buidling doc.

```bash
❯ sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

```bash
corretto-11/src❯ bash configure

...
configure: Found potential Boot JDK using /usr/libexec/java_home
configure: Potential Boot JDK found at /Library/Java/JavaVirtualMachines/openjdk-13.0.2.jdk/Contents/Home is incorrect JDK version (openjdk version "13.0.2" 2020-01-14); ignoring
configure: (Your Boot JDK version must be one of: 10 11)
Unable to find any JVMs matching version "1.9".
configure: Found potential Boot JDK using /usr/libexec/java_home -v 1.9
configure: Potential Boot JDK found at /Library/Java/JavaVirtualMachines/openjdk-13.0.2.jdk/Contents/Home is incorrect JDK version (openjdk version "13.0.2" 2020-01-14); ignoring
configure: (Your Boot JDK version must be one of: 10 11)
Unable to find any JVMs matching version "1.8".
configure: Found potential Boot JDK using /usr/libexec/java_home -v 1.8
configure: Potential Boot JDK found at /Library/Java/JavaVirtualMachines/openjdk-13.0.2.jdk/Contents/Home is incorrect JDK version (openjdk version "13.0.2" 2020-01-14); ignoring
configure: (Your Boot JDK version must be one of: 10 11)
Unable to find any JVMs matching version "1.7".
configure: Found potential Boot JDK using /usr/libexec/java_home -v 1.7
configure: Potential Boot JDK found at /Library/Java/JavaVirtualMachines/openjdk-13.0.2.jdk/Contents/Home is incorrect JDK version (openjdk version "13.0.2" 2020-01-14); ignoring
configure: (Your Boot JDK version must be one of: 10 11)
checking for javac... /Users/bric3/.asdf/shims/javac
checking for java... /Users/bric3/.asdf/shims/java
configure: Found potential Boot JDK using well-known locations (in /Library/Java/JavaVirtualMachines/openjdk-13.0.2.jdk)
configure: Potential Boot JDK found at /Library/Java/JavaVirtualMachines/openjdk-13.0.2.jdk/Contents/Home is incorrect JDK version (openjdk version "13.0.2" 2020-01-14); ignoring
configure: (Your Boot JDK version must be one of: 10 11)
configure: Could not find a valid Boot JDK. You might be able to fix this by running 'brew cask install java'.
configure: This might be fixed by explicitly setting --with-boot-jdk
configure: error: Cannot continue
configure exiting with result code 1
```

Then another constraint is the need for an N or N-1 jdk to be present to be able 
to build the JDK sources. In my setup I use brew to install the latest java, at this time java 13, 
to run java apps and I use a distribution manager to manage different JDK versions for developemt 
purpose, like java 11 or java 8. Currently I'm experimenting with `asdf-vm`.
From the logs `configure` sees the asdf _shims_, but doesn't know where this JDK is located.

Use your sdk environement mangement to get the java home

* `$(jenv javahome)`
* `$(asdf where java amazon-corretto-11.0.6.10.1-2)`
* etc.

Finally configure works.

```bash
corretto-11/src❯ bash configure --with-boot-jdk=$(asdf where java amazon-corretto-11.0.6.10.1-2)

...
checking if build directory is on local disk... yes
checking JVM features for JVM variant 'server'... "aot cds cmsgc compiler1 compiler2 dtrace epsilongc g1gc graal jfr jni-check jvmci jvmti management nmt parallelgc serialgc services vm-structs"
configure: creating /Users/bric3/opensource/corretto-11/src/build/macosx-x86_64-normal-server-release/configure-support/config.status
config.status: creating /Users/bric3/opensource/corretto-11/src/build/macosx-x86_64-normal-server-release/spec.gmk
config.status: creating /Users/bric3/opensource/corretto-11/src/build/macosx-x86_64-normal-server-release/bootcycle-spec.gmk
config.status: creating /Users/bric3/opensource/corretto-11/src/build/macosx-x86_64-normal-server-release/buildjdk-spec.gmk
config.status: creating /Users/bric3/opensource/corretto-11/src/build/macosx-x86_64-normal-server-release/compare.sh
config.status: creating /Users/bric3/opensource/corretto-11/src/build/macosx-x86_64-normal-server-release/Makefile

====================================================
A new configuration has been successfully created in
/Users/bric3/opensource/corretto-11/src/build/macosx-x86_64-normal-server-release
using configure arguments '--with-boot-jdk=/Users/bric3/.asdf/installs/java/amazon-corretto-11.0.6.10.1-2'.

Configuration summary:
* Debug level:    release
* HS debug level: product
* JVM variants:   server
* JVM features:   server: 'aot cds cmsgc compiler1 compiler2 dtrace epsilongc g1gc graal jfr jni-check jvmci jvmti management nmt parallelgc serialgc services vm-structs'
* OpenJDK target: OS: macosx, CPU architecture: x86, address length: 64
* Version string: 11.0.6-internal+0-adhoc.bric3.src (11.0.6-internal)

Tools summary:
* Boot JDK:       openjdk version "11.0.6" 2020-01-14 LTS OpenJDK Runtime Environment Corretto-11.0.6.10.1 (build 11.0.6+10-LTS) OpenJDK 64-Bit Server VM Corretto-11.0.6.10.1 (build 11.0.6+10-LTS, mixed mode)  (at /Users/bric3/.asdf/installs/java/amazon-corretto-11.0.6.10.1-2)
* Toolchain:      clang (clang/LLVM from Xcode 11.3.1)
* C Compiler:     Version 11.0.0 (at /usr/bin/clang)
* C++ Compiler:   Version 11.0.0 (at /usr/bin/clang++)

Build performance summary:
* Cores to use:   8
* Memory limit:   16384 MB
```


It's possible to tweak the configuration by looking at the §common configure arguments
however it may require additional dependencies.


Let's start spinning the fans

```bash
❯ make images
Building target 'images' in configuration 'macosx-x86_64-normal-server-release'
Compiling 8 files for BUILD_TOOLS_LANGTOOLS
Warning: No SCM configuration present and no .src-rev
Parsing 2 properties into enum-like class for jdk.compiler
Compiling 13 properties into resource bundles for jdk.javadoc
Compiling 12 properties into resource bundles for jdk.jdeps
Compiling 7 properties into resource bundles for jdk.jshell
Compiling 19 properties into resource bundles for jdk.compiler
Compiling 117 files for BUILD_java.compiler.interim
Creating hotspot/variant-server/tools/adlc/adlc from 13 file(s)
Compiling 2 files for BUILD_JVMTI_TOOLS
Compiling 1 files for BUILD_JFR_TOOLS
...
Compiling 224 properties into resource bundles for jdk.localedata
Compiling 90 properties into resource bundles for java.desktop
Compiling 2982 files for java.base
...
Compiling 1586 files for jdk.internal.vm.compiler
...
Creating support/modules_libs/java.base/libverify.dylib from 2 file(s)
Creating support/modules_libs/java.base/libjava.dylib from 60 file(s)
...
Creating images/jmods/jdk.management.agent.jmod
Creating images/jmods/jdk.management.jfr.jmod
Creating images/jmods/jdk.naming.dns.jmod
...
Creating jdk image
Stopping sjavac server
Finished building target 'images' in configuration 'macosx-x86_64-normal-server-release'
```

The process took ~20 min on my laptop (16GB 2,7 GHz Quad-Core Intel Core i7) with
2 browser and many tabs opened, slack, intellij, and other apps running.

Let's try to see if it worked :

```java
coretto-11/src❯ build/macosx-x86_64-normal-server-release/images/jdk/bin/java --version
openjdk 11.0.6-internal 2020-01-14
OpenJDK Runtime Environment (build 11.0.6-internal+0-adhoc.bric3.src)
OpenJDK 64-Bit Server VM (build 11.0.6-internal+0-adhoc.bric3.src, mixed mode)
```

Other things are possible, like only building hotspot (the actual JVM).

```bash
coretto-11/src❯ make help

OpenJDK Makefile help
=====================

Common make targets
 make [default]         # Compile all modules and create a runnable "exploded"
                        # image (alias for jdk or exploded-image)
 make all               # Create all images: product, test, docs
                        # (alias for all-images)
 make images            # Create a complete jdk image
                        # (alias for product-images)
...
Targets for Hotspot
 make hotspot           # Build all of hotspot
 make hotspot-<variant> # Build just the specified jvm variant
 make hotspot-gensrc    # Only build the gensrc part of hotspot
 make hotspot-<variant>-<phase> # Build the specified phase for the variant
...
```

## Opening the JDK in IntelliJ.

Now let's naviagte the code base using IntelliJ IDEA, for that just run 

```bash
coretto-11/src❯ bash bin/idea.sh
FATAL: cannot find ant. Try setting ANT_HOME.
```

I finally got rid of ant for it to come back this way. Let's `brew install ant` and rerun `idea.sh`

```bash
coretto-11/src❯ bash bin/idea.sh
mkdir: /Users/bric3/opensource/corretto-11/src/.idea: File exists
```

The tool complans that this folder already exists, it's a nice thing to prevent 
this script to overwrite this folder as IntelliJ IDEA may add or modify some of these files.
In my case I just remote it since they were incorrect. Also if for some reason,
`bin/idea.sh` does not pick up ant, you coud always set `ANT_HOME` it this way, that's 
what I had to do:

```bash
coretto-11/src❯ rm -rf .idea
coretto-11/src❯ ANT_HOME=/usr/local/opt/ant/libexec/ bash bin/idea.sh
```

Open Idea, I'm using the shell launcher that is installed by the jetbrains toolbox installer.

```bash
coretto-11/src❯ idea .
```

And voilà

![OpenJDK browsing in IntelliJ IDEA]({{ site.baseurl }}/assets/corretto-11-in-intellij-idea.png)


One thing I noticed is that the project is set for Java 9 language level,
but some Java code actually have language features from Java 10, like `var`.
So I had to increase the project language level.

![corretto source project level]({{ site.baseurl }}/assets/corretto-11-project-source-level.png)


## Let's play with the jdk

### Quicly hack something in jshell (2)

I always have the habit to type `/quit` within `jshell`, let's see how to add an alias to
`/exit`

Let's explore the code base by searching a specific text, like the one in the `/help intro`
like 

> The jshell tool allows you to execute Java code, getting immediate results.

This can be found here, in `src/jdk.jshell/share/classes/jdk/internal/jshell/tool/resources/l10n.properties`

```
help.intro =\
The jshell tool allows you to execute Java code, getting immediate results.\n\
You can enter a Java definition (variable, method, class, etc), like:  int x = 8\n\
or a Java expression, like:  x + x\n\
or a Java statement or import.\n\
These little chunks of Java code are called 'snippets'.\n\
```

following the resource eky we can stumble on `src/src/jdk.jshell/share/classes/jdk/internal/jshell/tool/JShellTool.java`
and this code especially

```java
        registerCommand(new Command("intro",
                "help.intro",
                CommandKind.HELP_SUBJECT));
```

Quickly hacking a duplicate command of the actual `/exit` to register the 
additional `/quit`...

```diff
diff --git i/src/src/jdk.jshell/share/classes/jdk/internal/jshell/tool/JShellTool.java w/src/src/jdk.jshell/share/classes/jdk/internal/jshell/tool/JShellTool.java
index 9ccb4e888..73cb61ff6 100644
--- i/src/src/jdk.jshell/share/classes/jdk/internal/jshell/tool/JShellTool.java
+++ w/src/src/jdk.jshell/share/classes/jdk/internal/jshell/tool/JShellTool.java
@@ -41,7 +41,6 @@ import java.lang.module.ModuleDescriptor;
 import java.lang.module.ModuleFinder;
 import java.lang.module.ModuleReference;
 import java.net.MalformedURLException;
-import java.net.URI;
 import java.net.URISyntaxException;
 import java.net.URL;
 import java.nio.charset.Charset;
@@ -260,6 +259,19 @@ public class JShellTool implements MessageHandler {

     Map<Snippet, SnippetInfo> mapSnippet;

+    private List<Suggestion> exitCompletionSuggestions(String sn, int c, int[] a) {
+        if (analysis == null || sn.isEmpty()) {
+// No completions if uninitialized or snippet not started
+            return Collections.emptyList();
+        } else {
+// Give exit code an int context by prefixing the arg
+            List<Suggestion> suggestions = analysis.completionSuggestions(INT_PREFIX + sn,
+                    INT_PREFIX.length() + c, a);
+            a[0] -= INT_PREFIX.length();
+            return suggestions;
+        }
+    }
+
     // Kinds of compiler/runtime init options
     private enum OptionKind {
         CLASS_PATH("--class-path", true),
@@ -1782,19 +1794,11 @@ public class JShellTool implements MessageHandler {
                 arg -> cmdImports(),
                 EMPTY_COMPLETION_PROVIDER));
         registerCommand(new Command("/exit",
-                arg -> cmdExit(arg),
-                (sn, c, a) -> {
-                    if (analysis == null || sn.isEmpty()) {
-                        // No completions if uninitialized or snippet not started
-                        return Collections.emptyList();
-                    } else {
-                        // Give exit code an int context by prefixing the arg
-                        List<Suggestion> suggestions = analysis.completionSuggestions(INT_PREFIX + sn,
-                                INT_PREFIX.length() + c, a);
-                        a[0] -= INT_PREFIX.length();
-                        return suggestions;
-                    }
-                }));
+                this::cmdExit,
+                this::exitCompletionSuggestions));
+        registerCommand(new Command("/quit",
+                this::cmdExit,
+                this::exitCompletionSuggestions));
         registerCommand(new Command("/env",
                 arg -> cmdEnv(arg),
                 envCompletion()));
```

Recompile the images.

```bash
coretto-11/src❯ make images
Building target 'images' in configuration 'macosx-x86_64-normal-server-release'
Warning: No SCM configuration present and no .src-rev
Compiling 94 files for jdk.jshell
Creating images/jmods/jdk.jshell.jmod
Creating images/jmods/java.base.jmod
Creating jdk image
Stopping sjavac server
Finished building target 'images' in configuration 'macosx-x86_64-normal-server-release'
```

and discover the result

```bash
coretto-11/src❯ build/macosx-x86_64-normal-server-release/images/jdk/bin/jshell
|  Welcome to JShell -- Version 11.0.6-internal
|  For an introduction type: /help intro

jshell> /quit
|  Goodbye
```

Jobs done !

### Quicly hack something in jshell (2)

Now I'd like something easier to work with, creating images makes the feedback 
loop too long and I can not debug the program which is cumbersome.
First we need to set the JDK in the project, which is not another JDK but this JDK
(otherwise the classes that will be loaded will be from the SDK not from the JDK sources).
The JDK we want can be found at this location, after the the `make images`

But we need the `jdk` target

```
corretto-11/src/build/macosx-x86_64-normal-server-release/jdk
```

which includes `java`

```
corretto-11/src❯ tree -L 1 build/macosx-x86_64-normal-server-release/jdk/bin
build/macosx-x86_64-normal-server-release/jdk/bin
...
├── jarsigner
├── jarsigner.dSYM
├── java
├── javac
├── javac.dSYM
├── javadoc
├── javadoc.dSYM
...
```

![Setting freshly built JDK as Project SDK]({{ site.baseurl }}/assets/hacking-corretto-11/corretto-11-feesh-build-jdk-as-sdk.png)

**That the JDK we need to add to IntelliJ and to set to the current project.**

Now let's find something to run like a main method, hoefully for `jshell` (<kbd>cmd</kbd> + <kbd>alt</kbd> + <kbd>o</kbd>)

![Looking for main methods]({{ site.baseurl }}/assets/hacking-corretto-11/corretto-11-looking-for-main.png)

There's one, let then run `jdk.internal.jshell.tool.JShellToolProvider#main`

![Running JShellToolProvider#main]({{ site.baseurl }}/assets/hacking-corretto-11/corretto-11-run-JshellToolProvider.main.png)

Later in `JShellTool` we can find this method, let's set a break point to see how 
commands are processed.

```java
    /**
     * Process a command (as opposed to a snippet) -- things that start with
     * slash.
     *
     * @param input
     */
    private void processCommand(String input) {
        if (input.startsWith("/-")) {
```

At boot strap we see a lot of `/set` commands, so it may be necessary to toggle the breakpoint once 
the init phase is over.

* `/set mode verbose -command`
* `/set prompt verbose '\njshell> '   '   ...> '`
* `/set format verbose pre '|  '`
* `/set format verbose post '%n'`
* `/set format verbose errorpre '|  '`
* `/set format verbose errorpost '%n'`
* `/set format verbose errorline '{post}{pre}    {err}'`
* `/set format verbose action 'created' added-primary`
* `...`
* `/set format verbose typeKind 'interface'              interface`
* `...`

I'm not sure yet how to use the build command within IntelliJ IDEA yet,
so modifications were not added to the jdk here `corretto-11/src/build/macosx-x86_64-normal-server-release/jdk`.

But if we are not generating the images, which is what we want, there's this `make` 
target that is faster.

```bash
corretto/src❯ make jdk
Building target 'jdk' in configuration 'macosx-x86_64-normal-server-release'
Warning: No SCM configuration present and no .src-rev
Compiling 94 files for jdk.jshell
Stopping sjavac server
Finished building target 'jdk' in configuration 'macosx-x86_64-normal-server-release'
```

The compilation appear to be incremental, and doesn't recompile every JDK modules.

