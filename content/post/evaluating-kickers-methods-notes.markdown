---
author: ""
categories:
- Data science
- R
date: "2019-12-08"
disable_jquery: false
draft: false
image:
  caption: ""
  focal_point: ""
math: false
mathjax: false
output:
  blogdown::html_page:
    toc: true
photoswipe: false
slug: kickers-methods-notes
summary: Here I discuss statistical and logistical details involved in my attempts
  at modeling kicker talent. This includes model selection as well as a brief history
  of research. I use some quantitative assessments to compare my approach to previous
  attempts and it does quite well.
tags:
- statistics
- NFL
- sports
- data science
- R
- Bayesian statistics
title: Building a statistical model for field goal kicker accuracy
---



{{% callout note %}}
This is the methodological companion to [my post](/post/evaluating-kickers) on
my proposed method for evaluating NFL kickers. To get all the results and 
some extra info about the data, check it out.
{{% / callout %}}

When you have a hammer, everything looks like a nail, right? Well I'm a big
fan of multilevel models and especially the ability of MCMC estimation to 
fit these models with many, often sparse, groups. Great software implementations
like [Stan](https://mc-stan.org) and my favorite R interface to it, 
[`brms`](https://paul-buerkner.github.io/brms/index.html) make doing applied 
work pretty straightforward and even fun. 

As I spent time lamenting the disappointing season my Chicago Bears have been
having, I tried to think about how seriously I should take the shakiness of 
their new kicker, Eddy Pineiro. Just watching casually, it can be hard to really
know whether a kicker has had a very difficult set of kicks or not and what 
an acceptable FG% would be. This got me thinking about how I could use what 
I know to satisfy my curiosity. 

## Previous efforts

Of course, I'm not exactly the first person to want to do something to account
for those differences. Chase Stuart over 
[at Football Perspectives](http://www.footballperspective.com/the-greatest-field-goal-kickers-of-all-time-ii-part-i/)
used field goal distance to adjust FG% for difficulty (as well as comparing 
kickers across eras by factoring in generational differences in kicking success).
[Football Outsiders](https://www.footballoutsiders.com/info/methods#specialteams)
does something similar --- adjusting for distance --- when grading kickers. 
Generally speaking, the evidence suggests that just dealing with kick distance
gets you very far along the path to identifying the best kickers.

Chris Clement at the 
[Passes and Patterns blog](https://passesandpatterns.blogspot.com/2018/12/three-point-plays-analytics-of-field.html) 
provides a nice review of the statistical and theoretical approaches to the 
issue. There are several things that are clear from previous efforts, besides
the centrality of kick distance. Statistically, methods based
on the logistic regression model are appropriate and the most popular --- 
logistic regression is a statistical method designed to predict binary events
(e.g., making/missing a field goal) using multiple sources of information. And
besides kick distance, there are certainly elements of the environment that 
matter --- wind, temperature, elevation among them --- although just how much
and how easily they can be measured is a matter of debate.

There has also been a lot of interest in game situations, especially clutch
kicking. Do kickers perform worse under pressure, like when their kicks will
tie the game or give their team the lead late in the game? Does "icing" the
kicker, by calling a timeout before the kick, make the kicker less likely to
be successful? Do they perform worse in playoff games? 

On **icing**, [Moskowitz and Wertheim  (2011)](https://www.amazon.com/Scorecasting-Hidden-Influences-Behind-Sports/dp/0307591794), 
[Stats, Inc.](https://web.archive.org/web/20091207082510/http://thesportseconomist.com/2005/01/icing-kicker.htm), 
[Clark, Johnson, and Stimpson (2013)](http://www.sloansportsconference.com/wp-content/uploads/2013/Going%20for%20Three%20Predicting%20the%20Likelihood%20of%20Field%20Goal%20Success%20with%20Logistic%20Regression.pdf), 
and [LeDoux (2016)](https://ejournals.bc.edu/index.php/elements/article/view/9448/8514)
do not find compelling evidence that icing the kicker is effective. On the other
hand, 
[Berry and Wood (2004)](http://www.tandfonline.com/doi/full/10.1080/09332480.2004.10554926) 
[Goldschmied, Nankin, and Cafri (2010)](https://journals.humankinetics.com/view/journals/tsp/24/3/article-p300.xml),
and [Carney (2016)](https://mixpanel.com/blog/2016/11/22/nfl-data-icing-the-kicker/)
do find some evidence that icing hurts the kicker. All these have some limitations,
including which situations qualify as "icing" and whether we can identify 
those situations in archival data. In general, to the extent there may be an
effect, it looks quite small.

Most important in this prior work is the establishment of a few approaches to
quantification. A useful way to think about comparing kickers is to know what
their **expected FG%** (eFG%) is. That is, given the difficulty of their kicks,
how
would some hypothetical average kicker have fared? Once we have an expected FG%,
we can more sensibly look at the kicker's actual FG%. If we have two kickers
with an actual FG% of 80%, and kicker A had an eFG% of 75% while 
kicker B had an eFG% of 80%, we can say kicker A is doing better because he 
clearly had a more difficult set of kicks and still made them at the same rate.

Likewise, once we have eFG%, we can compute **points above average** (PAA). 
This is fairly straightforward since we're basically just going to take the
eFG% and FG% and weight them by the number of kicks. This allows us to 
appreciate the kickers who accumulate the most impressive (or unimpressive) 
kicks over the long haul. And since coaches generally won't try kicks they 
expect to be missed, it rewards kickers who win the trust of their coaches and
get more opportunities to kick. 

Extensions of these include **replacement FG%** and **points above 
replacement**, which use replacement level as a reference point rather than 
average. This is useful because if you want to know whether a kicker is playing
badly enough to be fired, you need some idea of who the competition is. 
PAA and eFG% are more useful when you're talking about greatness and who 
deserves a pay raise.

### Statistical innovations

The most important --- in my view --- entries into the "evaluating kickers with
statistical models" literature are papers by
[Pasteur and Cunningham-Rhoads (2014)](https://www.degruyter.com/view/j/jqas.2014.10.issue-1/jqas-2013-0039/jqas-2013-0039.xml) as well as 
[Osborne and Levine (2017)](https://content.iospress.com/articles/journal-of-sports-analytics/jsa140). 

Pasteur and Cunningham-Rhoads --- I'll refer to them as PC-R for short --- 
gathered more data than most predecessors, particularly in terms of auxiliary
environmental info. They have wind, temperature, and presence/absence of 
precipitation. They show fairly convincingly that while modeling kick distance
is the most important thing, these other factors are important as well. PC-R
also find the cardinal direction of every NFL stadium (i.e., does it run 
north-south, east-west, etc.) and use this information along with wind direction
data to assess the presence of cross-winds, which are perhaps the trickiest for
kickers to deal with. They can't know about headwinds/tailwinds because as far
as they (and I) can tell, nobody bothers to record which end zone teams defend
at the game's coin toss, so we don't know without looking at video which 
direction the kick is going. They ultimately combine the total wind and the 
cross wind, suggesting they have some meaningful measurement error that makes 
them not accurately capture all the cross-winds. Using
their logistic regressions that factor for these several factors, they calculate
an eFG% and use it and its derivatives to rank the kickers.

PC-R
include some predictors that, while empirically justifiable based on their 
results, I don't care to include. These are especially indicators of defense 
quality, because I don't think this should logically effect the success of a 
kick and is probably related to the selection bias inherent to the coach's 
decision to try a kick or not. They also include a "kicker fatigue" variable
that appears to show that kickers attempting 5+ kicks in a game are less 
successful than expected. I don't think this makes sense and so I'm not 
going to include it for my purposes. 

They put some effort into defining a 
"replacement-level" kicker which I think is sensible in spite of some limitations
they acknowledge. In my own efforts, I decided to do something fairly similar 
by using circumstantial evidence to classify a given kicker in a given 
situation as a replacement or not. 

PC-R note that their model seems to overestimate the probability of very long 
kicks, which is not surprising from a statistical standpoint given that there
are rather few such kicks, they are especially likely to only be taken by those
with an above-average likelihood of making them, and the statistical assumption
of linearity is most likely to break down on the fringes like this. They also
mention it would be nice to be able to account for kickers having different
leg strengths and not just differing in their accuracy.

Osborne and Levine (I'll call them OL) take an important step in trying to 
improve upon some of these limitations. Although they don't use this phrasing,
they are basically proposing to use multilevel models, which treat each kicker
as his own group and thereby accounting for the possibility --- I'd say it's a
certainty --- that kickers differ from one another in skill. 

A multilevel 
model has several positive attributes, especially that it not only adjusts for
the apparent differences in kickers but also that it looks skeptically upon
small sample sizes. A guy who makes a 55-yard kick in his first career attempt
won't be dubbed the presumptive best kicker of all time because the model will
by design account for the fact that a single kick isn't very informative. This
means we can simultaneously improve the prediction accuracy on kicks, but also
use the model's estimates of kicker ability without over-interpreting 
small sample sizes. They also attempt to use a quadratic term for kick
distance, which could better capture the extent to which the marginal 
difference of a few extra yards of distance is a lot different when you're at
30 vs. 40 vs. 50 yards. OL are unsure about whether the model justifies 
including the quadratic term but I think on theoretical grounds it makes a lot 
of sense.

OL also discuss using a clog-log link rather than the logistic link, showing 
that it has better predictive accuracy under some conditions. I am going to
ignore that advice for a few reasons, most importantly because the advantage is
small and also because the clog-log link is computationally intractable with
the software I'm using.

## Model

{{% callout note %}}
Code and data for reproducing these analyses can be found 
[on Github](https://github.com/jacob-long/NFL-kicker-analysis)
{{% / callout %}}

My tool is a multilevel logistic regression fit via 
MCMC using the wonderful 
[`brms`](https://paul-buerkner.github.io/brms/index.html) R package. 
I actually considered several models for model selection.

In all cases, I have random intercepts for kicker and stadium. I also use 
random slopes for both kick distance and wind at the stadium level. Using 
random wind slopes at the stadium level will hopefully capture the *prevailing*
winds at that stadium. If they tend to be helpful, it'll have a larger absolute
slope. Some stadiums may have swirling winds and this helps capture that as 
well. The random slope for distance hopefully captures some other things, like 
elevation. I also include interaction terms for wind and kick distance as well
as temperature and kick distance, since the elements may only affect longer 
kicks.

There are indicators for whether the kick was "clutch" --- game-tying or 
go-ahead in the 4th quarter --- whether the kicker was "iced," and whether
the kick occurred in the playoffs. There is an interaction term between 
clutch kicks and icing to capture the ideal icing situation as well.

I have a binary variable indicating whether the kicker was, at the time, a 
replacement. In the [main post](/post/evaluating-kickers), I describe the
decision rules involved in that. I have interaction terms for replacement
kickers and kick distance as well as replacement kickers and clutch kicks.

I have two random slopes at the kicker level:

* Kick distance (allowing some kickers to have stronger legs)
* Season (allowing kickers to have a career trajectory)

Season is modeled with a quadratic term so that kickers can decline over
time --- it also helps with the over-time ebb and flow of NFL FG%. It would
probably be better to use a GAM for this to be more flexible, but they are a 
pain.

All I've disclosed so far is enough to have one model. But I also explore
the form of kick distance using polynomials. OL used a quadratic term, but I'm
not sure even that is enough. I compare 2nd, 3rd, and 4th degree polynomials
for kick distance to try to improve the prediction of long kicks in particular.
Of course, going down the road of polynomials can put you on a glide path 
towards the land of overfitting. 

I fit several models, with combinations of the following:

* 2nd, 3rd, or 4th degree polynomial
* `brms` default improper priors on the fixed and random effects or 
weakly informative normal priors on the fixed and random effects
* Interactions with kick distance with either all polynomial terms or just 
the first and second degree terms

That last category is one that I suspected --- and later confirmed --- could
cause some weird results. Allowing all these things to interact with a 3rd 
and 4th degree polynomial term made for some odd predictions on the fringes, 
like replacement-level kickers having a predicted FG% of 70% at 70 yards out.

## Model selection

I looked at several criteria to compare models.

A major one was
[approximate leave-one-out cross-validation](https://paul-buerkner.github.io/brms/reference/loo.brmsfit.html). 
I will show the LOOIC, which is interpreted like AIC/BIC/DIC/WAIC in terms of 
lower numbers being better. This produces the same ordering as the ELPD, which 
has the opposite interpretation in that higher numbers are better.
Another thing I looked at was generating prediction weights for the models via 
[Bayesian model stacking](https://projecteuclid.org/euclid.ba/1516093227). 
I also calculated [Brier scores](https://en.wikipedia.org/wiki/Brier_score),
which are a standard tool for looking at prediction accuracy for binary 
outcomes and are simply the mean squared prediction error. Last among the
quantitative measures is the 
[AUC](https://en.wikipedia.org/wiki/Receiver_operating_characteristic) 
(*a*rea *u*nder the *c*urve), which is another standard tool in the evaluation
of binary prediction models.

Beyond these, I also plotted predictions in areas of interest where I'd like
the model to perform well (like on long kicks) and checked certain cases
where external information not shown directly to the model gives me a relatively
strong prior. Chief among these was whether it separated the strong-legged
kickers well.

Below I've summarized the model comparison results. I shade the metrics 
darker wherever the number is better --- sometimes lower numbers are better,
sometimes higher numbers are. The bolded, red-colored row is the model I 
used.

<table class="table" style="margin-left: auto; margin-right: auto;">
 <thead>
<tr>
<th style="border-bottom:hidden; padding-bottom:0; padding-left:3px;padding-right:3px;text-align: center; " colspan="3"><div style="border-bottom: 1px solid #ddd; padding-bottom: 5px; ">Model specification</div></th>
<th style="border-bottom:hidden; padding-bottom:0; padding-left:3px;padding-right:3px;text-align: center; " colspan="4"><div style="border-bottom: 1px solid #ddd; padding-bottom: 5px; ">Model fit metrics</div></th>
</tr>
  <tr>
   <th style="text-align:left;"> Polynomial degree </th>
   <th style="text-align:left;"> Interaction degree </th>
   <th style="text-align:left;"> Priors </th>
   <th style="text-align:left;"> LOOIC </th>
   <th style="text-align:left;"> Model weight </th>
   <th style="text-align:left;"> Brier score </th>
   <th style="text-align:left;"> AUC </th>
  </tr>
 </thead>
<tbody>
  <tr>
   <td style="text-align:left;"> 3 </td>
   <td style="text-align:left;"> 2 </td>
   <td style="text-align:left;"> Proper </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #71ca97">8030.265</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #71ca97">0.5083</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #bce9cf">0.1165</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #cbefdb">0.7786</span> </td>
  </tr>
  <tr>
   <td style="text-align:left;"> 4 </td>
   <td style="text-align:left;"> 2 </td>
   <td style="text-align:left;"> Proper </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #81d0a3">8032.332</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #bde9d0">0.1533</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #b4e5c9">0.1164</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #bde9d0">0.7792</span> </td>
  </tr>
  <tr>
   <td style="text-align:left;font-weight: bold;color: #aa0000 !important;"> 3 </td>
   <td style="text-align:left;font-weight: bold;color: #aa0000 !important;"> 2 </td>
   <td style="text-align:left;font-weight: bold;color: #aa0000 !important;"> Improper </td>
   <td style="text-align:left;font-weight: bold;color: #aa0000 !important;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #84d2a5">8032.726</span> </td>
   <td style="text-align:left;font-weight: bold;color: #aa0000 !important;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #cdf0dc">0.0763</span> </td>
   <td style="text-align:left;font-weight: bold;color: #aa0000 !important;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #92d7b0">0.1160</span> </td>
   <td style="text-align:left;font-weight: bold;color: #aa0000 !important;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #91d7af">0.7811</span> </td>
  </tr>
  <tr>
   <td style="text-align:left;"> 3 </td>
   <td style="text-align:left;"> 3 </td>
   <td style="text-align:left;"> Proper </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #8ed6ac">8033.879</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #ddf6e8">0.0001</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #bce9cf">0.1165</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #c9eed9">0.7787</span> </td>
  </tr>
  <tr>
   <td style="text-align:left;"> 3 </td>
   <td style="text-align:left;"> 3 </td>
   <td style="text-align:left;"> Improper </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #9cdbb7">8035.616</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #b2e4c8">0.2042</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #81d0a3">0.1158</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #88d3a8">0.7815</span> </td>
  </tr>
  <tr>
   <td style="text-align:left;"> 4 </td>
   <td style="text-align:left;"> 2 </td>
   <td style="text-align:left;"> Improper </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #a4dfbd">8036.614</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #ddf6e8">0.0001</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #81d0a3">0.1158</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #85d2a6">0.7816</span> </td>
  </tr>
  <tr>
   <td style="text-align:left;"> 4 </td>
   <td style="text-align:left;"> 4 </td>
   <td style="text-align:left;"> Proper </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #b1e4c7">8038.266</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #def7e9">0.0000</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #abe2c3">0.1163</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #bbe8ce">0.7793</span> </td>
  </tr>
  <tr>
   <td style="text-align:left;"> 2 </td>
   <td style="text-align:left;"> 2 </td>
   <td style="text-align:left;"> Proper </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #d9f5e5">8043.221</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #def7e9">0.0000</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #def7e9">0.1169</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #def7e9">0.7778</span> </td>
  </tr>
  <tr>
   <td style="text-align:left;"> 2 </td>
   <td style="text-align:left;"> 2 </td>
   <td style="text-align:left;"> Improper </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #dbf6e7">8043.450</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #d1f1df">0.0577</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #bce9cf">0.1165</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #afe3c6">0.7798</span> </td>
  </tr>
  <tr>
   <td style="text-align:left;"> 4 </td>
   <td style="text-align:left;"> 4 </td>
   <td style="text-align:left;"> Improper </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #def7e9">8043.741</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #def7e9">0.0000</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #71ca97">0.1156</span> </td>
   <td style="text-align:left;"> <span style="display: block; padding: 0 4px; border-radius: 4px; background-color: #71ca97">0.7825</span> </td>
  </tr>
</tbody>
</table>

So why did I choose that model? The approximate LOO-CV procedure picks it as
the third model, although there's enough uncertainty around those estimates 
that it could easily be the best --- or not as good as some ranked below it.
It's not clear that the 4th degree polynomial does a lot of good in the 
models that have it and it increases the risk of overfitting. It seems to 
reduce the predicted probability of very long kicks, but as I've thought about
it more I'm not sure it's a virtue.

Compared to the top two models, which distinguish themselves from the chosen
model by their use of proper priors, the model I chose does better on the 
in-sample prediction accuracy metrics without looking much different on the
approximate out-of-sample ones. It doesn't get much weight because it doesn't
have much unique information compared to the slightly-preferred version with
proper priors. But as I looked at the models' predictions, it appeared to me
that the regularization with the normal priors was a little too aggressive
and wasn't picking up on the differences among kickers in leg strength.

That being said, the choices among these top few models are not very important
at all when it comes to the basics of who are the top and bottom ranked kickers.

### Comparisons to previous work

PC-R report Brier scores in their paper, so that can serve as a useful 
benchmark. Their final model has Brier score of 0.1226, which is higher 
(worse) than all my candidate models. I should note, though, that they use a
K-fold cross-validation procedure to select a model which could lead to a
worse choice by this metric since just adding more predictors can arbitrarily
improve the Brier score within sample. That being said, I think a multilevel
model is bound to outperform one without kicker and stadium random effects.

An interesting note of comparison to PC-R, whose data have minimal overlap with
mine in terms of timespan covered: We agree on the best kicker season, 
Sebastian Janikowski's 2009. My model thinks it was worth a little more over
replacement, but it's really quite close.

OL, on the other hand, focus primarily on AUC in terms of measures that can
reasonably be compared across datasets. Their clog-log model maxes out at 
.7646, which again is worse than all of my models. That being said, I still
want to apply some caution because our procedures aren't all that different,
the set of kicks under analysis are only partially overlapping, and they 
used a different model selection process that could potentially be choosing
a model worse at in-sample prediction because it doesn't do well out of sample.
I can't do these procedures for computational reasons.

## Notes on predicted success

I initially resisted including things like replacement status and anything else
that is a fixed characteristic of a kicker (at least within a season) or 
kicker-specific slopes in the
model because I planned to extract the random intercepts and use that as my
metric. Adding those things would make the random intercepts less interpretable;
if a kicker is bad and there's no "replacement" variable, then the intercept
will be negative, but with the "replacement" variable the kicker may not have
a negative intercept after the adjustment for replacement status.

Instead, I decided to focus on model predictions. Generating the expected
FG% and replacement FG% was pretty straightforward. For eFG%, take all kicks
attempted and set `replacement = 0`. For rFG%, take all kicks and set 
`replacement = 1`. 

To generate kicker-specific probabilities, though, I had to decide how to
incorporate this information. I'd clearly overrate new, replacement-level
kickers. My solution to this was to, before generating predictions on 
hypothetical data, set each kicker's `replacement` variable to his career
average. 

For `season`, on the other hand, I could eliminate the kicker-specific 
aspect of this by intentionally zeroing these effects out in the 
predictions. If I wanted to predict success in a specific season, of course,
I could include this.
