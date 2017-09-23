+++
title = "Here's how to use APA style in Zotero without issue numbers"
date = 2017-09-23T16:10:13-04:00
draft = true

math = false
highlight = true
tags = ["zotero", "APA"]
categories = ["Tools"]

photoswipe = false

# Optional featured image (relative to `static/img/` folder).
[header]
image = ""
caption = ""

+++

Zotero is a major part of my workflow from gathering research to the final,
written output. One major annoyance, though, is its interpretation of APA
reference style. It's all correct, of course, with one exception: It adds
the issue number to every journal citation.

APA style holds that you should not include the issue numbers. The sole
exception to this rule, which is admittedly asinine, are journals which
paginate by issue rather than volume[^1]. That is, some journal start every issue
at page 1, so the page numbers of any given article are not all that helpful
without knowing the issue. Unfortunately, the vast majority of journals in the
fields that use APA style do *not* paginate by issue, so the vast majority
of the time you do not need to include the issue number[^2].

Zotero has made
[the decision](https://forums.zotero.org/discussion/32375/apa-issue-number/)
to *always* include the issue number in the official
APA style included with the default installation. There's no reasonable way for
the format to know which journals do and don't paginate this way, but for most
users of the style it means the outputted format will almost always be
technically incorrect since most will only be citing journals
that do not need the issue number included.

I had been just deleting the issue numbers in my Zotero library to fix this
before I realized there's a better way of dealing with it without ruining my
library for the time that issue numbers become required again (like they were
for a time at the end of the APA 5th edition era).

I've just made a slight tweak to the style that prevents it from outputting the
issue numbers. You can download the modified style by
[clicking here](/misc/apa-no-issue-numbers.csl).

To add it to Zotero, go to preferences, then the "Cite" tab, and click the
plus sign.
Navigate to the `apa-no-issue-numbers.csl` file you just downloaded and add the
style. Next time you use Zotero to format the references in a document, just
choose that style instead of the regular APA version.

[^1]: See the comments [here](http://blog.apastyle.org/apastyle/2011/10/how-to-determine-whether-a-periodical-is-paginated-by-issue.html) for more back and forth on the terrible-ness of this aspect of the APA 6th style guide.
[^2]: Unless of course you come from one of the fields that predominantly uses journals paginated by issue, in which case I wonder how you ended up on this blog post.
