---
layout: post
title: When Java's WatchService is not enough
date: 2018-06-18
published: false
tags:
- Java
- Linux
- docker
- inotify
author: Brice Dutheil
---

Suppose the application you're working on needs to monitor changes to a 
file and rely on Java's `WatchService` introduced in Java 7. Developing 
it and testing it locally works, in unit tests as you want to control 
the content of the file the test rely on a `TemporaryFolder` Junit rule.
Everything is green to go live.

This file is `/etc/hosts`.

However when the application is live in production, nothing happen when
the file is modified. How is it possible ?



```bash
touch /etc/hosts
```



[`sun.nio.fs.LinuxWatchService`](http://hg.openjdk.java.net/jdk8u/jdk8u/jdk/file/478a4add975b/src/solaris/classes/sun/nio/fs/LinuxWatchService.java)

```java
/**
 * Linux implementation of WatchService based on inotify.
 *
 * In summary a background thread polls inotify plus a socket used for the wakeup
 * mechanism. Requests to add or remove a watch, or close the watch service,
 * cause the thread to wakeup and process the request. Events are processed
 * by the thread which causes it to signal/queue the corresponding watch keys.
 */
```

So this is based on `inotify`, the Linux API that allow to receive notifications 
on file-system change events. So let's try with system tools.

Install ``

In the container let's setup a watch on `/etc/hosts`, in shell session A

```bash
# inotifywait -m /etc/hosts
Setting up watches.
Watches established.
```

In shell session B, enter

```bash
# touch /etc/hosts
```

In console A, the expected events are observed, so inotify appears to be working
as expected.

```bash
/etc/hosts OPEN
/etc/hosts ATTRIB
/etc/hosts CLOSE_WRITE,CLOSE
```

But remember that JVM `WatchService` only allow to register a directory

> ```java
> /**
>  * A watch service that <em>watches</em> registered objects for changes and
>  * events. For example a file manager may use a watch service to monitor a
>  * directory for changes so that it can update its display of the list of files
>  * when files are created or deleted.
> ```

So let's retry with a watch on `/etc` folder instead, in shell session A

```bash
# inotifywait -m /etc
Setting up watches.
Watches established.
```

In shell session B, enter

```bash
# touch /etc/hosts
```

In console A, different events are observed, not quite what the Linux implementation
relying on `inotify` expects to notice modifications (no ATTRIB or MODIFY events, and interestingly it open `ld.so.cache`).

```bash
/etc/ OPEN ld.so.cache
/etc/ CLOSE_NOWRITE,CLOSE ld.so.cache
```

## The clue

Interestingly I remembered this paragraph in the `WatchService` javadoc :

> ```java
>  * <p> If a watched file is not located on a local storage device then it is
>  * implementation specific if changes to the file can be detected. In particular,
>  * it is not required that changes to files carried out on remote systems be
>  * detected.
> ```

So since this app is running in a rocket container, let's have a look at mounts

```bash
# findmnt
TARGET                           SOURCE                                          FSTYPE  OPTIONS
/                                overlay                                         overlay rw,relatime,lowerdir=/var/lib/rkt/cas/tree/deps-sha512-e6b558999a3ec87f0c8e85897c1f048e00735697307
|-/dev/termination-log           /dev/sda9[/var/lib/kubelet/pods/355881c1-e9c0-11e8-8dbd-2ee986b3f310/containers/edge-api/5eb32d80-e9c0-11e8-b832-5eb71c2a1aa1]
|                                                                                ext4    rw,relatime,seclabel,data=ordered
|-/dgr/attributes/k8s-attributes /dev/sda9[/var/lib/kubelet/pods/355881c1-e9c0-11e8-8dbd-2ee986b3f310/volumes/kubernetes.io~configmap/edge-api]
|                                                                                ext4    rw,relatime,seclabel,data=ordered
|-/etc/hosts                     /dev/sda9[/var/lib/kubelet/pods/355881c1-e9c0-11e8-8dbd-2ee986b3f310/etc-hosts]
|                                                                                ext4    rw,relatime,seclabel,data=ordered
|-/run/secrets/kubernetes.io/serviceaccount
|                                tmpfs                                           tmpfs   ro,relatime,seclabel
|-/dev/null                      tmpfs[/null]                                    tmpfs   rw,nosuid,seclabel,mode=755
|-/dev/zero                      tmpfs[/zero]                                    tmpfs   rw,nosuid,seclabel,mode=755
|-/dev/full                      tmpfs[/full]                                    tmpfs   rw,nosuid,seclabel,mode=755
|-/dev/random                    tmpfs[/random]                                  tmpfs   rw,nosuid,seclabel,mode=755
|-/dev/urandom                   tmpfs[/urandom]                                 tmpfs   rw,nosuid,seclabel,mode=755
|-/dev/tty                       tmpfs[/tty]                                     tmpfs   rw,nosuid,seclabel,mode=755
|-/dev/net/tun                   tmpfs[/net/tun]                                 tmpfs   rw,nosuid,seclabel,mode=755
|-/dev/console                   devpts[/6]                                      devpts  rw,nosuid,noexec,relatime,seclabel,gid=5,mode=620,ptmxmode=000
|-/proc                          proc                                            proc    rw,nosuid,nodev,noexec,relatime
| |-/proc/sys                    proc[/sys]                                      proc    ro,nosuid,nodev,noexec,relatime
| | `-/proc/sys/kernel/random/boot_id
| |                              tmpfs[/proc-sys-kernel-random-boot-id//deleted] tmpfs   ro,nosuid,nodev,seclabel,mode=755
| |-/proc/sysrq-trigger          proc[/sysrq-trigger]                            proc    ro,nosuid,nodev,noexec,relatime
| |-/proc/sys/kernel/random/boot_id
| |                              tmpfs[/proc-sys-kernel-random-boot-id//deleted] tmpfs   rw,nosuid,nodev,seclabel,mode=755
| `-/proc/kmsg                   tmpfs[/kmsg//deleted]                           tmpfs   rw,nosuid,nodev,seclabel,mode=755
|-/dev/shm                       tmpfs                                           tmpfs   rw,nosuid,nodev,seclabel
|-/dev/pts                       devpts                                          devpts  rw,nosuid,noexec,relatime,seclabel,gid=5,mode=620,ptmxmode=666
|-/run/systemd/journal           tmpfs[/systemd/journal]                         tmpfs   rw,nosuid,nodev,seclabel,mode=755
|-/sys                           sysfs                                           sysfs   ro,nosuid,nodev,noexec,relatime,seclabel
|-/etc/resolv.conf               overlay[/etc/rkt-resolv.conf]                   overlay rw,relatime,lowerdir=/var/lib/rkt/cas/tree/deps-sha512-8cae658164e36d41cb6485422dd6b66dbc787e1a4c1
|-/etc/hostname                  proc[/sys/kernel/hostname]                      proc    ro,nosuid,nodev,noexec,relatime
`-/run/systemd/notify            tmpfs[/systemd/notify]                          tmpfs   rw,nosuid,nodev,seclabel,mode=755
```

bind mount ?
https://unix.stackexchange.com/questions/198590/what-is-a-bind-mount

> Limitations and caveats
>       The inotify API provides no information about the user or process
>       that triggered the inotify event.  In particular, there is no easy
>       way for a process that is monitoring events via inotify to
>       distinguish events that it triggers itself from those that are
>       triggered by other processes.
>
>       *Inotify reports only events that a user-space program triggers
>       through the filesystem API.*  As a result, it does not catch remote
>       events that occur on network filesystems.  *(Applications must fall
>       back to polling the filesystem to catch such events.)*  Furthermore,
>       various pseudo-filesystems such as /proc, /sys, and /dev/pts are not
>       monitorable with inotify.
>
>       The inotify API does not report file accesses and modifications that
>       may occur because of mmap(2), msync(2), and munmap(2).

source: [man7.org](http://man7.org/linux/man-pages/man7/inotify.7.html)


Plenty of issues : 
https://github.com/docker/for-mac/issues/2375
https://github.com/moby/moby/issues/11705
https://github.com/libuv/libuv/issues/1201