---
authors: ["brice.dutheil"]
date: "{{ .Date }}"
language: en
draft: true
tags: ["cool-tag"]
slug: "{{ .Name | replaceRE "\\d{4}-\\d{2}-\\d{2}-(.*)" "$1" }}" 
title: "{{ .Name | replaceRE "\\d{4}-\\d{2}-\\d{2}-(.*)" "$1" | replaceRE "-" " " | title }}"
---

**Insert Lead paragraph here.**

<!--more-->


## New stuff



