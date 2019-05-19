# A modified plot hook

hook <- function(x, options) {
  require(glue)
  
  width <- height <- ''
  if (!is.null(options$out.width))
    width <- sprintf(' width = "%s" ', options$out.width)
  if (!is.null(options$out.height))
    height <- sprintf(' height = "%s" ', options$out.height)
  
  basename <- paste(x, collapse = '.')
  # cat(basename, " \n")
  # basename <- unlist(regmatches(x, regexec("[^\\/]+$", x)))
  # cat(basename, " \n")
  # paste(x, collapse = '.')
  # filename <- paste0("/img/", basename)
  
  if (!is.null(options$fig.cap)) {
    caption <- options$fig.cap
  } else {
    caption <- ""
  }
  
  #convert_plots(basename)
  
  #paste0("<figure>", imglink, "<figcaption>", caption, "</figcaption></figure>")
  glue("{{< figure src=\"", "[basename]", "\"",
       # " caption = \"", "[caption]", "\" >}}",
       ">}}",
       .open = "[", .close = "]")
  
}