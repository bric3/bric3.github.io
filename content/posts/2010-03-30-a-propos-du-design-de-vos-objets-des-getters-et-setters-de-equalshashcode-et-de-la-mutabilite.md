---
authors: ["brice.dutheil"]
date: "2010-03-30T18:20:52Z"
meta:
  _edit_last: "1"
  _su_rich_snippet_type: none
  _syntaxhighlighter_encoded: "1"
published: true
status: publish
tags:
- pattern
- TDD
- code
- contrat
- design
- equals
- fuite
- hashcode
slug: a-propos-du-design-de-vos-objets-des-getters-et-setters-de-equalshashcode-et-de-la-mutabilite
title: A propos du design de vos objets, des getters et setters, de equals/hashCode
  et de la mutabilité
type: post
---
# Prologue

A l'école nos professeurs nous apprenaient ce qu'était la programmation orientée objet; en particulier l'encapsulation. En effet avoir un accès public aux variables internes d'un objet n'est pas particulièrement recommandé, pourtant nous avons connaissons tous la convention JavaBean :

```java
class Bean {
  /** constructeur sans argument, optionnel si c'est le seul constructeur de la classe */
  public Bean() { }

  public void setBeanName(String name) {
    beanName = name;
  }

  public String getBeanName() {
    return beanName;
  }
}
```

Manque de bol, cette convention qui a pourtant son utilité -voire sa nécéssité- peut dans certains contextes  briser l'encapsulation, et plus dangereux pour votre code, elle permet à vos objets d'être mutable, c'est à dire de pouvoir modifier l'état d'un objet après sa création. Bien que dans certains cas le design ou le rôle de la classe demande cette caractéristique, dans beaucoup d'autres situations la mutabilité peut poser problème.

D'ailleurs historiquement les JavaBeans ont été pensé pour être utilisé par des applications  graphiques afin d'être construit itérativement et finalement pour être facilement dé/sérialisés [1]. Mais ces objets exposent publiquement leurs états, du coup :


1. Il y a de l'adhérence à des propriétés internes d'un objet, s'il y a beaucoup de code qui utilise ces propriétés internes, l'évolutivité et la maintenance de ce code peut très vite devenir difficile et donc couteuse.
2. Ce n'est plus vraiment de la programmation orientée objet. C'est en quelque sorte des variables globales, ça fait plus de 30 ans qu'on sait que les variables globales c'est mal! Demandez à Barbara Liskov [2].
3. Avec cette possibilité de muter les objets, il peut y avoir des problèmes au runtime, et croyez moi avec l'arrivée de la parallélisation en plus dans vos applications il va y avoir des surprises.

Bon revenons au design, et aux problèmes rencontrés.

# Illustration des problèmes de design du code

## hashCode et equals

Donc pour commencer, on va juste faire quelques tests sur un objet sans les méthodes *hashCode()* et *equals()*. Prenons les test suivants, je créé 4 instances de beans, *obj1* et *obj3* puis *obj2* et *obj4* ont les mêmes propriétés.

Ce test montre les problèmes quand on oublie les méthodes *equals* et *hashCode*.

```java
public class MutabilityCanBeBadTest {
  private AJavaBean obj1;
  private AJavaBean obj2;
  private AJavaBean obj3;
  private AJavaBean obj4;

  @Before
  public void initTheBeans() {
    obj1 = new AJavaBean();
    obj1.setName("paraboot");
    obj1.setSellingDate(new GregorianCalendar(2010, 03, 30).getTime());

    obj2 = new AJavaBean();
    obj2.setName("ethnies");
    obj2.setSellingDate(new GregorianCalendar(2010, 10, 30).getTime());

    obj3 = new AJavaBean();
    obj3.setName("paraboot");
    obj3.setSellingDate(new GregorianCalendar(2010, 03, 30).getTime());

    obj4 = new AJavaBean();
    obj4.setName("ethnies");
    obj4.setSellingDate(new GregorianCalendar(2010, 10, 30).getTime());
  }

  @Test
  public void objectsShouldBeEquals() throws Exception {
    assertEquals(obj2, obj4); // fail
    assertEquals(obj1, obj3); // fail
  }

  @Test
  public void hashCodeShouldBeEquals() throws Exception {
    assertEquals(obj1.hashCode(), obj3.hashCode()); // fail
    assertEquals(obj2.hashCode(), obj4.hashCode()); // fail
  }

  @Test
  public void addAndRemoveToHashBasedCollection() throws Exception {
    Set<AJavaBean> set = new HashSet<AJavaBean>();

    assertTrue(set.add(obj1));
    assertTrue(set.add(obj2));
    assertFalse(set.add(obj3)); // fail
    assertFalse(set.add(obj4)); // fail

    assertEquals(2, set.size()); // fail

    assertTrue(set.remove(obj1));
    assertTrue(set.remove(obj2));
    assertFalse(set.remove(obj3)); // fail
    assertFalse(set.remove(obj4)); // fail
  }
}
```

Si l'implémentation de AJavaBean oublie donc le *hashCode* et le *equals*, la plus part des assertions ne marchent plus.

```java
public class AJavaBean {
  private String name;
  private Date sellingDate;

  public String getName() {
    return name;
  }

  public void setName(final String name) {
    this.name = name;
  }

  public Date getSellingDate() {
    return sellingDate;
  }

  public void setSellingDate(final Date uid) {
    this.sellingDate = uid;
  }

  @Override
  public String toString() {
    return "AJavaBean [name=" + name + ", sellingDate=" + sellingDate + "]";
  }
}
```

En bref :

![fail]({{ site.baseurl }}/assets/fail.jpg)

Que s'est-il passé? S'il n'y a pas de *hashCode* et de *equals*, ce sont les méthodes de la super classe qui sont utilisées, dans le code listé plus haut ce sont les méthodes de Object qui seront utilisées pour tester l'égalité et le hashCode.


* Donc pour l'égalité Object.equals(Object) vérifie uniquement si l'instance est la même. Ce qui explique que les tests d'égalité échouent plus haut.
* Pour le hashCode, c'est la JVM qui le génère, bref autant dire que le hashcode est différent pour chaque instance. Ceci explique que les instances *obj1* et *obj2* sont ajoutées au HashSet, si le hashcode avait été le même alors les opérations d'ajout et de suppression auraient renvoyé *false* (n'oublions pas qu'il s'agit d'un **Hash** Set).


## Et donc pour le code mutable

Ok, bon maintenant qu'on a vu ça, notre bean implémente les méthodes equals et hashCode de manière idoine, c'est à dire dans notre cas que le code se base sur les attributs *name* et *sellingDate*. Pas de mystère, on peut utiliser l'outils de génération de l'IDE.

Eclipse génère ça:

```java
@Override
public int hashCode() {
  final int prime = 31;
  int result = 1;
  result = prime * result + ((name == null) ? 0 : name.hashCode());
  result = prime * result + ((sellingDate == null) ? 0 : sellingDate.hashCode());
  return result;
}

@Override
public boolean equals(final Object obj) {
  if (this == obj) { return true; }
  if (obj == null) { return false; }
  if (getClass() != obj.getClass()) { return false; }
  AJavaBean other = (AJavaBean) obj;
  if (name == null) {
    if (other.name != null) { return false; }
  } else if (!name.equals(other.name)) { return false; }
  if (sellingDate == null) {
    if (other.sellingDate != null) { return false; }
  } else if (!sellingDate.equals(other.sellingDate)) { return false; }
  return true;
}
```

Bon à priori on se dit que notre code est safe puisqu'on a nos méthodes *equals* et *hashcode*, mais on se fourvoie ; notre objet est mutable!

Exemple :

```java
  @Test
  public void playWithMutabilityWithABeanInHashBasedCollection() throws Exception {
    Set<AJavaBean> set = new HashSet<AJavaBean>();

    assertTrue(set.add(obj1));
    assertTrue(set.add(obj2));

    obj2.setSellingDate(new GregorianCalendar(2010, 05, 30).getTime()); // valeur précédente : 2010-10-30

    assertTrue(set.remove(obj2)); // owned
    assertEquals(2, set.size()); // owned
    assertFalse(set.add(obj2)); // owned
  }
```

Surprise! You just got

![pwned]({{ site.baseurl }}/assets/pwned.jpg)

Alors on sait que les méthodes *equals* et *hashCode* utilisent les deux propriétés *name* et *sellingDate*, donc quand on ajoute un objet dans le HashSet le hashCode correspondra au calcul fait partir des valeurs des ces attributs. Mais voilà le hashcode de l'objet n'est calculé qu'une fois, au moment de l'interaction dans la Map (ajout, suppression, contains, etc...).

Donc ce qu'il se passe c'est qu'on a fait muter l'état de notre objet, du coup le hashcode est différent, mais la collection conserve la référence de l'objet qu'elle contiens et ne recalcule pas son hashcode! C'est aussi avec avec ce genre de code que vous pouvez avoir des fuites mémoires. Et on est même pas dans un contexte multithreadé, alors imaginez si la collection est partagée entre plusieurs thread!

## Attention aux collections ou aux dates du JDK

Par ignorance puis par laxisme, j'avoue que j'ai écris du code qui ressemble à ça (et j'ai honte de le dire) :

```java
public class AnotherSupposedImmutableClass {

  private final String name;
  private final Date aDate;
  private final Map<String , Integer> aMap;

  public AnotherSupposedImmutableClass(final String name, final Date aDate, final Map<String , Integer> aMap) {
    super();
    this.name = name;
    this.aDate = aDate;
    this.aMap = aMap;
  }

  public String getName() {
    return name;
  }

  public Date getADate() {
    return aDate;
  }

  public Map<String , Integer> getAMap() {
    return aMap;
  }
}
```

Et forcement il y a des hics! A priori notre classe n'est pas mutable. Mais cela ne vous aura pas échappé, les propriétés *aDate* et *aMap* sont mutable!

```java
@Test
public void playWithInternalMutability() throws Exception {
  Map<String , Integer> map = new HashMap<String , Integer>();
  AnotherSupposedImmutableClass supposedImmutableClass = new AnotherSupposedImmutableClass(
    "name",
    new GregorianCalendar(2010, 05, 30).getTime(),
    map
    );
  supposedImmutableBean.getADate().setTime(123456789l); // oups
  supposedImmutableBean.getAMap().put("trente quatre", Integer.valueOf(34)); // oups
  supposedImmutableBean.getAMap().clear(); // oups, again
}
```

Et là, vous vous retrouverez les mêmes surprises que celles vu plus haut, ou évidement pire si vous êtes dans une application multithreadée.  A ce sujet j'ai vu des *ConcurrentModificationException* parceque levé par du code à priori immutable, une optimisation d'un vieux code multithreadé avait déplacé une section qui modifiait une Map.

Je vous conseille vivement d'utiliser des objets immutables pour vos property, les librairies Joda-Time [3] et Google-Collections [4] fournissent des objets immutables.

## Le pattern Builder de Joshua Bloch

Pour Joshua Bloch, c'est un peu une référence en Java, je pense qu'on peut lui faire confiance. Il est l'auteur du fameux livre *Effective Java* [5].

Alors pourquoi le **pattern Builder de Joshua Bloch** et non le **pattern Builder du ****GoF** ? En fait ce design vient d'une constatation au sujet de la construction d'objet complexes et pour s'affranchir des inconvénients des accesseurs.

En gros un objet du genre agrégat pourrait être construit avec un constructeur avec un paquet d'argument ou itérativement avec une foule de setter. Mais, un les gros constructeur ce n'est pas très pratique, puis deux les setters ça peux vite être lourd et ça rends votre objet mutable (ce qui n'est donc pas souhaité dans tous les cas).

Cette déclinaison du builder permet de construire un objet itérativement sans forcer la mutabilité.

Exemple les collections google :

```java
public abstract class ImmutableMap<K , V> implements Map<K , V>, Serializable {

  // ...

  public static <K , V> Builder<K , V> builder() {
  return new Builder<K , V>();
  }

  // ...

  public static class Builder<K , V> {
    final List<Entry <K , V>> entries = Lists.newArrayList();

    public Builder() {}

    public Builder<K , V> put(K key, V value) {
      entries.add(entryOf(key, value));
      return this;
    }

    // ...

    public ImmutableMap<K , V> build() {
      return fromEntryList(entries);
    }
  }

    private static <K , V> ImmutableMap<K , V> fromEntryList(List<Entry <K , V>> entries) {
      // ...
    }

  // ...

}
```

Ou encore avec une classe de notre domaine :

```java
public class ACoolImmutableClass {
  private final String name;
  private final DateTime sometime;
  private final List<String> listOfStuff;
  // many other fields

  public String getName() {
    return name;
  }

  public DateTime getSometime() {
    return sometime;
  }

  public static class Builder {
    private String name;
    private DateTime sometime;
    private List<String> listOfStuff = new ArrayList<String>();

    public Builder withName(String name) {
      this.name = name;
      return this;
    }

    public Builder at(DateTime moment) {
      this.sometime = moment;
      return this;
    }

    public Builder addThisThing(String thing) {
      this.listOfStuff.add(thing);
      return this;
    }

    public ACoolImmutableClass build() {
      return new ACoolImmutableClass(this);
    }
  }

  private ACoolImmutableClass(Builder builder) {
    this.name = builder.name;
    this.sometime = builder.sometime;
    this.listOfStuff = ImmutableList.copyOf(builder.listOfStuff);
  }
}
```

A noter que cette classe utilise des objets immutables pour ces attributs (`DateTime`, et `ImmutableList`).

Un des avantages, c'est qu'il est possible de valider les propriétés avant la création effective de l'objet. Avec les setters c'est faisable mais ça peut être délicat dans certaines situations.

Il y a un plugin Eclipse, qui permet de générer ces Builder, celà dit il est loin d'être super user friendly.

[http://code.google.com/p/bpep/](http://code.google.com/p/bpep/)

Quoiqu'il en soit en aucun cas ce pattern n'est un remplacement du pattern Builder du GoF, il s'agit plus d'un pattern à appliquer dans un contexte ou il faut des objets immutable. Et encore ce n'est pas la seule solution, JodaTime typiquement n'utilise pas de builders.

# Comment gérer la modification de l'objet

Si un comportement qui fait partit du domaine de l'objet et doit modifier l'état, alors il faut peut-être créer une nouvelle instance. La bibliothèque Joda-Time fait typiquement ça lorsqu'il y a modification d'un champs.

```java
DateTime instance1 = new DateTime("2009-04-01");
DateTime instance2 = instance1.withYear(2010);

```

Je ne m'étends pas sur le sujet, mais ce genre de choses dépends de votre contexte, du rôle et du besoin. Un objet devrait être par défaut immutable, sauf si vraiment votre domaine identifie un cas ou l'état doit bouger et alors vous aurez des méthodes documentées qui appliqueront cette modification.

# Conclusion

Mieux vaut des objets bien pensés et immutables que d'introduire la possibilité de changer l'état d'un objet et avoir des surprises. Et puis aussi :

* Il y a un risque fort d'avoir des problèmes au runtime, d'autant plus 10 ans après lorsqu'il y a une évolution à apporter et que plus personne ne sait qu'à tel endroit dans le code il y a le truc qui fout tout en l'air. Et les problèmes au runtime ca peut vite couter cher à analyser.
* Si vos objets ne peuvent pas être modifié alors vous n'aurez pas à vous soucier des problèmes de concurrences, c'est manifestement un gain de temps au développement et en maintenance. (Et donc un gain d'argent sur le long terme.)
* Bon ces objets sont bien cool, mais voilà il y a encore plein de framework (à tord ou à raison) qui se basent sur la convention JavaBean, je pense notamment aux objets marshallés en XML et consort.
* Ce code basé sur les builders est propre, mais il faut passer un petit peut plus de temps pour le faire. Il y a bien un plugin pour Eclipse, mais quid des autres IDE.

**Quoi qu'il en soit, ces solutions sont toujours à appliquer avec du recul et toujours en fonction du contexte de votre domaine.**

D'ailleurs cette entrée parle des problèmes rencontrés avec les collections du JDK, mais le problème pourrait se manifester différemment si une collection ou un de vos objets fonctionne autrement.

Encore une fois les remarques sont les bienvenues, ça fait plus de 40 ans que l'Homme fait du logiciel, et mafois on se plante encore assez souvent.

# Références

* [http://www.javaworld.com/javaworld/jw-09-2003/jw-0905-toolbox.html](http://www.javaworld.com/javaworld/jw-09-2003/jw-0905-toolbox.html)
* [http://www.infoq.com/presentations/liskov-power-of-abstraction](http://www.infoq.com/presentations/liskov-power-of-abstraction)
* [http://dutheil.brice.online.fr/blog/index.php/2010/02/09/a-propos-de-joda-time/](http://dutheil.brice.online.fr/blog/index.php/2010/02/09/a-propos-de-joda-time/)
* [http://dutheil.brice.online.fr/blog/index.php/2010/02/16/les-collections-par-google-comment-sy-retrouver/](http://dutheil.brice.online.fr/blog/index.php/2010/02/16/les-collections-par-google-comment-sy-retrouver/)
* [http://www.amazon.fr/Effective-Java-Joshua-Bloch/dp/0321356683/ref=sr_1_1?ie=UTF8&s=english-books&qid=1269958692&sr=8-1](http://www.amazon.fr/Effective-Java-Joshua-Bloch/dp/0321356683/ref=sr_1_1?ie=UTF8&s=english-books&qid=1269958692&sr=8-1)
* [http://rwhansen.blogspot.com/2007/07/theres-builder-pattern-that-joshua.html](http://rwhansen.blogspot.com/2007/07/theres-builder-pattern-that-joshua.html)
