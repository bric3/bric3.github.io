---
layout: post
title: Killing zookeeper instances on a local ensemble
date: 2016-10-25
published: false
tags:
- zookeeper
- cluster
- ensemble
author: Brice Dutheil
---

Zookeeper est un service de coordination distribuée. Son [usage](https://zookeeper.apache.org/doc/r3.4.9/recipes.html) permet notamment de maintenir des informations de configuration, de faire du service discovery, de fournir des mécasnimes distribués de concurrence (lock).

Bien qu'aujourd'hui d'autres logiciels plus pratiques et plus efficaces sont apparus, Zookeeper n'en reste pas moins une pièce maitresse de certains outils comme [Hadoop](http://hadoop.apache.org/) ou [Kafka](https://kafka.apache.org/documentation#quickstart_startserver).

## Comment zookeeper fonctionne ?

Zookeeper peut fonctionner avec une seule instance ou avec plusieur, dasn ce cas appelé _ensemble Zookeeper_. L'intérêt de Zookeeper est de fonctionner de manière distribué, une seul instance peut marcher, mais **il n'y a pas de continuité de service** si cette seule instance s'arrête.

Cet _ensemble_ d'instance Zookeeper vont donc partager un état. Lorsqu'un changement doit avoir lieu sur cet état, le changement n'est pas considéré comme terminé avec succès tant que le quorum de l'ensemble Zookeeper n'a pas été atteint. Ce qui veut dire **plus de la la moitié** des noeuds doivent acquitter l'écriture.

Comme il s'agit d'un système distribué il peut y avoir des raisons pour les quelles une instance Zookeeper n'est pas disponible (opération de maintenance, etc.). La règle de calcul pour établir le nombre d'instances nécéssaire pour qu'un ensemble supporte la perte d'un certain nombre de membre est :

```
( 2 x instance non disponible ) + 1
```

* Pour qu'un ensemble puisse supporter la perte de une instance, il faudra 3 serveurs.
* Pour qu'un ensemble puisse supporter la perte de deux instances, il faudra 5 serveurs.
* Pour qu'un ensemble puisse supporter la perte de trois instances, il faudra 7 server.

(À noter que plus il y a de noeuds plus le quorum [met longtemps à s'établir](http://zookeeper.apache.org/doc/r3.4.9/zookeeperOver.html#Performance) ; dans la majorité des cas un cluster de 3 ou 5 instances sera suffisant)

Cette formule conduit naturellement au fait que le nombre minimum nécéssaire pour un ensemble zookeeper sera toujours impair. Si le nombre de l'ensemble était pair, le quorum ne serait toujours atteint qu'avec plus de la moitié.

Exemple: Un cluster de 6 perds 2 instances, il en reste 4, le quorum peut être atteint. S'il en en perd 3, il reste 3 instances, le quorum ne peut pas être atteint.

Enfin un ensemble zookeeper choisit toujours un leader, ce leader est choisit également par quorum. Les autres instances sont des _suiveurs_ (follower). Toutes les écritures sont transferrée au leader. Les lectures peuvent en revanche être traitées par les autres instances.

Pour plus d'info j'invite à poursuivre sur le site de [zookeeper](https://zookeeper.apache.org/doc/trunk/zookeeperOver.html).

> À noter comme cet article n'utilise pas  le terme _noeud_ pour parler d'une _instance_ ou d'un _serveur_ Zookeeper, la raison est que le terme noeud (`node` donc) a une signification spéciale pour zookeeper. En effet un `node` correspond à un point dans [l'arborescence Zookeeper](https://zookeeper.apache.org/doc/r3.4.9/zookeeperOver.html#Nodes+and+ephemeral+nodes).

## Mise en pratique

Pour s'amuser un peu avec Zookeeper et ses collègues. Il est possible assez facilement de voir comment un ensemble zookeeper réagit à la perte de ses membres.

Cet exemple se base sur un ensemble de 5 instances. Qui est dans un premier temps en local.

### Configuration

Bien sûr après avoir téléchargé la distributon de zookeeper, il faut préparer quelques répertoires

```bash
mkdir -p ~/zktests/local/cluster
cd ~/zktests/local/cluster
wget http://www-eu.apache.org/dist/zookeeper/zookeeper-3.4.9/zookeeper-3.4.9.tar.gz
tar zxf zookeeper-3.4.9.tar.gz
```

Depuis ce dossier, il faut créer un fichier de configuration `zoo.template.cfg` qui servira de template pour toute les instances. Le texte à remplacer sera `{{peer}}` et `{{dataDir}}` :

```properties
server.1=localhost:28881:38881
server.2=localhost:28882:38882
server.3=localhost:28883:38883
server.4=localhost:28884:38884
server.5=localhost:28885:38885
syncLimit=5
initLimit=10
tickTime=2000
quorumListenOnAllIPs=true
clientPort=2181{{peer}}
autopurge.purgeInterval=24
dataDir={{dataDir}}
autopurge.snapRetainCount=10
```

Ces placeholders devront être remplacé par le numéro du membre zookeeper. Ensuite il faut créer la structure des répertoires de chaque membre ainsi que les fichiers correspondants :

* Donc les 5 fichiers ` zoo.$i.cfg` créés depuis `zoo.template.cfg` dans le répertoire courant (`~/zktests/local/cluster`)
* Ensuite créer les 5 dossiers `$i`, c'est là ou va être stockée les données de chaque instance (défini par la propriété `dataDir`)
* Créer le fichier `myid` dans chacun de ces dossiers, ce fichier contiendra l'identifiant du membre zookeeper (i.e. `$i`)

```bash
for i in {1..5}; do echo zk-$i; echo "zk-peer-$i config file"; cat zoo.template.cfg | sed -e "s|{{dataDir}}|$(pwd)/$i|g" -e "s|{{peer}}|$i|g" > zoo.$i.cfg; done
for i in {1..5}; do mkdir $i; done
for i in {1..5}; do echo $i > $i/myid; done
```

### Lancer l'ensemble

Une fois que tout est près, on peut lancer chaque instance de zookeeper. La commande suivante permet de lancer ces 5 instances depuis le répertoire en cours (`~/zktests/local/cluster`)

```bash
for i in {1..5}; do env ZOO_LOG_DIR=`pwd`/$i `pwd`/zookeeper-3.4.9/bin/zkServer.sh start `pwd`/zoo.$i.cfg; done
jps -v
```

`jps` montre que ces instances tournent, le nom du programme est `QuorumPeerMain`. Mais est-ce que le cluster fonctionne correctement ? Pour cela il faut interroger les membres en envoyant sur le le port client (`clientPort`), un [**mot à 4 lettres**](https://zookeeper.apache.org/doc/trunk/zookeeperAdmin.html#The+Four+Letter+Words) ; celui qui nous intéresse est le mot `stat`.

```bash
for i in {1..5}; do echo "\nzk peer $i\n---------"; echo stat | nc localhost 2181$i; done
```

Il devrait y avoir 5 blocs de statistiques, avec les modes de chaque noeud (follower ou leader).

### Stopper l'ensemble Zookeeper

Pour stopper correctement un ensemble il faut utiliser le script shell avec la commande `stop` la commande qui suit stoppe les 5 instances démarrées.

```bash
for i in {1..5}; do env ZOO_LOG_DIR=`pwd`/$i `pwd`/zookeeper-3.4.9/bin/zkServer.sh stop `pwd`/zoo.$i.cfg; done
```


## Supprimer le membre leader de l'ensemble Zookeeper

Sur cet ensemble Zookeeper bien portant, on voudrait donc jouer avec la perte d'une instance.

Pour monitorer les 5 noeuds en continue la commande suivante se base sur `watch`

```bash
watch --difference --color 'for i in {1..5}; do printf "\nzk peer $i\n"; echo stat | nc localhost 2181$i; done'
```

Une fois qu'on peut voir l'état de chaque noeud, on peut dans une console séparée, de préférence à coté.

### Stopper l'instance proprement avec le script `zkServer`

Il faut en premier trouver le leader (`mode : leader`), par exemple si le server `2` est le leader on devrait voir quelque chose de similaire à :

```
zk peer 2
Zookeeper version: 3.4.6-1569965, built on 02/20/2014 09:09 GMT
Clients:
 /0:0:0:0:0:0:0:1:64572[0](queued=0,recved=1,sent=0)

Latency min/avg/max: 0/0/0
Received: 202
Sent: 201
Connections: 1
Outstanding: 0
Zxid: 0x700000000
Mode: leader
Node count: 4
```

On peut stopper cette instance avec la commande suivante:

```bash
env ZOO_LOG_DIR=`pwd`/2 `pwd`/zookeeper-3.4.9/bin/zkServer.sh stop `pwd`/zoo.2.cfg
```

Une fois le leader supprimé, le cluster élit un nouveau leader parmis les membres restants.

En local l'élection est rapide. Le cluster n'est **indisponible** qu'un bref moment, mais il est quand même indisponible, sur réseau ce processus peut-être significativement plus long.

Maintenant supprimons un deuxième serveur, cet ensemble est constitué de cinq membre, la perte d'un autre membre est donc tolérée.
Après la réélection le nouveau leader est l'instance `5` :


```bash
env ZOO_LOG_DIR=`pwd`/5 `pwd`/zookeeper-3.4.9/bin/zkServer.sh stop `pwd`/zoo.5.cfg
```

Une fois encore la suppression d'un noeud montre une petite période d'indisponibilité de l'ensemble.


### Stopper l'instance avec `kill`

`kill` envoie le signal `TERM` (`15`), ce qui permet au processus de se terminer gracieusement.

Relancer tous les membres arretés, s'il s'agit des membres `2` et `5` il suffit de faire :

```bash
env ZOO_LOG_DIR=`pwd`/2 `pwd`/zookeeper-3.4.6/bin/zkServer.sh stop `pwd`/zoo.2.cfg
env ZOO_LOG_DIR=`pwd`/5 `pwd`/zookeeper-3.4.6/bin/zkServer.sh stop `pwd`/zoo.5.cfg
```

En adaptant le scénario, c'est à dire de trouver le leader, il fautdra trouver le _pid_ du processus zookeeper :

Si le leader est le membre `1`, alors son pid peut se trouver dans le dossier de donnée (`dataDir`) de zookeeper. Un fichier qui contient ce pid est stocké dans ce répertoire sous le nom `zookeeper_server.pid`, on peut changer ce dossier avec la variable d'environnement `ZOOPIDFILE`.

Donc pour terminer le process zookeeper :

```bash
kill $(< 1/zookeeper_server.pid)
```

De la même manière on peut observer que l'ensemble est indisponible un court moment tant qu'un nouveau leader n'est pas élu.

### Stopper l'instance avec `kill -9`

Même scénario qu'au dessus pour retrouver le pid mais cette fois on envoie le signal `KILL` (`9`) qui tue le processus sans lui permettre de terminer gracieusement. Si le leader est le membre `2`.

```bash
kill -KILL $(< 2/zookeeper_server.pid)
```

Encore une fois le cluster zookeeper tolère la perte brutale d'un noeud, mais demande un peu de temps pour élire un nouveau leader.


### Rendre l'ensemble indisponible

Il s'agit d'un cluster de 5 membres, celui-ci supporte la défaillance de 2 membres. Donc pour le rendre indisponible il faut éliminer un autre processus Zookeeper qu'il soit leader ou pas:

```bash
kill -KILL $(< 4/zookeeper_server.pid)
```

Les stat des deux noeuds restant affichent alors le message :

```
This ZooKeeper instance is not currently serving requests
```


## Wrap Up

Un ensemble Zookeeper est capable de se remettre de la perte de ces membres tant que le quorum peut-être atteint. Cependant la perte des membres introduit une fenêtre d'indisponibilité.
Qui plus est, les processus de cet ensemble utilise l'interface _loopback_ ; reproduire ces scénarios sur des machines différentes montrera que le réseau introduit des latences. Zookeeper n'aime pas du tout les latences (par exemple une instance qui a des problèmes peut ralentir considérablement le reste de l'ensemble Zookeeper pour le vote d'acquittement d'écriture ou pour élire un nouveau leader).

Ces considérations sont à prendre en compte lorsqu'une maintenance est à prévoir sur les machines qui hébergent ces processus.
