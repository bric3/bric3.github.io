---
authors: ["brice.dutheil"]
date: "2012-07-30T00:00:00Z"
disqus_identifier: 274 http://blog.arkey.fr/?p=274
published: true
status: publish
tags:
- code
- j2se 5.0
- java5
- jdk5
- lion
- macosx
- mountain lion
title: Script d'installation du JDK 5 sur MacOSX Lion et Mountain Lion (Mis à jour)
type: post
---
**MAJ 14/06/2016**: La dernière version du script est maintenant sur un [repository github dédié](https://github.com/bric3/osx-jdk5-installer).

--------------------------------------------------
**MAJ 29/07/2012**: Le script a été mis à jour pour fonctionner avec Mac OS X Mountain Lion. Le script a été mis à jour pour télécharger lui même le DMG chez Apple, en bref il n'y a plus qu'à commencer à l'étape 2.

[!JDK 5 installation on Mountain Lion]({{ site.baseurl }}/assets/jdk5_install_mountain_lion.png)

--------------------------------------------------
**Original 22/08/2011** : Avec l'arrivée de Lion, Apple change les choses avec Java. Heureusement s'il s'agit d'une mise à jour depuis Snow Leopard, vous ne perdrez pas votre runtime JDK 6, en revanche si vous faites une installation clean, et bien il faudra télécharger le runtime ici :

> [http://support.apple.com/kb/DL1421](http://support.apple.com/kb/DL1421)

Bon ça fait une chose de plus pour nous ennuyer, mais bon comme toujours pour ceux qui veulent bosser sur un JDK 1.5, il vous faudra tricher un peu plus, il n'y a pas de mise à jour standard ou facile pour installer le JDK 5 sur 10.7.

Certains ont trouvé l'astuce en téléchargeant la mise à jour Java pour Mac OS X 10.5, et avec quelques outils et commandes dans le terminal. Cela dit le processus est un poil long. Du coup je me suis codé un petit script pour automatiser ces étapes. Pour l'instant le script repose sur un téléchargement manuel de cette mise à jour.


1. En premier on télécharge la mise à jour du JDK5 ici :

    > [http://support.apple.com/kb/DL1359](http://support.apple.com/kb/DL1359)

2. Ensuite dans le même répertoire on y téléchargera le **[script](https://raw.githubusercontent.com/bric3/osx-jdk5-installer/master/install_jdk5_post_lion.sh)**

3. Dans un terminal dans le dossier du téléchargement

    ```sh
    chmod +x install_jdk5_lion.sh
    ```

4. Il faut être **root**, attention quand même, le script fonctionne sur les environnements Lion que j'ai pu testé, mais il peut très bien casser votre système, déclencher un tempête ou je ne sais quoi encore... je ne garantis rien.

    ```sh
    sudo -s
    ```
5. Bref il se lance comme ça :

    ```sh
    ./install_jdk5_lion.sh
    ```

6. Si tout se passe bien alors, les préférences Java de Mac s'ouvriront en listant le JDK 5.

7. exit

En images, ça donne :

![jdk5_lion_install_terminal]({{ site.baseurl }}/assets/jdk5_lion_install_terminal.png)

![lion_java_preferences]({{ site.baseurl }}/assets/lion_java_preferences.png)

Évidement si vous repérez une coquille, je suis à l'écoute. Bonne soirée :)

**EDIT 29/08/2011**: Tant qu'à faire, autant montrer comment avoir plusieurs JDK dans IntelliJ sous macosx.

1. Donc une fois le projet ouvert, il faut aller dans les préférences du projet (Project Settings).

    ![IntelliJ Project Setting]({{ site.baseurl }}/assets/project_setting-e1314642274278.png)

2. Ensuite ajouter le JSDK.

    ![Add New JSDK]({{ site.baseurl }}/assets/add_new_jsdk.png)

3. Puis sélectionner dans l'explorateur le dossier `/System/Library/Java/JavaVirtualMachines/1.5.0/Contents/Home`

    ![Choose JDK 5 Home]({{ site.baseurl }}/assets/choose_jdk5_home-e1314642723756.png)

4. Hop, c'est fini, dans IntelliJ vous avez le JDK 5

    ![IntelliJ found it]({{ site.baseurl }}/assets/intellij_found_it-e1314642860664.png)

Idée originale : [Zend Studio *5*.x for OS X *Lion* (*Java* SE 6)](http://www.s-seven.net/zend_5x_lion)

{% gist 1163008 %}
