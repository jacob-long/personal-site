# Global things sourced in each blogpost
source(rprojroot::find_rstudio_root_file("helpers.R"))

#### Plot output ####

# Set hook defined in helpers.R
knitr::knit_hooks$set(plot = hook)