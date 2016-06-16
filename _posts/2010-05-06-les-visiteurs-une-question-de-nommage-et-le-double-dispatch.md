---
layout: post
title: Les visiteurs, une question de nommage, et le double-dispatch
date: 2010-05-06 16:02:10.000000000 +02:00
type: post
published: true
status: publish
tags:
- code
- design
- pattern
meta:
  _syntaxhighlighter_encoded: '1'
  _su_rich_snippet_type: none
  _edit_last: '1'
author: Brice Dutheil
---
# Une histoire qui commence mal

OK, je tranche le malheureux pattern Visiteur a la vie dure; on ne l'aime pas trop, il est mal compris, et le pauvre est sous utilisé. Alors bon même s'il a ses défauts, pourquoi lui en vouloir autant, alors qu'il apporte justement ses avantages au **code orienté objet**.

Et oui vous avez bien lu orienté objet. Jusqu'à aujourd'hui j'ai vu du code qui ressemble à ça?


* On a soit des objets très complexes, avec des comportements qu'il n'est pas forcément intéressant de mettre dans l'objet même. Le code ci-dessous montre un objet ou les méthodes qui permettent de récupérer les livres d'un certain genre ne sont pas forcément appropriées dans cette partie du code. Pourquoi parce qu'il est envisageable (selon le bon sens) que d'autres genres serait apprécié. Et s'il faut ajouter d'autres méthodes encore.

```java
public class FatObject {
  private Iterable<book> books;

  public Iterable<Book> selectOnlySciFi() { ... }
  public Iterable<Book> selectOnlyThriller() { ... }
  public Iterable<Book> selectOnlyDetectiveStory() { ... }
  public Iterable<Book> selectOnlyRomance() { ... }
  public Iterable<Book> selectOnlyManga() { ... }
}
```

* Ou alors on a des objets anémiques (cf [Martin Fowler](http://www.martinfowler.com/bliki/AnemicDomainModel.html)) et le comportement est bien en dehors des objets traités, mais, et c'est la ça pèche, le comportement est délocalisé dans des helpers. Bref en gros c'est de la programmation procédurale, ce sont des structures qui sont manipulées par des fonctions, c'est du C avec des espaces de nommage (les classes `Helper.java`). La programmation objet en prends un coup, pas étonnant que les principes objets ne marchent pas dans ce contexte, mais je diverge. Bref on a du code qui ressemble à ce qui suit. Un objet anémique qui ne fait rien. Au mieux il aura probablement les méthodes `equals` et `hashCode` et peut-être un `toString`.

```java
public class AnemicObject {
private Iterable<Book> books;
  public void setBooks(Iterable<Book> books) { this.books = books; }
  public Iterable<Book> getBooks() { return books; }
  @Override public boolean equals(Object o) { ... }
  @Override public int hashCode() { ... }
}
```

Et le démoniaque helper :

```java
public class Helper {
  public void iDoSomethingWith(AnemicObject anemicObject) { ... }
  public Price iExtractTotalPriceFrom(AnemicObject anemicObject) { ... }
  public Iterable<Book> getSciFiBooks(AnemicObject anemicObject) { ... }
  public Iterable<Book> getDetectiveStoryBooks(AnemicObject anemicObject) { ... }
}
```



Comme vous le voyez les deux exemples ci-dessus ne sont pas vraiment élégants, même si je préfère la première voie. A long terme ce n'est probablement pas une bonne idée. J'aimerais d'ailleurs avoir l'avis des gens du [](http://fr.wikipedia.org/wiki/Conception_pilot%C3%A9e_par_le_domaine"><acronym title="Domain Driven Design)?

Et c'est là que notre ami le visiteur va nous aider.

# Pourquoi le visiteur nous aide, qu'apporte-t-il ?

Bonne question, ce pattern est souvent incompris, et pour cause, il ne porte pas un nom qui lui facilite la vie.

Et oui pour le coup un **visiteur n'est pas fait pour visiter**. Page 387 de la traduction française du livre Design Patterns (par le GoF), nous pouvons lire :

> Le visiteur fait la représentation d'une opération applicable aux éléments d'une structure d'objet. **Il permet de définir une nouvelle opération, sans qu'il soit nécessaire de modifier la classe des éléments sur lesquels il agit.**


Effectivement aussi, ce livre donne comme un exemple un arbre. Et le visiteur prends toute sa puissance sur un arbre ou sur une structure composite. Mais ce n'est le seul cas ou celui-ci est utile, dans tous les cas **il s'agit bien de permettre l'ajout / la suppression / la modification de comportements d'une manière objet sans retoucher à ce qui existe déjà**.

> Je le répète le fait que le visiteur marche super bien sur un arbre est un bonus, mais le problème adressé, l'intention du visiteur n'est pas de visiter, mais de **définir une nouvelle opération sans changer le code existant sur lequel il agit**.

Il faut mesurer l'intérêt du visiteur suivant deux axes.

1. S'il y a beaucoup d'objet du domaine qui peuvent avoir le même comportement, ou si la grappe de nœud d'un arbre est importante, un ou des visiteurs sera une bonne solution de conception pour mutualiser du code.
2. S'il n'y a pas énormément d'objet du domaine, voir qu'un seul, mais que les comportements relatifs sont à la fois divers et volatiles. Alors le visiteur est un candidat pour ajouter des comportements sans faire de satané helper et sans avoir à modifier les éléments du domaine.
3. Si vous avez des opérations différentes et un arbre ou des objets composite, le visiteur est le pattern pour vous, c'est la qu'il prendra toute son essence.
4. Si finalement vous n'avez pas beaucoup de comportement, qu'ils ne risque pas beaucoup de bouger et que vous n'avez pas des objets variés pour mutualiser ce code, alors le visiteur n'est probablement pas pour vous.

Egalement aussi le visiteur étant un objet permet de conserver un état, ce que ne permettent pas les objets même du domaine ou les helpers (sauf si on utilise des objets contextes passé de fonction en fonction, ce n'est pas exceptionnel).

## Exemple de visiteurs

D'abord la grappe d'objet "*complète*" :

```java
public class CoolBookCollection {
    private Collection<Book> books;
    private String owner;
    private CollectionStatus status;
    private void accept(DomainOperation operation) {
        operation.operateOn(this);
    }
    public Collection<Book> books() { return books; }
    public static enum CollectionStatus {
        TIDY, MESSY, OK
    }
    // ...
}
```

```java
public class Book {
    private Price price;
    private String title;
    private String author;

    public Price price() { return price; }
    public String title() { return title; }
    public String author() { return author; }
}
```

```java
public class Price {
    public Price() { }
    public Price(Price priceA, Price priceB) { }
    public Price add(Price price) { return new Price(this, price); }
}
```

Et la partie relatives aux visiteurs, d'abord l'interface (ou j'ai choisi volontairement de ne pas mettre les mot Visitor et visit) :

```java
public interface DomainOperation {
    void operateOn(CoolBookCollection coolBookCollection);
}
```

```java
public class CountAllBooks implements DomainOperation {
    private int count;

    public void operateOn(CoolBookCollection coolBookCollection) {
        count = coolBookCollection.books().size();
    }

    public int bookCount() {
        return count;
    }
}
```

```java
public class ObtainCollectionPriceByGenre implements DomainOperation {
    private final String genre;
    private Price totalPrice = new Price();

    public ObtainCollectionPriceByGenre(String genre) {
        this.genre = genre;
    }

    public void operateOn(CoolBookCollection coolBookCollection) {
        for (Book book : coolBookCollection.books()) {
            totalPrice.add(book.price());
        }
    }
    public Price totalPrice() { return totalPrice; }
}
```

Et voilà on des comportements différents liés à un objet en particulier, pas besoin de retoucher notre élément. Et on a une manière élégante de sortir nos comportements. Bien entendu, ce genre de chose est à faire avec du bon sens, en fonction du contexte et de l'opération à effectuer.

## Quand on a davatage d'objets du domaine à visiter, attention!

Attention quand même, comme précisé plus haut, le visiteur n'est pas non plus sans défaut. Sur une structure d'objet profonde ou large, votre pattern visiteur va créer une dépendance cyclique entre lui et les objets sur lesquels il est sensé s'appliquer.

```java
public interface DomainOperation {
    void operateOn(CoolBookCollection coolBookCollection);
}
```

Si mon visiteur doit par exemple travailler sur plusieurs sous type de l'objet (on pourrait typiquement avoir ce genre de problème avec les structures composites) :

```java
public interface DomainOperation {
    void operateOn(BookCollection bookCollection);
    void operateOn(CoolBookCollection coolBookCollection);
    void operateOn(CheesyBookCollection cheesyBookCollection);
    void operateOn(InTheCaveBookCollection inTheCaveBookCollection);
}
```

On voit vite le problème ou le visiteur est forcé d'implémenter des opérations pour des objets qui ne l'intéresse pas forcément. Le problème est contournable en utilisant intelligemment les interfaces, mais cette solution palliative a également des limites; on ne va faire implémenter 45 interfaces à nos objets.

Pour cela il y a une solution un peu plus complexe qui est également un pattern, c'est le [Visiteur Acyclique](http://www.objectmentor.com/resources/articles/acv.pdf). Je n'approfondie pas trop, mais l'idée est d'avoir pour chaque sous type du domaine une interface de visiteur qui permet de vérifier que l'instance du visiteur est acceptable. Evidemment vous pourrez adapter le comportement, et vous n'êtes non plus obligé d'implémenter toutes les méthodes, c'est le but de ce pattern acyclique.

![VisiteurAcyclique]({{ site.baseurl }}/assets/VisiteurAcyclique.png)

Et typiquement le code du accept pour chaque sous-type de collection aurait une tête du genre :

```java
public void accept(DomainOperation operation) {
    if(operation instanceOf BookCollectionOperation) {
        ((BookCollectionOperation) operation).operateOn(this);
    }
}
```

Et voilà on a cassé les dépendance, et on est pas obligé d'implémenter toute les interfaces de chaque type de collection.

> **Le double dispatch, à ne pas confondre avec un visiteur**

Le lecteur avertit aura vite deviné que ça ressemble au pattern stratégie, et il aura raison, ce sont des patterns comportementaux. Mais là ou le visiteur se distingue, et notamment dans des langages comme Java, .Net, C++ c'est qu'il utilise la technique du **double dispatch**.

Alors le double dispatch (double répartition) c'est quoi exactement, c'est un moyen pour le logiciel de résoudre au runtime les méthodes à exécuter.

Je vais citer les exemples [wikipédia](http://en.wikipedia.org/wiki/Double_dispatch) et transformer leurs exemples en Java.

On a donc deux catégories d'objets, des astéroïdes et des vaisseaux spatiaux.

```java
public class SpaceShip {
}
```

```java
public class GiantSpaceShip extends SpaceShip {
}
```

```java
public class Asteroid {
    void collideWith(SpaceShip spaceShip) {
        System.out.println("Asteroid hit a SpaceShip");
    }
    void collideWith(GiantSpaceShip giantSpaceShip) {
        System.out.println("Asteroid hit a GiantSpaceShip");
    }
}
```

```java
public class ExplodingAsteroid extends Asteroid {
    void collideWith(SpaceShip spaceShip) {
        System.out.println("ExplodingAsteroid hit a Spaceship");
    }

    void collideWith(GiantSpaceShip giantSpaceShip) {
        System.out.println("ExplodingAsteroid hit a GiantSpaceShip");
    }
}
```

Ok, maintenant dans le code on a ça

```java
Asteroid theAsteroid = new ExplodingAsteroid();
SpaceShip theSpaceShip = new GiantSpaceShip();
GiantSpaceShip theGiantSpaceShip = new GiantSpaceShip();

theAsteroid.collideWith(theSpaceShip);
theAsteroid.collideWith(theGiantSpaceShip);
```

Comme en java c'est la méthode de l'instance qui est appelée, pas de problème pour nos astéroïdes. Mais là ou ça coince c'est au niveau des vaisseaux spatiaux. Les deux appels vont afficher sur la sortie sandard:

```
ExplodingAsteroid hit a SpaceShip
ExplodingAsteroid hit a GiantSpaceShip
```

En effet le type réel du vaisseau spatial n'est pas connu, sauf si on fait de la reflection avec un `instanceof`, mais il y a plus élégant, c'est le double dispatch.

Si maintenant nos vaisseaux spatiaux ont tous les deux cette méthode définie :

```java
public class SpaceShip {
    void collideWith(Asteroid asteroid) {
        asteroid.collideWith(this);
    }
}
```

```java
public class GiantSpaceShip extends SpaceShip {
    void collideWith(Asteroid asteroid) {
        asteroid.collideWith(this);
    }
}
```

Maintenant notre code utilisera l'API de cette façon :

```java
Asteroid theAsteroid = new ExplodingAsteroid();
SpaceShip theSpaceShip = new GiantSpaceShip();
GiantSpaceShip theGiantSpaceShip = new GiantSpaceShip();

theSpaceShip.collideWith(theAsteroid);
theGiantSpaceShip.collideWith(theAsteroid);
```

Et on aura le code correcte utilisé.

Cette technique est utilisée par le visiteur, mais nous ne somme pas obligé d'avoir des visiteurs pour l'utiliser (la preuve par l'exemple grâce à wikipédia). C'est utilisé régulièrement dans la JDK, typiquement pour la sérialisation (même si c'est caché). Coté performance si on a le choix, le double dispatch sera toujours plus rapide qu'un instanceof. Coté design c'est pratique quand on a des branches d'objets qui travaillent ensemble.

Certains langages proposent nativement un support pour ces problèmes de résolution de type d'opérande, comme Nice.

A regarder aussi, c'est le multi dispatch ou les multi-méthodes, il y a notamment une implémentation de Rémy Forax de l'université de Marne-la-Vallée, cette implémentation a le mérite d'être standard Java, c'est à dire qu'elle n'étends pas le langage lui-même.

Pour y jeter un œil : [http://www-igm.univ-mlv.fr/~forax/works/jmmf/index.html](http://www-igm.univ-mlv.fr/~forax/works/jmmf/index.html)

# Récapitulatif sur le visiteur

Le visiteur est bien un ami, mais comme tous les potes, il ne sait pas tous faire non plus.

Un visiteur sait parcourir des arbres, il se débrouille super bien avec, mais il est aussi utile quand il n'y a pas d'arbre.

Un visiteur sert avant tout à extraire des comportements lié à un structure d'objet qui bouge peu. La structure peut être plate, ou en profondeur (cela dit je privilégierait la composition à la lace de l'héritage).

Le visiteur utilise la technique du double dispatch, ne pas confondre les deux.

Le visiteur permet de respecter le SRP (Single Responsibility Principle).

Le visiteur aide à maintenir le CCP (Common Closure Principle), c'est une histoire de cohésion entre les classes qui sont regroupées dans un même package.

> The classes in a package should be closed together against the same kind of changes. A change that affects a package affects all the classes in that package.

Bon voilà, le débat reste ouvert, si vous pensez que j'ai tort, que j'oublie un point important, ou pour autre chose, il y a les commentaires.

# Références

* [http://www.objectmentor.com/omSolutions/oops_what.html](http://www.objectmentor.com/omSolutions/oops_what.html)
* [http://www.objectmentor.com/resources/articles/visitor.pdf](http://www.objectmentor.com/resources/articles/visitor.pdf)
* [http://www.objectmentor.com/resources/articles/acv.pdf](http://www.objectmentor.com/resources/articles/acv.pdf)
* [be-not-afraid-of-the-visitor-the-big-bad-composite-or-their-little-friend-double-dispatch](http://codebetter.com/blogs/jeremy.miller/archive/2007/10/31/be-not-afraid-of-the-visitor-the-big-bad-composite-or-their-little-friend-double-dispatch.aspx)
* [http://www.artima.com/cppsource/top_cpp_aha_moments.html](http://www.artima.com/cppsource/top_cpp_aha_moments.html)
* [http://butunclebob.com/ArticleS.UncleBob.VisitorVersusInstanceOf](http://butunclebob.com/ArticleS.UncleBob.VisitorVersusInstanceOf)
* [http://www.javaperformancetuning.com/articles/ddispatch.shtml](http://www.javaperformancetuning.com/articles/ddispatch.shtml)
