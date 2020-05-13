---
authors: ["brice.dutheil"]
date: "2019-02-14T00:00:00Z"
language: en
slug: immutable-jackson-pojo-with-lombok
title: Immutable jackson pojo with Lombok
# tags: ["Java" ,"Jackson" ,"Json" ,"lombok" ,"immutable"]
published: false
---

## The quest to immutable objects

It's sometime hard to keep following good principles in object oriented 
paradigm especially if we'd like to enjoy modern tooling that those that 
generates code for us.

This quick writing is not about whether one should use Lombok, Jackson, etc.
or not, there's reasonable arguments that goes both way. But rather on how 
to keep a simple principle in his code base : immutable objects.

They are quite easy to get right using vanilla Java. But when you have tons 
of objects with various boiler plate code like the accessors and constructors, 
generation tool may come naturally to reduce the repetitive tasks. And that's 
not even considering the maintenance cost of all this boiler plate code.

## A _simple_ bean

If the project don't have Lombok, the pojos will look a lot like this

```java
public class TrainSchedule {
  private TrainNumber trainNumber;
  private OffsetDateTime departureDateTime;
  
  // other fields
  
  public void setTrainNumber(TrainNumber id) { this.id = id; }
  public TrainNumber getTrainNumber() { return id; }
  public void setDepartureDateTime(OffsetDateTime departureDateTime) { 
    this.departureDateTime = departureDateTime;
  }
  public OffsetDateTime getDepartureDateTime() { return departureDateTime; }
  
  // other accessors
  // eventually toString, equals and haschCode
}
```




