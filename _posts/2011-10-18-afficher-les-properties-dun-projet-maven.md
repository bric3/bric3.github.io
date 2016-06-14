---
layout: post
title: Afficher les properties d'un projet maven
date: 2011-10-18 12:15:28.000000000 +02:00
type: post
published: true
status: publish
categories:
- maven
tags:
- ant
- maven
- properties
meta:
  _syntaxhighlighter_encoded: '1'
  _edit_last: '1'
  _su_rich_snippet_type: none
author: Brice Dutheil
---
Pas vraiment un article mais plutôt une astuce que j'ai utilisé pour afficher la valeur de certaines property.

Il faut ajouter dans la section build/plugins du pom une tache ant qui fera simplement un echo. A noter que cette tache est disponible dans la phase validate.

```xml
<build>
<plugins>

    <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-antrun-plugin</artifactId>
        <version>1.1</version>
        <executions>
            <execution>
                <phase>validate-property</phase>
                <goals>
                    <goal>run</goal>
                </goals>
                <configuration>
                    <tasks>
                        <echo>Displaying properties resolution</echo>
                        <echo>some.property]= ${some.property}</echo>
                        <echo>project.build.directory = ${project.build.directory</echo>

                        <echo>project.build.finalName= ${project.build.finalName}</echo>
                    </tasks>
                </configuration>
            </execution>
        </executions>
    </plugin>

</plugins>
<build>
```

Cela dit n'étant pas un expert maven, il y existe peut-être une solution plus élégante, un commentaire est le bienvenu dans ce cas.
