---
authors: ["brice.dutheil"]
date: "2016-12-05T00:00:00Z"
tags:
- ssh
- docker
- docker for mac
- tunnel
- host
- cassandra
- cqlsh
- mac
- osx
slug: make-docker-container-access-host-ssh-tunnel
title: Connecter un container docker sur un tunnel ssh OSX
---

J'utilise Cassandra depuis un moment déjà et avec une version 2.1.13 en production je garde donc la même version
sur mon poste. Hors `cqlsh` ne fonctionne plus correctement lorsque python est à la version 2.11 ou plus, voir le ticket [CASSANDRA-11850](https://issues.apache.org/jira/browse/CASSANDRA-11850). Fixé en version 2.1.16 ou 3.0.10, il faut que
j'utilise cette version, ou que j'utilise le moyen alternatif documenté dans ce ticket, qui consiste en installant
le driver et `cqlsh` avec `pip`. Mais cette approche a d'autres problèmes.

{{< fas fa-lightbulb >}} Idée utiliser les images docker officielles de cassandra.

> Disclaimer : J'utilise OSX 10.11 et Docker for Mac 1.12

### Première approche

```bash
# Création du pont SSH port 29042
ssh -Nf platform-cassandra-1
# CQLSH dans le container
docker run -it --net=host --rm cassandra:3.0.10 cqlsh -u db_user localhost 29042
```

Mais ça ne marche pas. En effet le mode `host` n'est pas géré avec Docker for Mac car la pile réseau est différente sur
OSX. C'est même documenté sur la page [networking](https://docs.docker.com/docker-for-mac/networking/) de Docker for Mac.
Dans cette situation, l'application du conteneur essaye de se connecter sur le container même (`localhost`) et non sur
le host ; morale l'option `--net=host` ne sert à rien sur OSX.

### Deuxième approche

En revanche en bon lecteur de documentation, je remarque le petit paragraphe
[_use cases and workarounds_](https://docs.docker.com/docker-for-mac/networking/#use-cases-and-workarounds), dans
lequel est indiqué une procédure intéréssante pour ce cas.

L'idée c'est d'ajouter une IP sur l'interface réseau de loopback. Par défaut sur mac `lo0` écoute sur les IPs locales
qu'on connait bien, `127.0.0.1` :

```sh
> ifconfig lo0
lo0: flags=8049<UP,LOOPBACK,RUNNING,MULTICAST> mtu 16384
	options=3<RXCSUM,TXCSUM>
	inet6 ::1 prefixlen 128
	inet 127.0.0.1 netmask 0xff000000
	inet6 fe80::1%lo0 prefixlen 64 scopeid 0x1
	nd6 options=1<PERFORMNUD>
```

Pour ajouter la nouvelle IP il faut utiliser la sous-commande `alias`


```sh
> sudo ifconfig lo0 alias 192.168.49.49
> ifconfig lo0
lo0: flags=8049<UP,LOOPBACK,RUNNING,MULTICAST> mtu 16384
	options=3<RXCSUM,TXCSUM>
	inet6 ::1 prefixlen 128
	inet 127.0.0.1 netmask 0xff000000
	inet6 fe80::1%lo0 prefixlen 64 scopeid 0x1
	inet 192.168.49.49 netmask 0xffffff00
	nd6 options=1<PERFORMNUD>
```

Ensuite une autre chose importante qui est écrit dans la documentation : le service du host doit écouter sur `0.0.0.0`.
Hors ma config SSH ne contient que le minimum et par défaut SSH utilise localhost comme bind_address.

```
Host platform-cassandra-1
   LocalForward 29042 10.100.100.100:9042
```

Rien de plus facile, il faut juste déclarer le wildcard devant le port local :

```
Host platform-cassandra-1
   LocalForward 0.0.0.0:29042 10.100.100.100:9042
```

Ensuite il possible de se connecter avec le container docker sur le pont ssh établis par le host.


```sh
> docker run -it --rm cassandra:3.0.10 cqlsh -u db_user 192.168.49.49 29042
Password:
Connected to Platform  Cluster at 192.168.49.49:29042.
[cqlsh 5.0.1 | Cassandra 3.0.10.1443 | CQL spec 3.4.0 | Native protocol v4]
Use HELP for help.
cassandra@cqlsh> use some_keyspace;
cassandra@cqlsh:some_keyspace> exit
```

### Mise en garde

* En établissant le pont sur `0.0.0.0`, l'accès au tunnel SSH est effectivement ouvert à tout le monde.

  Solution : déclarer un deuxième tunnel dans la config SSH:

  ```
  Host platform-cassandra-1
     LocalForward               29042 10.100.100.100:9042
     LocalForward 192.168.49.49:29042 10.100.100.100:9042
  ```

  De cette façon le pont est accessible sur les deux couples `locoalhost:29042` et `192.168.49.49:29042`, mais pas au
  reste du monde.

* L'IP _alias_ de l'interface loopback, ne doit pas être en conflit avec une autre IP. `192.168.49.49` pourrait être une
  addresse routée suivant le réseau auquel la machine est connectée.

  À noter qu'après usage il peut-être intéressant de retirer l'alias :

  ```sh
  sudo ifconfig lo0 -alias 192.168.49.49
  ```

  De manière plus pérenne il pourrait être judicieux de prendre une IP spéciale (non routée) telle que
  [`203.0.113.0`](http://www.iana.org/assignments/ipv4-address-space/ipv4-address-space.xhtml#note12)
  qui est réservée pour les tests ou la documentation. **Attention à n'utiliser que sur son poste, en local**.
