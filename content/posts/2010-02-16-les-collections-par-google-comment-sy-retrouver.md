---
authors: ["brice.dutheil"]
date: "2010-02-16T15:51:49Z"
meta:
  _edit_last: "1"
  _su_rich_snippet_type: none
  _syntaxhighlighter_encoded: "1"
published: true
status: publish
tags:
- code
- google-collections
title: Les collections par Google, comment s'y retrouver?
type: post
---
Depuis quelques jours déjà le framework de collection par google est sorti en version 1.0. Ce framework a vu le jour chez Google donc, et s’impose finalement comme le prochain framework pour travailler avec les collections. En effet les classes utilitaires du JDK sont plutôt limitées et les classes commons-collections de Apache ne sont pas *générifiés*.

Les classes fournies par Google, ont été tunées pour être performante en rapidité et en utilisation mémoire. Si possible ce sont les collections standard du JDK, les collections du JDK sont mutables. Éventuellement l'utilisation des classes standard du JDK pourrait permettre à la JVM de faire les optimisation sur ces objets qu'il connait. Également aussi l'API orientée builder – un peu comme Joda-Time – facilite l'utilisation de google-collections.

Pour commencer, vous pouvez jeter un œil aux classes suivantes :

```java
com.google.common.collect.Collections2
com.google.common.collect.Lists
com.google.common.collect.Maps
com.google.common.collect.Sets
com.google.common.collect.ObjectArrays
com.google.common.collect.Multisets
com.google.common.collect.Multimaps
com.google.common.collect.Iterators
com.google.common.collect.Iterables
```

Ces classes utilitaires permettent déjà d’instancier les collections avec quelques commodités, par exemple dans le code ci-dessous les classes retournées sont les **classes mutables du JDK** :

```java
LinkedHashSet<String> linkedHashSet = Sets.newLinkedHashSet();
ArrayList<AGenericObject <Class<Observer>>> arrayList = Lists.newArrayList();
Lists.newArrayList("bob", "marie", "barack", "bruce");
```

à la place de :

```java
List<AGenericObject<Class<Observer>>> list = new ArrayList<AGenericObject<Class<Observer>>>();
```

Voilà rapidement pour les utilitaires des collections fournies par le JDK, mais Google fournit également des **implémentations immutables** des collections :

```java
ImmutableSet<integer> immutableSet = ImmutableSet.of(1, 2, 3, 4, 5);
ImmutableList<string> immutableList = ImmutableList.of("a,b,c,d,e,f,g".split(","));
```

Pour les maps, il y a aussi une API plutôt expressive et facilement utilisable. Par exemple pour créer facilement une multimap:

```java
Multimap<color , Fruit> colorIndex = HashMultimap.create();
for (Fruit fruit : fruits) {
    colorIndex.put(fruit.getColor(), fruit);
}
Collection<Fruit> redFruits = colorIndex.get(Color.RED);
```

Si on veut jouer avec des map bi-directionnelles.

```java
ImmutableBiMap<Integer , String> biMap = ImmutableBiMap.of(0, "Zero", 1, "One", 2, "Two", 3, "Three");
biMap.inverse().get("Zero"); // => 0
```

L’outil MapMaker pour créer des maps customisées :

```java
Map<Params , Result> resultCache = new MapMaker().expiration(5 * 60,TimeUnit.SECONDS)
    .makeComputingMap(new Function<Params , Result>() {
        public Result apply(Params param) {
            return computeHeavyAlgorythm();
        }
    }).makeMap();
```

Il est aussi possible de ne pas utiliser l’expiration mais de choisir plutôt des WeakReference ou des SoftReference pour les clés et/ou les valeurs.

Comment utiliser les Multiset. A noter, le Multiset ci-dessous est mutable! Pur un MultiSet immutable il faut le créer avec ImmutableMultiset.

```java
Multiset<String> histogram = HashMultiset.create();
histogram.add("Hello");
histogram.add("World", 3);
histogram.add("Hello");
histogram.add("!");

int count;
count = histogram.count("Hello");    // 2
count = histogram.count("World");    // 3
count = histogram.count("Brice");    // 0
```

Et pour les itérateurs :

```java
UnmodifiableIterator<Object> tokenizerIt = Iterators.forEnumeration(new StringTokenizer("a|b|c|d|e", "|")); // Eh oui ! StringTokenizer implémente Enumeration<Object>

UnmodifiableIterator<String> splitIt = Iterators.forArray("e|ed|f|g|h|i".split("|"));

Iterator<object> concatenatedIt = Iterators.concat(tokenizerIt, splitIt);

Iterators.frequency(concatenatedIt, "e"); // 2
concatenatedIt.hasNext(); // false
```

Ok maintenant que nous avons vu comment créer des collections, on peut regarder comment vraiment jouer avec. Ordonner une collection par exemple; il faut utiliser la classe Ordering (étends l’interface Comparator de java)

```java
Function<Fruit, Color> getColorFunction = new Function() {
    public Color apply(Fruit from) {
        return from.getColor();
    }
};

Function<Fruit , String> getNameFunction = new Function() {
    public String apply(Fruit from) {
        return from.getName();
    }
};

Ordering<Fruit> colorOrdering = Ordering.natural().onResultOf(getColorFunction);
Ordering<Fruit> nameOrdering = Ordering.natural().onResultOf(getNameFunction);

// ordonner par couleur puis par nom
Ordering<Fruit> colorAndNameOrdering = colorOrdering.compound(nameOrdering);

List<Fruit> sortedFruitList = Ordering.natural().sortedCopy(fruits);
Set<Fruit> sortedFruits = ImmutableSortedSet.orderedBy(colorAndNameOrdering).addAll(fruits).build();
```

Filtrer des éléments est devenu super facile à utiliser. Il nous faut les classes Predicate et Predicates.

```java
List<String> names = Lists.asList("Clément", "Jean-Max", "Caroline", "Céline", "Brice");
Iterable<String> filtered = Iterables.filter(
    names,
    Predicates.or(
        Predicates.or(Predicates.equalTo("Clément"), Predicates.equalTo("Brice")),
        returnALengthPredicate(5)
    )
);
```

Il est possible de faire des transformations

```java
Lists.transform(lotoNumbers, new Function<String , Integer> {
    public Integer apply(final String from) {
        return Integer.valueOf(from);
    }
});
```

Que peut-on faire d’autre? Par exemple avec les maps et les sets, on peut observer les différences, faire des unions, ou faire des intersections.

```java
MapDifference<String , Integer> differenceMap = Maps.difference(mapA, mapB);
differenceMap.areEqual();
Map<String , ValueDifference<Integer>> entriesDiffering = differenceMap.entriesDiffering();
Map<String , Integer> entriesOnlyOnLeft = differenceMap.entriesOnlyOnLeft();
Map<String , Integer> entriesOnlyOnRight = differenceMap.entriesOnlyOnRight();
Map<String , Integer> entriesInCommon = differenceMap.entriesInCommon();
```

On peut également faire de l’indexation sur des listes de map :

```java
List<String> badGuys = Arrays.asList("Inky", "Scratchy", "Blinky", "Pinky", "Pinky", "Clyde");
Function<String , Integer> stringLengthFunction = ...;

Multimap<String , Integer> index = Multimaps.index(badGuys, stringLengthFunction); // { 4=[Inky], 5=[Pinky, Pinky, Clyde], 6=[Blinky], 7=[Scratchy] }
```

Au cas ou pour éviter de chercher voici quelques méthodes utilitaires dans Iterables, d'ailleurs c'est là qu'on retrouve le fameux isEmpty. (Attention la librairie google ne vérifie pas la nullité, et leur argument est de ne pas encourager de retourner null mais plutôt des collections vide, bref ce que dit Joshua Blosh dans son fameux livre Effective Java, §Item 43)

```java
Iterables.getOnlyElement(ImmutableSet.of("1")); // 0
Iterables.getOnlyElement(ImmutableSet.of("1", "2")); // IllegalArgumentException

Iterables.isEmpty(ImmutableMultiset.of()); // true
Iterables.isEmpty(null); // NullPointerException
Iterable<String> moreFruits = Iterables.concat(ImmutableMultiset.of("apple", "banana", "kiwi"), Lists.newArrayList("ananas", "orange")); // "apple", "banana", "kiwi", "ananas", "orange"
String kiwi = Iterables.getLast(ImmutableMultiset.of("apple", "banana", "kiwi")); // "kiwi"

Iterable<List <String>> fruitBasket = Iterables.partition(moreFruits, 2);  // { "apple", "banana" }, { "kiwi", "ananas" }, { "orange" }
```

Pour passer d’un Iterable à un tableau :

```java
Iterables.toArray(Lists.newArrayList(new DateTime(), new DateTime().plusDays(1)), DateTime.class);
```

Voilà il y a pas mal de petits trucs bien sympa, ceci dit il peut manquer des choses qui nous semblent essentielles. Mais cette bibliothèque apporte enfin des choses qui nous simplifient la vie. Les commons-collection ont bien marqués nos habitudes, mais pour s’y retrouver et utiliser cette bibliothèque à bon escient il est certain qu'il va falloir faire un petit effort.
