---
authors: ["brice.dutheil"]
date: "2020-04-01T00:00:00Z"
language: en
tags:
- dotfiles
- chezmoi
- onepassword
- 1password
- secret
slug: manage_dotfiles_with_chezmoi
title: Managing dotfiles and secret with chezmoi
---

Every once in a while, you may need to bootstrap a new machine, and along with it 
to _reconfigure_ home directory's _dot files_. Various approaches already exist,
using simple archive, git the home directory, gnu stow (symlinks), etc.

These approaches work more or less depending on your expectation, I wanted something
that [`chezmoi`](https://github.com/twpayne/chezmoi) touts: 
the **integration with password managers**.
There are other features on the shelf too, like templating, and system bootstrap 
facility.

Here I will only focus on the management of the dot files and of the secrets.

----

After you've got `chezmoi` [installed](https://www.chezmoi.io/docs/install/), you 
need to initialize it     


```bash
❯ chezmoi init
```

This will create a directory there `~/.local/share/chezmoi` and managed dotfiles will
land here, this folder is actually a git repository. This folder and the files in here 
are referred to as the _source_ files while the files in the home directory adn are 
referred to as the _target_.

## The basics

Then start adding the files you care about, e.g. 

```bash
❯ chezmoi add .zshrc
❯ chezmoi add .config/alacritty/alacritty.yml
❯ chezmoi add .SpaceVim.d/init.toml
```

Then when ready commit the files, for that you need to go to the _source_
directory of `chezmoi` and perform the git dance.

```bash
❯ chezmoi cd
❯ git st
On branch master

No commits yet

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	dot_SpaceVim.d/autoload/myspacevim.vim
	dot_SpaceVim.d/init.toml
	dot_config/alacritty/alacritty.yml
	dot_config/iterm/com.googlecode.iterm2.plist
	dot_config/starship.toml
	dot_config/topgrade.toml
	dot_gitconfig
	dot_gitignore-global
	dot_gradle/init.d/checknetwork.gradle
	dot_gradle/init.d/tasktree.gradle
	dot_mrconfig
	dot_p10k.zsh
	dot_zshrc

❯ git add *
❯ git commit --message="Init config"
```

This repository can then be synchronized with a remote git repository.

## Managing changes

Suppose the file `$HOME/.zshrc` evolves a bit, like declaring another 
[oh-my-zsh](https://github.com/ohmyzsh/ohmyzsh) plugin, in order to see 
the difference between actual files, and the files that are backed up by
`chezmoi` use the `chezmoi diff` command 

```bash
❯ chezmoi diff
install -m 644 /dev/null /Users/bric3/.zshrc
--- a/Users/bric3/.zshrc
+++ b/Users/bric3/.zshrc
@@ -85,7 +85,7 @@
   gitfast
   git-extras

-  man osx
+  man

   gradle mvn
   kubectl helm docker
```

* The lines starting with a minus `-` comes from the _target_ files, i.e. the files 
  in the `$HOME` directory.  
* The lines starting with a plus `+` comes from the _source_ files, i.e. the files 
  in the `chezmoi` internal directory.  

Knowing the above, this output can be understood as, the source file only have the `man` 
plugin entry on that line, while the local file have `man osx` plugin entries on that 
same line.

Now let's look at the output of two other commands:

* `chezmoi apply` will apply the source file to their local target, e.g. the `.zshrc` 
  file will converge to what's in the source file, once `chezmoi apply` has been executed, 
  this file will only declare the `man` plugin. 
  
  ```bash
  ❯ chezmoi apply --verbose --dry-run ~/.zshrc
  install -m 644 /dev/null /Users/bric3/.zshrc
  --- a/Users/bric3/.zshrc
  +++ b/Users/bric3/.zshrc
  @@ -85,7 +85,7 @@
     gitfast
     git-extras
  
  -  man osx
  +  man
  
     gradle mvn
     kubectl helm docker
  ```

* `chezmoi add` will do the opposite, it will change the source file `.zshrc` from the local 
  target file, i.e. after executing `chezmoi add`, the source file will now have the `man osx` entries.    

  ```bash
  ❯ chezmoi add --verbose --dry-run ~/.zshrc
  rm -rf /Users/bric3/.local/share/chezmoi/dot_zshrc
  install -m 644 /dev/null /Users/bric3/.local/share/chezmoi/dot_zshrc
  --- a/Users/bric3/.local/share/chezmoi/dot_zshrc
  +++ b/Users/bric3/.local/share/chezmoi/dot_zshrc
  @@ -85,7 +85,7 @@
     gitfast
     git-extras
  
  -  man
  +  man osx
  
     gradle mvn
     kubectl helm docker
  ```    
  
  Note hoe the minus `-` and plus `+` appears in the opposite change. 

## Handling secret with 1Password

So now that we have a basic setup and understanding of the tool, let's 
manage files with secrets. Currently, I have some files that I'd rather 
keep protected, especially if I use a private repository on my git host
be it GitHub, Gitlab or else.   

For that we'll need the `chezmoi` templating feature, and the cli tool from
the password manager, in this blog post I'm using on 1Password, but check 
the [how-to documentation](https://www.chezmoi.io/docs/how-to/#keep-data-private)
for other password manager support like Bitwarden or Keypassx.

So I especially need to store securely files in my `.ssh` folder and
my `.gnupg` folders.

```bash      
❯ chezmoi add .ssh/id_rsa_home.pub                                             
```

Regarding SSH, `id_rsa_home.pub` is a public key, so I'm just adding it raw, however 
things get interesting for `id_rsa` which is my private key. 

```bash      
❯ chezmoi add --template .ssh/id_rsa_home
❯ chezmoi add --template .ssh/config
❯ chezmoi add --template .gnupg/trustdb.gpg
❯ chezmoi add --template .gnupg/pubring.kbx
```

Here I'm telling `chezmoi` to store `id_rsa_home` as a template. While the stored 
file template still contains the original:

> Regarding GPG files, `chezmoi` supports GPG, but it's used as way to encrypt 
> secrets not to _backup_ the GPG secrets. There's indeed a way to extract 
> these secret keys as non-binary files using a few `gpg` commands, via 
> [_run_ scripts](https://www.chezmoi.io/docs/how-to/#use-scripts-to-perform-actions),
> however this break the declarative approach of `chezmoi`. So I chose to 
> save the binary files, here only `trustdb.gpg` and `pubring.kbx`.  

```bash
❯ chezmoi edit .ssh/id_rsa_home
# template is the same as the actual $HOME/.ssh/id_rsa_home
```
   
In order to tell make `chezmoi` aware of 1Password for this template, I first need 
to store the documents on 1Password. For that it is necessary to have a 1Password 
subscription that lets you have an online vault.

First sign-in

```bash         
❯ eval $(op signin my)
```

Then store documents using the 1Password cli tool `op` 

```bash         
❯ op create document .ssh/id_rsa --tags chezmoi --title .ssh/id_rsa
{"uuid":"ti2adie9Aixaidae4dahpoh5io","createdAt":"2020-04-01T17:53:49.596484+02:00","updatedAt":"2020-04-01T17:53:49.596484+02:00","vaultUuid":"eith2iequievuthae9Eedaiboh"}
❯ op create document .ssh/config --tags chezmoi --title .ssh/config
{"uuid":"pairahnietaluv5Moonahm2ea5","createdAt":"2020-04-01T17:54:36.402265+02:00","updatedAt":"2020-04-01T17:54:36.402265+02:00","vaultUuid":"eith2iequievuthae9Eedaiboh"}
❯ op create document .gnupg/trustdb.gpg --tags chezmoi --title .gnupg/trustdb.gpg
{"uuid":"zi8ieleiphieTithiep2xieg3u","createdAt":"2020-04-01T17:57:13.338949+02:00","updatedAt":"2020-04-01T17:57:13.338949+02:00","vaultUuid":"eith2iequievuthae9Eedaiboh"}
❯ op create document .gnupg/trustdb.gpg --tags chezmoi --title .gnupg/pubring.kbx
{"uuid":"losachuYeeho5Eiph2uzoquohl","createdAt":"2020-04-01T17:58:12.818754+02:00","updatedAt":"2020-04-01T17:58:12.818755+02:00","vaultUuid":"eith2iequievuthae9Eedaiboh"}
```

> _All UUIDs have been edited of course._

To complete this operation, we need to modify the templates files 
where to get the file, since there's a few binary files `vim` is not suited 
for that, so I'm using another mean to replace the content by the template.

```bash
❯ chezmoi cd
❯ echo -n '{{- onepasswordDocument "ti2adie9Aixaidae4dahpoh5io" -}}' > private_dot_gnupg/private_id_rsa.tmpl
❯ echo -n '{{- onepasswordDocument "pairahnietaluv5Moonahm2ea5" -}}' > private_dot_gnupg/config.tmpl
❯ echo -n '{{- onepasswordDocument "zi8ieleiphieTithiep2xieg3u" -}}' > private_dot_gnupg/private_trustdb.gpg.tmpl
❯ echo -n '{{- onepasswordDocument "losachuYeeho5Eiph2uzoquohl" -}}' > private_dot_gnupg/private_pubring.kbx.tmpl
❯ exit
```       

Note that I'm replacing the binary file content of `.gnupg/trustdb.gpg` 
and `.gnupg/pubring.kbx` with the template character string `{{- onepasswordDocument "uuid" -}}`.

Also, one downside with 1Password at this time, is that documents cannot be updated,
you need to remove the old document using the UUID and use the `create` sub-command
on the new version of the file, you'll get a new uuid and as such you'll have to update 
these template 


## Checking the templates 

Eventually it's possible to check the templating works by apply the _source_
files to another _target_ directory.

```bash
❯ chezmoi apply --verbose --destination /Users/bric3/tmphome --dry-run
```

> One thing you may notice is that now, this is _global_ command, and all 
> _global_ command will require the 1Password `op` session to be active, 
> and you may have to run again `eval $(op signin my)` as a pre-requisite.

If ready remove the `--dry-run`, and see the `tmphome` folder populated (after the 
command has run because `chezmoi` applies changes atomically).

```bash
❯ l /Users/bric3/tmphome
Permissions Size User  Date Modified Name
drwxr-xr-x     - bric3  2 Apr  2:54  .config
.rw-r--r--  3.1k bric3  2 Apr  2:54  .gitconfig
.rw-r--r--  2.4k bric3  2 Apr  2:54  .gitignore-global
drwx------     - bric3  2 Apr  2:55  .gnupg
drwxr-xr-x     - bric3  2 Apr  2:55  .gradle
drwxr-xr-x     - bric3  2 Apr  2:55  .kube
.rw-r--r--  7.5k bric3  2 Apr  2:55  .mrconfig
.rw-r--r--   51k bric3  2 Apr  2:55  .p10k.zsh
drwxr-xr-x     - bric3  2 Apr  2:54  .SpaceVim.d
drwx------     - bric3  2 Apr  2:56  .ssh
.rw-r--r--  7.4k bric3  2 Apr  2:56  .zshrc
```   

Note, it's possible to apply only a portion of the dot files in that temporary folder
just by adding the target absolute path `/Users/bric3/tmphome/.gnupg/`   

```bash
❯ chezmoi apply --verbose --destination /Users/bric3/tmphome /Users/bric3/tmphome/.gnupg/
```

And what we wanted, make sure the templates are exactly the same as the original files

```bash  
❯ b3sum /Users/bric3/tmphome/.gnupg/pubring.kbx /Users/bric3/.gnupg/pubring.kbx
1b51813215edef2e97846bfee51cd02dd8d6c2cb6a119b3681ac087597fb0197  /Users/bric3/tmphome/.gnupg/pubring.kbx
1b51813215edef2e97846bfee51cd02dd8d6c2cb6a119b3681ac087597fb0197  /Users/bric3/.gnupg/pubring.kbx
❯ b3sum /Users/bric3/tmphome/.gnupg/trustdb.gpg /Users/bric3/.gnupg/trustdb.gpg
d2c67bb808b223cc6f1b7c95b627b4b5551daa1312e12dd0ad3c5bfa1ac35dc9  /Users/bric3/tmphome/.gnupg/trustdb.gpg
d2c67bb808b223cc6f1b7c95b627b4b5551daa1312e12dd0ad3c5bfa1ac35dc9  /Users/bric3/.gnupg/trustdb.gpg
```

Looks good !

## It's not over

`chezmoi` comes with some features that are a bit more involved, especially
the templating and the system bootstrap/configuration. As I'm not using them 
for now I'll leave it aside.

Now the only thing I'll need to get my dotfiles is  

```bash
❯ eval $(op signin my)
❯ chezmoi init --apply --verbose https://githost.tld/path/to/dotfiles.git
```

Additionally, in order to synchronize the dotfiles from _upstream_ repository :

```bash
❯ eval $(op signin my)
❯ chezmoi source pull -- --rebase && chezmoi diff
```

