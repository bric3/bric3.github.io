---
authors: ["brice.dutheil"]
date: "2011-10-14T13:01:31Z"
meta:
  _edit_last: "1"
  _su_rich_snippet_type: none
  _syntaxhighlighter_encoded: "1"
  amazon-product-content-hook-override: "2"
  amazon-product-excerpt-hook-override: "3"
  amazon-product-newwindow: "3"
status: publish
tags:
- code
- jmx
- TDD
- test unitaire
slug: tester-votre-code-jmx-dans-des-conditions-pseudo-reelle
title: Tester votre code JMX dans des conditions pseudo réelle.
type: post
---
Vous devez écrire du code qui fait appel à JMX, en bon citoyen et bon développeur vous voulez tester ce code.

Première approche; vous enregistrez vos MBean sur un `MBeanServer`, disons celui de la plateforme (avec Java 6 : `ManagementFactory.getPlatformMBeanServer()`).

```java
mBeanServer.registerMBean(theMBean, theMBean.getObjectName());
```

Étant donné que `MBeanServer` étends `MBeanServerConnection` il est possible d’exécuter des querys, de faire des invocations sur les MBean etc. Si le code est suffisamment isolé des aspects techniques de connexion à JMX, vous passerez le `MBeanServer` en lieu et place de la `MBeanServerConnection`.

Supposons le code suivant.

```java
public class OperateOnJMXConnection implements JMXOperation {

    public void perform(MBeanServerConnection connection) {
        // doing some stuff there
    }

    public Result getResult() { return result; }
}
```

Pour tester ce code il faudrait alors écrire :

```java
@Test
public void do_not_fail() {
    operateOnJMXConnection.perform(mbeanServer);

    assertThat(result).satisfies(someCondition);
}
```

Mais voilà, vous restez en local, et par exemple si vous avez merdé sur la sérialisation de vos beans, vous ne verrez pas d'échec dans vos test et vous aurez une surprise en prod, ou avant si votre projet a un processus qualité décent.

Évidement il y a une solution, l'idée c'est de pouvoir se connecter au `mBeanServer` local à votre processus (typiquement dans maven 3, l’exécution de vos tests peuvent être forkée).

Alors j'ai essayé de récupérer les informations pour récupérer les informations de la VM qui tourne, mais bon on tombe dans des classes **sun**, j'ai préféré ne pas continuer sur ce chemin semé d'embûches, sans compter sur la faiblesse de cette approche.

Bref en relisant les articles de Khanh sur JMX, j'ai vu quelque chose d'intéressant `JMXConnectorServerFactory`. Cette classe permet donc de créer un `JMXConnectorServer` avec l'URL qu'on lui spécifie et d'un `MBeanServer`. A noter que cette URL doit respecter un certain formalisme tel que la javadoc l'indique : `service:jmx:*protocol*:*remainder*`.

Le protocole ne peut pas être n'importe quoi, il faut qu'il y ait le bon service enregistré pour qu'il soit géré. Dans notre cas RMI est standard, c'est donc le protocole que je prendrai. Pour le remainder, il s'agit plus d'une partie d'une URL, je vous laisse voir la Javadoc de `JMXServiceUrl` à ce sujet, mais dans les grandes lignes la forme doit être la suivante : `//[host[:port]][url-path]`

```java
JMXConnectorServer connectorServer = JMXConnectorServerFactory.newJMXConnectorServer(
    new JMXServiceURL("service:jmx:rmi://"),
    null,
    mBeanServer
);

connectorServer.start();
```

Hop dans le code précédent, on a créé puis démarrer notre `JMXConnectorServer`. Il n'y a plus qu'à se connecter dessus de manière standard :

Je vais utiliser `connectorServer.getJMXServer()` pour récupérer l'URL du service, il y a une raison à cela, c'est que comme l'indique la javadoc, l'URL passée pour la création du `JMXConnectorServer` peut être légèrement modifiée par celui-ci, il faut donc récupérer la nouvelle URL.</p>

```java
JMXConnector jmxConnetor = JMXConnectorFactory.connect(connectorServer.getJMXServiceUrl());
MBeanServerConnection connection = jmx.getgetMBeanServerConnection();
```

Et voilà vous avez accès à une `MBeanServerConnection`, qui vit dans la JVM locale, mais qui utilise RMI pour communiquer avec le `MBeanServer`, du coup vous êtes nettement plus proches des conditions du code de production et c'est ce qui nous intéresse dans cet article.

Pour référence les articles de Khanh, et en français s'il vous plait :) :

* [Partie 1 : Les concepts](http://jetoile.blogspot.com/2010/10/jmx-pour-les-nuls-les-concepts-partie-1.html)
* [Partie 2 : Les différents MBean](http://jetoile.blogspot.com/2010/11/jmx-pour-les-nuls-les-differents-mbeans.html)
* [Partie 3 : Les agents](http://jetoile.blogspot.com/2010/11/jmx-pour-les-nuls-les-agents-jmx-partie.html)
* [Partie 4 : Les classes de bases](http://jetoile.blogspot.com/2010/11/jmx-pour-les-nuls-les-classes-de-base.html)
* [Partie 5 : Le MBean server](http://jetoile.blogspot.com/2010/11/jmx-pour-les-nuls-le-mbean-server.html)
* [Partie 6 : Le chargement dynamique](http://jetoile.blogspot.com/2010/12/jmx-pour-les-nuls-chargement-dynamique.html)
* [Partie 7 : Les services JMX](http://jetoile.blogspot.com/2010/12/jmx-pour-les-nuls-les-services-jmx.html)
* [Partie 8 : Les connecteurs](http://jetoile.blogspot.com/2010/12/jmx-pour-les-nuls-les-connecteurs.html)

Quelques liens javadoc :


* [`JMXConnectorFactory`](http://download.oracle.com/javase/6/docs/api/javax/management/remote/JMXConnectorFactory.html)
* [`JMXConnectorServerFactory`](http://download.oracle.com/javase/6/docs/api/javax/management/remote/JMXConnectorServerFactory.html)
* [`JMXServiceURL`](http://download.oracle.com/javase/6/docs/api/javax/management/remote/JMXServiceURL.html)
* [`JMXConnectorServer`](http://download.oracle.com/javase/6/docs/api/javax/management/remote/JMXConnectorServer.html)

Enfin je me suis créé une petite classe de commodité qui permet de créé facilement un loopback pour les TU :
