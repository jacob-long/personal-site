library(rmarkdown)
library(xfun)

render_and_process <- function(input_file) {
  # Render the document
  render(input_file, output_format = blogdown::html_page(toc = TRUE))
  
  # Get the base filename without extension
  base_name <- tools::file_path_sans_ext(basename(input_file))
  output_file <- paste0(base_name, ".html")
  
  # Read the generated HTML
  html_content <- xfun::read_utf8(output_file)
  
  # Extract YAML frontmatter from the Rmd file
  rmd_content <- xfun::read_utf8(input_file)
  yaml_start <- which(rmd_content == "---")[1]
  yaml_end <- which(rmd_content == "---")[2]
  yaml_content <- rmd_content[yaml_start:yaml_end]
  
  # Move library files
  local_lib <- paste0(base_name, "_files")
  if (dir.exists(local_lib)) {
    target_lib <- "../../static/rmarkdown-libs"
    dir.create(target_lib, recursive = TRUE, showWarnings = FALSE)
    file.copy(local_lib, target_lib, recursive = TRUE)
    unlink(local_lib, recursive = TRUE)
  }
  
  # Update references in HTML content
  html_content <- gsub(paste0(base_name, "_files"), "/rmarkdown-libs", html_content)
  
  # Combine YAML frontmatter and adjusted HTML content
  final_content <- c(yaml_content, "", html_content)
  
  # Write the modified content back to the file
  xfun::write_utf8(final_content, output_file)
  
  cat("Rendering and processing complete for", input_file, "\n")
}