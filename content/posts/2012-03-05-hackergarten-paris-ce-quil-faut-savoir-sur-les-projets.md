---
authors: ["brice.dutheil"]
date: "2012-03-05T01:54:28Z"
disqus_identifier: 337 http://blog.arkey.fr/?p=337
meta:
  _edit_last: "1"
  _su_rich_snippet_type: none
  _syntaxhighlighter_encoded: "1"
published: true
status: publish
tags:
- code
- hibernate
- infinitest
- jenkins
- maven
- mockito
- open source
slug: hackergarten-paris-ce-quil-faut-savoir-sur-les-projets
title: Hackergarten Paris - ce qu'il faut savoir sur les projets
type: post
---
Hello à tous,

![Hackergarten Logo BW](/assets/hackergarten_b_and_w_small.png)
**Mercredi 7 mars** (à 19h) aura lieu la 2ème session Hackergarten. Après **Soat**, on a le plaisir d'être hébergé par **Valtech** (103 Rue de Grenelle, 75007 Paris) et il y aura des **pizzas**, gros merci à eux.

> Hackergarten c'est le rendez-vous des gens qui veulent participer aux projets opensource. L'idée c'est, dans un format de 3h, de **contribuer** un **logiciel**, un **fix**, un **feature**, une **documentation** dont d'autres pourraient avoir l'usage. Il s'articule autour de commiters actifs pour mentorer les hackers qui participent à l'évènement.

Bref que du bon. Pour la planification de l'évènement c'est par là ⇒ [http://hackergarten-paris.eventbrite.com/](http://hackergarten-paris.eventbrite.com/)

Alors pour éviter les soucis de setup le jour J, ce post donne quelques informations sur ce qu'il y aurait à récupérer ou faire en avance sur votre machine. Si vous avez des questions ou si vous voulez participez aux discussions : inscrivez vous sur la mailing-list à cette adresse ⇒ [http://groups.google.com/group/hackergarten-paris/](http://groups.google.com/group/hackergarten-paris/)

## Hibernate OGM / Hibernate Search ⇐ mentoré par Emmanuel Bernard

* IDE : **IntelliJ** mais **Eclipse** fait l'affaire
* Pour builder : **Maven 3.0.3**
* JDK 1.6 recommandé
* changer les `~/.m2/settings.xml` selon [le wiki jboss](https://community.jboss.org/wiki/MavenGettingStarted-Users)
* **Installer Cassandra 1.0.8 (download sur Apache)**

Et pour les motivés NoSQL, installer votre moteur préféré aussi histoire de contribuer un dialect pour Hibernate OGM
Forker + cloner localement

- `git clone https://github.com/hibernate/hibernate-search`
- `git clone https://github.com/hibernate/hibernate-ogm`
- `git clone https://code.google.com/a/apache-extras.org/p/cassandra-jdbc/`

Lancer **mvn clean install** sous chacun des clones pour être sûr que Maven télécharge bien la terre.

## Maven / Jenkins ⇐ mentoré par Arnaud Héritier

* IDE : Pour Maven & Jenkins : IntelliJ ou eclipse + m2e versions recentes si possibles

* **Git** pour **Jenkins**, **SVN** pour **Maven**

* Pour builder :  **Maven** 2.2.1 min, 3.0.x serait un mieux

(De memoire pas de settings additionnels pour seulement builder)

* Jenkins :

    **EDIT** : Il faut modifier son `settings.xml`, voir : [https://wiki.jenkins-ci.org/display/JENKINS/Plugin+tutorial](https://wiki.jenkins-ci.org/display/JENKINS/Plugin+tutorial)

    Arnaud me dit à l'oreille que suite à des changements chez Oracle il faut ajouter ce miroir dans le `settings.xml`.

```xml
<mirror>
    <id>repo.jenkins-ci.org</id>
    <url>http://repo.jenkins-ci.org/public/</url>
    <mirrorOf>m.g.o-public</mirrorOf>
</mirror>
```

* Checkout du plugin qui vous interesse puis `mvn clean install hpi:run`

* Maven :
    Checkout du plugin qui vous interesse puis `mvn clean install -Prun-its`


## Infinitest ⇐ mentoré par David Gageot

* IDE : **Eclipse** mais **IntelliJ** fait l'affaire

    Utiliser **mvn eclipse:eclipse** plutot que **m2eclipse**

* Pour builder : Maven 3.0.3

* JDK 1.6 recommandé

* Forker + cloner localement https://github.com/infinitest/infinitest

* Lancer **mvn dependency:go-offline** pour récupérer toutes les dépendances

## Mockito ⇐ mentoré par Brice Dutheil

* IDE : **IntelliJ** en particulier, la **version Community** suffira. Eclipse peut faire l'affaire. Attention on a eu des soucis avec Netbeans la dernière fois.

* Pour Builder : **Ant** (IntelliJ contient un Ant)

* JDK 5 préféré, mais pas obligatoire.
* Forker et cloner localement depuis Google code : [http://code.google.com/p/mockito/source/checkout](http://code.google.com/p/mockito/source/checkout)

Attention ici c'est du **mercurial**.
Il n'y a plus qu'à ouvrir les fichiers du projet.

## FluentLenium ⇐ mentoré par Mathilde Lemée

* IDE : Un IDE qui gère maven, genre IntelliJ.

* Pour Builder : Maven

Checkout depuis : [https://github.com/FluentLenium/FluentLenium](https://github.com/FluentLenium/FluentLenium)

## Votre projet

Et oui si vous avez une idée à coder en Open Source et que vous cherchez des intéressés c'est peut-être l'endroit pour en parler et dresser un plan :)

## 1000 mercis

Gros merci à tous ceux qui participent aux Hackergarten Paris

* Arnaud Héritier
* Guillaume Laforge
* Emmanuel Bernard
* David Gageot
* Eric Lefevre
* Mathilde Lemée
* Et vous tous qui venez

Gros merci aussi à ceux qui hébergent l'évènement, c'est bien sympa :


* Soat
* Valtech

Évidement merci à **Hamlet D'Harcy** pour avoir initier l'idée là bas en Suisse :)
