---
categories:
- R
date: "2019-05-21"
draft: false
image:
  caption: ""
  focal_point: ""
slug: comparing-panelr-and-plm
summary: It has been just a little more than a day since I announced my new R package,
  `panelr`, to the wider world. There's at least one comparable package for R, called
  `plm`, which is very good and should be particularly appealing for economists. This
  leads to the understandable question as to how `panelr` differs from `plm`.
tags:
- panel data
- panelr
- R
- statistics
- plm
title: Comparing `panelr` and `plm`
---

It has been just a little more than a day since I announced my new R package,
`panelr`, to the wider world.

{{<tweet 1130489445550043137>}}

Quite frankly, I've been surprised by the level of attention! Some responses
have been calls for *economists* to check the package out (they are certainly 
welcome to do so) as well as things along the lines of there finally being 
a package for panel data in R. So let me make something clear: There's at least
one comparable package for R, called `plm`, which is very good and should be
particularly appealing for economists. This leads to the understandable question
as to how `panelr` differs from `plm`.

{{<tweet 1130864919807549440 >}}

The `plm` package has been around [since 2006](https://cran.r-project.org/src/contrib/Archive/plm/) and is quite good. 
I didn't make `panelr` out of any kind of deep dissatisfaction with `plm` nor 
the idea that it needed to be superseded. 

Yves Croissant and Giovanni Millo 
discuss in `plm`'s [main vignette](https://cran.r-project.org/web/packages/plm/vignettes/plmPackage.html) the fact that there is a great deal of overlap between econometric
treatment of panel data and other statistical approaches to panel data, like 
multilevel modeling. They note, among, other things,

> while a very comprehensive software framework for (among many other features) maximum likelihood estimation of linear regression models for longitudinal data, packages nlme (Pinheiro et al. 2007) and lme4 (Bates 2007), is available in the R environment and can be used, e.g., for estimation of random effects panel models, its use is not intuitive for a practicing econometrician, and maximum likelihood estimation is only one of the possible approaches to panel data econometrics.

and 

> Furthermore, we felt there was a need for automation of some basic data management tasks such as lagging, summing and, more in general, applying (in the R sense) functions to the data, which, although conceptually simple, become cumbersome and error-prone on two-dimensional data, especially in the case of unbalanced panels.

I totally agree with these things. I, however, am not an econometrician, so I
came to this area with the opposite problem as Croissant and Millo. I like and
respect `plm` a great deal, but

> a package doing panel data “from the econometrician’s viewpoint”

is the opposite of what I was looking for. The way I am accustomed to 
thinking and talking about panel data analysis is different from the standard
econometric approach, for better or worse. My training in this area comes mostly
from sociologists, who are of course not ignorant of econometrics but have 
different preferences and norms. There is a lot of overlap, but ultimately I 
was motivated to fit a type of model that I would not expect to see in `plm` 
even though it is closely related. Those efforts led to `panelr`.

So here's the **TL;DR:**

* I wanted to simplify the fitting of panel models that use multilevel 
models for estimation, especially the kind that produces within-entity effects
equivalent to econometric fixed effects models.
* I subsequently wanted to streamline GEE estimation of these models.
* I wanted to create a function that estimates asymmetric effects models (Allison, 2019).
* The `panel_data` object inherits from grouped `tibbles` and should fit well
into workflows that rely on the "tidyverse."
* I have included tools that make reshaping data from wide to long and vice 
versa more user-friendly.
* The documentation and general approach talk about panel data in ways that
are more familiar to me and people similarly trained.

**Longer version:**

Bell and Jones (2015) describe a model specification for panel data that uses
the estimation technique econometricians would use for what they call "random
effects" models but generates estimates equivalent to what econometricians call
"fixed effects" models. This is achieved using multilevel (also known as mixed)
models and including individual-level means of time-varying predictors in the
model[^caveat]. What you get are within-entity estimates (exactly equivalent to
fixed effects) along with between-entity effect estimates, which are not robust
to confounding from stable predictors but nonetheless may be of substantive
interest. This further enables the analyst to include other time-stable 
covariates, incorporate random slopes or additional grouping factors, and even
move to generalized models (e.g., logit). 

The equivalence of these models was first noted by Mundlak (1978). 
Multilevel modeling researchers have been estimating models like this for some
time (e.g., Kreft, de Leeuw, & Aiken, 1995; Hofmann & Gavin, 1998; Raudenbush & Bryk, 2002).
Only recently has there been wider recognition of the near-equivalence of 
fixed effects models and this multilevel model that I and some others refer to 
as the "within-between" model (Allison, 2009; Bell & Jones, 2015).

Wanting to fit these models is what got me started on the road to `panelr`.
The transformations needed to properly fit the models were quite tedious and,
to quote Croissant and Millo, I "felt there was a need for automation of some 
basic data management tasks such as lagging, summing and, more in general, 
applying (in the R sense) functions to the data, which, although conceptually 
simple, become cumbersome and error-prone." With the popularity of `dplyr` for
data manipulation, and the fact that it can make the necessary transformations
much easier, I thought others would find these tools to be useful and 
accessible.

Later on, more models I was interested in became fairly straightforward to add
to the package. GEE estimation of the within-between model may be desirable in
some cases, for instance (McNeish, 2019). I wanted to fit asymmetric effects
models that allow positive and negative changes in variables to differ (Allison, 2019).
I was also able to implement a better method for calculating interactions in 
within-between models (Giesselmann & Schmidt-Catran, 2018). Get the details on 
these things in the [introductory vignette](https://panelr.jacob-long.com/articles/wbm.html).

In general, `plm` has a lot more stuff. For instance, for fixed effects models
there are many different methods for calculating standard errors included 
rather painlessly with `plm`. In the mutlilevel modeling framework for 
`panelr`'s `wbm()` function, the multilevel model inherently deals with the 
within-entity correlation of errors, but you are limited if you would like 
different kinds of adjustments (GEE estimation offers some more flexibility). 
`plm` also includes many tests of various model assumptions, like the Hausman
test (which can be replicated on a per-coefficient basis in the within-between
model). `plm` has many tools for including instrumental variables, but `panelr`
has none and I don't foresee any being added in the near future.

Overall, I am not motivated to duplicate features of `plm` *just for the sake of
feature parity*. There are some models which are nearly or exactly equivalent
across the two packages, but this is just a happy coincidence. I will expand
`panelr` as is prudent, which may sometimes involve duplication of `plm` 
functionality but only for reasons relating to substantive differences in 
implementation. As an example, `panelr` includes the function `are_varying()`
that allows the user to assess whether variables vary over time. 
It is substantively equivalent to `plm`'s `pvar()`, but I was motivated to 
give users a means for asking for specific variables using a "tidy" selection
interface. Although I would not generally promise that my packages are highly 
performant, I later realized that `are_varying()` is much faster than `pvar()`,
which can be quite noticeable for larger datasets. 

This is just to say that there may be cases in which `panelr` does something 
very similar, and it may sometimes be better or different in a way that you 
would prefer. But I generally see `panelr` as a complementary package, filling in 
some gaps and giving an alternative way to do panel data analysis in R.

### References

Allison, P. D. (2009). Fixed effects regression models. Thousand Oaks, CA: SAGE Publications. https://doi.org/10.4135/9781412993869.d33

Allison, P. D. (2019). Asymmetric fixed-effects models for panel data. *Socius*,
*5*, 1–12. https://doi.org/10.1177/2378023119826441

Bell, A., & Jones, K. (2015). Explaining fixed effects: Random effects modeling
of time-series cross-sectional and panel data. *Political Science Research and
Methods*, *3*, 133–153. https://doi.org/10.1017/psrm.2014.7

Giesselmann, M., & Schmidt-Catran, A. (2018). Interactions in fixed effects 
regression models (Discussion Papers of DIW Berlin No. 1748). DIW Berlin, 
German Institute for Economic Research. Retrieved from
https://ideas.repec.org/p/diw/diwwpp/dp1748.html

Hofmann, D. A., & Gavin, M. B. (1998). Centering decisions in hierarchical 
linear models: Implications for research in organizations. *Journal of 
Management*, *24*, 623–641. https://doi.org/10.1177/014920639802400504

Kreft, I. G. G., de Leeuw, J., & Aiken, L. S. (1995). The effect of different 
forms of centering in hierarchical linear models. *Multivariate Behavioral 
Research*, *30*, 1–21. https://doi.org/10.1207/s15327906mbr3001_1

McNeish, D. (2019). Effect partitioning in cross-sectionally clustered data 
without multilevel models. *Multivariate Behavioral Research*, 1–20. https://doi.org/10.1080/00273171.2019.1602504

Mundlak, Y. (1978). On the pooling of time series and cross section data.
*Econometrica*, *46*, 69–85. https://doi.org/10.2307/1913646

Raudenbush, S. W., & Bryk, A. S. (2002). Hierarchical linear models: 
Applications and data analysis methods (2nd ed). Thousand Oaks, CA: Sage.


[^caveat]: Conventionally, one also subtracts the individual means from the occasion-level predictor values, as one often does to estimate fixed effects models via OLS. This is not strictly necessary, though.
