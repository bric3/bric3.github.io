---
authors: ["brice.dutheil"]
date: "2010-02-12T21:12:39Z"
disqus_identifier: 41 http://dutheil.brice.online.fr/blog/?p=41
meta:
  _edit_last: "1"
  _su_rich_snippet_type: none
  _syntaxhighlighter_encoded: "1"
  suf_pseudo_template: default
published: true
status: publish
tags:
- code
- memoryleak
- OutOfMemoryError
- performance
- reflection
slug: une-fuite-memoire-beaucoup-de-reflection-et-pas-de-outofmemoryerror
title: Une fuite mémoire, beaucoup de reflection et pas de OutOfMemoryError
type: post
---
# Le contexte

L'histoire commence par un problème en production sur une version à priori stable et sans anomalie connue. Seulement voilà une fois en prod l'application devient de plus en plus lente. Pourquoi? Que se passe-t-il?

Avec l'activation des logs du GC dans les options de la JVM, l'équipe s'aperçoit donc très vite que l'application arrive à bout de la mémoire disponible, mais pas de `OutOfMemoryError` (pourtant classique lors d'une fuite mémoire).

```bash
-Xloggc:-XX:+PrintGCDetails
```

&nbsp;

Lors de l'analyse des GC on remarque immédiatement une famine de mémoire, la JVM est obligée de faire des Full GC très souvent, et un Full GC c'est lent!

Pour avoir une représentation un peu compréhensible, on analyse ces logs avec [GCViewer](http://www.tagtraum.com/gcviewer.html). On a alors un graphe qui ressemble à ça :

![application-gc](/assets/application-gc.png)

On voit comment se passe le consommation de la mémoire dans l'application, on sait que l'application est lente, maintenant pourquoi la consommation mémoire monte autant sans être libéré. Effectivement les raisons peuvent varier **surtout qu'il n'y avait pas de OutOfMemoryError**!

* Possibilité 1 : Un problème de concurrence (deadlock, point de contention sur une ressource, ...); c'est cette possibilité qui a été retenue pour l'investigation du problème. Les thread dump nous confortaient dans cette optique étant donné qu'on voyait régulièrement le même code revenir. Et les indicateurs sur le CPU montrait qu'il n'était pas énormément utilisé.
* Possibilité 2 : Une fuite mémoire, choix écarté parce qu'on ne voyait de <abbr title="OutOfMemoryError">OOME</abbr>.

Et bien on avait tort, il s'agissait d'une fuite mémoire. Avec un collègue plus expérimenté nous avons fait du profiling, très vite il a mis le doigt sur le code en tort. **Mais quelque chose me choquait, pourquoi pas d'erreur <abbr title="OutOfMemoryError">OOME</abbr>** alors qu'il s'agissait manifestement d'une fuite mémoire.

# La bonne rencontre

J'ai eu la chance de pouvoir rencontré [Zenika](http://www.zenika.com/), en discutant avec lui j'ai eu l'occasion d'aborder ce sujet. Il m'a immédiatement demandé si notre application utilisait beaucoup d'introspection. Il m'a dit qu'il soupçonnait que ce genre de cas pouvait se produire, et il m'a ensuite aiguillé sur la manière dont le JDK de Sun utilise des SoftReference pour stocker les éléments issus de la reflection.

Et là, les cases manquantes n'étaient plus, en effet les objets [SoftReference](http://java.sun.com/j2se/1.5.0/docs/api/java/lang/ref/SoftReference.html) sont des références qui sont réclamées par le GC lorsque la JVM a vraiment vraiment besoin de mémoire, juste avant de lever une OutOfMemoryError. En gros, ça se passe typiquement lors des Full GC.

Et donc comme l'application est toujours en état de marche, le code qui a besoin de reflection va recréer ces objets. Cette combinaison de Full GC et la recréation constante des références des éléments issus de l'introspection, va très fortement ralentir l'application sans lever cette fameuse <abbr title="OutOfMemoryError">OOME</abbr>. Ou en tout cas en repoussant dans le temps cette <abbr title="OutOfMemoryError">OOME</abbr>.

# La preuve

Fort de cette nouvelle connaissance, j'ai été jeter un coup d'œil dans l'objet `java.lang.Class` pour effectivement y découvrir la mise en cache des éléments comme les méthodes et les champs dans une `SoftReference`. Ainsi en regardant le code source de OpenJDK:

```java
/*
 * Copyright 1994-2006 Sun Microsystems, Inc.  All Rights Reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  Sun designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Sun in the LICENSE file that accompanied this code.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * version 2 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 2 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Sun Microsystems, Inc., 4150 Network Circle, Santa Clara,
 * CA 95054 USA or visit www.sun.com if you need additional information or
 * have any questions.
*/

...

// Returns an array of "root" methods. These Method objects must NOT
// be propagated to the outside world, but must instead be copied
// via ReflectionFactory.copyMethod.
private Method[] privateGetDeclaredMethods(boolean publicOnly) {
  checkInitted();
  Method[] res = null;
  if (useCaches) {
    clearCachesOnClassRedefinition();
    if (publicOnly) {
      if (declaredPublicMethods != null) {
        res = (Method[]) declaredPublicMethods.get();
      }
    } else {
      if (declaredMethods != null) {
        res = (Method[]) declaredMethods.get();
      }
    }
    if (res != null) return res;
  }
  // No cached value available; request value from VM
  res = Reflection.filterMethods(this, getDeclaredMethods0(publicOnly));
  if (useCaches) {
    if (publicOnly) {
      declaredPublicMethods = new SoftReference(res);
    } else {
      declaredMethods = new SoftReference(res);
    }
  }
  return res;
}
```

Bon voilà pour la preuve de ce qui était avancé, mais pour aller plus loin je vais reproduire le scénario.

# La preuve par l'exemple

L'idée de l'exemple est d'avoir du code qui va simuler une fuite mémoire et un autre code qui va utiliser plus ou moins intensément l'introspection. On le verra plus tard mais le débit d'allocation d'objet de la fuite mémoire ne doit pas être trop important sinon on verra effectivement très vite l'erreur `OutOfMemoryError`.

## Le processus métier qui utilise de l'introspection

Comme je suis fainéant, je n'ai pas spécialement envie de créer 300 classes, donc je vais les générer en utilisant l'API Compiler du JDK 6. Je me suis un peu inspiré de qui disponible sur le net à ce sujet. En particulier de cette [entrée](http://speaking-my-language.blogspot.com/2008/04/instant-evaluation-of-java-code-in.html). Je passe brièvement dessus pour simplement dire que c'est la méthode `processBusinessLogic` qui est intéressante, on charge des classes, et surtout on appelle une méthode par introspection.

```java
package com.brice.memoryleakwithoutoome;

import javax.tools.*;
import java.io.*;
import java.lang.reflect.Method;
import java.net.URI;
import java.nio.charset.Charset;
import java.util.*;

public class BusinessLayerWithALotOfReflection {
  private InMemoryClassLoader classLoader = new InMemoryClassLoader();
  private List<String> classNames = new ArrayList();

  public static void main(String... args) throws Exception {
    BusinessLayerWithALotOfReflection businessLayer = new BusinessLayerWithALotOfReflection(3);
    businessLayer.performBusinessLogic();
  }

  public BusinessLayerWithALotOfReflection(int toGenerate) throws Exception {
    init(toGenerate);
  }

  public void performBusinessLogic() throws Exception {
    for (String className : classNames) {
      Object o = Class.forName(className, true, classLoader).newInstance();
      Method method = o.getClass().getMethod("m1", null);
      method.invoke(o, null);
    }
  }

  private void init(int toGenerate) throws Exception {
    generateSources(toGenerate);
  }

  private void generateSources(int toGenerate) throws Exception {
    List<JavaObjectFromString> generatedSources = new ArrayList<JavaObjectFromString>();

    for (int genId=0; genId < toGenerate; genId++) {
      String className = "$Generated" + genId;
      StringBuilder sb = new StringBuilder();
      sb.append("package com.brice.memoryleakwithoutoome.generated; ");
      sb.append("import java.util.Random;");
      sb.append("public class ").append(className).append(" {");
      sb.append("public void m1() { new Random().nextGaussian(); }");
      sb.append("}");

      classNames.add("com.brice.memoryleakwithoutoome.generated." + className);
      generatedSources.add(new JavaObjectFromString(className, sb.toString()));
    }
    generateClasses(generatedSources);
  }

  private void generateClasses(Iterable<JavaObjectFromString> javaObjects) throws IOException {

    JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
    StandardJavaFileManager javaFileManager = compiler.getStandardFileManager(null, null, Charset.defaultCharset());
    InMemoryJavaFileManager inMemoryJavaFileManager = new InMemoryJavaFileManager(javaFileManager, classLoader);

    compiler.getTask(null, inMemoryJavaFileManager, null, null, null, javaObjects).call();

    javaFileManager.close();
  }

  static class JavaObjectFromString extends SimpleJavaFileObject {
    private String contents = null;

    public JavaObjectFromString(String className, String contents) throws Exception {
      super(URI.create("string:///" + className.replace('.', '/') + Kind.SOURCE.extension), Kind.SOURCE);
      this.contents = contents;
    }

    public CharSequence getCharContent(boolean ignoreEncodingErrors) throws IOException {
      return contents;
    }
  }

  static class InMemoryJavaFileObject extends SimpleJavaFileObject {

    InMemoryJavaFileObject(String name, Kind kind) {
      super(URI.create(name), kind);
    }

    private ByteArrayOutputStream baos;

    @Override
    public CharSequence getCharContent(boolean ignoreEncodingErrors) throws IOException, IllegalStateException, UnsupportedOperationException {
      throw new UnsupportedOperationException();
    }

    @Override
    public InputStream openInputStream() throws IOException, IllegalStateException, UnsupportedOperationException {
      return new ByteArrayInputStream(baos.toByteArray());
    }

    @Override
    public OutputStream openOutputStream() throws IOException, IllegalStateException, UnsupportedOperationException {
      return baos = new ByteArrayOutputStream();
    }

    public byte[] getClassDefinition() {
      return baos.toByteArray();
    }
  }

  static class InMemoryJavaFileManager extends ForwardingJavaFileManager<StandardJavaFileManager> {
    private InMemoryClassLoader inMemoryClassLoader;

    protected InMemoryJavaFileManager(StandardJavaFileManager fileManager, InMemoryClassLoader classLoader) {
      super(fileManager);
      this.inMemoryClassLoader = classLoader;
    }

    @Override
    public JavaFileObject getJavaFileForOutput(Location location,
                                               String name,
                                               JavaFileObject.Kind kind,
                                               FileObject sibling) throws IOException {
      return inMemoryClassLoader.registerClassDefinition(new InMemoryJavaFileObject(name, kind));
    }
  }

  static class InMemoryClassLoader extends ClassLoader {
    private Map<String , InMemoryJavaFileObject> inMemoryClassObjects = new HashMap<String , InMemoryJavaFileObject>();

    protected Class findClass(String name) throws ClassNotFoundException {
      InMemoryJavaFileObject classObject = inMemoryClassObjects.get(name);
      if (classObject != null) {
        byte[] classDefinition = classObject.getClassDefinition();
        return defineClass(name, classDefinition, 0, classDefinition.length);
      }
      return super.findClass(name);
    }

    public InMemoryJavaFileObject registerClassDefinition(InMemoryJavaFileObject object) {
      inMemoryClassObjects.put(object.getName(), object);
      return object;
    }
  }
}
```

## Le code avec la fuite mémoire

Bon voilà pour le code qui simule du code métier avec de l'introspection, maintenant c'est au tour de simuler le service qui engendre une fuite mémoire. L'utilisation des thread est accessoire cela dit, mais ça permet de rappeler le fonctionnement d'une véritable application.

```java
package com.brice.memoryleakwithoutoome;

import java.lang.management.ManagementFactory;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentSkipListSet;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.logging.Logger;

public class Service {

  private static Set<UUID> sessions = new ConcurrentSkipListSet<UUID>();
  private static ExecutorService executor = Executors.newCachedThreadPool();
  private static BusinessLayerWithALotOfReflection businessLayer;
  static {
    try {
      businessLayer = new BusinessLayerWithALotOfReflection(300);
    } catch (Exception e) {
      e.printStackTrace();
      System.exit(1);
    }
  }

  public static void main(String[] args) throws Throwable {
    System.out.println(ManagementFactory.getRuntimeMXBean().getName());
    try {
      while (true) {
        executor.submit(new LeakyThread(businessLayer));
        Thread.sleep(1);
      }
    } catch (Throwable t) {
      Logger.getAnonymousLogger().severe(t.toString());
      throw t;
    }
  }

  private static class LeakyThread extends Thread {
    private BusinessLayerWithALotOfReflection businessLayer;

    public LeakyThread(BusinessLayerWithALotOfReflection businessLayer) {
      this.businessLayer = businessLayer;
    }

    @Override
    public void run() {
      // leak
      sessions.add(UUID.randomUUID());

      // non leaky business logic using a lot reflection
      try {
        businessLayer.performBusinessLogic();
      } catch (Exception e) {
        e.printStackTrace();
        return;
      }
    }
  }
}
```

C'est à la ligne de 30 du code que je contrôle le débit de la fuite mémoire. En effet si je retire ce `Thread.sleep`, il y a très vite une <abbr title="OutOfMemoryError">OOME</abbr>. Pour la fuite mémoire, celle-ci consiste juste à alimenter un liste de `String`. On pourrait par exemple imaginer que dans une application réelle ce code stockerait des objets dans une Map pour chaque session.

Afin de ne pas attendre des heures avec juste quelques `String`, je vais limiter l'espace mémoire de mon application à 10MB:

```default
-Xms10m -Xmx10m
```


Je vais également ajouter les paramètres à la JVM pour suivre le GC.

Et le résultat est là, l'application ne plante toujours pas après 6 minutes.

Effectivement les paramètres de la JVM donnent une allure différente d'une application en production, mais ici le but est de reproduire un scénario de fuite mémoire sans OutOfMemoryError. Le GC a donc l'allure suivante :

![gc](/assets/gc1.png)

On voit un premier Full GC vers 1min30 ou les SoftReferences sont nettoyées, et puis vers 2min30 c'est la catastrophe, il n'y a que des Full GC, la JVM va constamment réclamer les références issues de l'introspection, le programme va constamment en recréer, avec la saturation de la mémoire la lenteur de tous les FullGC devient manifeste. Et comme dit plus haut les thread dump ne vont pas révéler de point de contention, ils vont juste montrer que l'application est lente. En particulier les thread dump vont surtout révéler les stacks des modules ou l'application est plus lente!

D'ailleurs sur la sortie standard, on voit au premier Full GC les traces suivantes, et elles arrivent  plus régulièrement une fois que les GC s'enchainent :

```
...
[Unloading class sun.reflect.GeneratedConstructorAccessor147]
[Unloading class sun.reflect.GeneratedConstructorAccessor419]
[Unloading class sun.reflect.GeneratedMethodAccessor104]
[Unloading class sun.reflect.GeneratedMethodAccessor151]
[Unloading class sun.reflect.GeneratedMethodAccessor57]
[Unloading class sun.reflect.GeneratedMethodAccessor390]
[Unloading class sun.reflect.GeneratedConstructorAccessor8]
[Unloading class sun.reflect.GeneratedMethodAccessor207]
[Unloading class sun.reflect.GeneratedMethodAccessor395]
[Unloading class sun.reflect.GeneratedConstructorAccessor83]
...
```


Autre outil à utiliser, jVisualVM qui est disponible en standard avec le JDK6. On se retrouve avec onglet de monitoring sympa. A noter que les graphes d'activité du CPU ne sont pas disponible en standard sur jVisualVM avec la JDK6.

![visualvm-mon](/assets/visualvm-mon1.png)

Ce que je ne voyais pas avec GCViewer c'est que le nombre de threads actives a dramatiquement baissé, ce qui confirme la lenteur exécution, les traitements mettent vraiment plus longtemps, et les autres threads sont alors mises en standby. Si on fait attention à la fenêtre temporelle, ça passe vers 14h48, à ce moment là, la mémoire heap n'est pas encore complètement saturée les GC tenaient jusque là. C'est ensuite que **les** Full GC prennent le relai pour réclamer de la mémoire, c'est donc à ce moment que les SoftReference sont collectées. Et comme dit plus haut, ces références sont recréées par les *traitements métier*. Et comme le Full GC s'exerce en permanence après ce moment, les références qui viennent d'être recréés sont collectées à nouveau. Et voilà la boucle est bouclée.

# Conclusion

En conclusion, ce n'est pas parce qu'il n'y a pas de OutOfMemoryError qu'il n'y a pas de fuite mémoire. Plus généralement le réflexe c'est de se demander si notre application utilise beaucoup d'introspection ou plus simplement si l'application utilise beaucoup de références plus faibles comme les WeakReference, SoftReference.
