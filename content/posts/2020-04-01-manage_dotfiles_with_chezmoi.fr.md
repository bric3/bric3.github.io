---
authors: ["brice.dutheil"]
date: "2020-04-01T00:00:00Z"
language: fr
published: true
tags:
- dotfiles
- chezmoi
- onepassword
- 1password
- secret
title: Gestion des dotfiles et des secrets avec chezmoi
---

Régulièrement il nous arrive d'avoir à re-configurer une nouvelle machine, avec 
notamment la re-configuration des fichiers du `$HOME`. Il y a plusieurs approches
et outils, faire une simple archive, utiliser git pour le répertoire $HOME,
utiliser des outils comme GNU stow, etc.

Ces approches ont des avantages et des inconvénients, mais je souhaitais
une fonctionnalité en particulier que [`chezmoi`](https://github.com/twpayne/chezmoi) 
vantait : **l'intégration avec un gestionnaire de mot de passe**.
`chezmoi` dispose également d'autres fonctionnalités pour aider au bootstrap d'une 
nouvelle machine comme le templating, et la possibilité de lancer des scripts de 
configuration.

Dans cet article je me contenterai toutefois du management de dotfiles et des secrets. 

----

Une fois `chezmoi` [installé](https://www.chezmoi.io/docs/install/), il faut l'initialiser 

```bash
❯ chezmoi init
```

Cette commande créé un répertoire `~/.local/share/chezmoi` dans lequel les seront ajouté
les dotfiles géré par `chezmoi`, ce dossier est un repo git, (mais il est possible 
d'utiliser mercurial). Ce dossier et les fichiers dedans seront mentionné en temps que 
fichiers _source_, tandis que les fichiers dans le dossier home seront mentionnés en 
tant que fichiers _cible_ (_target_).   

## Les bases

Maintenant ajoutons les fichiers qui nous tiennent à coeur, e.g.

```bash
❯ chezmoi add .zshrc
❯ chezmoi add .config/alacritty/alacritty.yml
❯ chezmoi add .SpaceVim.d/init.toml
```

Puis une fois tous les fichiers ajoutés, il faut aller dans le dossier de `chezmoi` 
pour les ajouter au repo git. 

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
❯ git commit --message="Initial dotfiles config"
```

Bien entendu ce repo peut/doit être synchronisé avec un repo distant.

## Gérer les changements

Supposons que le fichier `$HOME/.zshrc` évolue, tel que l'ajout d'un plugin 
[oh-my-zsh](https://github.com/ohmyzsh/ohmyzsh), pour voir les différences entre 
le fichier local (la _cible_) et le fichier _source_ géré par `chezmoi`, il faut 
exécuter la commande `chezmoi diff`: 

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

* Les lignes commençant par un moins `-` viennent des fichiers _cible_ (_target_), c'est-à-dire 
  les fichiers du répertoire `$HOME`.  
* Les lignes commençant par un plus `+` viennent des fichiers _source_, c'est-à-dire 
  les fichiers du répertoire interne de `chezmoi`.  

Sachant interpreter la sortie de cette commande, dans l'exemple au-dessus, le fichier source
pnt uniquement le plugin `man` alors que le fichier actuel déclare les plugins `man osx` sur 
cette ligne. 

Maintenant regardons la sortie de deux autres commandes :

* la commande `chezmoi apply` applique les _sources_ sur les _cibles_ locales, par exemple le 
  fichier`.zshrc` va converger vers ce qui existe dans le fichier _source_, donc une fois 
  `chezmoi apply` exécuté, ce fichier ne déclarera que le plugin `man`. 
  
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

* la commande `chezmoi add` fera le contraire, elle applique les fichiers _cible_ sur les fichiers 
  _sources_, dans cet exemple ce sont les fichiers sources qui vont converger vers le contenu fichier 
  `.zshrc` du répertoire `$HOME`, donc une fois `chezmoi add` exécuté, les fichiers _source_ 
  déclareront les plugins `man osx`.    

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
  
  Notons que cette fois-ci les signes plus `+` et moins `-` sont également en sens contraire. 

## Gestion des secrets avec 1Password

Maintenant que nous avons les bases de `chezmoi` nous pouvons regarder comment gérer
les secrets. Avoir un repository distant privé pour ses dotfiles, c'est bien, mais
je souhaite tout de même garder ces fichiers protégés, en particulier si ces fichiers
doivent être stockés sur un repository distant, même s'il s'agit d'un repository privé.   
  
C'est le moment d'utiliser le mécanisme de templating de `chezmoi` et l'autil en ligne de 
commande de mon gestionnaire de mot de passe, ici 1Password. Pour en savoir plus sur les 
intégrations possibles il faut aller sur la [guide how-to](https://www.chezmoi.io/docs/how-to/#keep-data-private),
il y a notamment BitWarden, Keypassx et d'autres bien sûr.  

Donc je voudrais en particulier mettre en sécurité certains fichiers des dossiers
`.ssh` et `.gnupg`.


```bash      
❯ chezmoi add .ssh/id_rsa_home.pub                                             
```

Pour SSH, `id_rsa_home.pub` est la clef publique, il suffit d'utiliser les commandes 
de base, en revanche ça devient intéressant pour `id_rsa` qui est donc la clef privée.

```bash
❯ chezmoi add --template .ssh/id_rsa_home
❯ chezmoi add --template .ssh/config
❯ chezmoi add --template .gnupg/trustdb.gpg
❯ chezmoi add --template .gnupg/pubring.kbx 
```

Je demande à `chezmoi` de _stocker_ `id_rsa_home` et les autres fichiers sous forme 
de template. 

> En ce qui concerne mes clefs GPG, `chezmoi` supporte GPG mais uniquement pour
> chiffrer des secrets pas pour stocker les secrets GPG. Bien qu'il y ait un 
> mécanisme pour extraire les clefs secrètes en fichiers non binaires avec 
> certaines commandes `gpg`, et via les 
> [scripts _run_](https://www.chezmoi.io/docs/how-to/#use-scripts-to-perform-actions),
> cependant cette approche casse le modèle déclaratif de `chezmoi`. 
> Pour ces raisons j'ai choisi de sauver les fichiers binaires, ici uniquement 
> `trustdb.gpg` et `pubring.kbx`.  


Lorsqu'il est stocké ce template a exactement le même contenu que l'orginal : 

```bash
❯ chezmoi edit .ssh/id_rsa_home
# template is the same as the actual $HOME/.ssh/id_rsa_home
```
   
Il faut donc indiquer à `chezmoi` comment le récupérer de 1Password. Mais
encore avant il faut entreposer ce fichier sur 1Password, il faut un 
abonnement ce qui donne droit à un coffre-fort chez 1Password. 
   
En premier il faut donc se connecter

```bash         
❯ eval $(op signin my)
```

Puis il faut créer un document avec la commande `op` 

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

> _Bien évidement tous ces UUIDs ont été édité._

L'étape finale c'est de modifier les fichiers template. Étant donné qu'il y a 
aussi des fichiers binaire `vim` n'est pas particulièrement approprié pour les 
modifier, du coup je m'y prends autrement :
  
{% raw %}
```bash  
❯ chezmoi cd
❯ echo -n '{{- onepasswordDocument "ti2adie9Aixaidae4dahpoh5io" -}}' > private_dot_gnupg/private_id_rsa.tmpl
❯ echo -n '{{- onepasswordDocument "pairahnietaluv5Moonahm2ea5" -}}' > private_dot_gnupg/config.tmpl
❯ echo -n '{{- onepasswordDocument "zi8ieleiphieTithiep2xieg3u" -}}' > private_dot_gnupg/private_trustdb.gpg.tmpl
❯ echo -n '{{- onepasswordDocument "losachuYeeho5Eiph2uzoquohl" -}}' > private_dot_gnupg/private_pubring.kbx.tmpl
❯ exit
```
{% endraw %}

Donc même le contenu des fichiers binaires `.gnupg/trustdb.gpg` et `.gnupg/pubring.kbx`
sont remplacés par cette simple chaine de caractère `{{- onepasswordDocument "uuid" -}}`.

Pour le moment 1Password ne supporte pas la mise à jour de documents, il faut supprimer
l'ancien avec son UUID puis ré-utiliser la sous commande `create` avec la nouvelle 
version du fichier, et mettre à jour le template avec le nouvel UUID.


## Vérification des templates 

Vu qu'il s'agit de template créé manuellement, une erreur est toujours possible.
Autant vérifier le résultat de ces templates. Pour cela il faut appliquer
les _source_ sur un autre dossier _cible_.

```bash
❯ chezmoi apply --verbose --destination /Users/bric3/tmphome --dry-run
```

> Une chose à noter, la commande ici est _globale_, et toutes les commandes globales 
> qui ont besoin de 1Password vont demander à ce que la session 1Password en ligne 
> de commande soit active, elle peut donc avoir en prérequis l'exécution de 
> `eval $(op signin my)`.

Une fois près il suffit de retirer `--dry-run`, et de voir le dossier `tmphome` 
remplis (une fois la commande terminée car `chezmoi` applique les changements 
atomiquement).

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

Il est aussi possible de n'appliquer qu'une portion en spécifiant le chemin voulu
il faut en revanche le préciser avec un chemin absolu `/Users/bric3/tmphome/.gnupg/`.   

```bash
❯ chezmoi apply --verbose --destination /Users/bric3/tmphome /Users/bric3/tmphome/.gnupg/
```

Ce que nous voulions vérifier que le processing des templates donne exactement les même
fichier que les originaux.

```bash  
❯ b3sum /Users/bric3/tmphome/.gnupg/pubring.kbx /Users/bric3/.gnupg/pubring.kbx
1b51813215edef2e97846bfee51cd02dd8d6c2cb6a119b3681ac087597fb0197  /Users/bric3/tmphome/.gnupg/pubring.kbx
1b51813215edef2e97846bfee51cd02dd8d6c2cb6a119b3681ac087597fb0197  /Users/bric3/.gnupg/pubring.kbx
❯ b3sum /Users/bric3/tmphome/.gnupg/trustdb.gpg /Users/bric3/.gnupg/trustdb.gpg
d2c67bb808b223cc6f1b7c95b627b4b5551daa1312e12dd0ad3c5bfa1ac35dc9  /Users/bric3/tmphome/.gnupg/trustdb.gpg
d2c67bb808b223cc6f1b7c95b627b4b5551daa1312e12dd0ad3c5bfa1ac35dc9  /Users/bric3/.gnupg/trustdb.gpg
```

Looks good !

## Pour finir

`chezmoi` offre certaines fonctionnalités un peu plus engagées en particulier 
pour les templates des scripts de bootstrap/configuration. Étant donné que 
je n'utilise pas encore ça je le mets de côté. 

Maintenant la seule chose que j'aurais à faire pour me re-configurer un home
sera

```bash
❯ eval $(op signin my)
❯ chezmoi init --apply --verbose https://githost.tld/path/to/dotfiles.git
```

Également pour synchroniser les dotfiles depuis le repository _upstream_ :

```bash
❯ eval $(op signin my)
❯ chezmoi source pull -- --rebase && chezmoi diff
```

