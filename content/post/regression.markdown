---
author: admin
categories:
- R
date: "2018-01-12"
draft: true
math: true
slug: understanding-ols-regression-via-matrix-operations-a-walkthrough-in-r
tags:
- R
- statistics
title: 'Understanding OLS regression via matrix operations: A walkthrough in R'
---

There is more than one way to express the underlying mathematics behind linear
regression. The way you would want to do that depends on what the goal is. 
When you want to teach social scientists to do applied statistics, you want to
describe the "black box" only to the extent that the user understands what their
software is doing for them. 

When I was introduced to linear regression, I was given lots of summations.

You start with the fact you're going to have an equation, like

$\hat{Y} = \alpha + \beta_1 x_1 + ... + \beta_p x_p + e$

Where Y is the dependent variable, each x is a predictor, alpha ($\alpha$) is
the intercept, e is the error, and p is the number of predictors. Our problem,
then, is we don't know what the betas ($\beta$) are.

We're told that we will find out the betas by minimizing this sum:

$\sum{(Y_i-\hat{Y_i})^2}$




```r
head(mtcars)
```

```
##                    mpg cyl disp  hp drat    wt  qsec vs am gear carb
## Mazda RX4         21.0   6  160 110 3.90 2.620 16.46  0  1    4    4
## Mazda RX4 Wag     21.0   6  160 110 3.90 2.875 17.02  0  1    4    4
## Datsun 710        22.8   4  108  93 3.85 2.320 18.61  1  1    4    1
## Hornet 4 Drive    21.4   6  258 110 3.08 3.215 19.44  1  0    3    1
## Hornet Sportabout 18.7   8  360 175 3.15 3.440 17.02  0  0    3    2
## Valiant           18.1   6  225 105 2.76 3.460 20.22  1  0    3    1
```


```r
y <- mtcars$qsec
x1 <- mtcars$hp
x0 <- rep(1, nrow(mtcars))

x <- cbind(x0,x1)
```




```r
t(x) %*% x
```

```
##      x0     x1
## x0   32   4694
## x1 4694 834278
```


```r
solve(t(x) %*% x) %*% t(x) %*% y
```

```
##           [,1]
## x0 20.55635402
## x1 -0.01845831
```



```r
lm(qsec ~ hp, data = mtcars)
```

```
## 
## Call:
## lm(formula = qsec ~ hp, data = mtcars)
## 
## Coefficients:
## (Intercept)           hp  
##    20.55635     -0.01846
```



```r
x2 <- mtcars$wt
x1 <- mtcars$hp
x0 <- rep(1, nrow(mtcars))

x <- cbind(x0,x1,x2)
```




```r
t(x) %*% x
```

```
##          x0        x1         x2
## x0   32.000   4694.00   102.9520
## x1 4694.000 834278.00 16471.7440
## x2  102.952  16471.74   360.9011
```


```r
b <- solve(t(x) %*% x) %*% t(x) %*% y
b
```

```
##           [,1]
## x0 18.82558525
## x1 -0.02730962
## x2  0.94153237
```




```r
yhat <- x %*% b
head(yhat)
```

```
##          [,1]
## [1,] 18.28834
## [2,] 18.52843
## [3,] 18.47015
## [4,] 18.84855
## [5,] 17.28527
## [6,] 19.21578
```


```r
resids <- y - yhat
```



```r
n <- nrow(x)
k <- ncol(x)

sigma2e <- as.numeric(t(resids) %*% resids)/(n-k)
varbetas <- sigma2e * solve(t(x) %*% x)
```


```r
round(varbetas, 3)
```

```
##        x0     x1     x2
## x0  0.451  0.000 -0.130
## x1  0.000  0.000 -0.001
## x2 -0.130 -0.001  0.071
```

```r
round(vcov(lm(y ~ 0 + x0 + x1 + x2)),3)
```

```
##        x0     x1     x2
## x0  0.451  0.000 -0.130
## x1  0.000  0.000 -0.001
## x2 -0.130 -0.001  0.071
```



```r
sqrt(diag(varbetas))
```

```
##          x0          x1          x2 
## 0.671867025 0.003794603 0.265896975
```

```r
sum <- summary(lm(y ~ 0 + x0 + x1 + x2))
coef(sum)[,"Std. Error"]
```

```
##          x0          x1          x2 
## 0.671867025 0.003794603 0.265896975
```

## Huber-White SE


```r
resids <- as.vector(resids)

eeprime <- diag(resids^2)

xprimexinv <- solve(t(x) %*% x)

vcov_robust <- xprimexinv %*% t(x) %*% eeprime %*% x %*% xprimexinv
round(vcov_robust,3)
```

```
##        x0     x1     x2
## x0  0.219  0.000 -0.027
## x1  0.000  0.000 -0.001
## x2 -0.027 -0.001  0.039
```

```r
hc0_ses <- sqrt(diag(vcov_robust))

hc1_ses <- sqrt(nrow(x))/sqrt(nrow(x) - ncol(x)) * hc0_ses


sigma2e_I <- sigma2e * diag(length(resids))
vcov_std <- xprimexinv %*% t(x) %*% sigma2e_I %*% x %*% xprimexinv
round(vcov_std, 3)
```

```
##        x0     x1     x2
## x0  0.451  0.000 -0.130
## x1  0.000  0.000 -0.001
## x2 -0.130 -0.001  0.071
```

```r
std_ses <- sqrt(diag(vcov_std))

hc0_ses
```

```
##          x0          x1          x2 
## 0.468174426 0.004127259 0.197203991
```

```r
std_ses
```

```
##          x0          x1          x2 
## 0.671867025 0.003794603 0.265896975
```


```r
library(jtools)
j_summ(lm(y ~ 0 + x0 + x1 + x2))
```

```
## MODEL INFO:
## Observations: 32
## Dependent Variable: y
## 
## MODEL FIT: 
## F(3,29) = 2879.1, p = 0
## R-squared = 1
## Adj. R-squared = 1
## 
## Standard errors: OLS 
##     Est. S.E. t val. p    
## x0 18.83 0.67  28.02 0 ***
## x1 -0.03 0     -7.2  0 ***
## x2  0.94 0.27   3.54 0  **
```

```r
j_summ(lm(y ~ 0 + x0 + x1 + x2), robust = T, robust.type = "HC1")
```

```
## MODEL INFO:
## Observations: 32
## Dependent Variable: y
## 
## MODEL FIT: 
## F(3,29) = 2879.1, p = 0
## R-squared = 1
## Adj. R-squared = 1
## 
## Standard errors: Robust, type = HC1
##     Est. S.E. t val. p    
## x0 18.83 0.49  38.28 0 ***
## x1 -0.03 0     -6.3  0 ***
## x2  0.94 0.21   4.55 0 ***
```







