---
authors: ["brice.dutheil"]
categories: null
date: "2015-11-06T22:33:53Z"
meta:
  _edit_last: "1"
  _oembed_88a7b9e5fa58f4ba4da51144dbc06c2c: '{{unknown}}'
  _oembed_634d9c27589adc20bd27321e026a3b4f: '{{unknown}}'
  _su_rich_snippet_type: none
published: true
status: publish
tags:
- prod
- tips
- entropie
- entropy
- firewall
- jdbc
- keepalive
- oracle
- random
title: Problème de connexion à Oracle
type: post
---


Deux problèmes assez courant peuvent survenir sur les connexions à une base de donnée Oracle. Ces problèmes peuvent
être à l’origine de timeout sur les connexions HTTP, etc…

Ces deux problèmes touchent deux choses totalement différente, l’entropie du système et la coupure de connexion par
un firewall.

# Manque d'Entropie

Pourquoi l’entropie ? L’entropie est une mesure de l’incertitude d’un message par rapport à celui qui le précède.
Sur un système POSIX c’est `/dev/random` qui est mesuré avec l’entropie. La JVM utilise ce device
pour la génération de nombres aléatoires avec la classe `SecureRandom` qui est souvent utilisé pour des fonctions
_cryptographique_.

Le driver Oracle 11g _(probablement dans les versions précédentes aussi)_ établit un lien sécurisé avec la base donnée
pour protéger les échanges de credentials lors de l'initialisation d'une nouvelle connexion.

Le problème vient du fait que la lecture dans `/dev/random` est bloquante tant que le système (Linux, BSD, etc.)
considère qu’il n’y a pas assez d’entropie. Heureusement en bon lecteur de la javadoc il y a une note
sur `SecureRandom` pour nous aider à résoudre le problème.

> Note: Depending on the implementation, the generateSeed and nextBytes methods may block as entropy is being gathered,
> for example, if they need to read from /dev/random on various unix-like operating systems.

## La solution

Java permet de changer la source du random avec la propriété `java.security.egd` (egd = entropy gathering device).
Sur les systèmes UNIX il y a deux devices:

* `/dev/random` Source **bloquante** de nombres aléatoires
* `/dev/urandom` Source **non-bloquante** de nombre aléatoires

Sur la ligne de commande ça se passe comme ça :

```
-Djava.security.egd=file:/dev/./urandom
```

Ainsi si en choisissant le device `/dev/urandom` on aurait résolu le problème d'entropie. Pas si vite !

Les deux sources [`/dev/random`](http://linux.die.net/man/4/random) et
[`/dev/urandom`](http://linux.die.net/man/4/urandom) utilisent le même mécanisme, basé sur un CSPRNG (cryptographic
pseudo-random number generator), la différence étant que `/dev/urandom` peut fournir des nombres avec une entropie
moins élevée afin de ne pas être bloquant.

![Entropy](http://www.2uo.de/myths-about-urandom/structure-yes.png)
_Source : [http://www.2uo.de/myths-about-urandom/](http://www.2uo.de/myths-about-urandom/)_

> A read from the /dev/urandom device will not block waiting for more entropy. As a result, if there is not sufficient
> entropy in the entropy pool, the returned values are theoretically vulnerable to a cryptographic attack on the
> algorithms used by the driver. Knowledge of how to do this is not available in the current unclassified literature,
> but it is theoretically possible that such an attack may exist. If this is a concern in your application,
> use /dev/random instead.

Quoiqu'il en soit ce n'est pas sensé être un soucis pour l'établissement de connexions SSH ou à la base de donnée.
Pour la génération de clef SSH c'est une autre histoire.

-----------------------
D'après la page `man` le scénario catastrophe, **si un attaquant a accès à la machine**, serait que celui-ci arrive
à connaitre ou à déterminer quel seraient les prochains nombres qui sortiront de `/dev/urandom`, donc de `SecureRandom`,
et ainsi de reconstruire les éléments cryptographiques tel que des clés privées.

Dans les faits ce scénario est très peu probable.
-----------------------

> If you are unsure about whether you should use /dev/random or /dev/urandom, then probably you want to use the latter.
> As a general rule, /dev/urandom should be used for everything except long-lived GPG/SSL/SSH keys.

En revanche sur des serveurs fortement chargés et parceque cette modification touche la JVM, On peut vouloir entretenir
le niveau d'entropie.

## Ajouter de l'entropie

Les OS alimentent `/dev/random` généralement à partir de plusieurs sources, comme :

* les sondes de température,
* l’activité du CPU,
* le trafic réseau,

De retour au problème initial, suivant les aléas de ces sources l'OS sera capable de maintenir une bonne entropie,
sinon il _bloque_ la lecture de `/dev/random` tant qu'il n'y a pas assez d'entropie (selon les euils configuré de l'OS).
En utilisant `/dev/urandom` l'entropie est potentiellement moins bonne.

Pour celà **l’idée est donc d’aider l’OS à entretenir l'entropie**, plusieurs solutions existent, soit hardware soit
software. Mais l'idée maître est que ces solutions _contribuent_ leur entropie.

Coté logiciel, les _démons_ suivant peuvent être mis en place
* Haveged
* Frandom
* rng-tools

**HAVEGED** utilise comme _source_ les états des composants internes des processeurs modernes pour augmenter
significativement l’entropie du système.
À noter : il tourne dans le user space donc assez facile à installer.

Passons au deuxième soucis : les coupures de connexions.

# Coupure de connexion par le Firewall

Suivant les infras, en fonction des besoins de légalité, il faut protéger les bases de données par un firewall.
Ce firewall va inspecter et protéger les équipements derrière mais il fait aussi de _l’assainissement de connexions
TCP_, c'est-à-dire qu'il va couper les connexions inactives au bout d’un certain temps.

## Le pool de connexion

De manière générale un serveur d'application est configuré avec une `DataSource` pour faire du connexion pooling ;
en effet la création d'une connexion est cher et augmente le temps de latence du service, le but du pool est donc
de partager les connexions une fois que celles-ci ne sont plus utilisées. En revanche quand le pool donne une
connexion il ne sait pas forcement qu’elle à été fermé par un composant tierce (un firewall).
Heureusement la plupart des pools implémente un mécanisme de vérification qui peut s'effectuer à différentes étapes
de l'utilsation de la connexion.

Pour traiter ce problème de coupure de connexion par le firewall il faudra activer les bonnes options
au niveau du pool, par exemple afin de vérifier les connexions régulièrement avec `tomcat-jdbc` :

* `minEvictableIdleTimeMillis` : The minimum amount of time an object may sit idle in the pool before it is
  eligible for eviction. The default value is 60000 (60 seconds).
* `timeBetweenEvictionRunsMillis` : The number of milliseconds to sleep between runs of the idle connection
  validation/cleaner thread. This value should not be set under 1 second. It dictates how often we check for
  idle, abandoned connections, and how often we validate idle connections. The default value is `5000` (5 seconds).

Ci-dessous un exemple de déclaration de `DataSource`, paramètres qui devront bien sûr être adpatés à votre instrastructure.

```xml
<Resource name="Locator"
      type="javax.sql.DataSource"
      factory="org.apache.tomcat.jdbc.pool.DataSourceFactory"
      testOnBorrow="true" driverClassName="oracle.jdbc.OracleDriver"
      validationInterval="30000"
      validationQuery="SELECT 1 FROM DUAL"
      ...
      timeBetweenEvictionRunsMillis="30000"
      minEvictableIdleTimeMillis="60000"
      url="jdbc:oracle:thin:@..."
      ...
      >
</Resource>
```

Il y a plusieurs implémentations de pool, ceux-ci ont un fonctionnement plus ou moins abouti et donc offrent
une configuration plus ou moins fine voire différente (ex: HirakiCP). Il faudra donc consulter la documentation
des options pour corriger le problème.

**Quoiqu’il en soit cette option n’est pas optimale car elle ne traite pas le problème de rupture de connexion à sa source.**

## TCP Keepalive

**TCP**, le protocole réseau sur lequel transite la connexion oracle, fourni un mécanisme de keepalive.
Ce mécanisme va envoyer un paquet sur la connexion pour que les équipements de l’infrastructure réseau dont le fameux
firewall maintiennent cette connexion ouverte.

Dans l'univers Java il faut passer la bonne option à l’ouverture de la socket
[`SopcketOptions.SO_KEEPALIVE`](http://docs.oracle.com/javase/7/docs/api/java/net/SocketOptions.html#SO_KEEPALIVE).
La plupart des drivers, frameworks exposent une API pour activer cette option. Il en est de même avec le driver
JDBC Oracle.

D’après la [documentation Oracle](http://docs.oracle.com/cd/E11882_01/java.112/e16548/apxtblsh.htm#JJDBC28984) il y a
plusieurs moyens de configurer le driver JDBC pour travailler avec un firewall.

Dans le cas d’une configuration style `TNSNAMES` il faudra utiliser la chaine suivante `ENABLE=BROKEN` pour activer
le keepalive. Par exemple :

```
jdbc:oracle:thin:@(DESCRIPTION=(ENABLE=BROKEN)(ADDRESS=(PROTOCOL=tcp)(PORT=1521)(HOST=myhost))(CONNECT_DATA=(SID=orcl)))
```

Dans le cas d’une configuration sans `TNSNAMES` il faut passer la propriété `oracle.net.keepAlive` à `true`
programmatiquement via les properties passée à l’API JDBC
`java.sql.DriverManager#getConnection(java.lang.String, java.util.Properties)`. Attention à la casse des caractères!
Les propriété non documentées du driver sont disponible sur la javadoc de [`oracle.jdbc.OracleConnection`](http://download.oracle.com/otn_hosted_doc/jdeveloper/905/jdbc-javadoc/index.html?constant-values.html)

Enfin, dans tout les cas il faut aussi configurer le keepalive sur l’OS
Sur Linux par exemple, la [documentation](http://tldp.org/HOWTO/TCP-Keepalive-HOWTO/usingkeepalive.html) indique
comment il faut faire our les configurer. Et pour vérifier qu’il correspondent aux valeurs souhaitées :

```sh
$ cat /proc/sys/net/ipv4/tcp_keepalive_time
2400
$ cat /proc/sys/net/ipv4/tcp_keepalive_intvl
75
$ cat /proc/sys/net/ipv4/tcp_keepalive_probes
6
```

Ces paramètres disent :

* la pile TCP enverra la première sonde (premier paquet de keepalive) au bout de **`40min`**,
* attendra **`75`** millisecondes avant de renvoyer une sonde
* dans la limite de **`6`** essais.
* Si aucun pacquet `ACK` n’est reçu alors la connexion est reconnue par l’OS comme fermée.

Il faut régler ces paramètres en accord avec les réglages des équipements réseau qui constitue l'infrastructure.

À noter que la documention indique bien que le **keepalive** est un comportement à activer volontairement,
d’ou la présence de l’option `SopcketOptions.SO_KEEPALIVE` dans le JDK.

> Remember that keepalive support, even if configured in the kernel, is not the default behavior in Linux. Programs must request keepalive control for their sockets using the setsockopt interface.
