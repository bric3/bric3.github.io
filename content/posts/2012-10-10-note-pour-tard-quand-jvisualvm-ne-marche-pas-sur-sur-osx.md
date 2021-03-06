---
authors: ["brice.dutheil"]
categories: null
date: "2012-10-10T12:25:57Z"
meta:
  _edit_last: "1"
  _su_rich_snippet_type: none
published: true
status: publish
tags:
- tips
- heap dump
- instrumentation
- jdk7
- jmap
- jmx
- jstack
- jvisualvm
- macosx
- mountain lion
- thread dump
- visualvm
slug: note-pour-tard-quand-jvisualvm-ne-marche-pas-sur-sur-osx
title: 'Note pour plus tard: Problème avec jVisualVM sur OSX'
type: post
---
Au cour d'un petit development, j'ai remarqué que mon process ne se terminait pas, une fois l'exécution de mon code
terminé. Il devait y avoir soit une thread qui tournait encore, soit un deadlock quelque part, j'optais plus pour
la seconde option.

Du coup je lance `jvisualvm` depuis mon terminal (celui du JDK7 update 7). Là j'ai la liste des process java qui
tournent malheureusement quand je choisi d'investiguer ce process, `jvisualvm` me rapporte sur le terminal :

```sh
attach: task_for_pid(7234) failed (5)
```

L'onglet du process s'ouvre bien dans `jvisualvm` mais impossible monitorer les threads ni faire de heap dump
(au cas ou ça m'intéresserai), d'ailleurs ces sous-onglets ne sont même pas affichés.

La solution: passer avant au process java qu'il faut monitorer les paramètres suivants (en fonction des besoins)


* `-Xverify:none` : Désactive la vérification du bytecode dans la JVM. De base la JVM s'assure que le bytecode
  vérifie certaines règles. Bref il faut activer ce flag si vous voulez faire des thread dump ou des heap dump.
  Il s'agit probablement d'un bug du JDK7 ou de jVisualVM sur OSX.
* `-Xshare:off` : Comme son nom l'indique il s'agit de partager de la mémoire, dans les faits ça se traduit par le
  partage des classes déjà chargé. Sur mac cette option est active par défaut. A priori cette option pose problème
  pour l'attachement à un process Java, du coup en isolant la mémoire du process on peut s'en sortir.
* `-Dcom.sun.management.jmxremote` : Active l'export des MBean de la JVM, si vous voulez les monitorer

On dirait une réapparition dans le JDK7u7 d'un bug a priori déjà clos dans le JDK6 (pour OSX). A noter que les
outils en ligne de commade tel que `jmap` peuvent aussi être affectés.

Bien entendu si j'ai loupé un truc je suis tout ouïe.

Référence : [VISUALVM-326](http://java.net/jira/browse/VISUALVM-326)
