+++
# Projects widget.
# Note: this widget will only display if `content/project/` contains projects.
widget = "projects"
active = true

title = "Software"
subtitle = ""

# Order that this section will appear in.
weight = 4

# Content.
# Display content from the following folder.
# For example, `folder = "project"` displays content from `content/project/`.
folder = "project"

# View.
#   1 = List
#   3 = Card
#   5 = Showcase
view = 1

# Widget layout
# Legend: 0 = two columns (default), 1 = single column
widget_layout = 0

# For Showcase view, flip alternate rows?
flip_alt_rows = false

# Default filter index (e.g. 0 corresponds to the first `[[filter]]` instance below).
filter_default = 0

# Filter toolbar.
# Add or remove as many filters (`[[filter]]` instances) as you like.
# Use "*" tag to show all projects or an existing tag prefixed with "." to filter by specific tag.
# To remove toolbar, delete/comment all instances of `[[filter]]` below.

[[filter]]
  name = "R Packages"
  tag = "RPackages"

[[filter]]
  name = "Other"
  tag = "Other"

[[filter]]
  name = "All"
  tag = "*"

+++