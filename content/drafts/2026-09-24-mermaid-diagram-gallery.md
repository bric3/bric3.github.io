---
authors: ["brice.dutheil"]
date: "2026-09-24T21:00:00+02:00"
language: en
draft: true
tags: ["mermaid", "diagrams"]
slug: "mermaid-diagram-gallery"
title: "Mermaid 11 diagram gallery"
summary: "A rendering gallery for every diagram type bundled with Mermaid 11.17.2."
---

This draft exercises every diagram type registered by the Mermaid `11.17.2` core browser bundle.
The five C4 forms and four railroad grammars have separate examples. ZenUML is not included because
Mermaid distributes it as a separate plugin.

## Flowchart

```mermaid
flowchart LR
    Source[Diagram source] --> Hugo
    Hugo --> Browser
    Browser --> SVG
```

## ELK flowchart

```mermaid
flowchart-elk TB
    A[Large graph] --> B{Layout}
    B --> C[ELK]
    B --> D[SVG]
```

## Sequence diagram

```mermaid
sequenceDiagram
    participant Reader
    participant Blog
    participant Mermaid
    Reader->>Blog: Open article
    Blog->>Mermaid: Render diagram
    Mermaid-->>Reader: Display SVG
```

## Class diagram

```mermaid
classDiagram
    class Article {
        +String title
        +render()
    }
    class Diagram {
        +String source
        +toSvg()
    }
    Article *-- Diagram
```

## State diagram

```mermaid
stateDiagram-v2
    [*] --> Source
    Source --> Rendering
    Rendering --> Rendered
    Rendering --> Failed
    Rendered --> [*]
    Failed --> Source
```

## Entity relationship diagram

```mermaid
erDiagram
    ARTICLE ||--o{ DIAGRAM : contains
    ARTICLE {
        string title
        string format
    }
    DIAGRAM {
        string type
        string source
    }
```

## User journey

```mermaid
journey
    title Reading a diagram
    section Open article
      Load page: 5: Reader
      Find diagram: 4: Reader
    section Understand
      Inspect relationships: 5: Reader
      Follow source link: 4: Reader
```

## Gantt chart

```mermaid
gantt
    title Mermaid support
    dateFormat YYYY-MM-DD
    section Implementation
      Add renderer :done, render, 2026-09-24, 1d
      Add gallery  :active, gallery, after render, 1d
```

## Pie chart

```mermaid
pie showData title Diagram sources
    "Markdown" : 60
    "AsciiDoc" : 40
```

## Quadrant chart

```mermaid
quadrantChart
    title Diagram value
    x-axis Simple --> Complex
    y-axis Decorative --> Explanatory
    quadrant-1 Worth the space
    quadrant-2 Strong visual
    quadrant-3 Prefer prose
    quadrant-4 Add context
    Flowchart: [0.30, 0.75]
    Sequence: [0.55, 0.90]
    Pie: [0.20, 0.30]
```

## Requirement diagram

```mermaid
requirementDiagram
    requirement browser_rendering {
        id: REQ1
        text: Render Mermaid source as SVG
        risk: low
        verifymethod: test
    }
    element blog_page {
        type: document
    }
    blog_page - satisfies -> browser_rendering
```

## Git graph

```mermaid
gitGraph
    commit id: "base"
    branch mermaid-support
    checkout mermaid-support
    commit id: "renderer"
    commit id: "gallery"
    checkout main
    merge mermaid-support
```

## C4 system context

```mermaid
C4Context
    title Blog diagram context
    Person(reader, "Reader", "Reads technical articles")
    System(blog, "Hugo blog", "Publishes Markdown and AsciiDoc")
    System_Ext(cdn, "Mermaid CDN", "Provides the browser module")
    Rel(reader, blog, "Reads")
    Rel(blog, cdn, "Loads Mermaid from")
```

## C4 container

```mermaid
C4Container
    title Blog containers
    Person(author, "Author")
    System_Boundary(blog, "Hugo blog") {
        Container(content, "Content", "Markdown and AsciiDoc", "Stores articles")
        Container(site, "Generated site", "HTML and JavaScript", "Serves articles")
    }
    Rel(author, content, "Writes")
    Rel(content, site, "Hugo builds")
```

## C4 component

```mermaid
C4Component
    title Rendering components
    Container_Boundary(site, "Generated site") {
        Component(article, "Article", "HTML", "Contains Mermaid source")
        Component(renderer, "Mermaid renderer", "JavaScript", "Produces SVG")
    }
    Rel(article, renderer, "Rendered by")
```

## C4 dynamic

```mermaid
C4Dynamic
    title Runtime rendering
    Person(reader, "Reader")
    Container(page, "Article page", "HTML")
    Container(renderer, "Mermaid", "JavaScript")
    Rel(reader, page, "1. Opens")
    Rel(page, renderer, "2. Requests rendering")
    Rel(renderer, page, "3. Inserts SVG")
```

## C4 deployment

```mermaid
C4Deployment
    title Blog deployment
    Deployment_Node(browser, "Reader device", "Browser") {
        Container(page, "Article page", "HTML")
    }
    Deployment_Node(edge, "CDN", "Static hosting") {
        Container(site, "Generated blog", "Hugo output")
    }
    Rel(page, site, "Loads", "HTTPS")
```

## Mindmap

```mermaid
mindmap
  root((Mermaid))
    Structure
      Flowchart
      Class
      State
    Time
      Sequence
      Timeline
      Gantt
    Data
      ER
      Sankey
      XY chart
```

## Timeline

```mermaid
timeline
    title Diagram rendering
    Authoring : Write Mermaid source
    Build : Hugo preserves the code block
    Browser : Mermaid replaces it with SVG
```

## Sankey diagram

```mermaid
sankey-beta
Markdown,Hugo,60
AsciiDoc,Hugo,40
Hugo,Mermaid,100
Mermaid,SVG,100
```

## XY chart

```mermaid
xychart
    title "Rendered diagrams"
    x-axis [Flowchart, Sequence, Class, State, ER]
    y-axis "Count" 0 --> 10
    bar [8, 6, 4, 5, 3]
    line [7, 7, 5, 4, 4]
```

## Block diagram

```mermaid
block-beta
    columns 3
    Source space Renderer
    space:2 SVG
    Source --> Renderer
    Renderer --> SVG
```

## Packet diagram

```mermaid
packet-beta
    0-3: "Version"
    4-7: "Type"
    8-15: "Length"
    16-31: "Diagram payload"
```

## Kanban board

```mermaid
kanban
    backlog[Backlog]
        source[Write source]
    active[Rendering]
        parse[Parse diagram]
    done[Done]
        svg[Display SVG]
```

## Architecture diagram

```mermaid
architecture-beta
    group blog(cloud)[Blog]
    service content(disk)[Content] in blog
    service hugo(server)[Hugo] in blog
    service browser(internet)[Browser]
    content:R -- L:hugo
    hugo:R -- L:browser
```

## Radar chart

```mermaid
radar-beta
    axis clarity["Clarity"], speed["Speed"], detail["Detail"], reach["Reach"]
    curve prose["Prose"]{90, 85, 80, 95}
    curve diagram["Diagram"]{85, 70, 95, 80}
    max 100
    min 0
```

## Treemap

```mermaid
treemap-beta
"Structural"
    "Flowchart": 30
    "Class": 20
    "State": 15
"Temporal"
    "Sequence": 25
    "Timeline": 10
```

## Venn diagram

```mermaid
venn-beta
    title "Authoring support"
    set Markdown
    set AsciiDoc
    union Markdown,AsciiDoc["Mermaid diagrams"]
```

## Swimlane diagram

```mermaid
swimlane-beta LR
    subgraph Author
        write[Write diagram]
    end
    subgraph Hugo
        preserve[Preserve source]
    end
    subgraph Browser
        render[Render SVG]
    end
    write --> preserve --> render
```

## Event modeling diagram

```mermaid
eventmodeling
    tf 01 ui ArticlePage
    tf 02 cmd RenderDiagram
    tf 03 evt DiagramRendered
```

## Tree view

```mermaid
treeView-beta
├── content/
│   ├── posts/
│   └── drafts/
├── layouts/
│   └── partials/
└── hugo.toml
```

## Ishikawa diagram

```mermaid
ishikawa-beta
    Broken diagram
    Source
        Invalid syntax
        Unsupported type
    Runtime
        Module unavailable
        Browser too old
    Styling
        Low contrast
        Overflow
```

## Wardley map

```mermaid
wardley-beta
    title Blog diagram value chain
    anchor Reader [0.95, 0.70]
    component Article [0.80, 0.65]
    component Hugo [0.55, 0.55]
    component Mermaid [0.35, 0.40]
    component Browser [0.15, 0.75]
    Reader -> Article
    Article -> Hugo
    Hugo -> Mermaid
    Mermaid -> Browser
```

## Cynefin diagram

```mermaid
cynefin-beta
    title Diagram choices
    complex
        "Architecture overview"
    complicated
        "Concurrency sequence"
    clear
        "Simple flowchart"
    chaotic
        "Incident timeline"
    confusion
        "Unknown audience"
```

## Railroad diagram: EBNF

```mermaid
railroad-ebnf-beta
    title "Mermaid fence"
    diagram = "```mermaid" source "```" ;
    source = identifier+ ;
```

## Railroad diagram: ABNF

```mermaid
railroad-abnf-beta
    title "Diagram identifier"
    identifier = ALPHA *( ALPHA / DIGIT / "-" ) ;
```

## Railroad diagram: PEG

```mermaid
railroad-peg-beta
    title "Simple expression"
    Expression <- Term (("+" / "-") Term)* ;
    Term <- Number ;
    Number <- Digit+ ;
    Digit <- "0" / "1" / "2" / "3" ;
```

## Railroad diagram: intermediate representation

```mermaid
railroad-beta
    title Diagram source
    source = sequence(
        terminal("```mermaid"),
        oneOrMore(nonterminal("statement")),
        terminal("```")
    ) ;
```

## Info diagram

```mermaid
info
```
